import { execFile, execFileSync, spawn as nodeSpawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readCliToken as defaultReadCliToken } from '../cli-token.js';
import { type Countdown, startCountdown as defaultStartCountdown } from '../countdown.js';
import { messages } from '../messages.js';
import { openBrowser as defaultOpenBrowser } from '../open-browser.js';
import {
  StudioApiError,
  type StudioCreateResponse,
  createStudioSession as defaultCreateStudioSession,
  markStudioReady as defaultMarkStudioReady,
  studioOpenLink as defaultStudioOpenLink,
  uploadRecording as defaultUploadRecording,
  studioPageUrl,
} from '../studio-api.js';
import { terminalLink } from '../terminal-link.js';
import { runLogin as defaultRunLogin } from './login.js';

/** Recording cap when the server doesn't report one (older server) — the Free tier. */
const DEFAULT_CAP_SECONDS = 30;

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
  /** Project (folder) name to title the recording, e.g. the cwd's basename. */
  getProjectName: () => string | null;
  startRecording: (outPath: string) => RecordingHandle;
  /**
   * Tell `proto start`'s local server (port 3001) a recording is on/off, so the
   * scaffold's dev-only TouchDots overlay draws taps into the captured video.
   * Best-effort: swallow failures (older `proto start`, or none running).
   */
  setRecordingFlag: (on: boolean) => Promise<void>;
  /**
   * Losslessly remux the capture to a fast-start MP4; returns the new path, or
   * null to upload the raw file. simctl writes a QuickTime container (ftyp qt)
   * even with an .mp4 name, and Chrome's media loader intermittently stalls on
   * it at 0 bytes in Studio.
   */
  remux: (inPath: string) => Promise<string | null>;
  /** Resolves when the designer presses Enter to stop early. */
  waitForStop: () => Promise<void>;
  /** Live countdown to the tier's recording cap; `expired` fires the auto-stop. */
  startCountdown: (capSeconds: number) => Countdown;
  readRecording: (outPath: string) => Uint8Array;
  createSession: (
    accountToken: string,
    device: string | null,
    project: string | null,
  ) => Promise<StudioCreateResponse>;
  uploadRecording: (
    uploadUrl: string,
    body: Uint8Array,
    onProgress: (fraction: number) => void,
  ) => Promise<void>;
  /** Render upload progress in place (fraction 0..1). */
  renderProgress: (fraction: number) => void;
  markReady: (sessionToken: string, accountToken: string) => Promise<void>;
  pageUrl: (sessionToken: string) => string;
  /** One-time sign-in handoff URL so the browser opens Studio authed; null = fall back. */
  openLink: (sessionToken: string, accountToken: string) => Promise<string | null>;
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

function defaultGetProjectName(): string | null {
  // The folder `proto record` runs in, e.g. "my-app". Used to title the recording.
  const base = path.basename(process.cwd());
  return base && base !== '.' && base !== '/' ? base : null;
}

function defaultStartRecording(outPath: string): RecordingHandle {
  return spawnRecorder('xcrun', ['simctl', 'io', 'booted', 'recordVideo', '--codec=h264', outPath]);
}

// macOS's built-in avconvert (no ffmpeg dependency): PresetPassthrough copies
// the streams into a proper MP4 with fast-start on by default — no re-encode,
// sub-second for our clip sizes. Any failure → null → upload the raw capture.
async function defaultRemux(inPath: string): Promise<string | null> {
  const outPath = `${inPath.replace(/\.mp4$/, '')}-faststart.mp4`;
  return new Promise((resolve) => {
    execFile(
      '/usr/bin/avconvert',
      ['--preset', 'PresetPassthrough', '--source', inPath, '--output', outPath, '--replace'],
      { timeout: 60_000 },
      (err) => resolve(err ? null : outPath),
    );
  });
}

