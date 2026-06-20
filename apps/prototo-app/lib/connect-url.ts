const SCHEME = 'prototo';
const DEV_CLIENT_PREFIX = `${SCHEME}://expo-development-client/`;

/**
 * Turn a scanned QR payload into a deep link the native dev client can open,
 * or null if the QR is not a Prototo/Metro connect code.
 *
 * `proto start` prints a QR encoding `prototo://expo-development-client/?url=exp://<lan>:8081`.
 * Some Expo setups encode a bare `exp://<lan>:8081` instead — we wrap that.
 */
export function parseConnectUrl(data: string): string | null {
  const value = data.trim();
  if (!value) return null;
  if (value.startsWith(DEV_CLIENT_PREFIX)) return value;
  if (value.startsWith('exp://')) return `${DEV_CLIENT_PREFIX}?url=${value}`;
  return null;
}
