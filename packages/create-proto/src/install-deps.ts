import { spawn } from 'node:child_process';
import { messages } from './messages.js';
import type { PackageManager } from './detect-pm.js';

export type SpawnResult = { code: number | null; stderr: string };
export type SpawnFn = (
  cmd: string,
  args: string[],
  opts: { cwd: string },
) => Promise<SpawnResult>;

export type InstallOptions = {
  cwd: string;
  pm: PackageManager;
  spawnFn?: SpawnFn;
};

export async function installDeps(options: InstallOptions): Promise<void> {
  const fn = options.spawnFn ?? defaultSpawn;
  const result = await fn(options.pm, ['install', '--silent'], { cwd: options.cwd });
  if (result.code !== 0) {
    throw new Error(translateInstallError(result.stderr));
  }
}

export function translateInstallError(stderr: string): string {
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN/.test(stderr)) {
    return messages.noNetwork;
  }
  if (/EACCES/.test(stderr)) {
    return messages.noPermission;
  }
  if (/ENOSPC/.test(stderr)) {
    return messages.noSpace;
  }
  return messages.installFailed;
}

function defaultSpawn(cmd: string, args: string[], opts: { cwd: string }): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => {
      resolve({ code, stderr });
    });
    child.on('error', (err) => {
      resolve({ code: 1, stderr: err.message });
    });
  });
}
