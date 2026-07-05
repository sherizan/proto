import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildBundle, publishUpdate, type PublishDeps } from './publish-update.js';

// Write a minimal `expo export` dist into `dir` (metadata + launch bundle + 1 asset).
function writeFakeDist(dir: string): void {
  const bundleRel = '_expo/static/js/ios/entry-abc.hbc';
  const assetRel = 'assets/aaa111';
  fs.mkdirSync(path.join(dir, path.dirname(bundleRel)), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, bundleRel), 'BUNDLE-BYTES');
  fs.writeFileSync(path.join(dir, assetRel), 'PNG-BYTES');
  fs.writeFileSync(
    path.join(dir, 'metadata.json'),
    JSON.stringify({ fileMetadata: { ios: { bundle: bundleRel, assets: [{ path: assetRel, ext: 'png' }] } } }),
  );
}

const tmpDirs: string[] = [];
function tmpDist(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-dist-test-'));
  tmpDirs.push(d);
  writeFakeDist(d);
  return d;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('buildBundle', () => {
  it('produces a prototo-56 manifest + upload files from an export dist', () => {
    const { manifest, files } = buildBundle(tmpDist(), {
      fileMetadata: { ios: { bundle: '_expo/static/js/ios/entry-abc.hbc', assets: [{ path: 'assets/aaa111', ext: 'png' }] } },
      // biome-ignore lint/suspicious/noExplicitAny: test reads through the opaque return
    }) as { manifest: any; files: any[] };

    expect(manifest.runtimeVersion).toBe('prototo-56');
    expect(typeof manifest.id).toBe('string');
    expect(manifest.launchAsset.contentType).toBe('application/javascript');
    expect(manifest.launchAsset.fileExtension).toBeUndefined();
    expect(manifest.assets[0].contentType).toBe('image/png');
    expect(manifest.assets[0].fileExtension).toBe('.png');
    // base64url hash (no +/=) and md5-hex key
    expect(manifest.assets[0].hash).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(manifest.assets[0].key).toMatch(/^[a-f0-9]{32}$/);

    // uploads: the launch bundle + one keyed asset; storage key = asset md5.
    expect(files.map((f) => f.uploadPath)).toEqual(['bundle', `assets/${manifest.assets[0].key}`]);
  });

  it('throws when the export has no iOS bundle', () => {
    expect(() => buildBundle(tmpDist(), { fileMetadata: { ios: {} } })).toThrow(/no iOS bundle/);
  });
});

// --- orchestration --------------------------------------------------------------

const INPUT = {
  root: '/tmp/proj',
  token: 'XK92MABCDEFG',
  accountToken: 'proto_acct',
  baseUrl: 'https://prototo.app',
};

function exportingDeps(over: Partial<PublishDeps> = {}): { deps: PublishDeps; uploaded: string[] } {
  const uploaded: string[] = [];
  const deps: PublishDeps = {
    runExport: async (_root, outDir) => {
      writeFakeDist(outDir);
      return { code: 0, stderr: '' };
    },
    fetch: (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { token: string; paths: string[] };
      const uploads = Object.fromEntries(body.paths.map((p) => [p, `https://up/${p}`]));
      return new Response(JSON.stringify({ token: body.token, uploads }), { status: 200 });
    }) as unknown as typeof fetch,
    uploadFile: async (url) => {
      uploaded.push(url);
      return 200;
    },
    ...over,
  };
  return { deps, uploaded };
}

describe('publishUpdate (self-hosted)', () => {
  it('exports, uploads every object, and returns the prototo.app deep link', async () => {
    const { deps, uploaded } = exportingDeps();
    const res = await publishUpdate(INPUT, deps);
    expect(res).toEqual({
      ok: true,
      deepLink: 'prototo://expo-development-client/?url=https://prototo.app/api/manifest/XK92MABCDEFG',
    });
    // manifest.json is uploaded last, after the bundle + assets.
    expect(uploaded[uploaded.length - 1]).toBe('https://up/manifest.json');
    expect(uploaded).toContain('https://up/bundle');
  });

  it('fails when the export fails', async () => {
    const { deps } = exportingDeps({ runExport: async () => ({ code: 1, stderr: 'Metro blew up' }) });
    expect(await publishUpdate(INPUT, deps)).toEqual({ ok: false, error: 'Metro blew up' });
  });

  it('surfaces an unauthorized publish', async () => {
    const { deps } = exportingDeps({
      fetch: (async () => new Response('no', { status: 401 })) as unknown as typeof fetch,
    });
    expect(await publishUpdate(INPUT, deps)).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('surfaces an owner-mismatch publish', async () => {
    const { deps } = exportingDeps({
      fetch: (async () => new Response('no', { status: 409 })) as unknown as typeof fetch,
    });
    expect(await publishUpdate(INPUT, deps)).toEqual({ ok: false, error: 'owner-mismatch' });
  });

  it('fails when an upload does not succeed', async () => {
    const { deps } = exportingDeps({ uploadFile: async () => 500 });
    expect(await publishUpdate(INPUT, deps)).toEqual({ ok: false, error: 'upload failed (500)' });
  });
});
