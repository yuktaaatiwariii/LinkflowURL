import { authenticatedFetch } from './api';

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

export interface NotificationPreferences {
  master_enabled: boolean;
  milestones: boolean;
  performance: boolean;
  expiration: boolean;
  qr_activity: boolean;
  updated_at?: string;
}

export interface NotificationHistoryItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  master_enabled: true,
  milestones: true,
  performance: true,
  expiration: true,
  qr_activity: true,
};

/** Registers (or refreshes) this device's Expo push token for the user. */
export async function registerDeviceToken(
  authToken: string,
  expoPushToken: string,
  platform: NotificationPlatform,
  deviceName?: string
) {
  return authenticatedFetch('/api/notifications/register', authToken, {
    method: 'POST',
    body: JSON.stringify({ expoPushToken, platform, deviceName }),
  });
}

/** Removes this device's push token (used on sign-out). */
export async function unregisterDeviceToken(authToken: string, expoPushToken: string) {
  return authenticatedFetch('/api/notifications/unregister', authToken, {
    method: 'POST',
    body: JSON.stringify({ expoPushToken }),
  });
}

/** Loads the user's stored notification preferences. */
export async function fetchNotificationPreferences(authToken: string) {
  return authenticatedFetch<{ preferences: NotificationPreferences }>(
    '/api/notifications/preferences',
    authToken,
    { method: 'GET' }
  );
}

/** Persists the user's notification preferences. */
export async function updateNotificationPreferences(
  authToken: string,
  preferences: Partial<NotificationPreferences>
) {
  return authenticatedFetch<{ preferences: NotificationPreferences }>(
    '/api/notifications/preferences',
    authToken,
    {
      method: 'PUT',
      body: JSON.stringify(preferences),
    }
  );
}

/** Loads the user's notification history (most recent first). */
export async function fetchNotificationHistory(authToken: string, limit = 50) {
  return authenticatedFetch<{ notifications: NotificationHistoryItem[]; total: number }>(
    `/api/notifications/history?limit=${limit}`,
    authToken,
    { method: 'GET' }
  );
}
