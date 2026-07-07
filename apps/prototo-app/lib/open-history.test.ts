import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeHistory, getHistory, recordOpen } from './open-history';

vi.mock('@react-native-async-storage/async-storage');

describe('designerName (optional, added for the recents "by <name>" line)', () => {
  beforeEach(() => {
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
