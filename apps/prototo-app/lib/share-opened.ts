// Fire-and-forget funnel ping: a recipient opened a shared prototype. Fires
// beside the local open-history write (app/p/[token].tsx); the server stores
// it in share_opens. Never awaited by callers, never throws, 3s cap — an
// analytics failure must not touch the open flow.

const API_BASE = 'https://prototo.app';

export async function pingShareOpened(
  token: string,
  accessToken: string | undefined,
  opts: { fetch?: typeof fetch; baseUrl?: string } = {},
): Promise<void> {
  const fetchFn = opts.fetch ?? fetch;
  const base = opts.baseUrl ?? API_BASE;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetchFn(`${base}/api/share/${encodeURIComponent(token)}/opened`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {
    // analytics only
  }
}
