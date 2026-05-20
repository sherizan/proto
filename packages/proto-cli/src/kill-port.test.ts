import { describe, expect, it } from 'vitest';
import { makeKillPort, type RunCmdFn } from './kill-port';

function makeRunCmd(initial: {
  [argv: string]: { stdout: string; code: number | null };
}): { fn: RunCmdFn; calls: Array<{ cmd: string; args: string[] }> } {
  const calls: Array<{ cmd: string; args: string[] }> = [];
  const fn: RunCmdFn = async (cmd, args) => {
    calls.push({ cmd, args });
    const key = [cmd, ...args].join(' ');
    return initial[key] ?? { stdout: '', code: 0 };
  };
  return { fn, calls };
}

describe('makeKillPort', () => {
  it('runs lsof for the given port and kills each PID', async () => {
    const { fn, calls } = makeRunCmd({
      'lsof -ti :8081': { stdout: '1234\n5678\n', code: 0 },
    });
    const killPort = makeKillPort({ runCmd: fn });
    const result = await killPort(8081);

    expect(result.killed).toBe(2);
    expect(calls).toEqual([
      { cmd: 'lsof', args: ['-ti', ':8081'] },
      { cmd: 'kill', args: ['1234'] },
      { cmd: 'kill', args: ['5678'] },
    ]);
  });

  it('returns killed: 0 when no PIDs are found', async () => {
    const { fn, calls } = makeRunCmd({
      'lsof -ti :3001': { stdout: '', code: 1 },
    });
    const killPort = makeKillPort({ runCmd: fn });
    const result = await killPort(3001);

    expect(result.killed).toBe(0);
    expect(calls).toEqual([{ cmd: 'lsof', args: ['-ti', ':3001'] }]);
  });

  it('ignores empty lines and whitespace in lsof output', async () => {
    const { fn, calls } = makeRunCmd({
      'lsof -ti :8081': { stdout: '\n1111\n\n  2222\n', code: 0 },
    });
    const killPort = makeKillPort({ runCmd: fn });
    const result = await killPort(8081);

    expect(result.killed).toBe(2);
    expect(calls.slice(1)).toEqual([
      { cmd: 'kill', args: ['1111'] },
      { cmd: 'kill', args: ['2222'] },
    ]);
  });
});
