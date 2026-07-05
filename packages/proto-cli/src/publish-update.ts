import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SHARE_RUNTIME_VERSION } from './share-config.js';

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
};

export type PublishUpdateResult = { ok: true; deepLink: string } | { ok: false; error: string };

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
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
  json: 'application/json', mp4: 'video/mp4', wav: 'audio/wav', mp3: 'audio/mpeg', lottie: 'application/json',
};
const contentTypeFor = (ext: string): string => CONTENT_TYPES[ext.toLowerCase()] ?? 'application/octet-stream';

type ExportMetadata = {
  fileMetadata?: { ios?: { bundle?: string; assets?: Array<{ path: string; ext: string }> } };
};

type UploadFile = { uploadPath: string; bytes: Buffer; contentType: string };

/**
 * Read an `expo export` dist and produce the manifest + the list of objects to
 * upload. Asset storage keys are the md5 of each file's bytes (the client
 * references assets by this key); the launch bundle lands at `bundle`. Exported for
 * tests. Throws if the export has no iOS bundle.
 */
export function buildBundle(distDir: string, metadata: ExportMetadata): {
  manifest: unknown;
  files: UploadFile[];
} {
  const ios = metadata.fileMetadata?.ios;
  if (!ios?.bundle) throw new Error('export has no iOS bundle');

  const bundleBytes = fs.readFileSync(path.join(distDir, ios.bundle));
  const files: UploadFile[] = [
    { uploadPath: 'bundle', bytes: bundleBytes, contentType: 'application/javascript' },
  ];
  const launchAsset = {
    hash: sha256(bundleBytes),
    key: md5(bundleBytes),
    contentType: 'application/javascript',
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
    runtimeVersion: SHARE_RUNTIME_VERSION,
    launchAsset,
    assets,
    metadata: {},
    extra: {},
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
      ({ manifest, files } = buildBundle(outDir, metadata));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'could not read export' };
    }
    const manifestFile: UploadFile = {
      uploadPath: 'manifest.json',
      bytes: Buffer.from(JSON.stringify(manifest)),
      contentType: 'application/json',
    };

    // Ask for signed upload URLs for every object.
    const paths = [...files.map((f) => f.uploadPath), 'manifest.json'];
    let uploads: Record<string, string>;
    try {
      const res = await deps.fetch(`${base}/api/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.accountToken}`,
        },
        body: JSON.stringify({ token: input.token, paths }),
      });
      if (res.status === 401) return { ok: false, error: 'unauthorized' };
      if (res.status === 409) return { ok: false, error: 'owner-mismatch' };
      if (!res.ok) return { ok: false, error: `publish request failed (${res.status})` };
      const json = (await res.json()) as { uploads?: Record<string, string> };
      if (!json.uploads) return { ok: false, error: 'no upload urls' };
      uploads = json.uploads;
    } catch {
      return { ok: false, error: 'network' };
    }

    // Upload assets + bundle first, manifest.json last (so a manifest never points
    // at a not-yet-uploaded asset).
    for (const f of [...files, manifestFile]) {
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
    return { ok: true, deepLink };
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
    const child = spawn(
      'npx',
      ['expo', 'export', '--platform', 'ios', '--output-dir', outDir],
      { cwd: root, env: { ...process.env, EXPO_NO_TELEMETRY: '1' } },
    );
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
