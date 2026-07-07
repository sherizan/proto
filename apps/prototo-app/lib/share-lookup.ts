const SHARE_PROJECT_ID = '8c8ddf7d-1f6a-4b21-a7cc-116ec4d72c6d';
// Two trusted shapes the dev client will load+run: the legacy central EAS Update
// project on u.expo.dev, and prototo.app's own self-hosted manifest (see
// prototo-website lib/bundle.ts). Nothing else — a bad host could run arbitrary code.
const SHARE_DEEP_LINK_RE = new RegExp(
  '^prototo://expo-development-client/\\?url=(' +
    `https://u\\.expo\\.dev/${SHARE_PROJECT_ID}/group/[0-9a-fA-F-]{8,}` +
    '|https://prototo\\.app/api/manifest/[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}' +
    ')$',
);

/** True only for a deep link pinned to a trusted share host — the dev client will load+run it. */
export function isValidShareDeepLink(deepLink: string): boolean {
  return SHARE_DEEP_LINK_RE.test(deepLink.trim());
}

/** The inner prototo.app manifest URL, or null for legacy u.expo.dev links. */
export function manifestUrlFromDeepLink(deepLink: string): string | null {
  const match = /\?url=(https:\/\/prototo\.app\/api\/manifest\/[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12})$/.exec(
    deepLink.trim(),
  );
  return match ? match[1] : null;
}

// A request that never settles left the share screen on an eternal spinner
// (field report, build 28). Abort after this long and let the caller's
// error/fail-open path take over. Manual controller: AbortSignal.timeout is
// not a given on Hermes.
const FETCH_TIMEOUT_MS = 15_000;

function withTimeout(fetchFn: typeof fetch, url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetchFn(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * The runtimeVersion a self-hosted share was published with, read from its manifest
 * (the website serializes the manifest JSON verbatim inside the multipart body, so a
 * field match is reliable). null on any failure — callers fail open and load anyway.
 */
export async function fetchManifestRuntimeVersion(
  deepLink: string,
  opts: { fetch?: typeof fetch } = {},
): Promise<string | null> {
  const url = manifestUrlFromDeepLink(deepLink);
  if (!url) return null;
  const fetchFn = opts.fetch ?? fetch;
  try {
    const res = await withTimeout(fetchFn, url);
    if (!res.ok) return null;
    const body = await res.text();
    return /"runtimeVersion"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? null;
  } catch {
    return null;
  }
}

export type ShareInfo = { designerName: string; appName: string; deepLink: string };
export type ShareResult =
  | { ok: true; share: ShareInfo }
  | { ok: false; reason: 'not-found' | 'network' | 'invalid' };

const SHARE_API_BASE = 'https://prototo.app';

/** Anonymously resolve a share token to its run target. Never throws. */
export async function fetchShare(
  token: string,
  opts: { fetch?: typeof fetch; baseUrl?: string } = {},
): Promise<ShareResult> {
  const fetchFn = opts.fetch ?? fetch;
  const base = opts.baseUrl ?? SHARE_API_BASE;

  let res: Response;
  try {
    res = await withTimeout(fetchFn, `${base}/api/share/${encodeURIComponent(token)}`);
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (res.status === 404) return { ok: false, reason: 'not-found' };
  if (!res.ok) return { ok: false, reason: 'network' };

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'network' };
  }

  const b = body as { designerName?: unknown; appName?: unknown; deepLink?: unknown };
  if (
    typeof b.designerName !== 'string' ||
    typeof b.appName !== 'string' ||
    typeof b.deepLink !== 'string' ||
    !isValidShareDeepLink(b.deepLink)
  ) {
    return { ok: false, reason: 'invalid' };
  }
  return {
    ok: true,
    share: { designerName: b.designerName, appName: b.appName, deepLink: b.deepLink },
  };
}
