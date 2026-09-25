import { spawn as nodeSpawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { findConfig } from '../find-config.js';
import { messages } from '../messages.js';
import { readProjectSdkMajor } from '../native-modules.js';
import { ensureShareConfig } from '../share-config.js';
import { type RuntimeInfo, currentRuntime } from '../update-check.js';
import { excludeProtoFromReleaseAge, healIgnoredBuilds } from '../pnpm-builds.js';

// `proto upgrade` — update the project's pinned proto-cli to the latest, hiding
// the package manager entirely. Installs the exact registry-latest version (not
// a caret bump, not `@latest`) so it also crosses a major/minor boundary and a
// package manager that quietly resolves an older one is caught by verify (#75).

export type PackageManager = 'pnpm' | 'yarn' | 'npm';

/** Pick the package manager from the project's lockfile (npm is the default). */
export function detectPackageManager(root: string): PackageManager {
  if (existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/**
 * Like detectPackageManager, but heals a project that has BOTH lockfiles (an
 * npm install over a pnpm tree, #75): whichever install ran LAST decides,
 * read from the marker each package manager rewrites on every install —
 * `node_modules/.package-lock.json` (npm) vs `node_modules/.modules.yaml`
 * (pnpm) — because a pnpm tree's `.pnpm/` dir survives a later npm install
 * untouched, so its mere presence doesn't say who's newest. The newer
 * marker wins; with only one marker it wins; with neither, npm. The losing
 * lockfile is deleted as before.
 */
export function resolvePackageManager(root: string): PackageManager {
  const pnpmLock = path.join(root, 'pnpm-lock.yaml');
  const npmLock = path.join(root, 'package-lock.json');
  if (!(existsSync(pnpmLock) && existsSync(npmLock))) return detectPackageManager(root);
  const npmMarker = path.join(root, 'node_modules', '.package-lock.json');
  const pnpmMarker = path.join(root, 'node_modules', '.modules.yaml');
  const npmMtime = existsSync(npmMarker) ? statSync(npmMarker).mtimeMs : null;
  const pnpmMtime = existsSync(pnpmMarker) ? statSync(pnpmMarker).mtimeMs : null;
  const pnpmWins = pnpmMtime !== null && (npmMtime === null || pnpmMtime > npmMtime);
  rmSync(pnpmWins ? npmLock : pnpmLock, { force: true });
  return pnpmWins ? 'pnpm' : 'npm';
}

function upgradeCommand(pm: PackageManager, version: string): [string, string[]] {
  // proto-cli is a devDependency in scaffolds.
  const pkg = `@sherizan/proto-cli@${version}`;
  if (pm === 'npm') return ['npm', ['install', '-D', pkg]];
  return [pm, ['add', '-D', pkg]];
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
  latestCli: () => Promise<string | null>;
  readCliVersion: (root: string) => string | null;
  out: (line: string) => void;
};

export type UpgradeResult = {
  ok: boolean;
  cli: string | null;
  expoMajor: number | null;
  target: { cli: string | null; expoMajor: number | null };
  step?: 'project' | 'cli' | 'runtime' | 'verify';
  reason?: string;
};

const REGISTRY_LATEST = 'https://registry.npmjs.org/@sherizan/proto-cli/latest';

async function defaultLatestCli(): Promise<string | null> {
  try {
    const res = await fetch(REGISTRY_LATEST, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const v = ((await res.json()) as { version?: unknown }).version;
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

function defaultReadCliVersion(root: string): string | null {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(root, 'node_modules', '@sherizan', 'proto-cli', 'package.json'), 'utf8'),
    ) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

export async function runUpgrade(
  injected: Partial<UpgradeDeps> = {},
  opts: { json?: boolean; root?: string } = {},
): Promise<void> {
  const deps: UpgradeDeps = {
    findRoot: (cwd) => findConfig(cwd),
    detectPackageManager: resolvePackageManager,
    run: defaultRun,
    // --json: stdout carries only the result line; progress goes to stderr
    log: (m) => (opts.json ? console.error(m) : console.log(m)),
    out: (line) => console.log(line),
    // Not process.exit(): stdout to a pipe is async on macOS, and an immediate
    // exit can truncate the JSON line `out` just wrote. Set the code and let the
    // process end naturally once the event loop drains.
    exit: (code) => {
      process.exitCode = code;
    },
    readSdkMajor: readProjectSdkMajor,
    // fresh: the 24h update-check cache can't be trusted for verify — a runtime
    // flip must be seen on this run, not up to a day late (#76 review).
    currentRuntime: () => currentRuntime({ fresh: true }),
    ensureShareConfig,
    latestCli: defaultLatestCli,
    readCliVersion: defaultReadCliVersion,
    ...injected,
  };

  const target: UpgradeResult['target'] = { cli: null, expoMajor: null };
  const finish = (root: string | null, fail?: { step: NonNullable<UpgradeResult['step']>; reason: string }) => {
    const cli = root ? deps.readCliVersion(root) : null;
    const major = root ? Number.parseInt(deps.readSdkMajor(root) ?? '', 10) : Number.NaN;
    const expoMajor = Number.isFinite(major) ? major : null;
    let failure = fail;
    if (!failure && ((target.cli && cli !== target.cli) || (target.expoMajor && (expoMajor ?? 0) < target.expoMajor))) {
      failure = { step: 'verify', reason: messages.upgradeVerifyFailed };
    }
    // upgradeDone only on overall success — a verify failure must not show
    // "up to date" right before the failure that says otherwise. And it's
    // terminal copy ("Run proto start…"): the desktop is the only --json
    // caller, so skip it there rather than showing it as a caption.
    if (failure) deps.log(failure.reason);
    else if (!opts.json) deps.log(messages.upgradeDone);
    if (opts.json) {
      const result: UpgradeResult = { ok: !failure, cli, expoMajor, target, ...(failure ?? {}) };
      deps.out(JSON.stringify(result));
    }
    if (failure) deps.exit(1);
  };

  const found = deps.findRoot(opts.root ?? process.cwd());
  if (!found.ok || !found.root) {
    finish(null, { step: 'project', reason: messages.upgradeNotInProject });
    return;
  }
  const root = found.root;

  const [latest, runtime] = await Promise.all([deps.latestCli(), deps.currentRuntime()]);
  target.cli = latest;
  target.expoMajor = runtime?.expoMajor ?? null;

  const pm = deps.detectPackageManager(root);
  // pnpm's one-day release-age gate would otherwise resolve to an old CLI (#75).
  if (pm === 'pnpm') excludeProtoFromReleaseAge(root);
  const [cmd, args] = upgradeCommand(pm, latest ?? 'latest');
  deps.log(messages.upgrading);
  if ((await deps.run(cmd, args, { cwd: root })) !== 0) {
    finish(root, { step: 'cli', reason: messages.upgradeFailed });
    return;
  }

  // The project's own runtime: a project scaffolded on an older Expo SDK can't
  // publish a bundle the current Viewer will open, so move it too. `expo install`
  // picks every SDK-correct version; the designer never sees an Expo command.
  const major = Number.parseInt(deps.readSdkMajor(root) ?? '', 10);
  if (runtime && Number.isFinite(major) && major < runtime.expoMajor) {
    deps.log(messages.runtimeUpgrading);
    const bump = await deps.run('npx', ['expo', 'install', `expo@~${runtime.expoMajor}.0.0`], { cwd: root });
    // pnpm 11 exits 1 when it meets a dependency's build script it hasn't been
    // told about, and leaves a placeholder in pnpm-workspace.yaml that it never
    // flips itself — flip it, then one retry is the normal path.
    const fixArgs = ['expo', 'install', '--fix'];
    let fix = bump === 0 ? await deps.run('npx', fixArgs, { cwd: root }) : 1;
    if (bump === 0 && fix !== 0) {
      healIgnoredBuilds(root);
      fix = await deps.run('npx', fixArgs, { cwd: root });
    }
    if (fix !== 0) {
      // --json's reason is the desktop's modal copy: no "run proto upgrade
      // again", the desktop's own Try again button is the retry.
      const reason = opts.json ? messages.runtimeUpgradeFailedRetry : messages.runtimeUpgradeFailed;
      finish(root, { step: 'runtime', reason });
      return;
    }
    deps.ensureShareConfig(root);
    // Terminal copy ("Run proto share…") — not for the desktop's --json caption.
    if (!opts.json) deps.log(messages.runtimeUpgraded);
  }
  finish(root);
}
