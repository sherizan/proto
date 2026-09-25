import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { messages } from './messages.js';
import { readProjectSdkMajor } from './native-modules.js';

// Update notifier. On `proto start` we ask prototo.app whether a newer proto-cli
// is published and, if so, nudge the designer (with a few "what's new" highlights)
// to run `proto upgrade`. Fully fail-open + throttled to ~once/day; the check must
// never delay or break startup. Mirrors the share-api fail-open + PROTO_SHARE_API_BASE
// conventions, and the ~/.prototo/ on-disk cache pattern from cli-token.ts.

const UPDATE_API_BASE_DEFAULT = 'https://prototo.app';
const CHECK_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2000;

function resolveBaseUrl(baseUrl?: string): string {
  if (baseUrl) return baseUrl;
  const env = process.env.PROTO_SHARE_API_BASE;
  return env && env.length > 0 ? env : UPDATE_API_BASE_DEFAULT;
}

/** Compare two `x.y.z` versions. <0 if a is older, 0 equal, >0 if a is newer. */
export function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** This CLI's own version, read from its package.json (dist/.. or src/..). */
export function getCliVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8')) as {
      version?: unknown;
    };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// The Prototo runtime currently shipping in the Viewer / dev client. Additive:
// older servers omit it and every consumer treats "unknown" as "don't nudge".
export const RuntimeInfoSchema = z.object({ version: z.string(), expoMajor: z.number() });
export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;

export const UpdateInfoSchema = z.object({
  latest: z.string().nullable().optional(),
  highlights: z.array(z.string()).default([]),
  changelogUrl: z.string().optional(),
  runtime: RuntimeInfoSchema.optional(),
});
export type UpdateInfo = z.infer<typeof UpdateInfoSchema>;

/** GET /api/cli/version. Fail-open: any error / non-200 / bad body → null. */
export async function fetchUpdateInfo(
  opts: { fetch?: typeof fetch; baseUrl?: string; timeoutMs?: number } = {},
): Promise<UpdateInfo | null> {
  const fetchFn = opts.fetch ?? fetch;
  const url = `${resolveBaseUrl(opts.baseUrl)}/api/cli/version`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    const res = (await fetchFn(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })) as Response;
    if (!res.ok) return null;
    const parsed = UpdateInfoSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---- on-disk throttle cache (~/.prototo/update-check.json) -------------------

export type UpdateCacheFs = {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string) => string;
  mkdirSync: (p: string, opts?: { recursive?: boolean }) => void;
  writeFileSync: (p: string, data: string) => void;
};

const defaultFs: UpdateCacheFs = {
  existsSync,
  readFileSync: (p) => readFileSync(p, 'utf8'),
  mkdirSync: (p, opts) => {
    mkdirSync(p, opts);
  },
  writeFileSync: (p, data) => writeFileSync(p, data),
};

export type UpdateCache = {
  lastCheckTime: number;
  latest: string | null;
  highlights: string[];
  changelogUrl?: string;
  runtime?: RuntimeInfo | null;
};

export type UpdateCacheDeps = { fs?: UpdateCacheFs; homedir?: () => string };

function cacheFilePath(homedir: () => string): string {
  return path.join(homedir(), '.prototo', 'update-check.json');
}

export function readUpdateCache(deps: UpdateCacheDeps = {}): UpdateCache | null {
  const fs = deps.fs ?? defaultFs;
  const homedir = deps.homedir ?? os.homedir;
  const file = cacheFilePath(homedir);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file)) as UpdateCache;
  } catch {
    return null;
  }
}

export function saveUpdateCache(cache: UpdateCache, deps: UpdateCacheDeps = {}): void {
  const fs = deps.fs ?? defaultFs;
  const homedir = deps.homedir ?? os.homedir;
  try {
    fs.mkdirSync(path.join(homedir(), '.prototo'), { recursive: true });
    fs.writeFileSync(cacheFilePath(homedir), `${JSON.stringify(cache, null, 2)}\n`);
  } catch {
    // best-effort — a write failure must never break startup
  }
}

// ---- orchestrator ------------------------------------------------------------

export type UpdateNudge = {
  current: string;
  latest: string;
  highlights: string[];
  changelogUrl?: string;
};

export type LoadUpdateInfoDeps = {
  now: () => number;
  readCache: () => UpdateCache | null;
  saveCache: (c: UpdateCache) => void;
  fetchInfo: () => Promise<UpdateInfo | null>;
  ttlMs?: number;
};

export type CheckForUpdateDeps = LoadUpdateInfoDeps & { currentVersion: string };

