import { describe, expect, it } from 'vitest';
import { spawnExpo, type SpawnFn } from './expo-spawn.js';

describe('spawnExpo', () => {
  it('invokes spawn function with npx expo start --dev-client --scheme prototo --ios and the configured cwd', async () => {
    const calls: Array<{ cmd: string; args: string[]; cwd: string }> = [];
    const spawnFn: SpawnFn = (cmd, args, opts) => {
      calls.push({ cmd, args, cwd: opts.cwd });
      return {
        kill: () => {},
        exit: Promise.resolve(0),
      };
    };

    const handle = spawnExpo({ cwd: '/tmp/x', spawnFn });
    await handle.waitUntilExit;

    expect(calls).toEqual([
      {
        cmd: 'npx',
        args: ['expo', 'start', '--dev-client', '--scheme', 'prototo', '--ios'],
        cwd: '/tmp/x',
      },
    ]);
  });

  it('kill() forwards to the spawned process and resolves waitUntilExit', async () => {
    let killed = false;
    const spawnFn: SpawnFn = () => ({
      kill: () => {
        killed = true;
      },
      exit: Promise.resolve(0),
    });

    const handle = spawnExpo({ cwd: '/tmp/x', spawnFn });
    await handle.kill();
    expect(killed).toBe(true);
    await expect(handle.waitUntilExit).resolves.toBe(0);
  });
});
