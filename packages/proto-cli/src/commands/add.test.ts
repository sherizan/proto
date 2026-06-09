import { describe, expect, it, vi } from 'vitest';
import { runAdd } from './add.js';

function okSpawn(calls: string[][]) {
  return async (cmd: string, args: string[]) => {
    calls.push([cmd, ...args]);
    return { code: 0, stderr: '' };
  };
}

describe('runAdd', () => {
  it('installs via `expo install` and reports success', async () => {
    const calls: string[][] = [];
    const result = await runAdd({
      packages: ['react-native-svg'],
      cwd: '/proj',
      deps: { spawnFn: okSpawn(calls), warnFn: async () => [] },
    });

    expect(result.ok).toBe(true);
    expect(calls[0]).toEqual(['npx', 'expo', 'install', 'react-native-svg']);
  });

  it('refuses with a friendly message when no package is given', async () => {
    const result = await runAdd({ packages: [], cwd: '/proj', deps: { warnFn: async () => [] } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/proto add/);
  });

  it('translates an install failure into designer copy (no raw output)', async () => {
    const result = await runAdd({
      packages: ['bogus-pkg'],
      cwd: '/proj',
      deps: {
        spawnFn: async () => ({ code: 1, stderr: 'npm ERR! 404 Not Found - bogus-pkg' }),
        warnFn: async () => [],
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).not.toMatch(/npm ERR|404/);
  });

  it('runs native detection only on the added packages after a successful install', async () => {
    const warnFn = vi.fn(async () => ['react-native-maps']);
    const result = await runAdd({
      packages: ['react-native-maps'],
      cwd: '/proj',
      deps: { spawnFn: okSpawn([]), warnFn },
    });

    expect(result.ok).toBe(true);
    expect(warnFn).toHaveBeenCalledWith({ cwd: '/proj', only: ['react-native-maps'] });
  });

  it('does not run detection if the install failed', async () => {
    const warnFn = vi.fn(async () => []);
    await runAdd({
      packages: ['react-native-maps'],
      cwd: '/proj',
      deps: { spawnFn: async () => ({ code: 1, stderr: 'boom' }), warnFn },
    });
    expect(warnFn).not.toHaveBeenCalled();
  });
});
