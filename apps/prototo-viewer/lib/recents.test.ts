import { describe, it, expect } from 'vitest';
import { mergeRecent, loadRecents, addRecent, type RecentEntry, type RecentsStorage } from './recents';

function entry(token: string, viewedAt = '2026-06-12T00:00:00.000Z'): RecentEntry {
  return { token, appName: `App ${token}`, designerName: 'Sheri', viewedAt };
}

function memoryStorage(initial?: string): RecentsStorage & { value: string | null } {
  return {
    value: initial ?? null,
    async getItem() {
      return this.value;
    },
    async setItem(_key: string, v: string) {
      this.value = v;
    },
  };
}

describe('mergeRecent', () => {
  it('prepends the newest entry', () => {
    const out = mergeRecent([entry('AAAAA')], entry('BBBBB'));
    expect(out.map((e) => e.token)).toEqual(['BBBBB', 'AAAAA']);
  });

  it('dedupes by token, moving a re-view to the front', () => {
    const out = mergeRecent([entry('AAAAA'), entry('BBBBB')], entry('AAAAA', 'later'));
    expect(out.map((e) => e.token)).toEqual(['AAAAA', 'BBBBB']);
    expect(out[0].viewedAt).toBe('later');
  });

  it('caps the list length', () => {
    const list = Array.from({ length: 30 }, (_, i) => entry(`T${i}`));
    const out = mergeRecent(list, entry('NEW'), 30);
    expect(out).toHaveLength(30);
    expect(out[0].token).toBe('NEW');
    expect(out.some((e) => e.token === 'T29')).toBe(false);
  });
});

describe('loadRecents', () => {
  it('returns [] for an empty store', async () => {
    expect(await loadRecents(memoryStorage())).toEqual([]);
  });

  it('parses a stored list', async () => {
    const s = memoryStorage(JSON.stringify([entry('AAAAA')]));
    expect((await loadRecents(s)).map((e) => e.token)).toEqual(['AAAAA']);
  });

  it('returns [] for corrupt JSON instead of throwing', async () => {
    expect(await loadRecents(memoryStorage('{not json'))).toEqual([]);
  });
});

describe('addRecent', () => {
  it('persists the merged list and returns it', async () => {
    const s = memoryStorage();
    const out = await addRecent(s, entry('AAAAA'));
    expect(out.map((e) => e.token)).toEqual(['AAAAA']);
    expect(JSON.parse(s.value as string)).toHaveLength(1);

    const out2 = await addRecent(s, entry('BBBBB'));
    expect(out2.map((e) => e.token)).toEqual(['BBBBB', 'AAAAA']);
  });
});
