import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const PROTOTO_APP_BUNDLE_ID = 'com.sherizan.prototo';
const RELEASE_OWNER = 'sherizan';
const RELEASE_REPO = 'proto';

export type Manifest = {
  sdkMajor: number;
  sha256: string;
  builtAt: string;
};

export type RunCommand = (cmd: string, args: string[], opts?: { silent?: boolean }) => string;

export type Deps = {
  run: RunCommand;
  fetch: typeof fetch;
  computeSha256: (filePath: string) => Promise<string>;
  extractTarball: (archivePath: string, into: string) => Promise<void>;
  cacheRoot: string;
  log: (message: string) => void;
};

export type EnsureOptions = {
  cwd: string;
  deps?: Partial<Deps>;
};

const messageOffline =
  "The Simulator's Prototo is older than this project. Connect to the internet, then run proto start to refresh it.";
const messageInstalling = 'Setting up Prototo on the Simulator…';
const messageHashMismatch =
  "Couldn't verify the downloaded Prototo (hash mismatch). Run proto start again to retry.";

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

export async function ensurePrototoAppMatchesProject(opts: EnsureOptions): Promise<void> {
  const deps: Deps = {
    run: opts.deps?.run ?? defaultRun,
    fetch: opts.deps?.fetch ?? fetch,
    computeSha256: opts.deps?.computeSha256 ?? defaultComputeSha256,
    extractTarball: opts.deps?.extractTarball ?? defaultExtractTarball,
    cacheRoot: opts.deps?.cacheRoot ?? defaultCacheRoot(),
    log: opts.deps?.log ?? (() => {}),
  };

  const projectMajor = readProjectExpoMajor(opts.cwd);
  if (!projectMajor) return;

  let booted = '';
  try {
    booted = deps.run('xcrun', ['simctl', 'list', 'devices', 'booted']);
  } catch {
    return;
  }
  if (!/Booted/.test(booted)) return;

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

  if (installedVersion) {
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
    // Surface as silent failure; expo start will still try to run.
  }
}
