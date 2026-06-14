import { execFileSync, spawn as nodeSpawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readCliToken as defaultReadCliToken } from '../cli-token.js';
import { messages } from '../messages.js';
import {
  StudioApiError,
  type StudioCreateResponse,
  createStudioSession as defaultCreateStudioSession,
  markStudioReady as defaultMarkStudioReady,
  uploadRecording as defaultUploadRecording,
  studioPageUrl,
} from '../studio-api.js';
import { terminalLink } from '../terminal-link.js';
import { runLogin as defaultRunLogin } from './login.js';

/**
 * A running Simulator recording. `stop()` finalises the MP4 and resolves;
 * `failed` resolves (with a friendly message) only if the recorder dies on its
 * own before stop() is called — e.g. the host recorder is busy, or the device
 * went away. Used so a recorder that never started isn't mistaken for a capture.
 */
export type RecordingHandle = {
  stop: () => Promise<void>;
  failed: Promise<string>;
};

export type RecordOrchestratorDeps = {
  readCliToken: () => string | null;
  login: () => Promise<string | null>;
  isSimulatorBooted: () => boolean;
  /** Booted Simulator device name, e.g. "iPhone 17 Pro", or null. */
  getDeviceName: () => string | null;
  startRecording: (outPath: string) => RecordingHandle;
  /** Resolves when the designer presses Ctrl+C. */
  waitForStop: () => Promise<void>;
  readRecording: (outPath: string) => Uint8Array;
  createSession: (accountToken: string, device: string | null) => Promise<StudioCreateResponse>;
  uploadRecording: (uploadUrl: string, body: Uint8Array) => Promise<void>;
  markReady: (sessionToken: string, accountToken: string) => Promise<void>;
  pageUrl: (sessionToken: string) => string;
  openBrowser: (url: string) => void;
  now: () => number;
  tmpDir: () => string;
  log: (m: string) => void;
};

function bootedDevicesOutput(): string {
  return execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted']).toString();
}

function defaultIsSimulatorBooted(): boolean {
  try {
    return /Booted/.test(bootedDevicesOutput());
  } catch {
    return false;
  }
}

function defaultGetDeviceName(): string | null {
  try {
    const line = bootedDevicesOutput()
      .split('\n')
      .find((l) => /\(Booted\)/.test(l));
    if (!line) return null;
    // e.g. "    iPhone 17 Pro (EA27A92D-...-...) (Booted)" → "iPhone 17 Pro"
    const match = line.trim().match(/^(.+?)\s+\([0-9A-Fa-f-]{36}\)\s+\(Booted\)/);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

function defaultStartRecording(outPath: string): RecordingHandle {
  // recordVideo records until it receives SIGINT, then writes the moov atom and
  // exits — so stop() MUST send SIGINT (not SIGTERM/KILL) to get a playable file.
  const child = nodeSpawn(
    'xcrun',
    ['simctl', 'io', 'booted', 'recordVideo', '--codec=h264', outPath],
    { stdio: 'ignore' },
  );
  let stopping = false;
  let exited = false;
  child.on('exit', () => {
    exited = true;
  });

  // If recordVideo can't start (display busy, device gone), it exits on its own
  // within a moment. Surface that instead of silently "finishing" with no file.
  const failed = new Promise<string>((resolve) => {
    child.on('error', () => {
      if (!stopping) resolve(messages.recordFailed);
    });
    child.on('exit', () => {
      if (!stopping) resolve(messages.recordFailed);
    });
  });

  return {
    failed,
    stop: () =>
      new Promise<void>((resolve) => {
        stopping = true;
        if (exited) {
          resolve();
          return;
        }
        child.on('exit', () => resolve());
        child.kill('SIGINT');
      }),
  };
}

function defaultWaitForStop(): Promise<void> {
  // Override Node's default SIGINT (which would exit the CLI) so Ctrl+C stops the
  // recording and lets us finish the upload.
  return new Promise<void>((resolve) => {
    process.once('SIGINT', () => resolve());
  });
}

function defaultOpenBrowser(url: string): void {
  try {
    execFileSync('open', [url]);
  } catch {
    // Non-fatal: the URL is printed too, so the designer can open it manually.
  }
}

function buildDefaults(): RecordOrchestratorDeps {
  return {
    readCliToken: () => defaultReadCliToken(),
    login: () => defaultRunLogin(),
    isSimulatorBooted: defaultIsSimulatorBooted,
    getDeviceName: defaultGetDeviceName,
    startRecording: defaultStartRecording,
    waitForStop: defaultWaitForStop,
    readRecording: (p) => readFileSync(p),
    createSession: (token, device) => defaultCreateStudioSession({ token, device }),
    uploadRecording: (uploadUrl, body) => defaultUploadRecording(uploadUrl, body),
    markReady: (sessionToken, accountToken) =>
      defaultMarkStudioReady(sessionToken, { token: accountToken }),
    pageUrl: (sessionToken) => studioPageUrl(sessionToken),
    openBrowser: defaultOpenBrowser,
    now: () => Date.now(),
    tmpDir: () => os.tmpdir(),
    log: (m) => console.log(m),
  };
}

function mapStudioError(err: unknown): string | null {
  if (err instanceof StudioApiError) {
    if (err.kind === 'unauthorized') return messages.recordLoginExpired;
    if (err.kind === 'rate-limited') return messages.recordRateLimited;
    return messages.recordUploadFailed;
  }
  return null;
}

/**
 * `proto record` — capture the running Simulator session, wrap it in Prototo
 * Studio, and open the browser to export it. Requires a Prototo account (free):
 * recording + export work on free, exports just carry a watermark.
 */
export async function runRecord(injected?: Partial<RecordOrchestratorDeps>): Promise<void> {
  const deps: RecordOrchestratorDeps = { ...buildDefaults(), ...injected };

  // 1. Recording attaches to an account. Resolve the login first.
  let accountToken = deps.readCliToken();
  if (!accountToken) {
    deps.log(messages.recordNeedsLogin);
    accountToken = await deps.login();
    if (!accountToken) return;
  }

  // 2. Need a booted Simulator to record.
  if (!deps.isSimulatorBooted()) {
    deps.log(messages.recordNoSimulator);
    return;
  }
  const device = deps.getDeviceName();

  // 3. Record until Ctrl+C — unless the recorder dies on its own first (e.g. the
  //    host recorder is busy), in which case say so instead of exiting silently.
  const outPath = path.join(deps.tmpDir(), `proto-recording-${deps.now()}.mp4`);
  deps.log(messages.recordStarted);
  const recording = deps.startRecording(outPath);
  const outcome = await Promise.race([
    deps.waitForStop().then(() => 'stopped' as const),
    recording.failed.then((message) => ({ message })),
  ]);
  if (outcome !== 'stopped') {
    deps.log(outcome.message);
    return;
  }
  await recording.stop();
  deps.log(messages.recordSaving);

  // 4. Create the session, upload the MP4 directly to storage, confirm.
  try {
    const session = await deps.createSession(accountToken, device);
    const body = deps.readRecording(outPath);
    deps.log(messages.recordUploading);
    await deps.uploadRecording(session.uploadUrl, body);
    await deps.markReady(session.token, accountToken);

    // 5. Open Studio.
    const url = deps.pageUrl(session.token);
    deps.openBrowser(url);
    deps.log(messages.recordSaved(terminalLink(url)));
  } catch (err) {
    deps.log(mapStudioError(err) ?? messages.recordUploadFailed);
  }
}
