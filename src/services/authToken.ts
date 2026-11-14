/**
 * Authentication token bridge.
 *
 * Provides a stable `getSessionToken` function that wraps Clerk's `getToken`
 * with single-flight forced refresh on 401, throttled session-expired events,
 * and no sign-out on network errors.
 *
 * This module has zero React dependencies and can be imported anywhere.
 */

type GetTokenFn = (options?: { skipCache?: boolean }) => Promise<string | null>;
type SessionExpiredListener = () => void;

let sessionTokenProvider: GetTokenFn | null = null;
let refreshPromise: Promise<'refreshed' | 'no-session' | 'failed'> | null = null;
const sessionExpiredListeners = new Set<SessionExpiredListener>();
let lastSessionExpiredEmit = 0;
const SESSION_EXPIRED_THROTTLE_MS = 5_000; // 5 seconds

/** Set the Clerk getToken function (called once at app startup) */
export function setSessionTokenProvider(fn: GetTokenFn): void {
  sessionTokenProvider = fn;
}

/** Get the current session token (uses cache by default) */
export async function getSessionToken(options?: { skipCache?: boolean }): Promise<string | null> {
  if (!sessionTokenProvider) {
    return null;
  }
  return sessionTokenProvider(options);
}

/** Subscribe to session-expired events (throttled) */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

/** Emit session-expired event (throttled) */
function emitSessionExpired(): void {
  const now = Date.now();
  if (now - lastSessionExpiredEmit < SESSION_EXPIRED_THROTTLE_MS) {
    return;
  }
  lastSessionExpiredEmit = now;
  sessionExpiredListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  });
}

/**
 * Force a token refresh (single-flight across concurrent callers).
 * Returns 'refreshed' | 'no-session' | 'failed'.
 * Uses `skipCache: true` to bypass Clerk's SessionJWTCache and hit the server.
 */
export async function refreshSessionToken(): Promise<'refreshed' | 'no-session' | 'failed'> {
  // Return existing in-flight refresh if any
  if (refreshPromise) {
    return refreshPromise;
  }

  if (!sessionTokenProvider) {
    return 'no-session';
  }

  refreshPromise = (async () => {
    try {
      const token = await sessionTokenProvider({ skipCache: true });
      if (!token) {
        emitSessionExpired();
        return 'no-session';
      }
      return 'refreshed';
    } catch {
      emitSessionExpired();
      return 'failed';
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Clear the token provider (on sign-out) */
export function clearSessionTokenProvider(): void {
  sessionTokenProvider = null;
  refreshPromise = null;
  sessionExpiredListeners.clear();
  lastSessionExpiredEmit = 0;
}