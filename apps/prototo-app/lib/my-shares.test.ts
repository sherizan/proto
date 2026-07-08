import { describe, it, expect } from 'vitest';
import { fetchMyShares } from './my-shares';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const ROW = { token: 'AAAAAAAAAAAA', appName: 'Atlas', createdAt: '2026-06-23T00:00:00Z' };

describe('fetchMyShares', () => {
  it('returns the parsed list on 200, ignoring the legacy expiresAt stamp', async () => {
    const res = await fetchMyShares('tok', {
      // the server still sends a far-future expiresAt for old clients
      fetch: async () => jsonResponse(200, { shares: [{ ...ROW, expiresAt: '2126-01-01T00:00:00.000Z' }] }),
      baseUrl: 'https://x',
    });
    expect(res).toEqual({ ok: true, shares: [ROW] });
  });

  it('sends the Bearer token', async () => {
    let seen = '';
    await fetchMyShares('tok123', {
      baseUrl: 'https://x',
      fetch: async (_url, init) => {
        seen = String((init?.headers as Record<string, string>).Authorization);
        return jsonResponse(200, { shares: [] });
      },
    });
    expect(seen).toBe('Bearer tok123');
  });

  it('401 → unauthorized', async () => {
    const res = await fetchMyShares('tok', { baseUrl: 'https://x', fetch: async () => jsonResponse(401, { error: 'no' }) });
    expect(res).toEqual({ ok: false, reason: 'unauthorized' });
  });

  it('500 → network', async () => {
    const res = await fetchMyShares('tok', { baseUrl: 'https://x', fetch: async () => jsonResponse(500, {}) });
    expect(res).toEqual({ ok: false, reason: 'network' });
  });

  it('throwing fetch → network', async () => {
    const res = await fetchMyShares('tok', { baseUrl: 'https://x', fetch: async () => { throw new Error('offline'); } });
    expect(res).toEqual({ ok: false, reason: 'network' });
  });

  it('drops malformed rows', async () => {
    const res = await fetchMyShares('tok', {
      baseUrl: 'https://x',
      fetch: async () => jsonResponse(200, { shares: [ROW, { token: 1 }] }),
    });
    expect(res).toEqual({ ok: true, shares: [ROW] });
  });
});
