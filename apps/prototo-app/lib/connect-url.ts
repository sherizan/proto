const DEV_CLIENT_PREFIX = 'prototo://expo-development-client/';
const INNER_RE = /^(?:exp|exps|http|https):\/\/([^/:?#]+)(?::(\d+))?/i;

/** Loopback, RFC-1918 private, and link-local IPv4 hosts (plus localhost / ::1) only. */
function isLocalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1') return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  const m = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(h);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * Turn a scanned QR payload into a deep link the native dev client can open,
 * or null if it is not a safe Prototo/Metro connect code.
 *
 * `proto start` prints a QR encoding `prototo://expo-development-client/?url=exp://<lan>:8081`;
 * some Expo setups encode a bare `exp://<lan>:8081` instead. The dev client loads + runs JS
 * from whatever URL we open, so we never trust the scanned target: we re-extract the inner
 * Metro URL (even from a prototo://…?url=… link) and accept only loopback / private / link-local
 * hosts — a designer's own dev server is always on their LAN, never the public internet.
 */
export function parseConnectUrl(data: string): string | null {
  const value = data.trim();
  if (!value) return null;

  let inner: string | null = null;
  if (value.startsWith(DEV_CLIENT_PREFIX)) {
    const query = value.slice(DEV_CLIENT_PREFIX.length).replace(/^\?/, '');
    inner = new URLSearchParams(query).get('url');
  } else if (value.startsWith('exp://')) {
    inner = value;
  }
  if (!inner) return null;

  const target = inner.trim();
  const match = INNER_RE.exec(target);
  if (!match || !isLocalHost(match[1])) return null;

  return `${DEV_CLIENT_PREFIX}?url=${target}`;
}
