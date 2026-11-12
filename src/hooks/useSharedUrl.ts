import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useShareIntent } from 'expo-share-intent';import { extractUrlFromText, isValidHttpUrl } from '../utils/url';

/**
 * Share-to-LinkFlow.
 *
 * Uses the native share target (Android intent filter / iOS Share Extension)
 * provided by `expo-share-intent`. The received content is only ever turned
 * into a URL that the user can still edit before shortening — nothing is
 * submitted automatically.
 *
 * Note: this is a *share target*, not deep linking. The app does not register
 * any app/universal link domains.
 */
export function useSharedUrl() {
  const { hasShareIntent, shareIntent, resetShareIntent, isReady, error } = useShareIntent({
    debug: __DEV__,
    resetOnBackground: true,
    disabled: Platform.OS === 'web',
  });

  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [rejectedContent, setRejectedContent] = useState<string | null>(null);
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent) return;

    const candidate =
      (shareIntent?.webUrl && shareIntent.webUrl.trim()) ||
      extractUrlFromText(shareIntent?.text) ||
      '';

    if (!candidate) {
      // Shared content that is not a URL (e.g. plain text or an image).
      setRejectedContent(shareIntent?.text?.trim() || 'Unsupported content');
      return;
    }

    if (!isValidHttpUrl(candidate)) {
      setRejectedContent(candidate);
      return;
    }

    // Never process the same share intent twice (app open + background refresh).
    if (handledRef.current === candidate) return;
    handledRef.current = candidate;

    setRejectedContent(null);
    setSharedUrl(candidate);
  }, [hasShareIntent, shareIntent]);

  /** Clears the pending shared URL once it has been handed to the app. */
  const clearSharedUrl = useCallback(() => {
    setSharedUrl(null);
    setRejectedContent(null);
    handledRef.current = null;
    try {
      resetShareIntent(true);
    } catch {
      // Resetting is best-effort; a stale intent is harmless.
    }
  }, [resetShareIntent]);

  return {
    isReady,
    sharedUrl,
    rejectedContent,
    clearRejectedContent: () => setRejectedContent(null),
    clearSharedUrl,
    error,
  };
}
