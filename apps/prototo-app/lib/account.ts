export type DeleteAccountResult = { ok: true } | { ok: false; reason: 'unauthorized' | 'network' };

const API_BASE = 'https://prototo.app';

export async function deleteAccount(
  accessToken: string,
  opts: { fetch?: typeof fetch; baseUrl?: string } = {},
): Promise<DeleteAccountResult> {
  const fetchFn = opts.fetch ?? fetch;
  const base = opts.baseUrl ?? API_BASE;

  let res: Response;
  try {
    res = await fetchFn(`${base}/api/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (res.status === 401) return { ok: false, reason: 'unauthorized' };
  if (!res.ok) return { ok: false, reason: 'network' };
  return { ok: true };
}
