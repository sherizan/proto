// On-device history of opened prototypes. No backend — just a capped, deduped
// list in AsyncStorage. The pure list logic (mergeRecent) is separated from the
// storage I/O so it's testable without a device.

export type RecentEntry = {
  token: string;
  appName: string;
  designerName: string;
  viewedAt: string;
};

export type RecentsStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

const KEY = 'proto.recents';
const CAP = 30;

// Prepend the entry, drop any earlier view of the same token, cap the length.
export function mergeRecent(list: RecentEntry[], entry: RecentEntry, cap = CAP): RecentEntry[] {
  const without = list.filter((e) => e.token !== entry.token);
  return [entry, ...without].slice(0, cap);
}

export async function loadRecents(storage: RecentsStorage): Promise<RecentEntry[]> {
  try {
    const raw = await storage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

export async function addRecent(
  storage: RecentsStorage,
  entry: RecentEntry,
  cap = CAP,
): Promise<RecentEntry[]> {
  const list = mergeRecent(await loadRecents(storage), entry, cap);
  await storage.setItem(KEY, JSON.stringify(list));
  return list;
}
