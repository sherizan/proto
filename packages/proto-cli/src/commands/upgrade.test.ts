import { describe, expect, it, vi } from 'vitest';
import { messages } from '../messages.js';
import { type UpgradeDeps, runUpgrade } from './upgrade.js';

function makeDeps(over: Partial<UpgradeDeps>): UpgradeDeps {
  return {
    findRoot: () => ({ ok: true, root: '/proj' }),
    detectPackageManager: () => 'npm',
    run: async () => 0,
    log: () => {},
    exit: () => {},
    ...over,
  };
}

describe('runUpgrade', () => {
  it('aborts with a friendly message when not in a Prototo project', async () => {
    const logs: string[] = [];
    const exit = vi.fn();
    const run = vi.fn(async () => 0);
    await runUpgrade(
      makeDeps({ findRoot: () => ({ ok: false }), log: (m) => logs.push(m), exit, run }),
    );
    expect(logs).toContain(messages.upgradeNotInProject);
    expect(exit).toHaveBeenCalledWith(1);
    expect(run).not.toHaveBeenCalled();
  });

  it('installs @latest as a devDependency with the right package manager', async () => {
    const npm = vi.fn(async () => 0);
    await runUpgrade(makeDeps({ detectPackageManager: () => 'npm', run: npm }));
    expect(npm).toHaveBeenCalledWith('npm', ['install', '-D', '@sherizan/proto-cli@latest'], {
      cwd: '/proj',
    });

    const pnpm = vi.fn(async () => 0);
    await runUpgrade(makeDeps({ detectPackageManager: () => 'pnpm', run: pnpm }));
    expect(pnpm).toHaveBeenCalledWith('pnpm', ['add', '-D', '@sherizan/proto-cli@latest'], {
      cwd: '/proj',
    });

    const yarn = vi.fn(async () => 0);
    await runUpgrade(makeDeps({ detectPackageManager: () => 'yarn', run: yarn }));
    expect(yarn).toHaveBeenCalledWith('yarn', ['add', '-D', '@sherizan/proto-cli@latest'], {
      cwd: '/proj',
    });
  });

  it('reports success and does not exit on a zero exit code', async () => {
    const logs: string[] = [];
    const exit = vi.fn();
    await runUpgrade(makeDeps({ run: async () => 0, log: (m) => logs.push(m), exit }));
    expect(logs).toContain(messages.upgradeDone);
    expect(exit).not.toHaveBeenCalled();
  });

  it('reports a friendly failure and exits on a non-zero exit code', async () => {
    const logs: string[] = [];
    const exit = vi.fn();
    await runUpgrade(makeDeps({ run: async () => 1, log: (m) => logs.push(m), exit }));
    expect(logs).toContain(messages.upgradeFailed);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
