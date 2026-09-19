// A dev-client connect link (the desktop's "Preview on iPhone" QR, `proto
// start`'s QR, the Camera app handing us the same URL) has no route of its
// own — expo-router would land on +not-found. Send it to /open, which shows
// "Connecting to your Mac…" and surfaces a failed connect instead of nothing.
const DEV_CLIENT_PREFIX = 'prototo://expo-development-client/';

/** The /open href for a connect link, or undefined to leave the path alone. */
export function redirectConnectPath(path: string | null | undefined): string | undefined {
  if (!path || !path.startsWith(DEV_CLIENT_PREFIX)) return undefined;
  return `/open?url=${encodeURIComponent(path)}`;
}
