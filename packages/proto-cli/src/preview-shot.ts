import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A picture of the prototype for the share page, the social card, and the
// library rows: the booted Simulator's screen at publish time, scaled down.
// Best-effort — no Simulator (publishing from a plain terminal later) means no
// picture, and the share falls back to text.

export type PreviewDeps = {
  run: (cmd: string, args: string[]) => string;
  readFile: (file: string) => Buffer;
  cleanup: (dir: string) => void;
};

/** Width of the stored preview. Phone-shaped, sharp enough for a 1200px card. */
export const PREVIEW_WIDTH = 600;

export const defaultPreviewDeps: PreviewDeps = {
  run: (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
  readFile: (f) => fs.readFileSync(f),
  cleanup: (dir) => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  },
};

export async function capturePreview(
  deps: PreviewDeps = defaultPreviewDeps,
  width: number = PREVIEW_WIDTH,
): Promise<{ ok: true; bytes: Buffer } | { ok: false }> {
  try {
    if (!/Booted/.test(deps.run('xcrun', ['simctl', 'list', 'devices', 'booted'])))
      return { ok: false };
  } catch {
    return { ok: false };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-preview-'));
  const file = path.join(dir, 'preview.png');
  try {
    deps.run('xcrun', ['simctl', 'io', 'booted', 'screenshot', file]);
    // macOS ships sips; scale in place (keeps the aspect ratio)
    deps.run('sips', ['--resampleWidth', String(width), file]);
    return { ok: true, bytes: deps.readFile(file) };
  } catch {
    return { ok: false };
  } finally {
    deps.cleanup(dir);
  }
}
