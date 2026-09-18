import { redirectConnectPath } from '../lib/connect-intent';

// expo-router hook: rewrite incoming system URLs before routing. Connect links
// (desktop / proto start QR, Camera app) go to /open for feedback.
export function redirectSystemPath({ path }: { path: string | null; initial: boolean }) {
  return redirectConnectPath(path) ?? path;
}
