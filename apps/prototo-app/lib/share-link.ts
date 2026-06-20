const SHARE_HOST = 'prototo.app';
// 12-char Crockford base32 (no I, L, O, U) — the share-token shape minted by the CLI.
const TOKEN_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/;

/**
 * Pull the share token out of a `https://prototo.app/p/<token>` link (or a bare token),
 * or null if the input is not a valid Prototo share reference. Rejects other hosts so a
 * look-alike URL can't drive the app.
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
  if (url.protocol !== 'https:' || url.hostname !== SHARE_HOST) return null;

  const match = /^\/p\/([^/]+)\/?$/.exec(url.pathname);
  if (!match) return null;

  const token = match[1];
  return TOKEN_RE.test(token) ? token : null;
}
