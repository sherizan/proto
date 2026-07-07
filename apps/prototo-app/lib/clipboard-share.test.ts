import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectClipboardShare, rememberDecline, wasDeclined } from './clipboard-share';

vi.mock('expo-clipboard', () => ({
  hasUrlAsync: async () => false,
  getStringAsync: async () => '',
}));

// Mock AsyncStorage with a simple in-memory store
const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    clear: vi.fn(async () => {
      store.clear();
    }),
  },
}));

const TOKEN = 'TVY8DNDW8G4V';
const LINK = `https://prototo.app/p/${TOKEN}`;

describe('detectClipboardShare', () => {
  it('returns the token when the clipboard holds a share link', async () => {
    const token = await detectClipboardShare({
      hasUrl: async () => true,
      getString: async () => LINK,
    });
    expect(token).toBe(TOKEN);
  });

  it('never reads the clipboard when hasUrl is false (no iOS paste toast)', async () => {
    let read = false;
    const token = await detectClipboardShare({
      hasUrl: async () => false,
      getString: async () => {
        read = true;
        return LINK;
      },
    });
    expect(token).toBeNull();
    expect(read).toBe(false);
  });

  it('returns null for a non-Prototo URL and on errors', async () => {
    expect(
      await detectClipboardShare({ hasUrl: async () => true, getString: async () => 'https://example.com' }),
    ).toBeNull();
    expect(
      await detectClipboardShare({
        hasUrl: async () => {
          throw new Error('boom');
        },
        getString: async () => LINK,
      }),
    ).toBeNull();
  });
});

describe('decline memory', () => {
  beforeEach(async () => {
    await store.clear();
  });

  it('remembers a declined token', async () => {
    expect(await wasDeclined(TOKEN)).toBe(false);
    await rememberDecline(TOKEN);
    expect(await wasDeclined(TOKEN)).toBe(true);
  });

  it('a different token is not declined', async () => {
    await rememberDecline(TOKEN);
    expect(await wasDeclined('AB12CD34EF56')).toBe(false);
  });
});
