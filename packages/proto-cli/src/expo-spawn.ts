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
  // Prototo Desktop sets PROTO_HEADLESS_SIM=1: it owns a headless simulator
  // (streamed via serve-sim) and launches the app itself, so `--ios` — which
  // force-opens Simulator.app — must be dropped. Terminal users are unaffected.
  const args = ['expo', 'start', '--dev-client', '--scheme', 'prototo'];
  if (process.env.PROTO_HEADLESS_SIM !== '1') args.push('--ios');
  const child = fn('npx', args, { cwd: options.cwd });

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
