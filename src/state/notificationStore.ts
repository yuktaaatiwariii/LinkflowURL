/**
 * Centralized notification data store.
 *
 * Pure TypeScript module with zero runtime dependencies (no React, no Expo).
 * Uses a simple in-memory cache with TTL, single-flight request deduplication,
 * and generation guards to prevent stale updates after user switches.
 *
 * Can be consumed via `useSyncExternalStore` in React components.
 */

export type NotificationPhase =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'unauthorized';

export interface NotificationHistoryItem {
  id: string;
  type: 'milestone' | 'performance' | 'expiration' | 'qr_activity';
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface NotificationPreferences {
  master_enabled: boolean;
  milestones: boolean;
  performance: boolean;
  expiration: boolean;
  qr_activity: boolean;
  updated_at?: string;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  master_enabled: true,
  milestones: true,
  performance: true,
  expiration: true,
  qr_activity: true,
};

export interface NotificationState {
  history: NotificationHistoryItem[];
  preferences: NotificationPreferences;
  phase: NotificationPhase;
  errorMessage: string | null;
  totalHistory: number;
  lastFetchedAt: number | null;
}

interface InFlightRequest<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

const CACHE_TTL_MS = 30_000; // 30 seconds

class NotificationStore {
  private state: NotificationState = {
    history: [],
    preferences: DEFAULT_PREFERENCES,
    phase: 'idle',
    errorMessage: null,
    totalHistory: 0,
    lastFetchedAt: null,
  };

  private generation = 0;
  private subscribers = new Set<() => void>();
  private inFlightHistory: InFlightRequest<{ notifications: NotificationHistoryItem[]; total: number }> | null = null;
  private inFlightPreferences: InFlightRequest<NotificationPreferences> | null = null;
  private activeUserId: string | null = null;

  /** Subscribe to store changes (for useSyncExternalStore) */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /** Get current snapshot (for useSyncExternalStore) */
  getSnapshot(): NotificationState {
    return this.state;
  }

  /** Get server snapshot (for SSR/hydration) */
  getServerSnapshot(): NotificationState {
    return this.state;
  }

  /** Set the active user; resets store on user change */
  setActiveUser(userId: string | null): void {
    if (this.activeUserId === userId) return;
    this.activeUserId = userId;
    this.generation++;
    this.inFlightHistory = null;
    this.inFlightPreferences = null;
    this.state = {
      history: [],
      preferences: DEFAULT_PREFERENCES,
      phase: userId ? 'loading' : 'idle',
      errorMessage: null,
      totalHistory: 0,
      lastFetchedAt: null,
    };
    this.notify();
  }

  /** Notify all subscribers */
  private notify(): void {
    this.subscribers.forEach((cb) => cb());
  }

  /** Check if cache is fresh */
  private isCacheFresh(): boolean {
    if (!this.state.lastFetchedAt) return false;
    return Date.now() - this.state.lastFetchedAt < CACHE_TTL_MS;
  }

