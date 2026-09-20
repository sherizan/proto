import { spawn } from 'node:child_process';
import { messages } from '../messages.js';
import { healIgnoredBuilds } from '../pnpm-builds.js';
import { warnUnsupportedNativeModules } from '../native-modules.js';

export type AddSpawnResult = { code: number | null; stderr: string; stdout?: string };
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
  const install = () => spawnFn('npx', ['expo', 'install', ...packages], { cwd: opts.cwd });
  let result = await install();
  // pnpm installed everything but refused the library's build script: allowlist
  // it and install again so the script runs and the exit code stops lying.
  if (result.code !== 0 && healIgnoredBuilds(opts.cwd, `${result.stdout ?? ''}${result.stderr}`)) {
    result = await install();
  }
  if (result.code !== 0) {
    return { ok: false, reason: messages.addFailed };
  }

  log(messages.addDone(packages));

  // Detect native modules the installed Prototo can't load — only the ones just added —
  // and surface it here, at the teachable moment (the add itself), not just on next start.
  const unsupported = await warnFn({ cwd: opts.cwd, only: packages });
  if (unsupported.length > 0) {
    log(messages.nativeNeedsPrototoUpdate(unsupported));
  }

  return { ok: true, packages, unsupported };
}

function defaultSpawn(cmd: string, args: string[], opts: { cwd: string }): Promise<AddSpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (err) => resolve({ code: 1, stderr: err.message }));
  });
}
