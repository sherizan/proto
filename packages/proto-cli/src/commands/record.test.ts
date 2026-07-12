import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '../messages.js';
import { StudioApiError } from '../studio-api.js';
import {
  type RecordOrchestratorDeps,
  defaultWaitForStop,
  runRecord,
  spawnRecorder,
} from './record.js';

const SESSION_TOKEN = 'ABCDEFGHJKMN';
const UPLOAD_URL = 'https://storage.test/upload/sign/recordings/u/x.mp4?token=t';

function makeDeps(overrides: Partial<RecordOrchestratorDeps>): RecordOrchestratorDeps {
  return {
    readCliToken: () => 'proto_account',
    login: async () => 'proto_account',
    isSimulatorBooted: () => true,
    getDeviceName: () => 'iPhone 17 Pro',
    getProjectName: () => 'my-app',
    startRecording: () => ({ stop: async () => {}, failed: new Promise<string>(() => {}) }),
    setRecordingFlag: async () => {},
    remux: async () => null,
    waitForStop: async () => {},
    startCountdown: () => ({ expired: new Promise<void>(() => {}), stop: () => {} }),
    readRecording: () => new Uint8Array([0, 1, 2, 3]),
    createSession: async () => ({
      token: SESSION_TOKEN,
      uploadUrl: UPLOAD_URL,
      videoPath: 'u/x.mp4',
      expiresAt: '2026-06-15T00:00:00.000Z',
    }),
    uploadRecording: async () => {},
    renderProgress: () => {},
    markReady: async () => {},
    pageUrl: (t) => `https://prototo.app/studio?v=${t}`,
    openLink: async () => null,
    openBrowser: () => {},
    now: () => 1_700_000_000_000,
    tmpDir: () => '/tmp',
    log: () => {},
    ...overrides,
  };
}

