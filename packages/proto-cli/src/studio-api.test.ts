import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  StudioApiError,
  type UploadTransport,
  createStudioSession,
  markStudioReady,
  resolveStudioBaseUrl,
  studioOpenLink,
  studioPageUrl,
  uploadRecording,
} from './studio-api.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('base url + page url', () => {
  it('defaults to prototo.app, honours PROTO_SHARE_API_BASE, then explicit baseUrl', () => {
    expect(resolveStudioBaseUrl()).toBe('https://prototo.app');
    vi.stubEnv('PROTO_SHARE_API_BASE', 'http://localhost:3000');
    expect(resolveStudioBaseUrl()).toBe('http://localhost:3000');
    expect(resolveStudioBaseUrl({ baseUrl: 'https://x.test' })).toBe('https://x.test');
  });

  it('builds the studio page url from the resolved base', () => {
    expect(studioPageUrl('ABCDEFGHJKMN', { baseUrl: 'https://x.test' })).toBe(
      'https://x.test/studio?v=ABCDEFGHJKMN',
    );
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

describe('createStudioSession', () => {
  const body = {
    token: 'ABCDEFGHJKMN',
    uploadUrl: 'https://storage.test/u?token=t',
    videoPath: 'u/x.mp4',
    expiresAt: '2026-06-15T00:00:00.000Z',
  };

  it('POSTs with the bearer token and returns the parsed session', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(201, body));
    const res = await createStudioSession({
      fetch: fetchFn as unknown as typeof fetch,
      token: 'proto_x',
      baseUrl: 'https://x.test',
    });
    expect(res).toEqual(body);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://x.test/api/studio',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer proto_x' }),
      }),
    );
  });

  it('sends the device + project in the request body', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(201, body));
    await createStudioSession({
      fetch: fetchFn as unknown as typeof fetch,
      baseUrl: 'https://x.test',
      device: 'iPhone 17 Pro',
      project: 'my-app',
    });
    const sent = JSON.parse((fetchFn.mock.calls[0]?.[1] as { body: string }).body);
    expect(sent).toEqual({ device: 'iPhone 17 Pro', project: 'my-app' });
  });

  it('maps 401 → unauthorized and 429 → rate-limited', async () => {
    const unauth = vi.fn(async () => jsonResponse(401, {}));
    await expect(
      createStudioSession({ fetch: unauth as unknown as typeof fetch, baseUrl: 'https://x.test' }),
    ).rejects.toMatchObject({ kind: 'unauthorized' });

    const limited = vi.fn(async () => jsonResponse(429, {}));
    await expect(
      createStudioSession({ fetch: limited as unknown as typeof fetch, baseUrl: 'https://x.test' }),
    ).rejects.toMatchObject({ kind: 'rate-limited' });
  });

  it('rejects a response that does not match the schema', async () => {
    const bad = vi.fn(async () => jsonResponse(201, { token: 'x' }));
    await expect(
      createStudioSession({ fetch: bad as unknown as typeof fetch, baseUrl: 'https://x.test' }),
    ).rejects.toBeInstanceOf(StudioApiError);
  });

  it('parses the optional tier + recording cap when present', async () => {
    const withCap = { ...body, tier: 'plus', maxRecordingSeconds: 180 };
    const fetchFn = vi.fn(async () => jsonResponse(201, withCap));
    const res = await createStudioSession({
      fetch: fetchFn as unknown as typeof fetch,
      baseUrl: 'https://x.test',
    });
    expect(res.tier).toBe('plus');
    expect(res.maxRecordingSeconds).toBe(180);
  });

  it('still parses when tier + cap are absent (older server)', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(201, body));
    const res = await createStudioSession({
      fetch: fetchFn as unknown as typeof fetch,
      baseUrl: 'https://x.test',
    });
    expect(res.maxRecordingSeconds).toBeUndefined();
  });
});