async function defaultSetRecordingFlag(on: boolean): Promise<void> {
  try {
    await fetch('http://127.0.0.1:3001/recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recording: on }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // proto start not running, or an older CLI without /recording — the
    // recording still works, taps just aren't drawn.
  }
}

/**
 * Spawn a screen recorder and return a handle whose `stop()` drives it to a
 * clean finish. `recordVideo` records until it receives SIGINT, then writes the
 * moov atom and exits — so stop() MUST send SIGINT (not SIGTERM/KILL) to get a
 * playable file. Exported so the spawn/stop primitive can be tested without a
 * Simulator (the production path was previously untested).
 */
export function spawnRecorder(command: string, args: string[]): RecordingHandle {
  const child = nodeSpawn(command, args, { stdio: 'ignore' });
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

/**
 * Resolve when the designer asks to stop. We read a keypress from stdin rather
 * than intercepting Ctrl+C: under `npx`, the terminal delivers SIGINT to the
 * whole process group (the npx wrapper, this CLI, and the recorder child) at
 * once, and the CLI was being killed before it could finish the upload + open
 * Studio. Stopping on stdin data sidesteps that race entirely; Ctrl+C stays a
 * plain cancel. When there's no interactive stdin (piped / CI), fall back to
 * SIGINT so non-interactive callers can still stop.
 */
export function defaultWaitForStop(input?: NodeJS.ReadableStream): Promise<void> {
  if (input === undefined && !process.stdin.isTTY) {
    return new Promise<void>((resolve) => {
      process.once('SIGINT', () => resolve());
    });
  }
  const stream = input ?? process.stdin;
  return new Promise<void>((resolve) => {
    const onData = () => {
      stream.off('data', onData);
      stream.pause();
      resolve();
    };
    stream.resume();
    stream.once('data', onData);
  });
}

function buildDefaults(): RecordOrchestratorDeps {
  return {
    readCliToken: () => defaultReadCliToken(),
    login: () => defaultRunLogin(),
    isSimulatorBooted: defaultIsSimulatorBooted,
    getDeviceName: defaultGetDeviceName,
    getProjectName: defaultGetProjectName,
    startRecording: defaultStartRecording,
    setRecordingFlag: defaultSetRecordingFlag,
    remux: defaultRemux,
    waitForStop: defaultWaitForStop,
    startCountdown: (capSeconds) => defaultStartCountdown(capSeconds),
    readRecording: (p) => readFileSync(p),
    createSession: (token, device, project) =>
      defaultCreateStudioSession({ token, device, project }),
    uploadRecording: (uploadUrl, body, onProgress) =>
      defaultUploadRecording(uploadUrl, body, { onProgress }),
    renderProgress: (fraction) => {
      const pct = Math.round(fraction * 100);
      // Finalise the in-place line with a newline at 100% so the next log is clean.
      const tail = fraction >= 1 ? '\n' : '  ';
      process.stdout.write(`\r  ↑ Uploading…  ${pct}%${tail}`);
    },
    markReady: (sessionToken, accountToken) =>
      defaultMarkStudioReady(sessionToken, { token: accountToken }),
    pageUrl: (sessionToken) => studioPageUrl(sessionToken),
    openLink: (sessionToken, accountToken) =>
      defaultStudioOpenLink(sessionToken, { token: accountToken }),
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
  const project = deps.getProjectName();

  // 3. Create the session up front: it tells us the tier's recording cap (so the
  //    countdown is right) and surfaces sign-in / rate-limit problems BEFORE we
  //    record anything.
  let session: StudioCreateResponse;
  try {
    session = await deps.createSession(accountToken, device, project);
  } catch (err) {
    deps.log(mapStudioError(err) ?? messages.recordUploadFailed);
    return;
  }
  const capSeconds = session.maxRecordingSeconds ?? DEFAULT_CAP_SECONDS;

  // 4. Record until the designer presses Enter or the cap runs out — unless the
  //    recorder dies on its own first (e.g. the host recorder is busy).
  const outPath = path.join(deps.tmpDir(), `proto-recording-${deps.now()}.mp4`);
  deps.log(messages.recordStarted);
  const recording = deps.startRecording(outPath);
  void deps.setRecordingFlag(true); // fire-and-forget: taps overlay on-device
  const countdown = deps.startCountdown(capSeconds);
  const outcome = await Promise.race([
    deps.waitForStop().then(() => 'stopped' as const),
    countdown.expired.then(() => 'stopped' as const),
    recording.failed.then((message) => ({ message })),
  ]);
  countdown.stop();
  if (outcome !== 'stopped') {
    void deps.setRecordingFlag(false);
    deps.log(outcome.message);
    return;
  }
  await recording.stop();
  void deps.setRecordingFlag(false);
  deps.log(messages.recordSaving);

  // Fast-start remux so Studio playback never stalls; raw capture on failure.
  const uploadPath = (await deps.remux(outPath)) ?? outPath;

  // 5. Upload the MP4 directly to storage (with progress), confirm, open Studio.
  try {
    const body = deps.readRecording(uploadPath);
    await deps.uploadRecording(session.uploadUrl, body, deps.renderProgress);
    await deps.markReady(session.token, accountToken);

    // Prefer a one-time sign-in handoff so the browser opens Studio already
    // authed; fall back to the plain URL (recipient signs in once) if it fails.
    const openUrl =
      (await deps.openLink(session.token, accountToken)) ?? deps.pageUrl(session.token);
    deps.openBrowser(openUrl);
    deps.log(messages.recordSaved(terminalLink(deps.pageUrl(session.token))));
  } catch (err) {
    deps.log(mapStudioError(err) ?? messages.recordUploadFailed);
  }
}
