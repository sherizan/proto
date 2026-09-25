import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { messages } from '../messages.js';
import { type UpgradeDeps, runUpgrade, resolvePackageManager } from './upgrade.js';

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
    latestCli: async () => null,
    readCliVersion: () => null,
    out: () => {},
    ...over,
  };
}

function jsonRun(over: Partial<UpgradeDeps>, root = '/proj') {
  const out: string[] = [];
  const exit = vi.fn();
  const p = runUpgrade(makeDeps({ out: (l) => out.push(l), exit, ...over }), { json: true, root });
  return p.then(() => ({ result: JSON.parse(out.at(-1)!), out, exit }));
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
        readSdkMajor: (() => {
          let n = 0;
          return () => (n++ === 0 ? '56' : '57');
        })(),
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

describe('runUpgrade --json', () => {
  it('ok when the installed versions match the targets', async () => {
    const { result, out, exit } = await jsonRun({
      latestCli: async () => '0.8.12', readCliVersion: () => '0.8.12', readSdkMajor: () => '57',
    });
    expect(out).toHaveLength(1);
    expect(result).toEqual({ ok: true, cli: '0.8.12', expoMajor: 57, target: { cli: '0.8.12', expoMajor: 57 } });
    expect(exit).not.toHaveBeenCalledWith(1);
  });

  it('installs the exact latest version, not @latest', async () => {
    const run = vi.fn(async () => 0);
    await jsonRun({ run, latestCli: async () => '0.8.12', readCliVersion: () => '0.8.12' });
    expect(run).toHaveBeenCalledWith('npm', ['install', '-D', '@sherizan/proto-cli@0.8.12'], { cwd: '/proj' });
  });

  it('verify catches a resolver that silently kept the old CLI (#75)', async () => {
    const { result, exit } = await jsonRun({ latestCli: async () => '0.8.12', readCliVersion: () => '0.8.7' });
    expect(result).toMatchObject({ ok: false, step: 'verify', cli: '0.8.7', target: { cli: '0.8.12' } });
    expect(result.reason).toBe(messages.upgradeVerifyFailed);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('cli install failure → step cli', async () => {
    const { result } = await jsonRun({ run: async () => 1 });
    expect(result).toMatchObject({ ok: false, step: 'cli', reason: messages.upgradeFailed });
  });

  it('runtime move failure → step runtime', async () => {
    const { result } = await jsonRun({
      readSdkMajor: () => '56',
      run: async (cmd) => (cmd === 'npx' ? 1 : 0),
      latestCli: async () => '0.8.12', readCliVersion: () => '0.8.12',
    });
    expect(result).toMatchObject({ ok: false, step: 'runtime', expoMajor: 56, target: { expoMajor: 57 } });
  });

  it('runtime unknown (offline website) → CLI only, expoMajor target null', async () => {
    const { result } = await jsonRun({
      currentRuntime: async () => null, latestCli: async () => '0.8.12', readCliVersion: () => '0.8.12',
    });
    expect(result).toMatchObject({ ok: true, target: { cli: '0.8.12', expoMajor: null } });
  });

  it('not a Prototo project → one ok:false line, step project', async () => {
    const { result, out } = await jsonRun({ findRoot: () => ({ ok: false }) });
    expect(out).toHaveLength(1);
    expect(result).toMatchObject({ ok: false, step: 'project', reason: messages.upgradeNotInProject });
  });

  it('--root is where the project is looked up, not process.cwd()', async () => {
    const findRoot = vi.fn(() => ({ ok: true, root: '/elsewhere' }));
    await jsonRun({ findRoot, latestCli: async () => '0.8.12', readCliVersion: () => '0.8.12' }, '/elsewhere');
    expect(findRoot).toHaveBeenCalledWith('/elsewhere');
  });

  it('registry unreachable → falls back to @latest and verifies against nothing', async () => {
    const run = vi.fn(async () => 0);
    const { result } = await jsonRun({ run, latestCli: async () => null, readCliVersion: () => '0.8.12' });
    expect(run).toHaveBeenCalledWith('npm', ['install', '-D', '@sherizan/proto-cli@latest'], { cwd: '/proj' });
    expect(result).toMatchObject({ ok: true, target: { cli: null } });
  });
});

describe('resolvePackageManager', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const touch = (p: string) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), ''); };

  it('both lockfiles + a pnpm tree → pnpm, package-lock removed', () => {
    touch('pnpm-lock.yaml'); touch('package-lock.json'); fs.mkdirSync(path.join(dir, 'node_modules/.pnpm'), { recursive: true });
    expect(resolvePackageManager(dir)).toBe('pnpm');
    expect(fs.existsSync(path.join(dir, 'package-lock.json'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))).toBe(true);
  });
  it('both lockfiles + an npm tree (instagram) → npm, pnpm-lock removed', () => {
    touch('pnpm-lock.yaml'); touch('package-lock.json'); fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    expect(resolvePackageManager(dir)).toBe('npm');
    expect(fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))).toBe(false);
  });
  it('both lockfiles, no node_modules at all → npm', () => {
    touch('pnpm-lock.yaml'); touch('package-lock.json');
    expect(resolvePackageManager(dir)).toBe('npm');
  });
  it('single lockfile → unchanged behaviour, nothing deleted', () => {
    touch('pnpm-lock.yaml');
    expect(resolvePackageManager(dir)).toBe('pnpm');
    expect(fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))).toBe(true);
  });
});

describe('runUpgrade — pnpm build scripts', () => {
  it("flips pnpm 11's placeholder to true before retrying `expo install --fix`", async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-upgrade-'));
    const yaml = path.join(root, 'pnpm-workspace.yaml');
    fs.writeFileSync(yaml, `allowBuilds:\n  cloudflared: true\n`);
    let fixes = 0;
    const run = vi.fn(async (_cmd: string, args: string[]) => {
      if (!args.includes('--fix')) return 0;
      fixes += 1;
      if (fixes === 1) {
        // What pnpm 11 leaves behind on the first failing run.
        fs.writeFileSync(
          yaml,
          `allowBuilds:\n  '@shopify/react-native-skia': set this to true or false\n  cloudflared: true\n`,
        );
        return 1;
      }
      return fs.readFileSync(yaml, 'utf8').includes(`'@shopify/react-native-skia': true`) ? 0 : 1;
    });
    const exit = vi.fn();
    try {
      await runUpgrade(
        makeDeps({
          findRoot: () => ({ ok: true, root }),
          detectPackageManager: () => 'pnpm',
          readSdkMajor: (() => {
            let n = 0;
            return () => (n++ === 0 ? '56' : '57');
          })(),
          run,
          exit,
        }),
      );
      expect(fixes).toBe(2);
      expect(exit).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
