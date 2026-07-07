const SHARE_HOST = 'prototo.app';
// 12-char Crockford base32 (no I, L, O, U) — the share-token shape minted by the CLI.
const TOKEN_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/;

/**
 * Pull the share token out of a `https://prototo.app/p/<token>` link, its
 * scheme-normalized form (`prototo:///p/<token>` / `prototo://p/<token>`, how iOS
 * re-emits an already-opened universal link), or a bare token. Returns null for
 * anything else. Rejects other hosts so a look-alike URL can't drive the app.
 */
export function parseShareLink(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (TOKEN_RE.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  let path: string;
  if (url.protocol === 'https:' && url.hostname === SHARE_HOST) {
    path = url.pathname;
  } else if (url.protocol === 'prototo:') {
    // prototo://p/<token> parses the first segment as the host; fold it back in.
    path = url.hostname ? `/${url.hostname}${url.pathname}` : url.pathname;
  } else {
    return null;
  }

  const match = /^\/p\/([^/]+)\/?$/.exec(path);
  if (!match) return null;

  const token = match[1];
  return TOKEN_RE.test(token) ? token : null;
}
