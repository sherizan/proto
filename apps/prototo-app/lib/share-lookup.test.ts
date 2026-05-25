import { describe, it, expect, vi } from 'vitest';
import { lookupShare, ShareLookupError, SHARE_API_BASE } from './share-lookup';

const VALID_BODY = {
  designerName: 'Sheri',
  appName: 'Atlas',
  screenCount: 7,
  theme: 'liquid-glass' as const,
  tunnelUrl: 'https://abc.trycloudflare.com',
  createdAt: '2026-05-25T00:00:00.000Z',
  expiresAt: '2026-06-01T00:00:00.000Z',
};

describe('SHARE_API_BASE', () => {
  it('points at the prototo.app production host', () => {
    expect(SHARE_API_BASE).toBe('https://prototo.app');
  });
});

describe('lookupShare', () => {
  it('GETs /api/share/<token> and returns the parsed body', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => VALID_BODY,
    })) as unknown as typeof fetch;

    const result = await lookupShare('xk92m', { fetch: fetchSpy });
    expect(result).toEqual(VALID_BODY);
    const [url] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://prototo.app/api/share/xk92m');
  });

  it('throws ShareLookupError with kind="expired" on 404', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      name: 'ShareLookupError',
      kind: 'expired',
    });
  });

  it('throws ShareLookupError with kind="unreachable" on 5xx', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'unreachable',
    });
  });

  it('throws ShareLookupError with kind="unreachable" when fetch rejects', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'unreachable',
    });
  });

  it('throws ShareLookupError with kind="unreachable" when response schema is invalid', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ designerName: 'only-this' }),
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'unreachable',
    });
  });

  it('rejects locally on empty token before fetching', async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    await expect(lookupShare('   ', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'expired',
    });
    expect((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
