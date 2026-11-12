import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { extractUrlFromText, isValidHttpUrl } from '../utils/url';

/**
 * Smart clipboard detection.
 *
 * Privacy rules baked into this module:
 *  - the clipboard is only read at deliberate lifecycle moments (app open /
 *    return to foreground), never on a timer;
 *  - clipboard contents are never uploaded to the backend automatically;
 *  - nothing is persisted except the list of URLs the user explicitly
 *    dismissed, so the same suggestion is not shown twice;
 *  - every platform failure (iOS paste prompt, Android restrictions, web
 *    permission errors) is swallowed and treated as "no URL found".
 */

const DISMISSED_URLS_KEY = 'linkflow.dismissedClipboardUrls';
const MAX_DISMISSED_URLS = 25;

/**
 * Reads the clipboard and returns a valid http(s) URL, or null.
 * Never throws and never stores the clipboard contents.
 */
export async function readClipboardUrl(): Promise<string | null> {
  try {
    const hasString = await Clipboard.hasStringAsync();
    if (!hasString) return null;

    const text = await Clipboard.getStringAsync();
    if (!text || typeof text !== 'string') return null;

    const trimmed = text.trim();
    if (!trimmed) return null;

    // A plain URL is accepted as-is; shared text may contain extra words.
    if (isValidHttpUrl(trimmed)) return trimmed;
    return extractUrlFromText(trimmed);
  } catch {
    // Clipboard access can be denied by the OS or the user.
    return null;
  }
}

async function readDismissedUrls(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_URLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

async function writeDismissedUrls(urls: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      DISMISSED_URLS_KEY,
      JSON.stringify(urls.slice(0, MAX_DISMISSED_URLS))
    );
  } catch {
    // Storage failures must never break the suggestion flow.
  }
}

/** True when the user already dismissed this exact URL. */
export async function isDismissedClipboardUrl(url: string): Promise<boolean> {
  const dismissed = await readDismissedUrls();
  return dismissed.includes(url);
}

/**
 * Remembers that the user dismissed this URL so it is not suggested again.
 * Only the dismissed URL itself is stored — never clipboard contents that the
 * user acted on.
 */
export async function dismissClipboardUrl(url: string): Promise<void> {
  const dismissed = await readDismissedUrls();
  if (dismissed.includes(url)) return;
  await writeDismissedUrls([url, ...dismissed]);
}

/** Clears the dismissed list (exposed through Settings for transparency). */
export async function clearDismissedClipboardUrls(): Promise<void> {
  await writeDismissedUrls([]);
}
