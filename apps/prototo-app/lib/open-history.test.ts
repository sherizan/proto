import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeHistory, getHistory, markRemoved, recordOpen } from './open-history';

const A = 'user-a';
const B = 'user-b';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

describe('designerName (optional, added for the recents "by <name>" line)', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it('mergeHistory preserves designerName', () => {
    const merged = mergeHistory([], {
      token: 'AB12CD34EF56',
      appName: 'botim',
      designerName: 'Yitong',
      openedAt: '2026-07-07T00:00:00.000Z',
    });
    expect(merged[0].designerName).toBe('Yitong');
  });

  it('getHistory keeps legacy entries without designerName', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(
      JSON.stringify([{ token: 'AB12CD34EF56', appName: 'old', openedAt: '2026-01-01T00:00:00.000Z' }]),
    );
    const list = await getHistory(A);
    expect(list).toHaveLength(1);
    expect(list[0].designerName).toBeUndefined();
  });
});

describe('markRemoved (the "Removed" tag on Recently viewed)', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it('tags the entry when a tap resolves not-found, and a later successful open clears it', async () => {
    await recordOpen(A, { token: 'AB12CD34EF56', appName: 'botim' });
    await recordOpen(A, { token: 'ZZ99YY88XX77', appName: 'other' });

    await markRemoved(A, 'AB12CD34EF56');
    let list = await getHistory(A);
    expect(list.find((p) => p.token === 'AB12CD34EF56')?.removedAt).toEqual(expect.any(String));
    expect(list.find((p) => p.token === 'ZZ99YY88XX77')?.removedAt).toBeUndefined();

    await recordOpen(A, { token: 'AB12CD34EF56', appName: 'botim' });
    list = await getHistory(A);
    expect(list[0].token).toBe('AB12CD34EF56');
    expect(list[0].removedAt).toBeUndefined();
  });

  it('is a no-op for a token not in history', async () => {
    await recordOpen(A, { token: 'AB12CD34EF56', appName: 'botim' });
    await markRemoved(A, 'NOPE00000000');
    const list = await getHistory(A);
    expect(list).toHaveLength(1);
    expect(list[0].removedAt).toBeUndefined();
  });
});

describe('per account (#69)', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it('keeps each account\'s Recently viewed apart on one device', async () => {
    await recordOpen(A, { token: 'AB12CD34EF56', appName: 'botim' });
    await recordOpen(B, { token: 'ZZ99YY88XX77', appName: 'other' });

    expect((await getHistory(A)).map((p) => p.token)).toEqual(['AB12CD34EF56']);
    expect((await getHistory(B)).map((p) => p.token)).toEqual(['ZZ99YY88XX77']);
  });

  it('markRemoved only touches the signed-in account', async () => {
    await recordOpen(A, { token: 'AB12CD34EF56', appName: 'botim' });
    await recordOpen(B, { token: 'AB12CD34EF56', appName: 'botim' });
    await markRemoved(A, 'AB12CD34EF56');

    expect((await getHistory(A))[0].removedAt).toEqual(expect.any(String));
    expect((await getHistory(B))[0].removedAt).toBeUndefined();
  });

  it('the first account after the update adopts the old device-wide list, once', async () => {
    store.set('proto.openHistory', JSON.stringify([{ token: 'OLD000000000', appName: 'old', openedAt: '2026-01-01T00:00:00.000Z' }]));

    expect((await getHistory(A)).map((p) => p.token)).toEqual(['OLD000000000']);
    expect(store.has('proto.openHistory')).toBe(false);
    expect(await getHistory(B)).toEqual([]);
  });
});
