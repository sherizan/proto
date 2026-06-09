import { spawn } from 'node:child_process';
import { messages } from '../messages.js';
import { warnUnsupportedNativeModules } from '../native-modules.js';

export type AddSpawnResult = { code: number | null; stderr: string };
export type AddSpawnFn = (
  cmd: string,
  args: string[],
  opts: { cwd: string },
) => Promise<AddSpawnResult>;

export type WarnFn = (opts: { cwd: string; only: string[] }) => Promise<string[]>;

export type AddDeps = {
  spawnFn: AddSpawnFn;
  warnFn: WarnFn;
  log: (message: string) => void;
};

export type AddResult =
  | { ok: true; packages: string[]; unsupported: string[] }
  | { ok: false; reason: string };

export async function runAdd(opts: {
  packages: string[];
  cwd: string;
  deps?: Partial<AddDeps>;
}): Promise<AddResult> {
  const packages = opts.packages.filter((p) => p.trim().length > 0);
  if (packages.length === 0) {
    return { ok: false, reason: messages.addNothing };
  }

  const spawnFn = opts.deps?.spawnFn ?? defaultSpawn;
  const warnFn = opts.deps?.warnFn ?? ((o) => warnUnsupportedNativeModules(o));
  const log = opts.deps?.log ?? (() => {});

  log(messages.addInstalling(packages));

  // `expo install` picks SDK-correct versions and resolves peers — the safe path that
  // avoids the --legacy-peer-deps pruning that breaks a designer's project.
  const result = await spawnFn('npx', ['expo', 'install', ...packages], { cwd: opts.cwd });
  if (result.code !== 0) {
    return { ok: false, reason: messages.addFailed };
  }

  log(messages.addDone(packages));

  // Detect native modules the installed Prototo can't load — only the ones just added.
  const unsupported = await warnFn({ cwd: opts.cwd, only: packages });

  return { ok: true, packages, unsupported };
}

function defaultSpawn(cmd: string, args: string[], opts: { cwd: string }): Promise<AddSpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => resolve({ code, stderr }));
    child.on('error', (err) => resolve({ code: 1, stderr: err.message }));
  });
}
