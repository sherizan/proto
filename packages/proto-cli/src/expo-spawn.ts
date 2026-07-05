import { spawn as nodeSpawn } from 'node:child_process';
import type { Writable } from 'node:stream';

export type SpawnedProcess = {
  kill: (signal?: NodeJS.Signals) => void;
  exit: Promise<number | null>;
};

export type SpawnOpts = {
  cwd: string;
  onLine?: (line: string) => void;
  // Test seam: where teed output goes. Defaults to this process's stdio.
  teeTo?: { stdout: Writable; stderr: Writable };
};

export type SpawnFn = (cmd: string, args: string[], opts: SpawnOpts) => SpawnedProcess;

export type SpawnExpoOptions = {
  cwd: string;
  spawnFn?: SpawnFn;
  onLine?: (line: string) => void;
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
  const child = fn('npx', args, { cwd: options.cwd, onLine: options.onLine });

  return {
    kill: async () => {
      child.kill('SIGTERM');
      await child.exit.catch(() => null);
    },
    waitUntilExit: child.exit,
  };
}

// Reassembles complete lines from arbitrary stream chunks for the error scanner.
export function createLineSplitter(onLine: (line: string) => void): {
  push: (chunk: Buffer | string) => void;
  flush: () => void;
} {
  let pending = '';
  const emit = (line: string) => onLine(line.endsWith('\r') ? line.slice(0, -1) : line);
  return {
    push(chunk) {
      pending += chunk.toString();
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) emit(line);
    },
    flush() {
      if (pending !== '') emit(pending);
      pending = '';
    },
  };
}

export function defaultSpawn(cmd: string, args: string[], opts: SpawnOpts): SpawnedProcess {
  if (!opts.onLine) {
    const child = nodeSpawn(cmd, args, { cwd: opts.cwd, stdio: 'inherit' });
    return {
      kill: (signal) => child.kill(signal ?? 'SIGTERM'),
      exit: new Promise<number | null>((resolve) => {
        child.on('exit', (code) => resolve(code));
      }),
    };
  }

  // Capturing mode: pipe stdout/stderr, tee every chunk through untouched so
  // the terminal stays byte-identical, and feed decoded lines to the scanner.
  // Piping drops the TTY, which would strip Metro's colors — FORCE_COLOR
  // keeps them. stdin stays inherited so Expo's interactive keys still work.
  const tee = opts.teeTo ?? { stdout: process.stdout, stderr: process.stderr };
  const child = nodeSpawn(cmd, args, {
    cwd: opts.cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  // One splitter per stream — stdout and stderr chunks interleave mid-line.
  const outSplitter = createLineSplitter(opts.onLine);
  const errSplitter = createLineSplitter(opts.onLine);
  child.stdout?.on('data', (chunk: Buffer) => {
    tee.stdout.write(chunk);
    outSplitter.push(chunk);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    tee.stderr.write(chunk);
    errSplitter.push(chunk);
  });

  return {
    kill: (signal) => child.kill(signal ?? 'SIGTERM'),
    exit: new Promise<number | null>((resolve) => {
      child.on('close', (code) => {
        outSplitter.flush();
        errSplitter.flush();
        resolve(code);
      });
    }),
  };
}
