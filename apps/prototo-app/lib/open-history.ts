import AsyncStorage from '@react-native-async-storage/async-storage';

export type OpenedProto = {
  token: string;
  appName: string;
  openedAt: string;
  designerName?: string;
  // Set when a tap resolved 404; a later successful open rebuilds the entry without it.
  removedAt?: string;
};

// Per account, so switching accounts on one phone doesn't mix lists (#69).
// LEGACY_KEY is the old device-wide list; the first account to read after the
// update adopts it once.
const LEGACY_KEY = 'proto.openHistory';
const keyFor = (userId: string) => `${LEGACY_KEY}.${userId}`;
const MAX = 10;

// Newest first, deduped by token, capped. Pure so it's trivially correct.
export function mergeHistory(list: OpenedProto[], entry: OpenedProto): OpenedProto[] {
  return [entry, ...list.filter((p) => p.token !== entry.token)].slice(0, MAX);
}

function parseHistory(raw: string | null): OpenedProto[] {
  const parsed = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (p): p is OpenedProto =>
      p && typeof p.token === 'string' && typeof p.appName === 'string' && typeof p.openedAt === 'string',
  );
}

export async function getHistory(userId: string): Promise<OpenedProto[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (raw !== null) return parseHistory(raw);
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy === null) return [];
    await AsyncStorage.setItem(keyFor(userId), legacy);
    await AsyncStorage.removeItem(LEGACY_KEY);
    return parseHistory(legacy);
  } catch {
    return [];
  }
}

export async function recordOpen(
  userId: string,
  entry: { token: string; appName: string; designerName?: string },
): Promise<void> {
  try {
    const next = mergeHistory(await getHistory(userId), { ...entry, openedAt: new Date().toISOString() });
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    // best-effort; history is non-critical
  }
}

export async function markRemoved(userId: string, token: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    const next = (await getHistory(userId)).map((p) =>
      p.token === token ? { ...p, removedAt: now } : p,
    );
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    // best-effort; history is non-critical
  }
}
