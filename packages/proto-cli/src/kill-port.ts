import { spawn } from 'node:child_process';

export type RunCmdResult = { stdout: string; code: number | null };
export type RunCmdFn = (cmd: string, args: string[]) => Promise<RunCmdResult>;
export type KillPortFn = (port: number) => Promise<{ killed: number }>;
export type KillPortDeps = { runCmd?: RunCmdFn };

export function makeKillPort(deps: KillPortDeps = {}): KillPortFn {
  const runCmd = deps.runCmd ?? defaultRunCmd;
  return async (port) => {
    const lsof = await runCmd('lsof', ['-ti', `:${port}`]);
    const pids = lsof.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const pid of pids) {
      await runCmd('kill', [pid]);
    }
    return { killed: pids.length };
  };
}

function defaultRunCmd(cmd: string, args: string[]): Promise<RunCmdResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.on('exit', (code) => resolve({ stdout, code }));
    child.on('error', () => resolve({ stdout, code: 1 }));
  });
}
