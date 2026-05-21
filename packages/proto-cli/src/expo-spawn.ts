import { spawn as nodeSpawn } from 'node:child_process';

export type SpawnedProcess = {
  kill: (signal?: NodeJS.Signals) => void;
  exit: Promise<number | null>;
};

export type SpawnFn = (cmd: string, args: string[], opts: { cwd: string }) => SpawnedProcess;

export type SpawnExpoOptions = {
  cwd: string;
  spawnFn?: SpawnFn;
};

export type ExpoHandle = {
  kill: () => Promise<void>;
  waitUntilExit: Promise<number | null>;
};

export function spawnExpo(options: SpawnExpoOptions): ExpoHandle {
  const fn = options.spawnFn ?? defaultSpawn;
  const child = fn('npx', ['expo', 'start'], { cwd: options.cwd });

  return {
    kill: async () => {
      child.kill('SIGTERM');
      await child.exit.catch(() => null);
    },
    waitUntilExit: child.exit,
  };
}

function defaultSpawn(cmd: string, args: string[], opts: { cwd: string }): SpawnedProcess {
  const child = nodeSpawn(cmd, args, {
    cwd: opts.cwd,
    stdio: 'inherit',
  });

  return {
    kill: (signal) => child.kill(signal ?? 'SIGTERM'),
    exit: new Promise<number | null>((resolve) => {
      child.on('exit', (code) => resolve(code));
    }),
  };
}
