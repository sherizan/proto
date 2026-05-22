import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export type RunCommand = (
  cmd: string,
  args: string[],
  opts?: { silent?: boolean },
) => string;

const EXPO_GO_BUNDLE_ID = 'host.exp.Exponent';

const defaultRun: RunCommand = (cmd, args, opts) =>
  execFileSync(cmd, args, { stdio: opts?.silent ? 'ignore' : 'pipe' }).toString();

export type EnsureExpoGoOptions = {
  cwd: string;
  run?: RunCommand;
  log?: (message: string) => void;
};

/**
 * If a booted iOS simulator has an Expo Go whose SDK major doesn't match
 * the project's `expo` package, uninstall it so `expo start --ios` will
 * install a fresh, matching Expo Go without prompting to upgrade.
 *
 * Silent no-op when: xcrun unavailable, no booted simulator, no Expo Go
 * installed, or installed version already matches.
 */
export function ensureExpoGoMatchesProject(opts: EnsureExpoGoOptions): void {
  const run = opts.run ?? defaultRun;
  const log = opts.log ?? (() => {});

  const projectMajor = readProjectExpoMajor(opts.cwd);
  if (!projectMajor) return;

  let booted = '';
  try {
    booted = run('xcrun', ['simctl', 'list', 'devices', 'booted']);
  } catch {
    return;
  }
  if (!/Booted/.test(booted)) return;

  let apps = '';
  try {
    apps = run('xcrun', ['simctl', 'listapps', 'booted']);
  } catch {
    return;
  }
  const installedVersion = parseExpoGoVersion(apps);
  if (!installedVersion) return;

  const installedMajor = installedVersion.split('.')[0];
  if (installedMajor === projectMajor) return;

  log(
    `Expo Go ${installedVersion} on simulator doesn't match SDK ${projectMajor}. Refreshing...`,
  );
  try {
    run('xcrun', ['simctl', 'uninstall', 'booted', EXPO_GO_BUNDLE_ID], { silent: true });
  } catch {
    // Best-effort; if uninstall fails, Expo will surface the prompt itself.
  }
}

function readProjectExpoMajor(cwd: string): string | null {
  const pkgPath = path.join(cwd, 'node_modules', 'expo', 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (typeof pkg.version !== 'string') return null;
    return pkg.version.split('.')[0];
  } catch {
    return null;
  }
}

export function parseExpoGoVersion(simctlListAppsOutput: string): string | null {
  const bundleIdx = simctlListAppsOutput.indexOf(EXPO_GO_BUNDLE_ID);
  if (bundleIdx === -1) return null;
  const block = simctlListAppsOutput.slice(bundleIdx, bundleIdx + 2000);
  const match = block.match(/CFBundleShortVersionString\s*=\s*"?([0-9]+\.[0-9]+\.[0-9]+)"?/);
  return match?.[1] ?? null;
}
