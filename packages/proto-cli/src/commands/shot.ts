import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { messages } from '../messages.js';

type RunCommand = (cmd: string, args: string[]) => string;

export type ShotDeps = {
  run: RunCommand;
  mkdir: (dir: string) => void;
};

export type ShotResult = { ok: true; path: string } | { ok: false; reason: string };

const defaultRun: RunCommand = (cmd, args) => execFileSync(cmd, args).toString();
const defaultMkdir = (dir: string) => fs.mkdirSync(dir, { recursive: true });

export async function runShot(opts: {
  cwd: string;
  deps?: Partial<ShotDeps>;
}): Promise<ShotResult> {
  const run = opts.deps?.run ?? defaultRun;
  const mkdir = opts.deps?.mkdir ?? defaultMkdir;

  let booted = '';
  try {
    booted = run('xcrun', ['simctl', 'list', 'devices', 'booted']);
  } catch {
    return { ok: false, reason: messages.shotNoSimulator };
  }
  if (!/Booted/.test(booted)) {
    return { ok: false, reason: messages.shotNoSimulator };
  }

  const outDir = path.join(opts.cwd, '.proto');
  const outPath = path.join(outDir, 'last-shot.png');
  try {
    mkdir(outDir);
    run('xcrun', ['simctl', 'io', 'booted', 'screenshot', outPath]);
  } catch {
    return { ok: false, reason: messages.shotFailed };
  }

  return { ok: true, path: outPath };
}
