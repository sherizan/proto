// No expiresAt: published links are permanent since the pricing relaunch (the
// server still sends a legacy far-future stamp for old clients; ignore it).
export type MyShare = { token: string; appName: string; createdAt: string };
export type MySharesResult =
  | { ok: true; shares: MyShare[] }
  | { ok: false; reason: 'unauthorized' | 'network' };

const API_BASE = 'https://prototo.app';

export async function fetchMyShares(
  accessToken: string,
  opts: { fetch?: typeof fetch; baseUrl?: string } = {},
): Promise<MySharesResult> {
  const fetchFn = opts.fetch ?? fetch;
  const base = opts.baseUrl ?? API_BASE;

  let res: Response;
  try {
    res = await fetchFn(`${base}/api/shares`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (res.status === 401) return { ok: false, reason: 'unauthorized' };
  if (!res.ok) return { ok: false, reason: 'network' };

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'network' };
  }
  const rows = (body as { shares?: unknown }).shares;
  if (!Array.isArray(rows)) return { ok: false, reason: 'network' };

  const shares: MyShare[] = [];
  for (const r of rows) {
    const s = r as Record<string, unknown>;
    if (
      typeof s.token === 'string' &&
      typeof s.appName === 'string' &&
      typeof s.createdAt === 'string'
    ) {
      shares.push({ token: s.token, appName: s.appName, createdAt: s.createdAt });
    }
  }
  return { ok: true, shares };
}
