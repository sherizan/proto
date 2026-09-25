import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type PublishDeps,
  buildBundle,
  publishFiles,
  publishUpdate,
  readShareExpoConfig,
} from './publish-update.js';

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
    JSON.stringify({
      fileMetadata: { ios: { bundle: bundleRel, assets: [{ path: assetRel, ext: 'png' }] } },
    }),
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
  it('produces a manifest for the given runtime + upload files from an export dist', () => {
    const { manifest, files } = buildBundle(
      tmpDist(),
      {
        fileMetadata: {
          ios: {
            bundle: '_expo/static/js/ios/entry-abc.hbc',
            assets: [{ path: 'assets/aaa111', ext: 'png' }],
          },
        },
        // biome-ignore lint/suspicious/noExplicitAny: test reads through the opaque return
      },
      null,
      'prototo-56',
    ) as { manifest: any; files: any[] };

    expect(manifest.runtimeVersion).toBe('prototo-56');
    expect(typeof manifest.id).toBe('string');
    expect(manifest.launchAsset.contentType).toBe('application/javascript');
    expect(manifest.launchAsset.fileExtension).toBeUndefined();
    expect(manifest.assets[0].contentType).toBe('image/png');
    expect(manifest.assets[0].fileExtension).toBe('.png');
    // base64url hash (no +/=) and md5-hex key
    expect(manifest.assets[0].hash).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(manifest.assets[0].key).toMatch(/^[a-f0-9]{32}$/);

    // uploads: launch bundle + asset are BOTH content-addressed (assets/<md5>) —
    // a fixed `bundle` path let a re-publish pair a new manifest with an old
    // bundle (hash mismatch on-device). The manifest declares where it lives.
    expect(manifest.launchAsset.key).toMatch(/^[a-f0-9]{32}$/);
    expect(manifest.launchAsset.storagePath).toBe(`assets/${manifest.launchAsset.key}`);
    expect(files.map((f) => f.uploadPath)).toEqual([
      `assets/${manifest.launchAsset.key}`,
      `assets/${manifest.assets[0].key}`,
    ]);
  });

  it('throws when the export has no iOS bundle', () => {
    expect(() => buildBundle(tmpDist(), { fileMetadata: { ios: {} } })).toThrow(/no iOS bundle/);
  });

  it('embeds the expo config as extra.expoClient + extra.expoConfig', () => {
    const cfg = { name: 'demo', scheme: 'prototo' };
    const { manifest } = buildBundle(
      tmpDist(),
      { fileMetadata: { ios: { bundle: '_expo/static/js/ios/entry-abc.hbc' } } },
      cfg,
      // biome-ignore lint/suspicious/noExplicitAny: test reads through the opaque return
    ) as { manifest: any };
    // Constants.expoConfig hydrates from extra.expoClient — expo-linking needs
    // `scheme` there or every shared prototype red-screens.
    expect(manifest.extra.expoClient).toEqual(cfg);
    expect(manifest.extra.expoConfig).toEqual(cfg);
  });

  it('leaves extra empty when no config is supplied', () => {
    const { manifest } = buildBundle(tmpDist(), {
      fileMetadata: { ios: { bundle: '_expo/static/js/ios/entry-abc.hbc' } },
      // biome-ignore lint/suspicious/noExplicitAny: test reads through the opaque return
    }) as { manifest: any };
    expect(manifest.extra).toEqual({});
  });
});

