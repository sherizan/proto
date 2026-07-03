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

  it('drops --ios when PROTO_HEADLESS_SIM=1 (desktop owns the simulator)', async () => {
    const calls: Array<{ args: string[] }> = [];
    const spawnFn: SpawnFn = (_cmd, args) => {
      calls.push({ args });
      return { kill: () => {}, exit: Promise.resolve(0) };
    };

    const prev = process.env.PROTO_HEADLESS_SIM;
    process.env.PROTO_HEADLESS_SIM = '1';
    try {
      const handle = spawnExpo({ cwd: '/tmp/x', spawnFn });
      await handle.waitUntilExit;
    } finally {
      if (prev === undefined) delete process.env.PROTO_HEADLESS_SIM;
      else process.env.PROTO_HEADLESS_SIM = prev;
    }

    expect(calls[0].args).toEqual(['expo', 'start', '--dev-client', '--scheme', 'prototo']);
    expect(calls[0].args).not.toContain('--ios');
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