describe('runRecord — happy path', () => {
  it('records, creates a session, uploads to the signed URL, marks ready, opens Studio', async () => {
    const logs: string[] = [];
    const startRecording = vi.fn(() => ({
      stop: vi.fn(async () => {}),
      failed: new Promise<string>(() => {}),
    }));
    const createSession = vi.fn(makeDeps({}).createSession);
    const uploadRecording = vi.fn(async () => {});
    const markReady = vi.fn(async () => {});
    const openBrowser = vi.fn(() => {});

    await runRecord(
      makeDeps({
        log: (m) => logs.push(m),
        startRecording,
        createSession,
        uploadRecording,
        markReady,
        openBrowser,
      }),
    );

    expect(startRecording).toHaveBeenCalledOnce();
    expect(createSession).toHaveBeenCalledWith('proto_account', 'iPhone 17 Pro', 'my-app');
    expect(uploadRecording).toHaveBeenCalledWith(
      UPLOAD_URL,
      expect.any(Uint8Array),
      expect.any(Function),
    );
    expect(markReady).toHaveBeenCalledWith(SESSION_TOKEN, 'proto_account');
    expect(openBrowser).toHaveBeenCalledWith(`https://prototo.app/studio?v=${SESSION_TOKEN}`);
    expect(logs.some((l) => l.includes('Wrap it. Export it. Post it.'))).toBe(true);
  });

  it('uploads the fast-start remux when it succeeds', async () => {
    const read: string[] = [];
    await runRecord(
      makeDeps({
        remux: async (inPath) => `${inPath}-faststart.mp4`,
        readRecording: (p) => {
          read.push(p);
          return new Uint8Array([1]);
        },
      }),
    );
    expect(read).toEqual(['/tmp/proto-recording-1700000000000.mp4-faststart.mp4']);
  });

  it('falls back to the raw capture when the remux fails', async () => {
    const read: string[] = [];
    await runRecord(
      makeDeps({
        remux: async () => null,
        readRecording: (p) => {
          read.push(p);
          return new Uint8Array([1]);
        },
      }),
    );
    expect(read).toEqual(['/tmp/proto-recording-1700000000000.mp4']);
  });

  it('flags the recording on for the touch-dots overlay, and off when it stops', async () => {
    const setRecordingFlag = vi.fn(async () => {});
    await runRecord(makeDeps({ setRecordingFlag }));
    expect(setRecordingFlag.mock.calls).toEqual([[true], [false]]);
  });

  it('clears the recording flag when the recorder dies on its own', async () => {
    const setRecordingFlag = vi.fn(async () => {});
    await runRecord(
      makeDeps({
        setRecordingFlag,
        startRecording: () => ({
          stop: async () => {},
          failed: Promise.resolve(messages.recordFailed),
        }),
        waitForStop: () => new Promise<void>(() => {}),
      }),
    );
    expect(setRecordingFlag.mock.calls).toEqual([[true], [false]]);
  });

  it('creates the session first (to learn the cap), then records until the designer stops', async () => {
    const order: string[] = [];
    const stop = vi.fn(async () => {
      order.push('stop');
    });
    await runRecord(
      makeDeps({
        startRecording: () => ({ stop, failed: new Promise<string>(() => {}) }),
        waitForStop: async () => {
          order.push('wait');
        },
        createSession: async () => {
          order.push('create');
          return {
            token: SESSION_TOKEN,
            uploadUrl: UPLOAD_URL,
            videoPath: 'u/x.mp4',
            expiresAt: 'x',
          };
        },
      }),
    );
    expect(order).toEqual(['create', 'wait', 'stop']);
  });

  it('caps the countdown at the session tier limit, defaulting to 30s', async () => {
    const capped = vi.fn(() => ({ expired: new Promise<void>(() => {}), stop: () => {} }));
    await runRecord(
      makeDeps({
        startCountdown: capped,
        createSession: async () => ({
          token: SESSION_TOKEN,
          uploadUrl: UPLOAD_URL,
          videoPath: 'u/x.mp4',
          expiresAt: 'x',
          tier: 'plus',
          maxRecordingSeconds: 180,
        }),
      }),
    );
    expect(capped).toHaveBeenCalledWith(180);

    const defaulted = vi.fn(() => ({ expired: new Promise<void>(() => {}), stop: () => {} }));
    await runRecord(makeDeps({ startCountdown: defaulted })); // session has no cap
    expect(defaulted).toHaveBeenCalledWith(30);
  });

  it('auto-stops and uploads when the countdown expires (no Enter)', async () => {
    const stop = vi.fn(async () => {});
    const uploadRecording = vi.fn(async () => {});
    await runRecord(
      makeDeps({
        startRecording: () => ({ stop, failed: new Promise<string>(() => {}) }),
        waitForStop: () => new Promise<void>(() => {}), // designer never presses Enter
        startCountdown: () => ({ expired: Promise.resolve(), stop: () => {} }),
        uploadRecording,
      }),
    );
    expect(stop).toHaveBeenCalledOnce();
    expect(uploadRecording).toHaveBeenCalledOnce();
  });

  it('shows upload progress and opens the sign-in handoff url when available', async () => {
    const renderProgress = vi.fn(() => {});
    const uploadRecording = vi.fn(
      async (_url: string, _body: Uint8Array, onProgress: (f: number) => void) => {
        onProgress(0.5);
        onProgress(1);
      },
    );
    const openBrowser = vi.fn(() => {});
    await runRecord(
      makeDeps({
        uploadRecording,
        renderProgress,
        openLink: async () =>
          `https://prototo.app/auth/callback?token_hash=h&type=magiclink&next=%2Fstudio%3Fv%3D${SESSION_TOKEN}`,
        openBrowser,
      }),
    );
    expect(renderProgress).toHaveBeenCalledWith(0.5);
    expect(renderProgress).toHaveBeenCalledWith(1);
    expect(openBrowser).toHaveBeenCalledWith(
      expect.stringContaining('/auth/callback?token_hash=h'),
    );
  });

  it('falls back to the plain Studio url when the handoff is unavailable', async () => {
    const openBrowser = vi.fn(() => {});
    await runRecord(makeDeps({ openLink: async () => null, openBrowser }));
    expect(openBrowser).toHaveBeenCalledWith(`https://prototo.app/studio?v=${SESSION_TOKEN}`);
  });
});

