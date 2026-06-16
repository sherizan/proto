import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  StudioApiError,
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
  it('PUTs the bytes and throws upload-failed on a non-ok status', async () => {
    const ok = vi.fn(async () => ({ ok: true, status: 200 }) as unknown as Response);
    await uploadRecording('https://storage.test/u', new Uint8Array([1]), {
      fetch: ok as unknown as typeof fetch,
    });
    expect(ok).toHaveBeenCalledWith(
      'https://storage.test/u',
      expect.objectContaining({ method: 'PUT' }),
    );

    const fail = vi.fn(async () => ({ ok: false, status: 403 }) as unknown as Response);
    await expect(
      uploadRecording('https://storage.test/u', new Uint8Array([1]), {
        fetch: fail as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: 'upload-failed' });
  });

  it('reports progress to 100% as the body stream is consumed', async () => {
    // A realistic client drains the request body stream — that drives onProgress.
    const drainingFetch = vi.fn(
      async (_url: string, init: { body: ReadableStream<Uint8Array> }) => {
        const reader = init.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
        return { ok: true, status: 200 } as unknown as Response;
      },
    );
    const seen: number[] = [];
    await uploadRecording('https://storage.test/u', new Uint8Array(700_000), {
      fetch: drainingFetch as unknown as typeof fetch,
      onProgress: (p) => seen.push(p),
    });
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toBe(1);
    // monotonic, bounded
    expect(seen.every((p, i) => p > 0 && p <= 1 && (i === 0 || p >= seen[i - 1]))).toBe(true);
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
