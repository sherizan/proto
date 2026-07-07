import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { parseShareLink } from './share-link';

const DECLINED_KEY = 'proto.clipboardDeclined';

type Deps = { hasUrl?: () => Promise<boolean>; getString?: () => Promise<string> };

/**
 * Share token on the clipboard, or null. Checks WHETHER a URL exists first
 * (UIPasteboard pattern detection, no iOS paste toast); only a positive check
 * reads the clipboard, which the user perceives as truthful ("it found my link").
 */
export async function detectClipboardShare(deps: Deps = {}): Promise<string | null> {
  const hasUrl = deps.hasUrl ?? Clipboard.hasUrlAsync;
  const getString = deps.getString ?? Clipboard.getStringAsync;
  try {
    if (!(await hasUrl())) return null;
    return parseShareLink(await getString());
  } catch {
    return null;
  }
}

/** "Not now" on the app-open prompt: never re-prompt for this exact token. */
export async function rememberDecline(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DECLINED_KEY, token);
  } catch {
    // best-effort; worst case the prompt shows again
  }
}

export async function wasDeclined(token: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DECLINED_KEY)) === token;
  } catch {
    return false;
  }
}
