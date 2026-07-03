import AsyncStorage from '@react-native-async-storage/async-storage';

export type OpenedProto = { token: string; appName: string; openedAt: string };

const KEY = 'proto.openHistory';
const MAX = 10;

// Newest first, deduped by token, capped. Pure so it's trivially correct.
export function mergeHistory(list: OpenedProto[], entry: OpenedProto): OpenedProto[] {
  return [entry, ...list.filter((p) => p.token !== entry.token)].slice(0, MAX);
}

export async function getHistory(): Promise<OpenedProto[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is OpenedProto =>
        p && typeof p.token === 'string' && typeof p.appName === 'string' && typeof p.openedAt === 'string',
    );
  } catch {
    return [];
  }
}

export async function recordOpen(entry: { token: string; appName: string }): Promise<void> {
  try {
    const next = mergeHistory(await getHistory(), { ...entry, openedAt: new Date().toISOString() });
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort; history is non-critical
  }
}
