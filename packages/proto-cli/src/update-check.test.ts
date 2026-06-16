import { describe, expect, it, vi } from 'vitest';
import {
  type CheckForUpdateDeps,
  type UpdateCache,
  checkForUpdate,
  compareSemver,
  fetchUpdateInfo,
} from './update-check.js';

describe('compareSemver', () => {
  it('orders by major, minor, patch', () => {
    expect(compareSemver('0.7.2', '0.7.3')).toBe(-1);
    expect(compareSemver('0.7.3', '0.7.2')).toBe(1);
    expect(compareSemver('0.7.3', '0.7.3')).toBe(0);
    expect(compareSemver('0.7.9', '0.8.0')).toBe(-1);
    expect(compareSemver('1.0.0', '0.9.9')).toBe(1);
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

describe('fetchUpdateInfo', () => {
  it('parses a well-formed response', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(200, { latest: '0.8.0', highlights: ['New: record'], changelogUrl: 'x' }),
    );
    const info = await fetchUpdateInfo({
      fetch: fetchFn as unknown as typeof fetch,
      baseUrl: 'https://x.test',
    });
    expect(info?.latest).toBe('0.8.0');
    expect(info?.highlights).toEqual(['New: record']);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://x.test/api/cli/version',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('fails open to null on non-200, bad body, or a thrown error', async () => {
    expect(
      await fetchUpdateInfo({
        fetch: (async () => jsonResponse(500, {})) as unknown as typeof fetch,
        baseUrl: 'https://x.test',
      }),
    ).toBeNull();
    expect(
      await fetchUpdateInfo({
        fetch: (async () => jsonResponse(200, { highlights: 'nope' })) as unknown as typeof fetch,
        baseUrl: 'https://x.test',
      }),
    ).toBeNull();
    expect(
      await fetchUpdateInfo({
        fetch: (async () => {
          throw new Error('offline');
        }) as unknown as typeof fetch,
        baseUrl: 'https://x.test',
      }),
    ).toBeNull();
  });
});

const NOW = 1_000_000_000_000;
function makeDeps(over: Partial<CheckForUpdateDeps>): CheckForUpdateDeps {
  return {
    currentVersion: '0.7.3',
    now: () => NOW,
    readCache: () => null,
    saveCache: () => {},
    fetchInfo: async () => ({ latest: '0.8.0', highlights: ['New: record'], changelogUrl: 'c' }),
    ...over,
  };
}

describe('checkForUpdate', () => {
  it('nudges when a newer version is published, with highlights', async () => {
    const nudge = await checkForUpdate(makeDeps({}));
    expect(nudge).toEqual({
      current: '0.7.3',
      latest: '0.8.0',
      highlights: ['New: record'],
      changelogUrl: 'c',
    });
  });

  it('is silent when already current or ahead', async () => {
    expect(
      await checkForUpdate(
        makeDeps({ fetchInfo: async () => ({ latest: '0.7.3', highlights: [] }) }),
      ),
    ).toBeNull();
    expect(
      await checkForUpdate(
        makeDeps({
          currentVersion: '0.9.0',
          fetchInfo: async () => ({ latest: '0.8.0', highlights: [] }),
        }),
      ),
    ).toBeNull();
  });

  it('saves the cache after a fresh fetch', async () => {
    const saveCache = vi.fn();
    await checkForUpdate(makeDeps({ saveCache }));
    expect(saveCache).toHaveBeenCalledWith(
      expect.objectContaining({ lastCheckTime: NOW, latest: '0.8.0', highlights: ['New: record'] }),
    );
  });

  it('throttles: a fresh cache (<24h) is used and the network is NOT hit', async () => {
    const fetchInfo = vi.fn(async () => ({ latest: '0.9.0', highlights: [] }));
    const cache: UpdateCache = {
      lastCheckTime: NOW - 1000,
      latest: '0.8.0',
      highlights: ['New: cached'],
    };
    const nudge = await checkForUpdate(makeDeps({ readCache: () => cache, fetchInfo }));
    expect(fetchInfo).not.toHaveBeenCalled();
    expect(nudge?.latest).toBe('0.8.0'); // from cache, not the (ignored) network 0.9.0
    expect(nudge?.highlights).toEqual(['New: cached']);
  });

  it('refetches when the cache is stale (>24h)', async () => {
    const fetchInfo = vi.fn(async () => ({ latest: '0.9.0', highlights: [] }));
    const cache: UpdateCache = {
      lastCheckTime: NOW - 25 * 60 * 60 * 1000,
      latest: '0.8.0',
      highlights: [],
    };
    const nudge = await checkForUpdate(makeDeps({ readCache: () => cache, fetchInfo }));
    expect(fetchInfo).toHaveBeenCalledOnce();
    expect(nudge?.latest).toBe('0.9.0');
  });

  it('falls back to the last cached result when the fetch fails', async () => {
    const cache: UpdateCache = {
      lastCheckTime: NOW - 25 * 60 * 60 * 1000,
      latest: '0.8.0',
      highlights: ['New: cached'],
    };
    const nudge = await checkForUpdate(
      makeDeps({ readCache: () => cache, fetchInfo: async () => null }),
    );
    expect(nudge?.latest).toBe('0.8.0');
  });

  it('is silent when the fetch fails and there is no cache', async () => {
    expect(
      await checkForUpdate(makeDeps({ readCache: () => null, fetchInfo: async () => null })),
    ).toBeNull();
  });
});
