import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { messages } from './messages.js';

export const PROTOTO_APP_BUNDLE_ID = 'com.sherizan.prototo';
const RELEASE_OWNER = 'sherizan';
const RELEASE_REPO = 'proto';

export type Manifest = {
  sdkMajor: number;
  sha256: string;
  builtAt: string;
  // Native modules compiled into this Prototo build (from apps/prototo-app deps).
  // Populated by the EAS release flow; absent on older builds → native detection skips.
  nativeModules?: string[];
};

export type RunCommand = (cmd: string, args: string[], opts?: { silent?: boolean }) => string;

export type Deps = {
  run: RunCommand;
  fetch: typeof fetch;
  computeSha256: (filePath: string) => Promise<string>;
  extractTarball: (archivePath: string, into: string) => Promise<void>;
  cacheRoot: string;
  log: (message: string) => void;
  sleep: (ms: number) => Promise<void>;
  // Long-running `xcodebuild -downloadPlatform iOS`; resolves true on success.
  // Injectable so tests don't shell out. Streams Xcode's own progress to the user.
  downloadIOSPlatform: () => Promise<boolean>;
};

export type EnsureOptions = {
  cwd: string;
  deps?: Partial<Deps>;
};

const messageOffline = messages.prototoSimulatorOffline;
const messageInstalling = messages.installingPrototoApp;
const messageHashMismatch = messages.prototoHashMismatch;
const messageInstallFailed = messages.prototoInstallFailed;
const messageStartingSimulator = messages.startingSimulator;

export function buildManifestUrl(sdkMajor: string): string {
  return `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/download/prototo-sim-sdk${sdkMajor}-latest/manifest.json`;
}

export function buildTarballUrl(sdkMajor: string): string {
  return `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/download/prototo-sim-sdk${sdkMajor}-latest/Prototo.app.tar.gz`;
}

