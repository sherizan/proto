import { describe, it, expect } from 'vitest';
import { deleteAccount } from './account';

function res(status: number): Response {
  return new Response(status === 200 ? JSON.stringify({ ok: true }) : '{}', { status });
}

describe('deleteAccount', () => {
  it('sends a DELETE with the Bearer token and returns ok on 200', async () => {
    let seen: { url: string; method?: string; auth?: string } | null = null;
    const result = await deleteAccount('tok123', {
      baseUrl: 'https://x',
      fetch: async (url, init) => {
        seen = {
          url: String(url),
          method: init?.method,
          auth: String((init?.headers as Record<string, string>).Authorization),
        };
        return res(200);
      },
    });
    expect(result).toEqual({ ok: true });
    expect(seen).toEqual({ url: 'https://x/api/account', method: 'DELETE', auth: 'Bearer tok123' });
  });

  it('401 → unauthorized', async () => {
    const r = await deleteAccount('t', { baseUrl: 'https://x', fetch: async () => res(401) });
    expect(r).toEqual({ ok: false, reason: 'unauthorized' });
  });

  it('500 → network', async () => {
    const r = await deleteAccount('t', { baseUrl: 'https://x', fetch: async () => res(500) });
    expect(r).toEqual({ ok: false, reason: 'network' });
  });

  it('throwing fetch → network', async () => {
    const r = await deleteAccount('t', { baseUrl: 'https://x', fetch: async () => { throw new Error('offline'); } });
    expect(r).toEqual({ ok: false, reason: 'network' });
  });
});
