import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { shareRuntimeVersion } from './share-config.js';

// Publishing a shared prototype = self-host its bundle. We run `expo export`,
// precompute a conformant expo-updates manifest (hashes + keys), and upload the
// bundle + assets + manifest.json to prototo.app (POST /api/publish → signed
// Storage URLs). The recipient's dev client then loads it from
// prototo.app/api/manifest/<token>. No EAS, no EXPO_TOKEN — the designer only
// authenticates to their prototo account. See prototo-website lib/bundle.ts for the
// server side; validated on-device.

const API_BASE_DEFAULT = 'https://prototo.app';

export type PublishUpdateInput = {
  root: string; // the prototype project directory
  token: string; // the share token (= the storage/manifest token)
  accountToken: string; // the prototo account token (Bearer) from `proto login`
  baseUrl?: string;
  // The project's source tarball (see source-archive) so teammates can remix it.
  // Optional: too-big or failed archives still publish the link.
  source?: Uint8Array;
  // A scaled screenshot of the running prototype (see preview-shot), stored as
  // `preview.png` next to the bundle for the share page + social card.
  preview?: Uint8Array;
  // The share page's Screens section (see share-flow): flow.json + screen-*.png.
  // Dropped (and the publish retried once) if the server rejects the paths.
  flow?: { uploadPath: string; bytes: Uint8Array; contentType: string }[];
};

export type PublishUpdateResult =
  | {
      ok: true;
      deepLink: string;
      runtimeVersion: string;
      hasSource: boolean;
      hasPreview: boolean;
      hasFlow: boolean;
    }
  | { ok: false; error: string };

// --- injectable seams (tests supply fakes) --------------------------------------

export type PublishDeps = {
  // Run `expo export` into outDir; resolves the exit code + captured stderr.
  runExport: (root: string, outDir: string) => Promise<{ code: number; stderr: string }>;
  fetch: typeof fetch;
  // PUT a file to a signed Storage URL; resolves the HTTP status.
  uploadFile: (url: string, body: Uint8Array, contentType: string) => Promise<number>;
};

// --- manifest building ----------------------------------------------------------

const base64url = (b: Buffer): string =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha256 = (b: Buffer): string => base64url(crypto.createHash('sha256').update(b).digest());
const md5 = (b: Buffer): string => crypto.createHash('md5').update(b).digest('hex');

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  json: 'application/json',
  mp4: 'video/mp4',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  lottie: 'application/json',
};
const contentTypeFor = (ext: string): string =>
  CONTENT_TYPES[ext.toLowerCase()] ?? 'application/octet-stream';

type ExportMetadata = {
  fileMetadata?: { ios?: { bundle?: string; assets?: Array<{ path: string; ext: string }> } };
};

type UploadFile = { uploadPath: string; bytes: Buffer; contentType: string };

/**
 * The prototype's resolved expo config — the scaffold's `app.config.js` is
 * `module.exports = require('./.proto/expo-config/app.json')`, so reading the
 * managed file IS the resolved config (fall back to a plain `app.json`).
 * Embedded into the manifest as `extra.expoClient` so `Constants.expoConfig`
 * exists at runtime — without it expo-linking (via expo-router) crashes with
 * "needs access to the expo-constants manifest" on every shared prototype.
 * Exported for tests. Returns null when no config is found.
 */
export function readShareExpoConfig(root: string): Record<string, unknown> | null {
  for (const file of [
    path.join(root, '.proto', 'expo-config', 'app.json'),
    path.join(root, 'app.json'),
  ]) {
    try {
      const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as { expo?: Record<string, unknown> };
      if (doc.expo && typeof doc.expo === 'object') return doc.expo;
    } catch {
      // missing/unparsable → try the next candidate
    }
  }
  return null;
}

/**
 * Read an `expo export` dist and produce the manifest + the list of objects to
 * upload. Asset storage keys are the md5 of each file's bytes (the client
 * references assets by this key); the launch bundle lands at `bundle`. Exported for
 * tests. Throws if the export has no iOS bundle.
 */