export function parsePrototoAppVersion(simctlListAppsOutput: string): string | null {
  const bundleIdx = simctlListAppsOutput.indexOf(PROTOTO_APP_BUNDLE_ID);
  if (bundleIdx === -1) return null;
  const block = simctlListAppsOutput.slice(bundleIdx, bundleIdx + 2000);
  const match = block.match(/CFBundleShortVersionString\s*=\s*"?([0-9]+\.[0-9]+\.[0-9]+)"?/);
  return match?.[1] ?? null;
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

const defaultRun: RunCommand = (cmd, args, opts) =>
  execFileSync(cmd, args, { stdio: opts?.silent ? 'ignore' : 'pipe' }).toString();

async function defaultComputeSha256(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function defaultExtractTarball(archivePath: string, into: string): Promise<void> {
  fs.mkdirSync(into, { recursive: true });
  execFileSync('tar', ['-xzf', archivePath, '-C', into]);
}

function defaultCacheRoot(): string {
  return path.join(os.homedir(), '.prototo', 'cache');
}

function findCachedEntry(cacheRoot: string, sdkMajor: number, sha256: string): string | null {
  const entry = path.join(cacheRoot, `${sdkMajor}-${sha256.slice(0, 12)}`);
  const appPath = path.join(entry, 'Prototo.app');
  return fs.existsSync(appPath) ? entry : null;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const defaultDownloadIOSPlatform = (): Promise<boolean> =>
  new Promise((resolve) => {
    // Let Xcode's own progress stream straight to the user's terminal — this is
    // a multi-GB, multi-minute download, so silence would look like a hang.
    const child = spawn('xcodebuild', ['-downloadPlatform', 'iOS'], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });

function hasIOS26Runtime(deps: Deps): boolean {
  let json = '';
  try {
    json = deps.run('xcrun', ['simctl', 'list', 'runtimes', '--json']);
  } catch {
    return false;
  }
  try {
    const parsed = JSON.parse(json) as {
      runtimes: Array<{ name?: string; identifier?: string; version?: string; isAvailable?: boolean }>;
    };
    return (parsed.runtimes ?? []).some(
      (r) =>
        r.isAvailable !== false &&
        (/iOS[\s-]?26/i.test(r.name ?? '') ||
          /iOS-26/i.test(r.identifier ?? '') ||
          (r.version ?? '').startsWith('26')),
    );
  } catch {
    return false;
  }
}

// Fresh Xcode ships with no iOS 26 Simulator runtime; without it the dev client
// can't install and `expo start --ios` throws a raw CommandError. Detect it and
// download it (or, if that fails, tell the designer exactly what to do) so the
// raw error never surfaces. Returns whether a usable iOS 26 runtime is present.
async function ensureIOS26Runtime(deps: Deps): Promise<boolean> {
  if (hasIOS26Runtime(deps)) return true;
  deps.log(messages.installingIOSRuntime);
  let downloaded = false;
  try {
    downloaded = await deps.downloadIOSPlatform();
  } catch {
    downloaded = false;
  }
  if (downloaded && hasIOS26Runtime(deps)) return true;
  deps.log(messages.iosRuntimeManualStep);
  return false;
}

function findIOS26DeviceUdid(deps: Deps): string | null {
  let json = '';
  try {
    json = deps.run('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(json) as {
      devices: Record<string, Array<{ udid: string; name: string; isAvailable?: boolean }>>;
    };
    const ios26Key = Object.keys(parsed.devices).find((k) => /iOS-26/i.test(k));
    if (!ios26Key) return null;
    const devicesOnRuntime = parsed.devices[ios26Key] ?? [];
    const available = devicesOnRuntime.filter((d) => d.isAvailable !== false);
    const iphone = available.find((d) => /iPhone/.test(d.name));
    return (iphone ?? available[0])?.udid ?? null;
  } catch {
    return null;
  }
}

async function ensureSimulatorBooted(deps: Deps): Promise<boolean> {
  try {
    const booted = deps.run('xcrun', ['simctl', 'list', 'devices', 'booted']);
    if (/Booted/.test(booted)) return true;
  } catch {
    return false;
  }

  const hasRuntime = await ensureIOS26Runtime(deps);
  if (!hasRuntime) return false;

  const udid = findIOS26DeviceUdid(deps);
  if (!udid) {
    deps.log(messages.noIOSSimulatorDevice);
    return false;
  }

  deps.log(messageStartingSimulator);
  try {
    deps.run('xcrun', ['simctl', 'boot', udid], { silent: true });
  } catch {
    // "Unable to boot device in current state: Booted" is fine
  }
  try {
    deps.run('open', ['-a', 'Simulator'], { silent: true });
  } catch {
    // best-effort
  }

  for (let i = 0; i < 20; i++) {
    await deps.sleep(500);
    try {
      const check = deps.run('xcrun', ['simctl', 'list', 'devices', 'booted']);
      if (/Booted/.test(check)) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function ensurePrototoAppMatchesProject(opts: EnsureOptions): Promise<void> {
  const deps: Deps = {
    run: opts.deps?.run ?? defaultRun,
    fetch: opts.deps?.fetch ?? fetch,
    computeSha256: opts.deps?.computeSha256 ?? defaultComputeSha256,
    extractTarball: opts.deps?.extractTarball ?? defaultExtractTarball,
    cacheRoot: opts.deps?.cacheRoot ?? defaultCacheRoot(),
    log: opts.deps?.log ?? (() => {}),
    sleep: opts.deps?.sleep ?? defaultSleep,
    downloadIOSPlatform: opts.deps?.downloadIOSPlatform ?? defaultDownloadIOSPlatform,
  };

  const projectMajor = readProjectExpoMajor(opts.cwd);
  if (!projectMajor) return;

  const isBooted = await ensureSimulatorBooted(deps);
  if (!isBooted) return;

  let apps = '';
  try {
    apps = deps.run('xcrun', ['simctl', 'listapps', 'booted']);
  } catch {
    return;
  }

  const installedVersion = parsePrototoAppVersion(apps);
  const installedMajor = installedVersion?.split('.')[0] ?? null;

  if (installedMajor && installedMajor === projectMajor) return; // up to date

  let manifest: Manifest | null = null;
  try {
    const res = await deps.fetch(buildManifestUrl(projectMajor));
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    manifest = (await res.json()) as Manifest;
  } catch {
    deps.log(messageOffline);
    return;
  }
  if (!manifest) return;

  fs.mkdirSync(deps.cacheRoot, { recursive: true });
  const cached = findCachedEntry(deps.cacheRoot, manifest.sdkMajor, manifest.sha256);
  let appPath: string | null = null;

  if (cached) {
    appPath = path.join(cached, 'Prototo.app');
  } else {
    const tarballPath = path.join(deps.cacheRoot, `download-${Date.now()}.tar.gz`);
    try {
      const res = await deps.fetch(buildTarballUrl(projectMajor));
      if (!res.ok) throw new Error(`tarball fetch failed: ${res.status}`);
      const body = res.body;
      if (body) {
        await pipeline(
          Readable.fromWeb(body as unknown as import('node:stream/web').ReadableStream),
          fs.createWriteStream(tarballPath),
        );
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(tarballPath, buf);
      }
    } catch {
      fs.rmSync(tarballPath, { force: true });
      deps.log(messageOffline);
      return;
    }

    const actualHash = await deps.computeSha256(tarballPath);
    if (actualHash !== manifest.sha256) {
      deps.log(messageHashMismatch);
      fs.rmSync(tarballPath, { force: true });
      return;
    }

    const entryDir = path.join(deps.cacheRoot, `${manifest.sdkMajor}-${manifest.sha256.slice(0, 12)}`);
    await deps.extractTarball(tarballPath, entryDir);
    fs.writeFileSync(path.join(entryDir, 'manifest.json'), JSON.stringify(manifest));
    fs.rmSync(tarballPath, { force: true });
    appPath = path.join(entryDir, 'Prototo.app');
  }

  if (apps.includes(PROTOTO_APP_BUNDLE_ID)) {
    try {
      deps.run('xcrun', ['simctl', 'uninstall', 'booted', PROTOTO_APP_BUNDLE_ID], { silent: true });
    } catch {
      // best-effort
    }
  }

  deps.log(messageInstalling);
  try {
    deps.run('xcrun', ['simctl', 'install', 'booted', appPath]);
  } catch {
    deps.log(messageInstallFailed);
  }
}
