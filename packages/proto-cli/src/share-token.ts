import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Crockford base32 (no I, L, O, U). The token guards access to a shared prototype,
// so it must be unguessable: a CSPRNG-picked index and a wide value space
// (32^12 ≈ 1.2e18 — not enumerable) rather than a memorable code.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SHARE_TOKEN_LENGTH = 12;

// `pick(max)` returns an integer in [0, max). Defaults to crypto.randomInt;
// tests inject a deterministic picker.
export function generateToken(pick: (max: number) => number = randomInt): string {
  let token = '';
  for (let i = 0; i < SHARE_TOKEN_LENGTH; i++) token += ALPHABET[pick(ALPHABET.length)];
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

export type GetOrCreateTokenDeps = { fs?: ShareTokenFs; pick?: (max: number) => number };

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
      if (typeof token === 'string' && token.length === SHARE_TOKEN_LENGTH) return token;
    } catch {
      // corrupt — fall through and mint a fresh one
    }
  }

  const token = generateToken(deps.pick);
  fs.mkdirSync(path.join(root, '.proto'), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ token }, null, 2)}\n`);
  return token;
}