describe('readShareExpoConfig', () => {
  it('reads the managed .proto/expo-config/app.json', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-root-test-'));
    tmpDirs.push(root);
    fs.mkdirSync(path.join(root, '.proto', 'expo-config'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.proto', 'expo-config', 'app.json'),
      JSON.stringify({ expo: { name: 'demo', scheme: 'prototo' } }),
    );
    expect(readShareExpoConfig(root)).toEqual({ name: 'demo', scheme: 'prototo' });
  });

  it('falls back to a plain app.json, and null when nothing exists', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-root-test-'));
    tmpDirs.push(root);
    expect(readShareExpoConfig(root)).toBeNull();
    fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({ expo: { scheme: 'other' } }));
    expect(readShareExpoConfig(root)).toEqual({ scheme: 'other' });
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
      deepLink:
        'prototo://expo-development-client/?url=https://prototo.app/api/manifest/XK92MABCDEFG',
      // INPUT.root has no installed expo → the CLI's own SDK is the fallback label.
      runtimeVersion: 'prototo-57',
      hasSource: false,
      hasPreview: false,
    });
    // manifest.json is uploaded last, after the bundle + assets.
    expect(uploaded[uploaded.length - 1]).toBe('https://up/manifest.json');
    expect(uploaded.some((u) => /^https:\/\/up\/assets\/[a-f0-9]{32}$/.test(u))).toBe(true);
  });

  it('fails when the export fails', async () => {
    const { deps } = exportingDeps({
      runExport: async () => ({ code: 1, stderr: 'Metro blew up' }),
    });
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

  it('uploads a manifest carrying the project expo config (scheme)', async () => {
    // real project root with the managed config, like a scaffold
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-root-test-'));
    tmpDirs.push(root);
    fs.mkdirSync(path.join(root, '.proto', 'expo-config'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.proto', 'expo-config', 'app.json'),
      JSON.stringify({ expo: { name: 'demo', scheme: 'prototo' } }),
    );

    const bodies: Record<string, string> = {};
    const { deps } = exportingDeps({
      uploadFile: async (url, body) => {
        bodies[url] = Buffer.from(body).toString();
        return 200;
      },
    });
    const res = await publishUpdate({ ...INPUT, root }, deps);
    expect(res.ok).toBe(true);
    const manifest = JSON.parse(bodies['https://up/manifest.json']);
    expect(manifest.extra.expoClient.scheme).toBe('prototo');
    expect(manifest.extra.expoConfig.scheme).toBe('prototo');
  });
});

describe('publishUpdate — source archive for remix', () => {
  it('asks for a source upload, sends the archive, and reports hasSource', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const { deps, uploaded } = exportingDeps({
      fetch: (async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { token: string; paths: string[] };
        bodies.push(body);
        const uploads = Object.fromEntries(body.paths.map((p) => [p, `https://up/${p}`]));
        return new Response(
          JSON.stringify({ token: body.token, uploads, sourceUpload: 'https://up/source.tgz' }),
          { status: 200 },
        );
      }) as unknown as typeof fetch,
    });
    const res = await publishUpdate({ ...INPUT, source: Buffer.from('tgz') }, deps);
    expect(res).toMatchObject({ ok: true, hasSource: true });
    expect(bodies[0].source).toBe(true);
    // the source goes up before the manifest, so a manifest never outruns it
    expect(uploaded.indexOf('https://up/source.tgz')).toBeLessThan(
      uploaded.indexOf('https://up/manifest.json'),
    );
  });

  it('publishes without source when the server does not offer an upload (older website)', async () => {
    const { deps, uploaded } = exportingDeps();
    const res = await publishUpdate({ ...INPUT, source: Buffer.from('tgz') }, deps);
    expect(res).toMatchObject({ ok: true, hasSource: false });
    expect(uploaded).not.toContain('https://up/source.tgz');
  });

  it('does not ask for a source upload when there is no archive', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const { deps } = exportingDeps({
      fetch: (async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { token: string; paths: string[] };
        bodies.push(body);
        const uploads = Object.fromEntries(body.paths.map((p) => [p, `https://up/${p}`]));
        return new Response(JSON.stringify({ token: body.token, uploads }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    const res = await publishUpdate(INPUT, deps);
    expect(res).toMatchObject({ ok: true, hasSource: false });
    expect(bodies[0].source).toBeUndefined();
  });
});

describe('publishUpdate — preview screenshot', () => {
  it('uploads preview.png before the manifest and reports hasPreview', async () => {
    const bodies: Array<{ paths: string[] }> = [];
    const { deps, uploaded } = exportingDeps({
      fetch: (async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { token: string; paths: string[] };
        bodies.push(body);
        const uploads = Object.fromEntries(body.paths.map((p) => [p, `https://up/${p}`]));
        return new Response(JSON.stringify({ token: body.token, uploads }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    const res = await publishUpdate({ ...INPUT, preview: Buffer.from('png') }, deps);
    expect(res).toMatchObject({ ok: true, hasPreview: true });
    expect(bodies[0].paths).toContain('preview.png');
    expect(uploaded.indexOf('https://up/preview.png')).toBeLessThan(
      uploaded.indexOf('https://up/manifest.json'),
    );
  });

  it('reports hasPreview false when there is no screenshot', async () => {
    const { deps } = exportingDeps();
    expect(await publishUpdate(INPUT, deps)).toMatchObject({ ok: true, hasPreview: false });
  });
});

describe('publishFiles (Flow export, #25)', () => {
  const files = [
    { uploadPath: 'screen-feed.png', bytes: Buffer.from('png'), contentType: 'image/png' },
    { uploadPath: 'flow.json', bytes: Buffer.from('{}'), contentType: 'application/json' },
  ];

  it('asks for URLs for just these files (no manifest) and uploads each', async () => {
    const bodies: Array<{ paths: string[] }> = [];
    const { deps, uploaded } = exportingDeps({
      fetch: (async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { token: string; paths: string[] };
        bodies.push(body);
        const uploads = Object.fromEntries(body.paths.map((p) => [p, `https://up/${p}`]));
        return new Response(JSON.stringify({ token: body.token, uploads }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect(
      await publishFiles(
        { token: INPUT.token, accountToken: 'proto_acct', baseUrl: INPUT.baseUrl, files },
        deps,
      ),
    ).toEqual({ ok: true });
    expect(bodies[0]?.paths).toEqual(['screen-feed.png', 'flow.json']);
    expect(uploaded).toEqual(['https://up/screen-feed.png', 'https://up/flow.json']);
  });

  it('maps the publish gate and owner errors', async () => {
    for (const [status, error] of [
      [401, 'unauthorized'],
      [403, 'trial-expired'],
      [409, 'owner-mismatch'],
    ] as const) {
      const { deps } = exportingDeps({
        fetch: (async () => new Response('', { status })) as unknown as typeof fetch,
      });
      expect(await publishFiles({ token: INPUT.token, accountToken: 'x', files }, deps)).toEqual({
        ok: false,
        error,
      });
    }
  });
});
