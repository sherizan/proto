import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { parseShareLink } from './share-link';

const DECLINED_KEY = 'proto.clipboardDeclined';

type Deps = {
  hasUrl?: () => Promise<boolean>;
  hasString?: () => Promise<string | boolean>;
  getString?: () => Promise<string>;
};

/**
 * Share token on the clipboard, or null. Checks WHETHER a URL or string is on
 * the pasteboard first (availability checks, no iOS paste toast); only a
 * positive check reads the clipboard, which may show iOS's paste notice —
 * acceptable since we only read on app-open/scanner-open and immediately act
 * on what we find. Links copied from the share page, the desktop app's Copy
 * button, and most text selections land as plain strings, not the URL type,
 * so both checks are needed to catch the primary flows.
 */
export async function detectClipboardShare(deps: Deps = {}): Promise<string | null> {
  const hasUrl = deps.hasUrl ?? Clipboard.hasUrlAsync;
  const hasString = deps.hasString ?? Clipboard.hasStringAsync;
  const getString = deps.getString ?? Clipboard.getStringAsync;
  try {
    if (!((await hasUrl()) || (await hasString()))) return null;
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
