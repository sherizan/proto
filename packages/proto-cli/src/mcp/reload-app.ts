import { execFileSync } from 'node:child_process';
import { PROTOTO_APP_BUNDLE_ID } from '../ensure-prototo-app.js';
import { messages } from '../messages.js';

// PERF-REPORT fix 2: root-layout/navigator changes don't apply via Fast
// Refresh — the agent had no way to cold-restart the app and burned ~6 tool
// calls discovering bundle ids and probing. This tool does the restart.
//
// Restart sequence mirrors Prototo Desktop's SIGSEGV-safe split (DC-07):
// terminate → plain launch (one runtime, settles) → THEN the connect deep
// link. openurl on a cold app would race two runtime inits inside
// ExpoModulesCore. `ui=bare` rides along only under PROTO_HEADLESS_SIM=1
// (claude inside Prototo Desktop inherits it; terminal users keep the Viewer
// menu) — same contract as the desktop's own connect link (CONTRACTS.md).

type RunCommand = (cmd: string, args: string[]) => string;

export type ReloadDeps = {
  run: RunCommand;
  sleep: (ms: number) => Promise<void>;
  env: NodeJS.ProcessEnv;
};

const defaultDeps: ReloadDeps = {
  run: (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  env: process.env,
};

export async function runReloadApp(opts: { deps?: Partial<ReloadDeps> } = {}): Promise<string> {
  const deps = { ...defaultDeps, ...opts.deps };

  let booted = '';
  try {
    booted = deps.run('xcrun', ['simctl', 'list', 'devices', 'booted']);
  } catch {
    return messages.reloadNoSimulator;
  }
  if (!booted.includes('Booted')) return messages.reloadNoSimulator;

  try {
    deps.run('xcrun', ['simctl', 'terminate', 'booted', PROTOTO_APP_BUNDLE_ID]);
  } catch {
    // not running — fine, we're about to launch it
  }

  try {
    deps.run('xcrun', ['simctl', 'launch', 'booted', PROTOTO_APP_BUNDLE_ID]);
  } catch {
    return messages.reloadLaunchFailed;
  }
  await deps.sleep(3000);

  const bare = deps.env.PROTO_HEADLESS_SIM === '1' ? '&ui=bare' : '';
  const url = `prototo://expo-development-client/?url=${encodeURIComponent('http://localhost:8081')}${bare}`;
  try {
    deps.run('xcrun', ['simctl', 'openurl', 'booted', url]);
  } catch {
    return messages.reloadLaunchFailed;
  }

  return messages.reloadDone;
}