export function buildBundle(
  distDir: string,
  metadata: ExportMetadata,
  expoConfig: Record<string, unknown> | null,
  runtimeVersion: string,
): {
  manifest: unknown;
  files: UploadFile[];
} {
  const ios = metadata.fileMetadata?.ios;
  if (!ios?.bundle) throw new Error('export has no iOS bundle');

  const bundleBytes = fs.readFileSync(path.join(distDir, ios.bundle));
  // Content-addressed like the assets (NOT the mutable `bundle` path): on a
  // re-publish, a manifest must only ever reference objects its own run
  // uploaded — a fixed path let interleaved/partial publishes pair a new
  // manifest with an old bundle (hash mismatch = share never loads).
  const bundleKey = md5(bundleBytes);
  const files: UploadFile[] = [
    {
      uploadPath: `assets/${bundleKey}`,
      bytes: bundleBytes,
      contentType: 'application/javascript',
    },
  ];
  const launchAsset = {
    hash: sha256(bundleBytes),
    key: bundleKey,
    contentType: 'application/javascript',
    storagePath: `assets/${bundleKey}`,
  };

  const assets = (ios.assets ?? []).map((a) => {
    const bytes = fs.readFileSync(path.join(distDir, a.path));
    const key = md5(bytes);
    const contentType = contentTypeFor(a.ext);
    files.push({ uploadPath: `assets/${key}`, bytes, contentType });
    return { hash: sha256(bytes), key, contentType, fileExtension: `.${a.ext}` };
  });

  const manifest = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    runtimeVersion,
    launchAsset,
    assets,
    metadata: {},
    // expo-updates hydrates Constants.expoConfig from extra.expoClient (newer
    // runtimes also read extra.expoConfig — set both). Empty extra = null
    // expoConfig = expo-linking crash in every viewer.
    extra: expoConfig ? { expoClient: expoConfig, expoConfig } : {},
  };
  return { manifest, files };
}

// --- orchestration --------------------------------------------------------------

function resolveBase(baseUrl?: string): string {
  if (baseUrl) return baseUrl;
  const env = process.env.PROTO_SHARE_API_BASE;
  return env && env.length > 0 ? env : API_BASE_DEFAULT;
}

/**
 * Export, upload, and return the recipient deep link. Any failure resolves to
 * `{ ok: false, error }` — the caller maps it to a designer-friendly message.
 */
