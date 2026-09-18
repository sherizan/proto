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
    readSdkMajor: () => '57',
    currentRuntime: async () => ({ version: 'prototo-57', expoMajor: 57 }),
    ensureShareConfig: () => true,
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

  it('also moves the project to the current Prototo runtime when it is behind', async () => {
    const calls: [string, string[]][] = [];
    const logs: string[] = [];
    const ensureShareConfig = vi.fn(() => true);
    await runUpgrade(
      makeDeps({
        readSdkMajor: () => '56',
        run: async (cmd, args) => {
          calls.push([cmd, args]);
          return 0;
        },
        log: (m) => logs.push(m),
        ensureShareConfig,
      }),
    );
    expect(calls).toEqual([
      ['npm', ['install', '-D', '@sherizan/proto-cli@latest']],
      ['npx', ['expo', 'install', 'expo@~57.0.0']],
      ['npx', ['expo', 'install', '--fix']],
    ]);
    expect(logs).toContain(messages.runtimeUpgrading);
    expect(logs).toContain(messages.runtimeUpgraded);
    expect(ensureShareConfig).toHaveBeenCalledWith('/proj');
  });

  it('skips the runtime step when the project is current or the runtime is unknown', async () => {
    for (const over of [
      { readSdkMajor: () => '57' },
      { readSdkMajor: () => '58' },
      { readSdkMajor: () => null },
      { currentRuntime: async () => null },
    ] as Partial<UpgradeDeps>[]) {
      const run = vi.fn(async () => 0);
      const logs: string[] = [];
      await runUpgrade(makeDeps({ ...over, run, log: (m) => logs.push(m) }));
      expect(run).toHaveBeenCalledTimes(1);
      expect(logs).not.toContain(messages.runtimeUpgrading);
    }
  });

  it('retries `expo install --fix` once (pnpm 11 errors the first time it records a blocked build script)', async () => {
    const calls: string[][] = [];
    const logs: string[] = [];
    await runUpgrade(
      makeDeps({
        readSdkMajor: () => '56',
        run: async (_cmd, args) => {
          calls.push(args);
          // first --fix fails, second succeeds
          return args.includes('--fix') && calls.filter((c) => c.includes('--fix')).length === 1
            ? 1
            : 0;
        },
        log: (m) => logs.push(m),
      }),
    );
    expect(calls.filter((c) => c.includes('--fix'))).toHaveLength(2);
    expect(logs).toContain(messages.runtimeUpgraded);
  });

  it('reports a friendly failure when the runtime update fails', async () => {
    const logs: string[] = [];
    const exit = vi.fn();
    await runUpgrade(
      makeDeps({
        readSdkMajor: () => '56',
        run: async (cmd) => (cmd === 'npx' ? 1 : 0),
        log: (m) => logs.push(m),
        exit,
      }),
    );
    expect(logs).toContain(messages.runtimeUpgradeFailed);
    expect(logs).not.toContain(messages.runtimeUpgraded);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
