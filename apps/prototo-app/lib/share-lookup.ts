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
    res = await fetchFn(`${base}/api/share/${encodeURIComponent(token)}`);
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