export async function publishUpdate(
  input: PublishUpdateInput,
  deps: PublishDeps = defaultDeps,
): Promise<PublishUpdateResult> {
  const runtimeVersion = shareRuntimeVersion(input.root);
  const base = resolveBase(input.baseUrl);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-export-'));
  try {
    const exp = await deps.runExport(input.root, outDir);
    if (exp.code !== 0) {
      return { ok: false, error: exp.stderr.trim() || `expo export exited ${exp.code}` };
    }

    let metadata: ExportMetadata;
    try {
      metadata = JSON.parse(fs.readFileSync(path.join(outDir, 'metadata.json'), 'utf8'));
    } catch {
      return { ok: false, error: 'export produced no metadata' };
    }

    let manifest: unknown;
    let files: UploadFile[];
    try {
      ({ manifest, files } = buildBundle(
        outDir,
        metadata,
        readShareExpoConfig(input.root),
        runtimeVersion,
      ));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'could not read export' };
    }
    const manifestFile: UploadFile = {
      uploadPath: 'manifest.json',
      bytes: Buffer.from(JSON.stringify(manifest)),
      contentType: 'application/json',
    };

    if (input.preview) {
      files.push({
        uploadPath: 'preview.png',
        bytes: Buffer.from(input.preview),
        contentType: 'image/png',
      });
    }
    const flowFiles: UploadFile[] = (input.flow ?? []).map((f) => ({
      uploadPath: f.uploadPath,
      bytes: Buffer.from(f.bytes),
      contentType: f.contentType,
    }));
    // Ask for signed upload URLs for every object.
    const requestUrls = (withFlow: boolean) =>
      deps.fetch(`${base}/api/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.accountToken}`,
        },
        body: JSON.stringify({
          token: input.token,
          paths: [
            ...files.map((f) => f.uploadPath),
            ...(withFlow ? flowFiles.map((f) => f.uploadPath) : []),
            'manifest.json',
          ],
          ...(input.source ? { source: true } : {}),
        }),
      });
    let hasFlow = flowFiles.length > 0;
    let uploads: Record<string, string>;
    let sourceUpload: string | undefined;
    try {
      let res = await requestUrls(hasFlow);
      // A website that predates the Screens section rejects the new paths:
      // publish the prototype without them rather than fail the link.
      if (res.status === 400 && hasFlow) {
        hasFlow = false;
        res = await requestUrls(false);
      }
      if (res.status === 401) return { ok: false, error: 'unauthorized' };
      // Post-relaunch a 403 here only means the Free Publish trial has ended
      // (the server gates before minting upload URLs).
      if (res.status === 403) return { ok: false, error: 'trial-expired' };
      if (res.status === 409) return { ok: false, error: 'owner-mismatch' };
      if (!res.ok) return { ok: false, error: `publish request failed (${res.status})` };
      const json = (await res.json()) as {
        uploads?: Record<string, string>;
        sourceUpload?: string;
      };
      if (!json.uploads) return { ok: false, error: 'no upload urls' };
      uploads = json.uploads;
      sourceUpload = json.sourceUpload;
    } catch {
      return { ok: false, error: 'network' };
    }

    // Upload assets + bundle first, manifest.json last (so a manifest never points
    // at a not-yet-uploaded asset). The source archive rides between them: a
    // failed source upload doesn't cost the link, the share just isn't remixable.
    let hasSource = false;
    for (const f of [...files, ...(hasFlow ? flowFiles : []), manifestFile]) {
      if (f === manifestFile && input.source && sourceUpload) {
        try {
          const status = await deps.uploadFile(sourceUpload, input.source, 'application/gzip');
          hasSource = status >= 200 && status < 300;
        } catch {
          hasSource = false;
        }
      }
      const url = uploads[f.uploadPath];
      if (!url) return { ok: false, error: `missing upload url for ${f.uploadPath}` };
      let status: number;
      try {
        status = await deps.uploadFile(url, f.bytes, f.contentType);
      } catch {
        return { ok: false, error: 'upload failed' };
      }
      if (status < 200 || status >= 300) return { ok: false, error: `upload failed (${status})` };
    }

    const deepLink = `prototo://expo-development-client/?url=${base}/api/manifest/${input.token}`;
    return {
      ok: true,
      deepLink,
      runtimeVersion,
      hasSource,
      hasPreview: !!input.preview,
      hasFlow,
    };
  } finally {
    try {
      fs.rmSync(outDir, { recursive: true, force: true });
    } catch {
      // best-effort temp cleanup
    }
  }
}

// --- default (production) implementations ---------------------------------------

const defaultRunExport: PublishDeps['runExport'] = (root, outDir) =>
  new Promise((resolve) => {
    const child = spawn('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', outDir], {
      cwd: root,
      env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
    });
    let stderr = '';
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    child.stdout?.on('data', () => {});
    child.on('exit', (code) => resolve({ code: code ?? 1, stderr }));
    child.on('error', (e) => resolve({ code: 1, stderr: stderr + String(e) }));
  });

const defaultUploadFile: PublishDeps['uploadFile'] = (url, body, contentType) =>
  new Promise<number>((resolve, reject) => {
    const requestFn = new URL(url).protocol === 'http:' ? httpRequest : httpsRequest;
    const req = requestFn(
      url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'x-upsert': 'true',
          'Content-Length': String(body.byteLength),
        },
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res.statusCode ?? 0));
      },
    );
    req.on('error', reject);
    req.end(Buffer.from(body));
  });

const defaultDeps: PublishDeps = {
  runExport: defaultRunExport,
  fetch,
  uploadFile: defaultUploadFile,
};
