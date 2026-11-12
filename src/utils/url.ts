/**
 * Shared URL helpers used by the clipboard suggestion, the share-target flow
 * and the QR scanner. Kept in one place so every entry point validates
 * incoming URLs exactly the same way.
 */

/** Matches an http(s) URL inside free-form text (shared text, clipboard copy). */
const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/i;

/**
 * True only for absolute http/https URLs with a usable host.
 * Plain text, `mailto:`, `javascript:` and malformed input are rejected.
 */
export function isValidHttpUrl(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  // Host must start with a non-delimiter character.
  if (!/^https?:\/\/[^\s/?#]+/i.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (!parsed.hostname) return false;
    if (parsed.hostname === '.' || parsed.hostname.includes(' ')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts the first http(s) URL from arbitrary text.
 * Returns null when the text contains no valid URL (e.g. "hello world").
 */
export function extractUrlFromText(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null;
  const match = text.match(URL_IN_TEXT);
  if (!match) return null;

  // Trailing punctuation is very common when text is copied from a chat bubble.
  const candidate = match[0].replace(/[.,;:!?)\]}'"]+$/, '');
  return isValidHttpUrl(candidate) ? candidate : null;
}

/**
 * Normalizes user input into a shortenable URL.
 * Bare hosts (example.com/path) get an https:// prefix.
 */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

/** Shortens a URL for display inside cards (keeps the host + start of path). */
export function truncateUrl(value: string, maxLength = 48): string {
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
