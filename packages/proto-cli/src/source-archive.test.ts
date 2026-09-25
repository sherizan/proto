import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SOURCE_MAX_BYTES, archiveProject, extractProject } from './source-archive.js';

const tmp: string[] = [];
afterEach(() => {
  for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function fakeProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-src-'));
  tmp.push(root);
  const write = (rel: string, body = 'x') => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  };
  write('proto.config.js', 'module.exports = { name: "Atlas" }');
  write('screens/Home.tsx');
  write('app/_layout.tsx');
  write('components/proto/Button.tsx');
  write('assets/icon.png');
  write('package.json', '{}');
  write('.proto/expo-config/app.json', '{}');
  // must NOT travel
  write('.proto/share.json', '{"token":"XK92MABCDEFG"}');
  write('.proto/cache/junk');
  write('node_modules/react/index.js');
  write('.expo/settings.json');
  write('.git/HEAD');
  write('ios/Pods/x');
  write('dist/bundle.js');
  return root;
}

describe('archiveProject / extractProject', () => {
  it('round-trips the project without node_modules, caches, git, builds, or the share token', async () => {
    const root = fakeProject();
    const out = path.join(root, '..', `${path.basename(root)}.tgz`);
    tmp.push(out);

    const res = await archiveProject(root, out);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.bytes).toBeGreaterThan(0);

    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-remix-'));
    tmp.push(dest);
    await extractProject(out, dest);

    const has = (rel: string) => fs.existsSync(path.join(dest, rel));
    for (const kept of [
      'proto.config.js',
      'screens/Home.tsx',
      'app/_layout.tsx',
      'components/proto/Button.tsx',
      'assets/icon.png',
      'package.json',
      '.proto/expo-config/app.json',
    ])
      expect(has(kept), kept).toBe(true);
    for (const dropped of [
      '.proto/share.json',
      '.proto/cache',
      'node_modules',
      '.expo',
      '.git',
      'ios',
      'dist',
    ])
      expect(has(dropped), dropped).toBe(false);
  });

  it('refuses an archive over the size cap', async () => {
    const root = fakeProject();
    fs.writeFileSync(path.join(root, 'assets/big.bin'), Buffer.alloc(2048, 7));
    const out = path.join(root, '..', `${path.basename(root)}-big.tgz`);
    tmp.push(out);
    const res = await archiveProject(root, out, { maxBytes: 1024 });
    expect(res).toEqual({ ok: false, reason: 'too-big' });
    expect(fs.existsSync(out)).toBe(false);
    expect(SOURCE_MAX_BYTES).toBe(45 * 1024 * 1024);
  });
});