  /** Load notification history (deduped, cached, generation-guarded) */
  async loadHistory(
    fetchFn: (token: string, limit: number) => Promise<{ data: { notifications: NotificationHistoryItem[]; total: number } | null; status: number; error: string | null }>,
    getToken: (options?: { skipCache?: boolean }) => Promise<string | null>,
    limit = 50,
    force = false
  ): Promise<{ notifications: NotificationHistoryItem[]; total: number }> {
    const currentGen = this.generation;

    // Return cached data if fresh and not forcing
    if (!force && this.isCacheFresh() && this.state.history.length > 0) {
      return { notifications: this.state.history, total: this.state.totalHistory };
    }

    // Dedupe concurrent identical requests
    if (this.inFlightHistory) {
      return this.inFlightHistory.promise;
    }

    const token = await getToken({ skipCache: force });
    if (!token) {
      throw new Error('No authentication token available');
    }

    let resolveFn: (value: { notifications: NotificationHistoryItem[]; total: number }) => void;
    let rejectFn: (error: Error) => void;

    this.inFlightHistory = {
      promise: new Promise((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
      }),
      resolve: resolveFn!,
      reject: rejectFn!,
    };

    // Set loading phase only for initial load
    if (this.state.phase === 'idle' || this.state.phase === 'error' || this.state.phase === 'unauthorized') {
      this.state = { ...this.state, phase: 'loading', errorMessage: null };
      this.notify();
    }

    try {
      const res = await fetchFn(token, limit);

      // Generation guard: discard if user switched
      if (currentGen !== this.generation) {
        this.inFlightHistory = null;
        throw new Error('User changed, discarding stale response');
      }

      if (res.status === 401) {
        this.state = {
          ...this.state,
          phase: 'unauthorized',
          errorMessage: 'Your session has expired. Please sign in again.',
        };
        this.notify();
        const err = new Error('Unauthorized');
        this.inFlightHistory = null;
        rejectFn!(err);
        throw err;
      }

      if (!res.data?.notifications) {
        throw new Error(res.error || 'Failed to load notification history');
      }

      this.state = {
        ...this.state,
        history: res.data.notifications,
        totalHistory: res.data.total,
        phase: 'ready',
        errorMessage: null,
        lastFetchedAt: Date.now(),
      };
      this.notify();
      this.inFlightHistory = null;
      resolveFn!({ notifications: res.data.notifications, total: res.data.total });
      return { notifications: res.data.notifications, total: res.data.total };
    } catch (error) {
      if (currentGen !== this.generation) {
        this.inFlightHistory = null;
        throw error;
      }

      const isUnauthorized = error instanceof Error && error.message === 'Unauthorized';
      this.state = {
        ...this.state,
        phase: isUnauthorized ? 'unauthorized' : 'error',
        errorMessage: isUnauthorized
          ? 'Your session has expired. Please sign in again.'
          : error instanceof Error
          ? error.message
          : 'Failed to load notifications',
      };
      this.notify();
      this.inFlightHistory = null;
      rejectFn!(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /** Load notification preferences (deduped, cached, generation-guarded) */
  async loadPreferences(
    fetchFn: (token: string) => Promise<{ data: { preferences: NotificationPreferences } | null; status: number; error: string | null }>,
    getToken: (options?: { skipCache?: boolean }) => Promise<string | null>,
    force = false
  ): Promise<NotificationPreferences> {
    const currentGen = this.generation;

    // Return cached data if fresh and not forcing
    if (!force && this.isCacheFresh() && this.state.preferences !== DEFAULT_PREFERENCES) {
      return this.state.preferences;
    }

    // Dedupe concurrent identical requests
    if (this.inFlightPreferences) {
      return this.inFlightPreferences.promise;
    }

    const token = await getToken({ skipCache: force });
    if (!token) {
      throw new Error('No authentication token available');
    }

    let resolveFn: (value: NotificationPreferences) => void;
    let rejectFn: (error: Error) => void;

    this.inFlightPreferences = {
      promise: new Promise((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
      }),
      resolve: resolveFn!,
      reject: rejectFn!,
    };

    // Set loading phase only for initial load
    if (this.state.phase === 'idle' || this.state.phase === 'error' || this.state.phase === 'unauthorized') {
      this.state = { ...this.state, phase: 'loading', errorMessage: null };
      this.notify();
    }

    try {
      const res = await fetchFn(token);

      // Generation guard: discard if user switched
      if (currentGen !== this.generation) {
        this.inFlightPreferences = null;
        throw new Error('User changed, discarding stale response');
      }

      if (res.status === 401) {
        this.state = {
          ...this.state,
          phase: 'unauthorized',
          errorMessage: 'Your session has expired. Please sign in again.',
        };
        this.notify();
        const err = new Error('Unauthorized');
        this.inFlightPreferences = null;
        rejectFn!(err);
        throw err;
      }

      if (!res.data?.preferences) {
        throw new Error(res.error || 'Failed to load notification preferences');
      }

      this.state = {
        ...this.state,
        preferences: res.data.preferences,
        phase: 'ready',
        errorMessage: null,
        lastFetchedAt: Date.now(),
      };
      this.notify();
      this.inFlightPreferences = null;
      resolveFn!(res.data.preferences);
      return res.data.preferences;
    } catch (error) {
      if (currentGen !== this.generation) {
        this.inFlightPreferences = null;
        throw error;
      }

      const isUnauthorized = error instanceof Error && error.message === 'Unauthorized';
      this.state = {
        ...this.state,
        phase: isUnauthorized ? 'unauthorized' : 'error',
        errorMessage: isUnauthorized
          ? 'Your session has expired. Please sign in again.'
          : error instanceof Error
          ? error.message
          : 'Failed to load preferences',
      };
      this.notify();
      this.inFlightPreferences = null;
      rejectFn!(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /** Save notification preferences (optimistic update with revert on failure) */
  async savePreferences(
    updateFn: (token: string, prefs: Partial<NotificationPreferences>) => Promise<{ data: { preferences: NotificationPreferences } | null; status: number; error: string | null }>,
    getToken: (options?: { skipCache?: boolean }) => Promise<string | null>,
    nextPrefs: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const currentGen = this.generation;
    const previousPrefs = this.state.preferences;

    // Optimistic update
    this.state = {
      ...this.state,
      preferences: { ...this.state.preferences, ...nextPrefs },
    };
    this.notify();

    const token = await getToken({ skipCache: false });
    if (!token) {
      // Revert on no token
      this.state = { ...this.state, preferences: previousPrefs };
      this.notify();
      throw new Error('No authentication token available');
    }

    try {
      const res = await updateFn(token, nextPrefs);

      if (currentGen !== this.generation) {
        throw new Error('User changed, discarding stale response');
      }

      if (res.status === 401) {
        this.state = {
          ...this.state,
          phase: 'unauthorized',
          errorMessage: 'Your session has expired. Please sign in again.',
          preferences: previousPrefs, // Revert
        };
        this.notify();
        throw new Error('Unauthorized');
      }

      if (!res.data?.preferences) {
        throw new Error(res.error || 'Failed to update notification preferences');
      }

      this.state = {
        ...this.state,
        preferences: res.data.preferences,
        errorMessage: null,
        lastFetchedAt: Date.now(),
      };
      this.notify();
      return res.data.preferences;
    } catch (error) {
      if (currentGen !== this.generation) throw error;

      // Revert on failure
      this.state = {
        ...this.state,
        preferences: previousPrefs,
        errorMessage: error instanceof Error ? error.message : 'Failed to update preferences',
      };
      this.notify();
      throw error;
    }
  }

  /** Force refresh both history and preferences */
  async refreshAll(
    fetchHistory: (token: string, limit: number) => Promise<{ data: { notifications: NotificationHistoryItem[]; total: number } | null; status: number; error: string | null }>,
    fetchPreferences: (token: string) => Promise<{ data: { preferences: NotificationPreferences } | null; status: number; error: string | null }>,
    getToken: (options?: { skipCache?: boolean }) => Promise<string | null>,
    limit = 50
  ): Promise<void> {
    await Promise.allSettled([
      this.loadHistory(fetchHistory, getToken, limit, true),
      this.loadPreferences(fetchPreferences, getToken, true),
    ]);
  }

  /** Clear all in-flight requests (cleanup on unmount/logout) */
  clearInFlight(): void {
    this.inFlightHistory = null;
    this.inFlightPreferences = null;
  }

  /** Reset store completely */
  reset(): void {
    this.generation++;
    this.activeUserId = null;
    this.clearInFlight();
    this.state = {
      history: [],
      preferences: DEFAULT_PREFERENCES,
      phase: 'idle',
      errorMessage: null,
      totalHistory: 0,
      lastFetchedAt: null,
    };
    this.notify();
  }
}

// Singleton instance
export const notificationStore = new NotificationStore();