import { authenticatedFetch } from './api';
import {
  NotificationHistoryItem,
  NotificationPreferences,
  DEFAULT_PREFERENCES,
  type NotificationPhase,
} from '../state/notificationStore';

/**
 * LinkFlow push-notification API client.
 *
 * Every endpoint is protected by the Clerk bearer token and scoped to the
 * authenticated user on the server side. Provider credentials (FCM/APNs) are
 * never exposed to the app: the mobile client only ever sees its own opaque
 * Expo push token.
 */

export type NotificationType = 'milestone' | 'performance' | 'expiration' | 'qr_activity';

export type NotificationPlatform = 'android' | 'ios' | 'web';

// Re-export types from centralized store
export type {
  NotificationHistoryItem,
  NotificationPreferences,
  NotificationPhase,
};
export { DEFAULT_PREFERENCES };

/** Error thrown when a notification request fails with a non-401 status */
export class NotificationRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = 'NotificationRequestError';
  }
}

/**
 * Gateway functions for the notification store to call.
 * These wrap the authenticatedFetch calls with proper error handling.
 */
export async function fetchNotificationHistoryGateway(
  token: string,
  limit: number
): Promise<{ data: { notifications: NotificationHistoryItem[]; total: number } | null; status: number; error: string | null }> {
  const res = await authenticatedFetch<{ notifications: NotificationHistoryItem[]; total: number }>(
    `/api/notifications/history?limit=${limit}`,
    token
  );
  return {
    data: res.data ? { notifications: res.data.notifications, total: res.data.total } : null,
    status: res.status,
    error: res.error ?? null,
  };
}

export async function fetchNotificationPreferencesGateway(
  token: string
): Promise<{ data: { preferences: NotificationPreferences } | null; status: number; error: string | null }> {
  const res = await authenticatedFetch<{ preferences: NotificationPreferences }>(
    '/api/notifications/preferences',
    token
  );
  return {
    data: res.data ? { preferences: res.data.preferences } : null,
    status: res.status,
    error: res.error ?? null,
  };
}

export async function updateNotificationPreferencesGateway(
  token: string,
  prefs: Partial<NotificationPreferences>
): Promise<{ data: { preferences: NotificationPreferences } | null; status: number; error: string | null }> {
  const res = await authenticatedFetch<{ preferences: NotificationPreferences }>(
    '/api/notifications/preferences',
    token,
    {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }
  );
  return {
    data: res.data ? { preferences: res.data.preferences } : null,
    status: res.status,
    error: res.error ?? null,
  };
}

/**
 * Legacy API functions (kept for backward compatibility during migration).
 * These will be phased out in favor of the centralized store.
 */

export async function fetchNotificationHistory(
  token: string,
  limit = 50
): Promise<{ data: { notifications: NotificationHistoryItem[]; total: number } | null; status: number; error: string | null }> {
  return fetchNotificationHistoryGateway(token, limit);
}

export async function fetchNotificationPreferences(
  token: string
): Promise<{ data: { preferences: NotificationPreferences } | null; status: number; error: string | null }> {
  return fetchNotificationPreferencesGateway(token);
}

export async function updateNotificationPreferences(
  token: string,
  prefs: Partial<NotificationPreferences>
): Promise<{ data: { preferences: NotificationPreferences } | null; status: number; error: string | null }> {
  return updateNotificationPreferencesGateway(token, prefs);
}

export async function registerDeviceToken(
  token: string,
  expoPushToken: string,
  platform: NotificationPlatform,
  deviceName?: string
): Promise<{ data: { success: boolean; message?: string } | null; status: number; error: string | null }> {
  const res = await authenticatedFetch<{ success: boolean; message?: string }>(
    '/api/notifications/register',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ expoPushToken, platform, deviceName }),
    }
  );
  return {
    data: res.data ? { success: res.data.success, message: res.data.message } : null,
    status: res.status,
    error: res.error ?? null,
  };
}

export async function unregisterDeviceToken(
  token: string,
  expoPushToken: string
): Promise<{ data: { success: boolean; message?: string } | null; status: number; error: string | null }> {
  const res = await authenticatedFetch<{ success: boolean; message?: string }>(
    '/api/notifications/register',
    token,
    {
      method: 'DELETE',
      body: JSON.stringify({ expoPushToken }),
    }
  );
  return {
    data: res.data ? { success: res.data.success, message: res.data.message } : null,
    status: res.status,
    error: res.error ?? null,
  };
}