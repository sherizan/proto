import { spawn as nodeSpawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';

export type SpawnedProcess = {
  stdout: AsyncIterable<string>;
  stderr: AsyncIterable<string>;
  kill: (signal?: NodeJS.Signals) => void;
  exit: Promise<number | null>;
};

export type SpawnFn = (cmd: string, args: string[], opts: { cwd: string }) => SpawnedProcess;

export type SpawnExpoOptions = {
  cwd: string;
  configPath: string;
  onStdoutLine: (line: string) => void;
  onStderrLine: (line: string) => void;
  spawnFn?: SpawnFn;
};

export type ExpoHandle = {
  kill: () => Promise<void>;
  waitUntilExit: Promise<number | null>;
};

export function spawnExpo(options: SpawnExpoOptions): ExpoHandle {
  const fn = options.spawnFn ?? defaultSpawn;
  const child = fn('npx', ['expo', 'start', '--config', options.configPath], {
    cwd: options.cwd,
  });

  const stdoutDone = (async () => {
    for await (const line of child.stdout) options.onStdoutLine(line);
  })();
  const stderrDone = (async () => {
    for await (const line of child.stderr) options.onStderrLine(line);
  })();

  const waitUntilExit = Promise.all([child.exit, stdoutDone, stderrDone]).then(([code]) => code);

  return {
    kill: async () => {
      child.kill('SIGTERM');
      await waitUntilExit.catch(() => null);
    },
    waitUntilExit,
  };
}

function defaultSpawn(cmd: string, args: string[], opts: { cwd: string }): SpawnedProcess {
  const child = nodeSpawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] });

  return {
    stdout: readLines(child.stdout),
    stderr: readLines(child.stderr),
    kill: (signal) => child.kill(signal ?? 'SIGTERM'),
    exit: new Promise<number | null>((resolve) => {
      child.on('exit', (code) => resolve(code));
    }),
  };
}

function readLines(stream: Readable | null): AsyncIterable<string> {
  if (!stream) {
    return { async *[Symbol.asyncIterator]() {} };
  }
  return createInterface({ input: stream, crlfDelay: Infinity });
}
