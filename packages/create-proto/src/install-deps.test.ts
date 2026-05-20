import { describe, expect, it } from 'vitest';
import { installDeps, translateInstallError } from './install-deps';

describe('translateInstallError', () => {
  it('maps ENOTFOUND to no-network message', () => {
    expect(translateInstallError('npm ERR! code ENOTFOUND')).toMatch(/internet/i);
  });

  it('maps ETIMEDOUT to no-network message', () => {
    expect(translateInstallError('Error: ETIMEDOUT')).toMatch(/internet/i);
  });

  it('maps EACCES to no-permission message', () => {
    expect(translateInstallError('Error: EACCES permission denied')).toMatch(/permission/i);
  });

  it('maps ENOSPC to no-space message', () => {
    expect(translateInstallError('ENOSPC: no space left on device')).toMatch(/disk space/i);
  });

  it('returns the generic message for unknown stderr', () => {
    expect(translateInstallError('Something weird happened')).toMatch(/Try again/i);
  });
});

describe('installDeps', () => {
  it('builds the right argv per package manager', async () => {
    const calls: Array<{ cmd: string; args: string[]; cwd: string }> = [];
    const fakeSpawn = (cmd: string, args: string[], opts: { cwd: string }) => {
      calls.push({ cmd, args, cwd: opts.cwd });
      return Promise.resolve({ code: 0, stderr: '' });
    };

    await installDeps({ cwd: '/tmp/x', pm: 'npm', spawnFn: fakeSpawn });
    expect(calls[0]).toEqual({ cmd: 'npm', args: ['install', '--silent'], cwd: '/tmp/x' });

    await installDeps({ cwd: '/tmp/y', pm: 'pnpm', spawnFn: fakeSpawn });
    expect(calls[1]).toEqual({ cmd: 'pnpm', args: ['install', '--silent'], cwd: '/tmp/y' });

    await installDeps({ cwd: '/tmp/z', pm: 'yarn', spawnFn: fakeSpawn });
    expect(calls[2]).toEqual({ cmd: 'yarn', args: ['install', '--silent'], cwd: '/tmp/z' });
  });

  it('throws a translated error when the spawn exits non-zero', async () => {
    const fakeSpawn = () =>
      Promise.resolve({ code: 1, stderr: 'npm ERR! code ENOTFOUND' });
    await expect(
      installDeps({ cwd: '/tmp/x', pm: 'npm', spawnFn: fakeSpawn }),
    ).rejects.toThrow(/internet/i);
  });

  it('resolves on success', async () => {
    const fakeSpawn = () => Promise.resolve({ code: 0, stderr: '' });
    await expect(
      installDeps({ cwd: '/tmp/x', pm: 'npm', spawnFn: fakeSpawn }),
    ).resolves.toBeUndefined();
  });
});
