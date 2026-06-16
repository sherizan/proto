import { spawn as nodeSpawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { findConfig } from '../find-config.js';
import { messages } from '../messages.js';

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

function upgradeCommand(pm: PackageManager): [string, string[]] {
  // proto-cli is a devDependency in scaffolds.
  if (pm === 'npm') return ['npm', ['install', '-D', PKG]];
  return [pm, ['add', '-D', PKG]];
}

function defaultRun(cmd: string, args: string[], opts: { cwd: string }): Promise<number> {
  return new Promise((resolve) => {
    const child = nodeSpawn(cmd, args, { cwd: opts.cwd, stdio: 'ignore' });
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
};

export async function runUpgrade(injected: Partial<UpgradeDeps> = {}): Promise<void> {
  const deps: UpgradeDeps = {
    findRoot: (cwd) => findConfig(cwd),
    detectPackageManager,
    run: defaultRun,
    log: (m) => console.log(m),
    exit: (code) => process.exit(code),
    ...injected,
  };

  const root = deps.findRoot(process.cwd());
  if (!root.ok || !root.root) {
    deps.log(messages.upgradeNotInProject);
    deps.exit(1);
    return;
  }

  const [cmd, args] = upgradeCommand(deps.detectPackageManager(root.root));
  deps.log(messages.upgrading);
  const code = await deps.run(cmd, args, { cwd: root.root });
  if (code === 0) {
    deps.log(messages.upgradeDone);
    return;
  }
  deps.log(messages.upgradeFailed);
  deps.exit(1);
}
