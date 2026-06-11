import type { Manifest } from '@sherizan/proto-manifest';

// Override at build time for staging/local validation; defaults to production.
export const SHARE_API_BASE = process.env.EXPO_PUBLIC_SHARE_API_BASE ?? 'https://prototo.app';

export type FetchManifestResult =
  | { ok: true; manifest: Manifest }
  | { ok: false; kind: 'expired' | 'unreachable'; message: string };

export type FetchManifestOptions = {
  fetch?: typeof fetch;
  baseUrl?: string;
};

const EXPIRED_MESSAGE = "This prototype link isn't active anymore.";
const UNREACHABLE_MESSAGE = "Couldn't load this prototype.";
const OFFLINE_MESSAGE = "Couldn't reach Prototo. Check your connection.";

// Fetches a shared prototype manifest by token. Never throws — returns a typed
// result so the clip and the in-app viewer can render the same friendly states.
export async function fetchManifest(
  token: string,
  opts: FetchManifestOptions = {},
): Promise<FetchManifestResult> {
  if (!token.trim()) {
    return { ok: false, kind: 'expired', message: EXPIRED_MESSAGE };
  }

  const fetchFn = opts.fetch ?? fetch;
  const baseUrl = opts.baseUrl ?? SHARE_API_BASE;

  let res: Response;
  try {
    res = await fetchFn(`${baseUrl}/api/share/${encodeURIComponent(token)}`);
  } catch {
    return { ok: false, kind: 'unreachable', message: OFFLINE_MESSAGE };
  }

  if (res.status === 404) {
    return { ok: false, kind: 'expired', message: EXPIRED_MESSAGE };
  }
  if (!res.ok) {
    return { ok: false, kind: 'unreachable', message: UNREACHABLE_MESSAGE };
  }

  let body: { manifest?: Manifest };
  try {
    body = (await res.json()) as { manifest?: Manifest };
  } catch {
    return { ok: false, kind: 'unreachable', message: OFFLINE_MESSAGE };
  }

  if (!body || typeof body !== 'object' || !body.manifest) {
    return { ok: false, kind: 'unreachable', message: UNREACHABLE_MESSAGE };
  }

  return { ok: true, manifest: body.manifest };
}