describe('uploadRecording', () => {
  it('PUTs via the transport and throws upload-failed on a non-2xx status', async () => {
    const ok: UploadTransport = vi.fn(async () => 200);
    await uploadRecording('https://storage.test/u', new Uint8Array([1, 2, 3]), { transport: ok });
    expect(ok).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://storage.test/u',
        body: expect.any(Uint8Array),
        headers: expect.objectContaining({ 'Content-Type': 'video/mp4', 'x-upsert': 'true' }),
      }),
    );

    const fail: UploadTransport = vi.fn(async () => 403);
    await expect(
      uploadRecording('https://storage.test/u', new Uint8Array([1]), { transport: fail }),
    ).rejects.toMatchObject({ kind: 'upload-failed' });
  });

  it('maps a transport error (network) to upload-failed', async () => {
    const boom: UploadTransport = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    await expect(
      uploadRecording('https://storage.test/u', new Uint8Array([1]), { transport: boom }),
    ).rejects.toMatchObject({ kind: 'upload-failed' });
  });

  it('really uploads over HTTP via the default Node transport, as a non-chunked PUT, reporting progress to 100%', async () => {
    // Integration test against a real local server: exercises the PRODUCTION
    // transport (node http) end-to-end — the path that broke under fetch
    // streaming on older Node. Asserts a normal Content-Length PUT, all bytes
    // received, and progress reaching 1.
    let receivedLen = 0;
    let sawContentLength = '';
    let sawTransferEncoding: string | undefined;
    const server = http.createServer((req, res) => {
      sawContentLength = req.headers['content-length'] ?? '';
      sawTransferEncoding = req.headers['transfer-encoding'];
      req.on('data', (c) => {
        receivedLen += c.length;
      });
      req.on('end', () => {
        res.writeHead(200);
        res.end('ok');
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const { port } = server.address() as AddressInfo;

    const seen: number[] = [];
    await uploadRecording(`http://127.0.0.1:${port}/u`, new Uint8Array(700_000).fill(3), {
      onProgress: (p) => seen.push(p),
    });

    expect(receivedLen).toBe(700_000);
    expect(sawContentLength).toBe('700000');
    expect(sawTransferEncoding).toBeUndefined(); // never chunked
    expect(seen.at(-1)).toBe(1);
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.every((p, i) => p > 0 && p <= 1 && (i === 0 || p >= seen[i - 1]))).toBe(true);
    server.close();
  });

  it('surfaces a server error status as upload-failed (default transport)', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(403);
      res.end('no');
    });
    await new Promise<void>((r) => server.listen(0, r));
    const { port } = server.address() as AddressInfo;
    await expect(
      uploadRecording(`http://127.0.0.1:${port}/u`, new Uint8Array([1, 2, 3])),
    ).rejects.toMatchObject({ kind: 'upload-failed' });
    server.close();
  });
});

describe('studioOpenLink', () => {
  it('returns the sign-in handoff url on 200', async () => {
    const url =
      'https://x.test/auth/callback?token_hash=h&type=magiclink&next=%2Fstudio%3Fv%3DABCDEFGHJKMN';
    const fetchFn = vi.fn(async () => jsonResponse(200, { url }));
    const got = await studioOpenLink('ABCDEFGHJKMN', {
      fetch: fetchFn as unknown as typeof fetch,
      token: 'proto_x',
      baseUrl: 'https://x.test',
    });
    expect(got).toBe(url);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://x.test/api/studio/ABCDEFGHJKMN/open',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer proto_x' }),
      }),
    );
  });

  it('fails open to null on a non-200, a bad body, or a network error', async () => {
    const non200 = vi.fn(async () => jsonResponse(502, {}));
    expect(
      await studioOpenLink('ABCDEFGHJKMN', {
        fetch: non200 as unknown as typeof fetch,
        baseUrl: 'https://x.test',
      }),
    ).toBeNull();

    const badBody = vi.fn(async () => jsonResponse(200, { nope: true }));
    expect(
      await studioOpenLink('ABCDEFGHJKMN', {
        fetch: badBody as unknown as typeof fetch,
        baseUrl: 'https://x.test',
      }),
    ).toBeNull();

    const boom = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(
      await studioOpenLink('ABCDEFGHJKMN', {
        fetch: boom as unknown as typeof fetch,
        baseUrl: 'https://x.test',
      }),
    ).toBeNull();
  });
});

describe('markStudioReady', () => {
  it('POSTs to the ready endpoint with the bearer token', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200 }) as unknown as Response);
    await markStudioReady('ABCDEFGHJKMN', {
      fetch: fetchFn as unknown as typeof fetch,
      token: 'proto_x',
      baseUrl: 'https://x.test',
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://x.test/api/studio/ABCDEFGHJKMN/ready',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer proto_x' }),
      }),
    );
  });
});
