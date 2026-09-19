// Fire-and-forget funnel ping: a recipient opened a shared prototype. Fires
// beside the local open-history write (app/p/[token].tsx); the server stores
// it in share_opens. Never awaited by callers, never throws, 3s cap — an
// analytics failure must not touch the open flow.

const API_BASE = 'https://prototo.app';

// Why an open could not proceed. `stale_runtime` = the share was published for an
// older Prototo runtime than this app runs; the server emails the owner to
// re-publish (once per share per day).
export type ShareOpenReason = { reason: 'stale_runtime'; published: string; own: string };

export async function pingShareOpened(
  token: string,
  accessToken: string | undefined,
  opts: { fetch?: typeof fetch; baseUrl?: string; body?: ShareOpenReason } = {},
): Promise<void> {
  const fetchFn = opts.fetch ?? fetch;
  const base = opts.baseUrl ?? API_BASE;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetchFn(`${base}/api/share/${encodeURIComponent(token)}/opened`, {
      method: 'POST',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {
    // analytics only
  }
}
