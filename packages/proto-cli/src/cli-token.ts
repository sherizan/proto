import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The Prototo API token minted by `proto login`. Server returns it once; we keep
// it on disk in the designer's home (same home as the cached designer name), with
// owner-only perms. Never the project tree — it identifies the account, not a project.
export const CLI_TOKEN_PREFIX = 'proto_';

export type CliTokenFs = {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string) => string;
  mkdirSync: (p: string, opts?: { recursive?: boolean }) => void;
  writeFileSync: (p: string, data: string, opts?: { mode?: number }) => void;
};

const defaultFs: CliTokenFs = {
  existsSync,
  readFileSync: (p) => readFileSync(p, 'utf8'),
  mkdirSync: (p, opts) => {
    mkdirSync(p, opts);
  },
  writeFileSync: (p, data, opts) => writeFileSync(p, data, opts),
};

export type CliTokenDeps = { fs?: CliTokenFs; homedir?: () => string; env?: NodeJS.ProcessEnv };

function tokenFilePath(homedir: () => string): string {
  return path.join(homedir(), '.prototo', 'api-token.json');
}

function isToken(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(CLI_TOKEN_PREFIX);
}

/**
 * The login token, or null if the designer hasn't run `proto login` yet.
 * `PROTO_API_TOKEN` overrides the stored file (handy for CI / scripted shares).
 */
export function readCliToken(deps: CliTokenDeps = {}): string | null {
  const fs = deps.fs ?? defaultFs;
  const homedir = deps.homedir ?? os.homedir;
  const env = deps.env ?? process.env;

  const fromEnv = env.PROTO_API_TOKEN?.trim();
  if (fromEnv && isToken(fromEnv)) return fromEnv;

  const file = tokenFilePath(homedir);
  if (!fs.existsSync(file)) return null;
  try {
    const token = (JSON.parse(fs.readFileSync(file)) as { token?: unknown }).token;
    return isToken(token) ? token : null;
  } catch {
    return null;
  }
}

/** Persist the login token (owner-only perms). */
export function saveCliToken(token: string, deps: CliTokenDeps = {}): void {
  const fs = deps.fs ?? defaultFs;
  const homedir = deps.homedir ?? os.homedir;
  fs.mkdirSync(path.join(homedir(), '.prototo'), { recursive: true });
  fs.writeFileSync(tokenFilePath(homedir), `${JSON.stringify({ token }, null, 2)}\n`, {
    mode: 0o600,
  });
}