describe('runRecord — guards', () => {
  it('signs the designer in when no token is stored, then proceeds', async () => {
    const login = vi.fn(async () => 'proto_freshly_signed_in');
    const createSession = vi.fn(async () => ({
      token: SESSION_TOKEN,
      uploadUrl: UPLOAD_URL,
      videoPath: 'u/x.mp4',
      expiresAt: 'x',
    }));
    await runRecord(makeDeps({ readCliToken: () => null, login, createSession }));
    expect(login).toHaveBeenCalledOnce();
    expect(createSession).toHaveBeenCalledWith('proto_freshly_signed_in', 'iPhone 17 Pro', 'my-app');
  });

  it('aborts quietly if sign-in does not complete', async () => {
    const startRecording = vi.fn(() => ({
      stop: async () => {},
      failed: new Promise<string>(() => {}),
    }));
    await runRecord(
      makeDeps({ readCliToken: () => null, login: async () => null, startRecording }),
    );
    expect(startRecording).not.toHaveBeenCalled();
  });

  it('reports a friendly error (and does not upload) when the recorder dies on its own', async () => {
    const logs: string[] = [];
    const uploadRecording = vi.fn(async () => {});
    await runRecord(
      makeDeps({
        // recorder fails to start before the designer ever stops it
        startRecording: () => ({
          stop: async () => {},
          failed: Promise.resolve(messages.recordFailed),
        }),
        waitForStop: () => new Promise<void>(() => {}), // never stops
        uploadRecording,
        log: (m) => logs.push(m),
      }),
    );
    expect(logs).toContain(messages.recordFailed);
    expect(uploadRecording).not.toHaveBeenCalled();
  });

  it('does not record when no Simulator is booted', async () => {
    const logs: string[] = [];
    const startRecording = vi.fn(() => ({
      stop: async () => {},
      failed: new Promise<string>(() => {}),
    }));
    await runRecord(
      makeDeps({ isSimulatorBooted: () => false, startRecording, log: (m) => logs.push(m) }),
    );
    expect(startRecording).not.toHaveBeenCalled();
    expect(logs).toContain(messages.recordNoSimulator);
  });
});

describe('defaultWaitForStop — stops on a keypress, not a signal', () => {
  it('resolves when the designer presses a key (stdin data), not before', async () => {
    const input = new PassThrough();
    let resolved = false;
    const done = defaultWaitForStop(input).then(() => {
      resolved = true;
    });

    // No input yet — must still be waiting.
    await new Promise((r) => setImmediate(r));
    expect(resolved).toBe(false);

    input.write('\n'); // Enter
    await done;
    expect(resolved).toBe(true);
  });

  it('detaches from the input stream once stopped (no leaked listeners)', async () => {
    const input = new PassThrough();
    const done = defaultWaitForStop(input);
    input.write('q');
    await done;
    expect(input.listenerCount('data')).toBe(0);
  });
});

describe('spawnRecorder — stop() finalises a real child process', () => {
  it('sends SIGINT and resolves once the recorder exits', async () => {
    // Stand-in recorder: stays alive, exits cleanly on SIGINT (like recordVideo
    // writing the moov atom). Proves stop() drives the child to a clean finish.
    const handle = spawnRecorder('node', [
      '-e',
      'process.on("SIGINT",()=>process.exit(0));setInterval(()=>{},1000)',
    ]);
    await expect(handle.stop()).resolves.toBeUndefined();
  });
});

describe('runRecord — failures map to friendly copy, never raw errors', () => {
  it('shows the upload-failed message when upload throws', async () => {
    const logs: string[] = [];
    await runRecord(
      makeDeps({
        uploadRecording: async () => {
          throw new StudioApiError('upload-failed', 'boom');
        },
        log: (m) => logs.push(m),
      }),
    );
    expect(logs).toContain(messages.recordUploadFailed);
  });

  it('shows the login-expired message on a 401 from the API', async () => {
    const logs: string[] = [];
    await runRecord(
      makeDeps({
        createSession: async () => {
          throw new StudioApiError('unauthorized', 'nope');
        },
        log: (m) => logs.push(m),
      }),
    );
    expect(logs).toContain(messages.recordLoginExpired);
  });
});
