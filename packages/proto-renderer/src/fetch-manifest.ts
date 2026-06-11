import type { Manifest } from '@sherizan/proto-manifest';

// Override at build time for staging/local validation; defaults to production.
export const SHARE_API_BASE = process.env.EXPO_PUBLIC_SHARE_API_BASE ?? 'https://prototo.app';

// Share tokens are 5-char Crockford base32 (no I/L/O/U).
const TOKEN = '[0-9A-HJ-NP-TV-Z]{5}';
const BARE_TOKEN = new RegExp(`^${TOKEN}$`, 'i');
const URL_TOKEN = new RegExp(`/p/(${TOKEN})(?:[/?#]|$)`, 'i');

// Extracts the token from an App Clip invocation / share URL (https://prototo.app/p/<token>).
export function tokenFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(URL_TOKEN);
  return m ? m[1].toUpperCase() : null;
}

// Parses user input from the viewer's "open a prototype" field: either a bare
// 5-char code or a full prototo.app/p/<token> link.
export function tokenFromInput(input: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (BARE_TOKEN.test(trimmed)) return trimmed.toUpperCase();
  return tokenFromUrl(trimmed);
}

export type FetchManifestResult =
  | { ok: true; manifest: Manifest; appName: string; designerName: string }
  | { ok: false; kind: 'expired' | 'unreachable'; message: string };

export type FetchManifestOptions = {
  fetch?: typeof fetch;
  baseUrl?: string;
};

const EXPIRED_MESSAGE = "This prototype link isn't active anymore.";
const UNREACHABLE_MESSAGE = "Couldn't load this prototype.";
const OFFLINE_MESSAGE = "Couldn't reach Prototo. Check your connection.";

// Fetches a shared prototype manifest by token. Never throws — returns a typed
// result so the clip and the viewer can render the same friendly states.
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

  let body: { manifest?: Manifest; appName?: string; designerName?: string };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, kind: 'unreachable', message: OFFLINE_MESSAGE };
  }

  if (!body || typeof body !== 'object' || !body.manifest) {
    return { ok: false, kind: 'unreachable', message: UNREACHABLE_MESSAGE };
  }

  const manifest = body.manifest;
  return {
    ok: true,
    manifest,
    appName: body.appName || manifest.app?.name || 'Prototype',
    designerName: body.designerName || 'Someone',
  };
}
