import fs from 'node:fs';
import path from 'node:path';

// `proto upgrade` relinks node_modules (pnpm retargets every package symlink),
// but Metro's persisted file map in os.tmpdir() keeps the old targets and the
// next `proto start` bundles the pre-upgrade store (prototo-shared#94). We
// can't name that cache file (an Expo hash), so upgrade leaves a marker and
// the next start passes `--clear` once.

const MARKER = ['.proto', 'metro-reset'] as const;

export function markMetroReset(root: string): void {
  const file = path.join(root, ...MARKER);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
}

/** True (once) when the last upgrade asked for a cache reset; removes the marker. */
export function takeMetroReset(root: string): boolean {
  const file = path.join(root, ...MARKER);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}
