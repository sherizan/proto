import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// The central "prototo-share" EAS project — every prototype publishes its share
// here (branch = token), and the dev client loads updates from it. These are
// Prototo-platform constants, not designer-specific.
export const SHARE_PROJECT_ID = '8c8ddf7d-1f6a-4b21-a7cc-116ec4d72c6d';
export const SHARE_SLUG = 'prototo-share';
export const SHARE_RUNTIME_VERSION = 'prototo-56';
export const SHARE_UPDATES_URL = `https://u.expo.dev/${SHARE_PROJECT_ID}`;

export type ShareConfigFs = {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string) => string;
  writeFileSync: (p: string, data: string) => void;
};

const defaultFs: ShareConfigFs = {
  existsSync,
  readFileSync: (p) => readFileSync(p, 'utf8'),
  writeFileSync: (p, data) => writeFileSync(p, data),
};

/**
 * Ensures a prototype's managed expo config (`.proto/expo-config/app.json`) carries
 * the central project identity so `eas update` publishes to the shared project with
 * a compatible runtime. Idempotent. Returns true if it wrote a change. Leaving these
 * values in place is harmless for local dev (`proto start` loads over Metro, not EAS).
 */
export function ensureShareConfig(root: string, deps: { fs?: ShareConfigFs } = {}): boolean {
  const fs = deps.fs ?? defaultFs;
  const file = path.join(root, '.proto', 'expo-config', 'app.json');
  if (!fs.existsSync(file)) return false;

  let doc: { expo?: Record<string, unknown> };
  try {
    doc = JSON.parse(fs.readFileSync(file));
  } catch {
    return false;
  }
  const expo = (doc.expo ??= {}) as Record<string, unknown>;

  const before = JSON.stringify(expo);
  expo.slug = SHARE_SLUG;
  expo.runtimeVersion = SHARE_RUNTIME_VERSION;
  expo.updates = { ...(expo.updates as object), url: SHARE_UPDATES_URL };
  const extra = (expo.extra ??= {}) as Record<string, unknown>;
  extra.eas = { ...(extra.eas as object), projectId: SHARE_PROJECT_ID };

  if (JSON.stringify(expo) === before) return false;
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
  return true;
}
