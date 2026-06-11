import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { enumerateScreens, gatherProject } from './share-project.js';

let dirs: string[] = [];

function tmpProject(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-share-'));
  dirs.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return root;
}

afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe('enumerateScreens', () => {
  it('reads screens/*.tsx as {name, source}, sorted by name', () => {
    const root = tmpProject({
      'screens/Home.tsx': 'HOME',
      'screens/Detail.tsx': 'DETAIL',
      'screens/notes.md': 'ignore me',
    });
    expect(enumerateScreens(root)).toEqual([
      { name: 'Detail', source: 'DETAIL' },
      { name: 'Home', source: 'HOME' },
    ]);
  });

  it('returns [] when there is no screens dir', () => {
    expect(enumerateScreens(tmpProject({ 'proto.config.js': 'module.exports={}' }))).toEqual([]);
  });
});

describe('gatherProject', () => {
  it('builds a CompileConfig from proto.config.js + enumerates screens', () => {
    const root = tmpProject({
      'proto.config.js':
        "module.exports = { name: 'Atlas', theme: 'materialYou', colorScheme: 'dark', accentColor: '#FF0000', screens: { initial: 'Home' } };",
      'screens/Home.tsx': 'H',
      'screens/Detail.tsx': 'D',
    });
    const { screens, config } = gatherProject(root);
    expect(screens.map((s) => s.name)).toEqual(['Detail', 'Home']);
    expect(config).toEqual({
      name: 'Atlas',
      initialScreen: 'Home',
      theme: 'materialYou',
      colorScheme: 'dark',
      accentColor: '#FF0000',
    });
  });

  it('falls back initialScreen to the first screen when config omits it', () => {
    const root = tmpProject({
      'proto.config.js': "module.exports = { name: 'X' };",
      'screens/Alpha.tsx': 'A',
    });
    expect(gatherProject(root).config.initialScreen).toBe('Alpha');
  });

  it('ignores an unknown theme value', () => {
    const root = tmpProject({
      'proto.config.js': "module.exports = { name: 'X', theme: 'neon' };",
      'screens/Home.tsx': 'H',
    });
    expect(gatherProject(root).config.theme).toBeUndefined();
  });

  it('throws when name is missing', () => {
    const root = tmpProject({ 'proto.config.js': 'module.exports = {};' });
    expect(() => gatherProject(root)).toThrow();
  });
});
