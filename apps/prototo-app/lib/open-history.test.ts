import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeHistory, getHistory, markRemoved, recordOpen } from './open-history';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
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
    const list = await getHistory();
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
    await recordOpen({ token: 'AB12CD34EF56', appName: 'botim' });
    await recordOpen({ token: 'ZZ99YY88XX77', appName: 'other' });

    await markRemoved('AB12CD34EF56');
    let list = await getHistory();
    expect(list.find((p) => p.token === 'AB12CD34EF56')?.removedAt).toEqual(expect.any(String));
    expect(list.find((p) => p.token === 'ZZ99YY88XX77')?.removedAt).toBeUndefined();

    await recordOpen({ token: 'AB12CD34EF56', appName: 'botim' });
    list = await getHistory();
    expect(list[0].token).toBe('AB12CD34EF56');
    expect(list[0].removedAt).toBeUndefined();
  });

  it('is a no-op for a token not in history', async () => {
    await recordOpen({ token: 'AB12CD34EF56', appName: 'botim' });
    await markRemoved('NOPE00000000');
    const list = await getHistory();
    expect(list).toHaveLength(1);
    expect(list[0].removedAt).toBeUndefined();
  });
});
