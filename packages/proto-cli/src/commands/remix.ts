import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readCliToken as defaultReadCliToken } from '../cli-token.js';
import { messages } from '../messages.js';
import { type RemixOrigin, writeRemixOrigin } from '../remix-origin.js';
import { ShareApiError, type ShareSourceResponse, fetchSourceDownload } from '../share-api.js';
import { extractProject } from '../source-archive.js';
import { runLogin as defaultRunLogin } from './login.js';

// `proto remix <link> [folder]` — a fork of a teammate's prototype: the source
// they last published, unpacked into a new folder here, with its own share link
// the first time it's shared. No link back, no sync.

const TOKEN_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/;

export type RemixDeps = {
  getCliToken: () => string | null;
  login: () => Promise<string | null>;
  fetchSource: (token: string, accountToken: string) => Promise<ShareSourceResponse>;
  download: (url: string, file: string) => Promise<void>;
  extract: (file: string, dest: string) => Promise<void>;
  install: (dir: string) => Promise<void>;
  exists: (p: string) => boolean;
  /** Drop `.proto/share.json` so the remix mints its own link. */
  removeShareToken: (dir: string) => void;
  /** Record which share this copy came from (`.proto/remix.json`). */
  writeOrigin: (dir: string, origin: RemixOrigin) => void;
  cwd: () => string;
  log: (m: string) => void;
  exit?: (code: number) => void;
};

export type RemixOptions = { target: string | undefined; folder: string | undefined };

/** The 12-char share token from a prototo.app/p/<token> link or a bare code. */
export function parseShareToken(input: string | undefined): string | null {
  if (!input) return null;
  const clean = input.trim().split(/[?#]/)[0] ?? '';
  const last = clean.split('/').filter(Boolean).pop() ?? '';
  const token = last.toUpperCase();
  return TOKEN_RE.test(token) ? token : null;
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'prototype'
  );
}

/**
 * pnpm ≥ 9 exits 1 when a dependency's build script isn't on the project's
 * allowlist (ERR_PNPM_IGNORED_BUILDS) even though everything installed. That's
 * the state of any project that gained a native library after scaffolding, so
 * it can't count as a failed remix.
 */
export function installSucceeded(code: number | null, output: string): boolean {
  if (code === 0) return true;
  return /ERR_PNPM_IGNORED_BUILDS/.test(output);
}

function mapError(err: unknown): string {
  if (err instanceof ShareApiError) {
    if (err.kind === 'unauthorized') return messages.shareLoginExpired;
    if (err.kind === 'not-on-team') return messages.remixNotOnTeam;
    if (err.kind === 'no-source') return messages.remixNoSource;
    if (err.kind === 'not-found') return messages.remixNotFound;
  }
  return messages.shareApiUnreachable;
}

function buildDefaults(): RemixDeps {
  return {
    getCliToken: () => defaultReadCliToken(),
    login: () => defaultRunLogin(),
    fetchSource: (token, accountToken) => fetchSourceDownload(token, { token: accountToken }),
    download: async (url, file) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download failed (${res.status})`);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    },
    extract: extractProject,
    install: (dir) =>
      new Promise<void>((resolve, reject) => {
        const usePnpm =
          fs.existsSync(path.join(dir, 'pnpm-lock.yaml')) ||
          fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'));
        const child = spawn(usePnpm ? 'pnpm' : 'npm', ['install'], {
          cwd: dir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, CI: '1' },
        });
        // pnpm prints its ignored-builds notice on stdout; keep both streams.
        let output = '';
        child.stdout?.on('data', (d) => {
          output += d.toString();
        });
        child.stderr?.on('data', (d) => {
          output += d.toString();
        });
        child.on('exit', (code) =>
          installSucceeded(code, output) ? resolve() : reject(new Error(`install exited ${code}`)),
        );
        child.on('error', reject);
      }),
    exists: (p) => fs.existsSync(p),
    removeShareToken: (dir) => {
      try {
        fs.rmSync(path.join(dir, '.proto', 'share.json'), { force: true });
      } catch {}
    },
    writeOrigin: writeRemixOrigin,
    cwd: () => process.cwd(),
    log: (m) => console.log(m),
    exit: (code) => process.exit(code),
  };
}

export async function runRemix(opts: RemixOptions, injected?: Partial<RemixDeps>): Promise<void> {
  const deps: RemixDeps = { ...buildDefaults(), ...injected };
  const exit = deps.exit ?? (() => {});

  const token = parseShareToken(opts.target);
  if (!token) {
    deps.log(messages.remixBadLink);
    exit(1);
    return;
  }

  let accountToken = deps.getCliToken();
  if (!accountToken) {
    deps.log(messages.shareNeedsLogin);
    accountToken = await deps.login();
    if (!accountToken) return;
  }

  let source: ShareSourceResponse;
  try {
    source = await deps.fetchSource(token, accountToken);
  } catch (err) {
    deps.log(mapError(err));
    exit(1);
    return;
  }

  const folder = opts.folder?.trim() || slug(source.appName);
  const dest = path.join(deps.cwd(), folder);
  if (deps.exists(dest)) {
    deps.log(messages.remixFolderExists(folder));
    exit(1);
    return;
  }

  deps.log(messages.remixStarting(source.appName, source.designerName));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-remix-'));
  const file = path.join(tmpDir, 'source.tgz');
  try {
    await deps.download(source.url, file);
    await deps.extract(file, dest);
    deps.removeShareToken(dest);
    deps.writeOrigin(dest, {
      from: token,
      appName: source.appName,
      designerName: source.designerName,
      at: new Date().toISOString(),
    });
    deps.log(messages.remixInstalling);
    await deps.install(dest);
  } catch {
    deps.log(messages.remixFailed);
    exit(1);
    return;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }

  deps.log(messages.remixDone(source.appName, source.designerName, folder));
}
