import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { type SpawnFn, createLineSplitter, defaultSpawn, spawnExpo } from './expo-spawn.js';

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
      if (prev === undefined) Reflect.deleteProperty(process.env, 'PROTO_HEADLESS_SIM');
      else process.env.PROTO_HEADLESS_SIM = prev;
    }

    expect(calls[0].args).toEqual(['expo', 'start', '--dev-client', '--scheme', 'prototo']);
    expect(calls[0].args).not.toContain('--ios');
  });

  it('forwards onLine to the spawn function so output capture reaches the real spawn', async () => {
    const seen: Array<((line: string) => void) | undefined> = [];
    const spawnFn: SpawnFn = (_cmd, _args, opts) => {
      seen.push(opts.onLine);
      return { kill: () => {}, exit: Promise.resolve(0) };
    };
    const onLine = () => {};

    const handle = spawnExpo({ cwd: '/tmp/x', spawnFn, onLine });
    await handle.waitUntilExit;

    expect(seen[0]).toBe(onLine);
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

describe('createLineSplitter', () => {
  it('emits complete lines even when they arrive split across chunks', () => {
    const lines: string[] = [];
    const splitter = createLineSplitter((l) => lines.push(l));

    splitter.push(Buffer.from('one\ntw'));
    splitter.push(Buffer.from('o\nthree'));

    expect(lines).toEqual(['one', 'two']);

    splitter.flush();
    expect(lines).toEqual(['one', 'two', 'three']);
  });

  it('strips a trailing carriage return but nothing else', () => {
    const lines: string[] = [];
    const splitter = createLineSplitter((l) => lines.push(l));

    splitter.push(Buffer.from('win\r\n  indented \n'));

    expect(lines).toEqual(['win', '  indented ']);
  });
});

describe('defaultSpawn with output capture', () => {
  it('tees child output byte-identically, feeds onLine, and sets FORCE_COLOR for the child', async () => {
    const out = new PassThrough();
    const err = new PassThrough();
    const lines: string[] = [];

    const script =
      'process.stdout.write("one\\ntw"); process.stderr.write("boom\\n"); ' +
      'setTimeout(() => process.stdout.write("o\\nFORCE=" + process.env.FORCE_COLOR), 20);';
    const child = defaultSpawn('node', ['-e', script], {
      cwd: process.cwd(),
      onLine: (l) => lines.push(l),
      teeTo: { stdout: out, stderr: err },
    });
    await child.exit;

    expect(out.read()?.toString()).toBe('one\ntwo\nFORCE=1');
    expect(err.read()?.toString()).toBe('boom\n');
    expect(lines).toEqual(expect.arrayContaining(['one', 'two', 'FORCE=1', 'boom']));
  });

  it('without onLine, spawns with inherited stdio (no capture)', async () => {
    const child = defaultSpawn('node', ['-e', 'process.exit(0)'], { cwd: process.cwd() });
    await expect(child.exit).resolves.toBe(0);
  });
});
