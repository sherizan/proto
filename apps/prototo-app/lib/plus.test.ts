import { describe, it, expect, vi } from 'vitest';
import { confirmPurchase, fetchPlusStatus, settlePurchase } from './plus';

const res = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

describe('fetchPlusStatus', () => {
  it('returns the server status with the Bearer', async () => {
    const f = vi.fn(async () => res(200, { plus: true, via: 'web' }));
    expect(await fetchPlusStatus('jwt', { fetch: f as typeof fetch })).toEqual({ plus: true, via: 'web' });
    expect(f).toHaveBeenCalledWith('https://prototo.app/api/billing/apple', { headers: { Authorization: 'Bearer jwt' } });
  });
  it('is null on failure', async () => {
    expect(await fetchPlusStatus('jwt', { fetch: (async () => res(500)) as typeof fetch })).toBeNull();
    expect(await fetchPlusStatus('jwt', { fetch: (async () => { throw new Error('offline'); }) as typeof fetch })).toBeNull();
  });
});

describe('confirmPurchase', () => {
  it('ok on 200, rejected on 4xx, retry on 5xx or offline', async () => {
    const at = (s: number) => confirmPurchase('jwt', 'jws', { fetch: (async () => res(s, {})) as typeof fetch });
    expect(await at(200)).toBe('ok');
    expect(await at(403)).toBe('rejected');
    expect(await at(409)).toBe('rejected');
    expect(await at(503)).toBe('retry');
    expect(await confirmPurchase('jwt', 'jws', { fetch: (async () => { throw new Error('x'); }) as typeof fetch })).toBe('retry');
  });
});

describe('settlePurchase', () => {
  const p = { productId: 'plus.monthly', purchaseToken: 'jws' };
  it('finishes after the server confirms', async () => {
    const finish = vi.fn(async () => {});
    expect(await settlePurchase(p, 'jwt', { confirm: async () => 'ok', finish })).toBe('ok');
    expect(finish).toHaveBeenCalledOnce();
  });
  it('finishes a final rejection so it does not replay forever', async () => {
    const finish = vi.fn(async () => {});
    await settlePurchase(p, 'jwt', { confirm: async () => 'rejected', finish });
    expect(finish).toHaveBeenCalledOnce();
  });
  it('leaves the transaction open when the server could not be reached', async () => {
    const finish = vi.fn(async () => {});
    expect(await settlePurchase(p, 'jwt', { confirm: async () => 'retry', finish })).toBe('retry');
    expect(finish).not.toHaveBeenCalled();
  });
  it('ignores purchases that are not Plus', async () => {
    const confirm = vi.fn(async () => 'ok' as const);
    const finish = vi.fn(async () => {});
    await settlePurchase({ productId: 'other', purchaseToken: 'x' }, 'jwt', { confirm, finish });
    expect(confirm).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });
});
