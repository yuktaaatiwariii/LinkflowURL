import { useSyncExternalStore, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/expo';
import { setSessionTokenProvider, getSessionToken, refreshSessionToken, onSessionExpired, clearSessionTokenProvider } from '../services/authToken';
import { notificationStore, DEFAULT_PREFERENCES } from '../state/notificationStore';
import {
  fetchNotificationHistoryGateway,
  fetchNotificationPreferencesGateway,
  updateNotificationPreferencesGateway,
  type NotificationHistoryItem,
  type NotificationPreferences,
} from '../services/notifications';

/**
 * Centralized notification center hook.
 *
 * Uses useSyncExternalStore to subscribe to the pure notificationStore.
 * Handles authentication integration, data fetching, and loading states.
 * Single source of truth for notification data across the app.
 */
export function useNotificationCenter() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  // Track if we've initialized the token provider
  const providerInitialized = useRef(false);
  const sessionExpiredUnsubscribe = useRef<(() => void) | null>(null);
  const lastUserId = useRef<string | null>(null);

  // Initialize the session token provider once
  useEffect(() => {
    if (!providerInitialized.current) {
      setSessionTokenProvider(getToken);
      providerInitialized.current = true;
    }

    // Subscribe to session-expired events
    sessionExpiredUnsubscribe.current = onSessionExpired(() => {
      // Force refresh on next data fetch
      notificationStore.setActiveUser(null);
    });

    return () => {
      sessionExpiredUnsubscribe.current?.();
      sessionExpiredUnsubscribe.current = null;
    };
  }, [getToken]);

  // Sync store with auth state (user changes)
  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && userId) {
      if (lastUserId.current !== userId) {
        lastUserId.current = userId;
        notificationStore.setActiveUser(userId);
      }
    } else {
      if (lastUserId.current !== null) {
        lastUserId.current = null;
        notificationStore.setActiveUser(null);
        clearSessionTokenProvider();
        providerInitialized.current = false;
      }
    }
  }, [isLoaded, isSignedIn, userId]);

  // Subscribe to store changes
  const state = useSyncExternalStore(
    notificationStore.subscribe.bind(notificationStore),
    notificationStore.getSnapshot.bind(notificationStore),
    notificationStore.getServerSnapshot.bind(notificationStore)
  );

  // Load history (called by components when needed)
  const loadHistory = useCallback(
    async (limit = 50, force = false): Promise<{ notifications: NotificationHistoryItem[]; total: number }> => {
      return notificationStore.loadHistory(
        fetchNotificationHistoryGateway,
        getSessionToken,
        limit,
        force
      );
    },
    []
  );

  // Load preferences (called by components when needed)
  const loadPreferences = useCallback(
    async (force = false): Promise<NotificationPreferences> => {
      return notificationStore.loadPreferences(
        fetchNotificationPreferencesGateway,
        getSessionToken,
        force
      );
    },
    []
  );

  // Refresh both history and preferences
  const refreshAll = useCallback(
    async (limit = 50): Promise<void> => {
      await notificationStore.refreshAll(
        fetchNotificationHistoryGateway,
        fetchNotificationPreferencesGateway,
        getSessionToken,
        limit
      );
    },
    []
  );

  // Save preferences with optimistic update
  const savePreferences = useCallback(
    async (nextPrefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> => {
      return notificationStore.savePreferences(
        updateNotificationPreferencesGateway,
        getSessionToken,
        nextPrefs
      );
    },
    []
  );

  // Force token refresh (for manual retry after 401)
  const forceTokenRefresh = useCallback(async (): Promise<boolean> => {
    const result = await refreshSessionToken();
    return result === 'refreshed';
  }, []);

  // Computed helpers for UI
  const isLoading = state.phase === 'loading';
  const isRefreshing = state.phase === 'ready' && (state.history.length > 0 || state.preferences !== DEFAULT_PREFERENCES);
  const isError = state.phase === 'error';
  const isUnauthorized = state.phase === 'unauthorized';
  const isEmpty = state.phase === 'ready' && state.history.length === 0;
  const hasData = state.phase === 'ready' && state.history.length > 0;

  return {
    // State
    history: state.history,
    preferences: state.preferences,
    phase: state.phase,
    errorMessage: state.errorMessage,
    totalHistory: state.totalHistory,
    lastFetchedAt: state.lastFetchedAt,

    // Computed
    isLoading,
    isRefreshing,
    isError,
    isUnauthorized,
    isEmpty,
    hasData,

    // Actions
    loadHistory,
    loadPreferences,
    refreshAll,
    savePreferences,
    forceTokenRefresh,
  };
}