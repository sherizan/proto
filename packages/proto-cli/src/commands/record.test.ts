import { describe, expect, it, vi } from 'vitest';
import { messages } from '../messages.js';
import { StudioApiError } from '../studio-api.js';
import { type RecordOrchestratorDeps, runRecord } from './record.js';

const SESSION_TOKEN = 'ABCDEFGHJKMN';
const UPLOAD_URL = 'https://storage.test/upload/sign/recordings/u/x.mp4?token=t';

function makeDeps(overrides: Partial<RecordOrchestratorDeps>): RecordOrchestratorDeps {
  return {
    readCliToken: () => 'proto_account',
    login: async () => 'proto_account',
    isSimulatorBooted: () => true,
    getDeviceName: () => 'iPhone 17 Pro',
    startRecording: () => ({ stop: async () => {}, failed: new Promise<string>(() => {}) }),
    waitForStop: async () => {},
    readRecording: () => new Uint8Array([0, 1, 2, 3]),
    createSession: async () => ({
      token: SESSION_TOKEN,
      uploadUrl: UPLOAD_URL,
      videoPath: 'u/x.mp4',
      expiresAt: '2026-06-15T00:00:00.000Z',
    }),
    uploadRecording: async () => {},
    markReady: async () => {},
    pageUrl: (t) => `https://prototo.app/studio?v=${t}`,
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
    expect(createSession).toHaveBeenCalledWith('proto_account', 'iPhone 17 Pro');
    expect(uploadRecording).toHaveBeenCalledWith(UPLOAD_URL, expect.any(Uint8Array));
    expect(markReady).toHaveBeenCalledWith(SESSION_TOKEN, 'proto_account');
    expect(openBrowser).toHaveBeenCalledWith(`https://prototo.app/studio?v=${SESSION_TOKEN}`);
    expect(logs.some((l) => l.includes('Wrap it. Export it. Post it.'))).toBe(true);
  });

  it('stops the recording only after the designer presses Ctrl+C', async () => {
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
    expect(order).toEqual(['wait', 'stop', 'create']);
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
    expect(createSession).toHaveBeenCalledWith('proto_freshly_signed_in', 'iPhone 17 Pro');
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
    const createSession = vi.fn(makeDeps({}).createSession);
    await runRecord(
      makeDeps({
        // recorder fails to start before the designer ever stops it
        startRecording: () => ({
          stop: async () => {},
          failed: Promise.resolve(messages.recordFailed),
        }),
        waitForStop: () => new Promise<void>(() => {}), // never stops
        createSession,
        log: (m) => logs.push(m),
      }),
    );
    expect(logs).toContain(messages.recordFailed);
    expect(createSession).not.toHaveBeenCalled();
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
