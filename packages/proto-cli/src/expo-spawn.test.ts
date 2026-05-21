import { describe, expect, it } from 'vitest';
import { spawnExpo, type SpawnFn } from './expo-spawn.js';

function asyncIterableFrom<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

describe('spawnExpo', () => {
  it('invokes the spawn function with npx expo start and the configured cwd', async () => {
    const calls: Array<{ cmd: string; args: string[]; cwd: string }> = [];
    const spawnFn: SpawnFn = (cmd, args, opts) => {
      calls.push({ cmd, args, cwd: opts.cwd });
      return {
        stdout: asyncIterableFrom<string>([]),
        stderr: asyncIterableFrom<string>([]),
        kill: () => {},
        exit: Promise.resolve(0),
      };
    };

    const handle = spawnExpo({
      cwd: '/tmp/x',
      onStdoutLine: () => {},
      onStderrLine: () => {},
      spawnFn,
    });
    await handle.waitUntilExit;

    expect(calls).toEqual([
      {
        cmd: 'npx',
        args: ['expo', 'start'],
        cwd: '/tmp/x',
      },
    ]);
  });

  it('delivers each stdout line to onStdoutLine', async () => {
    const lines: string[] = [];
    const spawnFn: SpawnFn = () => ({
      stdout: asyncIterableFrom<string>(['hello', '› noise', 'exp://x:1']),
      stderr: asyncIterableFrom<string>([]),
      kill: () => {},
      exit: Promise.resolve(0),
    });

    const handle = spawnExpo({
      cwd: '/tmp/x',
      onStdoutLine: (l) => lines.push(l),
      onStderrLine: () => {},
      spawnFn,
    });
    await handle.waitUntilExit;

    expect(lines).toEqual(['hello', '› noise', 'exp://x:1']);
  });

  it('delivers each stderr line to onStderrLine', async () => {
    const lines: string[] = [];
    const spawnFn: SpawnFn = () => ({
      stdout: asyncIterableFrom<string>([]),
      stderr: asyncIterableFrom<string>(['Unable to resolve module ./Foo']),
      kill: () => {},
      exit: Promise.resolve(0),
    });

    const handle = spawnExpo({
      cwd: '/tmp/x',
      onStdoutLine: () => {},
      onStderrLine: (l) => lines.push(l),
      spawnFn,
    });
    await handle.waitUntilExit;

    expect(lines).toEqual(['Unable to resolve module ./Foo']);
  });

  it('kill() forwards to the spawned process and resolves waitUntilExit', async () => {
    let killed = false;
    const spawnFn: SpawnFn = () => ({
      stdout: asyncIterableFrom<string>([]),
      stderr: asyncIterableFrom<string>([]),
      kill: () => {
        killed = true;
      },
      exit: Promise.resolve(0),
    });

    const handle = spawnExpo({
      cwd: '/tmp/x',
      onStdoutLine: () => {},
      onStderrLine: () => {},
      spawnFn,
    });
    await handle.kill();
    expect(killed).toBe(true);
    await expect(handle.waitUntilExit).resolves.toBe(0);
  });
});
