import { execFileSync } from 'node:child_process';
import { messages } from '../messages.js';
import { SHARE_API_BASE_DEFAULT } from '../share-api.js';
import { parseShareToken } from './remix.js';

// Open a published share in the Simulator. The Simulator's Prototo app is a
// development build: its home is expo-dev-launcher, not the phone app's shell,
// so a prototo.app/p/<token> link has no router to land on (or lands on the
// running project's router: "Unmatched Route"). Resolve the token the way the
// phone app does, then hand the dev-client link to the Simulator with ui=bare,
// which the native host loads directly, the same path Prototo Desktop uses.

const DEEP_LINK_PREFIX = 'prototo://expo-development-client/?url=';

export type OpenDeps = {
  run: (cmd: string, args: string[]) => string;
  fetch: typeof fetch;
  env: NodeJS.ProcessEnv;
  log: (m: string) => void;
};

const defaultDeps: OpenDeps = {
  run: (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }),
  fetch: (...a) => fetch(...a),
  env: process.env,
  log: (m) => console.log(m),
};

/** Resolves true when the share was handed to the Simulator. */
export async function runOpen(opts: {
  target: string | undefined;
  deps?: Partial<OpenDeps>;
}): Promise<boolean> {
  const deps = { ...defaultDeps, ...opts.deps };
  const token = parseShareToken(opts.target);
  if (!token) {
    deps.log(messages.openUsage);
    return false;
  }

  try {
    if (!deps.run('xcrun', ['simctl', 'list', 'devices', 'booted']).includes('Booted')) {
      deps.log(messages.reloadNoSimulator);
      return false;
    }
  } catch {
    deps.log(messages.reloadNoSimulator);
    return false;
  }

  const base = deps.env.PROTO_SHARE_API_BASE || SHARE_API_BASE_DEFAULT;
  let deepLink: unknown;
  try {
    const res = await deps.fetch(`${base}/api/share/${token}`);
    if (res.status === 404) {
      deps.log(messages.openNotFound);
      return false;
    }
    if (!res.ok) throw new Error(`share lookup ${res.status}`);
    deepLink = ((await res.json()) as { deepLink?: unknown }).deepLink;
  } catch {
    deps.log(messages.openNetwork);
    return false;
  }
  if (typeof deepLink !== 'string' || !deepLink.startsWith(DEEP_LINK_PREFIX)) {
    deps.log(messages.openNotFound);
    return false;
  }

  try {
    deps.run('xcrun', ['simctl', 'openurl', 'booted', `${deepLink}&ui=bare`]);
  } catch {
    deps.log(messages.reloadLaunchFailed);
    return false;
  }
  deps.log(messages.openDone);
  return true;
}
