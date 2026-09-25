import { spawn as nodeSpawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { findConfig } from '../find-config.js';
import { messages } from '../messages.js';
import { readProjectSdkMajor } from '../native-modules.js';
import { ensureShareConfig } from '../share-config.js';
import { type RuntimeInfo, currentRuntime } from '../update-check.js';
import { excludeProtoFromReleaseAge, healIgnoredBuilds } from '../pnpm-builds.js';

// `proto upgrade` — update the project's pinned proto-cli to the latest, hiding
// the package manager entirely. Installs `@latest` (not a caret bump) so it also
// crosses a major/minor boundary, then the next `npx proto` picks up the new bin.
const PKG = '@sherizan/proto-cli@latest';

export type PackageManager = 'pnpm' | 'yarn' | 'npm';

/** Pick the package manager from the project's lockfile (npm is the default). */
export function detectPackageManager(root: string): PackageManager {
  if (existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/**
 * Like detectPackageManager, but heals a project that has BOTH lockfiles (an
 * npm install over a pnpm tree, #75): the tree on disk decides, and the other
 * lockfile goes so the next install can't flip it back.
 */
export function resolvePackageManager(root: string): PackageManager {
  const pnpmLock = path.join(root, 'pnpm-lock.yaml');
  const npmLock = path.join(root, 'package-lock.json');
  if (!(existsSync(pnpmLock) && existsSync(npmLock))) return detectPackageManager(root);
  const pnpmTree = existsSync(path.join(root, 'node_modules', '.pnpm'));
  rmSync(pnpmTree ? npmLock : pnpmLock, { force: true });
  return pnpmTree ? 'pnpm' : 'npm';
}

function upgradeCommand(pm: PackageManager): [string, string[]] {
  // proto-cli is a devDependency in scaffolds.
  if (pm === 'npm') return ['npm', ['install', '-D', PKG]];
  return [pm, ['add', '-D', PKG]];
}

function defaultRun(cmd: string, args: string[], opts: { cwd: string }): Promise<number> {
  return new Promise((resolve) => {
    // CI=1: `expo install` auto-confirms its prompts — nothing here is interactive.
    const child = nodeSpawn(cmd, args, {
      cwd: opts.cwd,
      stdio: 'ignore',
      env: { ...process.env, CI: '1' },
    });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

export type UpgradeDeps = {
  findRoot: (cwd: string) => { ok: boolean; root?: string };
  detectPackageManager: (root: string) => PackageManager;
  run: (cmd: string, args: string[], opts: { cwd: string }) => Promise<number>;
  log: (m: string) => void;
  exit: (code: number) => void;
  readSdkMajor: (root: string) => string | null;
  currentRuntime: () => Promise<RuntimeInfo | null>;
  ensureShareConfig: (root: string) => boolean;
};

export async function runUpgrade(injected: Partial<UpgradeDeps> = {}): Promise<void> {
  const deps: UpgradeDeps = {
    findRoot: (cwd) => findConfig(cwd),
    detectPackageManager: resolvePackageManager,
    run: defaultRun,
    log: (m) => console.log(m),
    exit: (code) => process.exit(code),
    readSdkMajor: readProjectSdkMajor,
    currentRuntime,
    ensureShareConfig,
    ...injected,
  };

  const root = deps.findRoot(process.cwd());
  if (!root.ok || !root.root) {
    deps.log(messages.upgradeNotInProject);
    deps.exit(1);
    return;
  }

  const pm = deps.detectPackageManager(root.root);
  // pnpm's one-day release-age gate would otherwise resolve @latest to an old CLI.
  if (pm === 'pnpm') excludeProtoFromReleaseAge(root.root);
  const [cmd, args] = upgradeCommand(pm);
  deps.log(messages.upgrading);
  const code = await deps.run(cmd, args, { cwd: root.root });
  if (code !== 0) {
    deps.log(messages.upgradeFailed);
    deps.exit(1);
    return;
  }
  deps.log(messages.upgradeDone);

  // The project's own runtime: a project scaffolded on an older Expo SDK can't
  // publish a bundle the current Viewer will open, so move it too. `expo install`
  // picks every SDK-correct version; the designer never sees an Expo command.
  const runtime = await deps.currentRuntime();
  const major = Number.parseInt(deps.readSdkMajor(root.root) ?? '', 10);
  if (!runtime || !Number.isFinite(major) || major >= runtime.expoMajor) return;

  deps.log(messages.runtimeUpgrading);
  const bump = await deps.run('npx', ['expo', 'install', `expo@~${runtime.expoMajor}.0.0`], {
    cwd: root.root,
  });
  // pnpm 11 exits 1 when it meets a dependency's build script it hasn't been
  // told about, and leaves a placeholder in pnpm-workspace.yaml that it never
  // flips itself — flip it, then one retry is the normal path.
  const fixArgs = ['expo', 'install', '--fix'];
  let fix = bump === 0 ? await deps.run('npx', fixArgs, { cwd: root.root }) : 1;
  if (bump === 0 && fix !== 0) {
    healIgnoredBuilds(root.root);
    fix = await deps.run('npx', fixArgs, { cwd: root.root });
  }
  if (fix !== 0) {
    deps.log(messages.runtimeUpgradeFailed);
    deps.exit(1);
    return;
  }
  deps.ensureShareConfig(root.root);
  deps.log(messages.runtimeUpgraded);
}
