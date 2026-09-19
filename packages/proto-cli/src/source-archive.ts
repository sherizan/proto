import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The project's source for remix: everything a teammate needs to run it, minus
// installs, caches, git, native builds, and this project's share token (the
// remix gets its own link). tar ships with macOS, so no dependency.

/** Anything bigger than this can't be remixed; the link still publishes. */
export const SOURCE_MAX_BYTES = 45 * 1024 * 1024;

const EXCLUDES = [
  'node_modules',
  '.expo',
  '.metro-cache',
  '.git',
  'ios',
  'android',
  'dist',
  '.proto/cache',
  '.proto/share.json',
  '.proto/last-shot.png',
  '.proto/metro-errors.json',
  '.proto/tsconfig.mcp.json',
  '.DS_Store',
];

export type ArchiveResult =
  | { ok: true; bytes: number }
  | { ok: false; reason: 'too-big' | 'failed' };

function tar(args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('tar', args, { stdio: 'ignore' });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

/** Write `<root>` as a gzipped tarball to `outFile`. */
export async function archiveProject(
  root: string,
  outFile: string,
  opts: { maxBytes?: number } = {},
): Promise<ArchiveResult> {
  const max = opts.maxBytes ?? SOURCE_MAX_BYTES;
  const args = ['-czf', outFile, '-C', root];
  for (const e of EXCLUDES) args.push(`--exclude=./${e}`);
  args.push('.');
  const code = await tar(args);
  if (code !== 0) {
    try {
      fs.rmSync(outFile, { force: true });
    } catch {}
    return { ok: false, reason: 'failed' };
  }
  const bytes = fs.statSync(outFile).size;
  if (bytes > max) {
    fs.rmSync(outFile, { force: true });
    return { ok: false, reason: 'too-big' };
  }
  return { ok: true, bytes };
}

/** Unpack a tarball made by archiveProject into `dest` (created if missing). */
export async function extractProject(file: string, dest: string): Promise<void> {
  fs.mkdirSync(dest, { recursive: true });
  const code = await tar(['-xzf', file, '-C', dest]);
  if (code !== 0) throw new Error(`tar exited ${code}`);
}

/** archiveProject into a temp file and hand back the bytes (what `proto share` uploads). */
export async function archiveProjectBytes(
  root: string,
): Promise<{ ok: true; bytes: Buffer } | { ok: false; reason: 'too-big' | 'failed' }> {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'proto-source-')), 'source.tgz');
  try {
    const res = await archiveProject(root, file);
    if (!res.ok) return res;
    return { ok: true, bytes: fs.readFileSync(file) };
  } finally {
    try {
      fs.rmSync(path.dirname(file), { recursive: true, force: true });
    } catch {}
  }
}
