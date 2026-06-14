import fs from 'node:fs';
import { type ShotResult, runShot } from '../commands/shot.js';

export type ScreenshotDeps = {
  runShot: (opts: { cwd: string }) => Promise<ShotResult>;
  readFile: (p: string) => Buffer;
};

type ImageBlock = { type: 'image'; data: string; mimeType: string };
type TextBlock = { type: 'text'; text: string };
export type ScreenshotResult = { content: [ImageBlock | TextBlock] };

const defaultDeps: ScreenshotDeps = {
  runShot: (opts) => runShot(opts),
  readFile: (p) => fs.readFileSync(p),
};

export async function getSimulatorScreenshot(opts: {
  cwd: string;
  deps?: Partial<ScreenshotDeps>;
}): Promise<ScreenshotResult> {
  const deps = { ...defaultDeps, ...opts.deps };
  const shot = await deps.runShot({ cwd: opts.cwd });

  if (!shot.ok) {
    return { content: [{ type: 'text', text: shot.reason }] };
  }

  const png = deps.readFile(shot.path);
  return {
    content: [{ type: 'image', data: png.toString('base64'), mimeType: 'image/png' }],
  };
}
