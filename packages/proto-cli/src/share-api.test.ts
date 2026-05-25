import { describe, it, expect, vi } from 'vitest';
import {
  createShare,
  lookupShare,
  SHARE_API_BASE_DEFAULT,
  ShareApiError,
  type ShareCreateInput,
} from './share-api.js';

const VALID_INPUT: ShareCreateInput = {
  designerName: 'Sheri',
  appName: 'Atlas',
  screenCount: 7,
  theme: 'liquid-glass',
  tunnelUrl: 'https://abc.trycloudflare.com',
};

const VALID_RESPONSE = {
  token: 'xk92m',
  url: 'https://prototo.app/p/xk92m',
  expiresAt: '2026-06-01T00:00:00.000Z',
};

describe('SHARE_API_BASE_DEFAULT', () => {
  it('points at the prototo.app production host', () => {
    expect(SHARE_API_BASE_DEFAULT).toBe('https://prototo.app');
  });
});

describe('createShare', () => {
  it('POSTs to /api/share with the JSON body and returns the parsed response', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => VALID_RESPONSE,
    })) as unknown as typeof fetch;

    const result = await createShare(VALID_INPUT, { fetch: fetchSpy });

    expect(result).toEqual(VALID_RESPONSE);
    const [url, init] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://prototo.app/api/share');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(VALID_INPUT);
  });

  it('honours PROTO_SHARE_API_BASE env override', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => VALID_RESPONSE,
    })) as unknown as typeof fetch;

    await createShare(VALID_INPUT, { fetch: fetchSpy, baseUrl: 'https://staging.prototo.app' });
    const [url] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://staging.prototo.app/api/share');
  });

  it('throws ShareApiError with kind="rate-limited" on 429', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      name: 'ShareApiError',
      kind: 'rate-limited',
    });
  });

  it('throws ShareApiError with kind="bad-input" on 400', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'bad-input',
    });
  });

  it('throws ShareApiError with kind="server" on 5xx', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'server',
    });
  });

  it('throws ShareApiError with kind="network" when fetch rejects', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('ENOTFOUND prototo.app');
    }) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('rejects locally on invalid input before fetching', async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    await expect(
      createShare(
        { ...VALID_INPUT, designerName: '' } as ShareCreateInput,
        { fetch: fetchSpy },
      ),
    ).rejects.toThrow();
    expect((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('rejects when the server returns a body that does not match the schema', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ token: 'xk92m' }), // missing url + expiresAt
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'bad-response',
    });
  });
});

describe('lookupShare', () => {
  it('GETs /api/share/<token> and returns the parsed response', async () => {
    const body = {
      designerName: 'Sheri',
      appName: 'Atlas',
      screenCount: 7,
      theme: 'liquid-glass' as const,
      tunnelUrl: 'https://abc.trycloudflare.com',
      createdAt: '2026-05-25T00:00:00.000Z',
      expiresAt: '2026-06-01T00:00:00.000Z',
    };
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => body,
    })) as unknown as typeof fetch;

    const result = await lookupShare('xk92m', { fetch: fetchSpy });
    expect(result).toEqual(body);
    const [url] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://prototo.app/api/share/xk92m');
  });

  it('throws ShareApiError with kind="not-found" on 404', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
