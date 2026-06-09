import fs from 'node:fs';
import path from 'node:path';
import { buildManifestUrl } from './ensure-prototo-app.js';
import { messages } from './messages.js';

/**
 * A package needs to be compiled into the Prototo dev-client (a "native module")
 * when its installed folder carries native-build metadata. Pure-JS packages never do.
 */
export function isNativeModule(pkg: string, projectRoot: string): boolean {
  const dir = path.join(projectRoot, 'node_modules', ...pkg.split('/'));
  try {
    if (fs.existsSync(path.join(dir, 'expo-module.config.json'))) return true;
    if (fs.existsSync(path.join(dir, 'app.plugin.js'))) return true;
    return fs.readdirSync(dir).some((entry) => entry.endsWith('.podspec'));
  } catch {
    return false;
  }
}

export function readProjectDependencies(root: string): string[] {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  } catch {
    return [];
  }
}

export function readProjectSdkMajor(root: string): string | null {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'node_modules', 'expo', 'package.json'), 'utf8'),
    );
    return typeof pkg.version === 'string' ? pkg.version.split('.')[0] : null;
  } catch {
    return null;
  }
}

/** Native project deps that the Prototo dev-client doesn't bundle. Pure + fully injectable. */
export function computeUnsupported(
  projectDeps: string[],
  bundled: Iterable<string>,
  isNative: (pkg: string) => boolean,
): string[] {
  const bundledSet = new Set(bundled);
  return projectDeps.filter((dep) => !bundledSet.has(dep) && isNative(dep));
}

export type WarnDeps = {
  fetch: typeof fetch;
  isNative: (pkg: string) => boolean;
  readDeps: (root: string) => string[];
  readSdkMajor: (root: string) => string | null;
  log: (message: string) => void;
};

/**
 * Best-effort: warn when the project depends on a native module the installed Prototo can't
 * load. Honest about the fact that the designer can't rebuild it themselves. Any failure
 * (offline, no manifest, or a build whose manifest predates `nativeModules`) is a silent
 * no-op — never a false alarm.
 */
export async function warnUnsupportedNativeModules(opts: {
  cwd: string;
  only?: string[];
  deps?: Partial<WarnDeps>;
}): Promise<string[]> {
  const deps: WarnDeps = {
    fetch: opts.deps?.fetch ?? fetch,
    isNative: opts.deps?.isNative ?? ((pkg) => isNativeModule(pkg, opts.cwd)),
    readDeps: opts.deps?.readDeps ?? readProjectDependencies,
    readSdkMajor: opts.deps?.readSdkMajor ?? readProjectSdkMajor,
    log: opts.deps?.log ?? (() => {}),
  };

  try {
    const sdkMajor = deps.readSdkMajor(opts.cwd);
    if (!sdkMajor) return [];

    const res = await deps.fetch(buildManifestUrl(sdkMajor));
    if (!res.ok) return [];
    const manifest = (await res.json()) as { nativeModules?: unknown };
    if (!Array.isArray(manifest.nativeModules)) return [];

    const candidates = opts.only ?? deps.readDeps(opts.cwd);
    const unsupported = computeUnsupported(
      candidates,
      manifest.nativeModules as string[],
      deps.isNative,
    );
    if (unsupported.length > 0) {
      deps.log(messages.nativeNeedsPrototoUpdate(unsupported));
    }
    return unsupported;
  } catch {
    return [];
  }
}