export type LoadedUpdateInfo = {
  latest: string | null;
  highlights: string[];
  changelogUrl?: string;
  runtime: RuntimeInfo | null;
};

/**
 * The cached-or-fetched `/api/cli/version` answer. Uses the cache when it's fresh
 * (<24h) so the network isn't hit every run; otherwise fetches and refreshes it,
 * falling back to a stale cache when offline. Null only when nothing is known.
 */
export async function loadUpdateInfo(deps: LoadUpdateInfoDeps): Promise<LoadedUpdateInfo | null> {
  const ttl = deps.ttlMs ?? CHECK_TTL_MS;
  const cache = deps.readCache();
  const fresh = cache !== null && deps.now() - cache.lastCheckTime < ttl;
  if (fresh && cache) return fromCache(cache);

  const info = await deps.fetchInfo();
  if (info) {
    const loaded: LoadedUpdateInfo = {
      latest: info.latest ?? null,
      highlights: info.highlights,
      changelogUrl: info.changelogUrl,
      runtime: info.runtime ?? null,
    };
    deps.saveCache({ lastCheckTime: deps.now(), ...loaded });
    return loaded;
  }
  // Offline / server hiccup: fall back to the last known result.
  return cache ? fromCache(cache) : null;
}

function fromCache(cache: UpdateCache): LoadedUpdateInfo {
  return {
    latest: cache.latest,
    highlights: cache.highlights,
    changelogUrl: cache.changelogUrl,
    runtime: cache.runtime ?? null,
  };
}

/**
 * Decide whether to nudge. Returns a nudge only when a strictly-newer version is
 * published; otherwise null. Never throws.
 */
export async function checkForUpdate(deps: CheckForUpdateDeps): Promise<UpdateNudge | null> {
  const info = await loadUpdateInfo(deps);
  if (!info?.latest) return null;
  if (compareSemver(deps.currentVersion, info.latest) >= 0) return null;
  return {
    current: deps.currentVersion,
    latest: info.latest,
    highlights: info.highlights,
    changelogUrl: info.changelogUrl,
  };
}

/**
 * One line when the project's installed Expo SDK is behind the runtime the current
 * Prototo ships — its shares wouldn't open until `proto upgrade` + `proto share`.
 * Unknown on either side → silent (fail-open).
 */
export function runtimeNudge(input: {
  projectMajor: string | null;
  runtime: RuntimeInfo | null;
}): string | null {
  if (!input.runtime || !input.projectMajor) return null;
  const major = Number.parseInt(input.projectMajor, 10);
  if (!Number.isFinite(major) || major >= input.runtime.expoMajor) return null;
  return messages.runtimeStale;
}

function realLoadDeps(): LoadUpdateInfoDeps {
  return {
    now: () => Date.now(),
    readCache: () => readUpdateCache(),
    saveCache: (c) => saveUpdateCache(c),
    fetchInfo: () => fetchUpdateInfo(),
  };
}

/**
 * The current Prototo runtime (throttled, fail-open → null). Pass `{ fresh: true }`
 * to skip the 24h cache TTL and force a live fetch — the cache can otherwise be up
 * to a day stale, which `proto upgrade` can't afford (it would verify a runtime
 * move against a stale target and report ok:true after a real flip). Still
 * fail-open: offline, it falls back to whatever's cached, of any age.
 */
export async function currentRuntime(opts: { fresh?: boolean } = {}): Promise<RuntimeInfo | null> {
  try {
    const deps = { ...realLoadDeps(), ...(opts.fresh ? { ttlMs: 0 } : {}) };
    return (await loadUpdateInfo(deps))?.runtime ?? null;
  } catch {
    return null;
  }
}

/**
 * Real-deps wiring for `proto start`: check (throttled, fail-open) and print the
 * nudge if behind. Wrapped so the update check can never delay or break startup.
 */
export async function notifyUpdate(
  log: (m: string) => void,
  opts: { root?: string; readSdkMajor?: (root: string) => string | null } = {},
): Promise<void> {
  try {
    const deps = realLoadDeps();
    const nudge = await checkForUpdate({ currentVersion: getCliVersion(), ...deps });
    if (nudge) log(messages.updateAvailable(nudge.current, nudge.latest, nudge.highlights));
    if (opts.root) {
      const info = await loadUpdateInfo(deps);
      const stale = runtimeNudge({
        projectMajor: (opts.readSdkMajor ?? readProjectSdkMajor)(opts.root),
        runtime: info?.runtime ?? null,
      });
      if (stale) log(stale);
    }
  } catch {
    // best-effort — never let the update check affect startup
  }
}
