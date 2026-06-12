import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Crockford base32 (no I, L, O, U) — same alphabet the share API uses.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateToken(rand: () => number = Math.random): string {
  let token = '';
  for (let i = 0; i < 5; i++) token += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return token;
}

export type ShareTokenFs = {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string) => string;
  mkdirSync: (p: string, opts?: { recursive?: boolean }) => void;
  writeFileSync: (p: string, data: string) => void;
};

const defaultFs: ShareTokenFs = {
  existsSync,
  readFileSync: (p) => readFileSync(p, 'utf8'),
  mkdirSync: (p, opts) => {
    mkdirSync(p, opts);
  },
  writeFileSync: (p, data) => writeFileSync(p, data),
};

export type GetOrCreateTokenDeps = { fs?: ShareTokenFs; rand?: () => number };

/**
 * A stable share token per project, persisted in `.proto/share.json`. Re-sharing
 * the same project reuses it, so the `prototo.app/p/<token>` link stays current
 * (it re-publishes to the same EAS Update branch).
 */
export function getOrCreateToken(root: string, deps: GetOrCreateTokenDeps = {}): string {
  const fs = deps.fs ?? defaultFs;
  const file = path.join(root, '.proto', 'share.json');

  if (fs.existsSync(file)) {
    try {
      const token = (JSON.parse(fs.readFileSync(file)) as { token?: string }).token;
      if (typeof token === 'string' && token.length === 5) return token;
    } catch {
      // corrupt — fall through and mint a fresh one
    }
  }

  const token = generateToken(deps.rand);
  fs.mkdirSync(path.join(root, '.proto'), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ token }, null, 2)}\n`);
  return token;
}
