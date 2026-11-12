import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from '@clerk/expo';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  type NotificationPlatform,
} from '../services/notifications';

/**
 * Push-notification registration for LinkFlow.
 *
 * Flow:
 *  1. The foreground handler shows banners while the app is open.
 *  2. Permission is requested at a deliberate point in the journey (the
 *     notification settings screen or right after the first link is created),
 *     never automatically on app start.
 *  3. Once granted, the Expo push token is registered with the backend and
 *     refreshed whenever the OS rotates the token.
 *
 * Expo push tokens require an EAS project id (`extra.eas.projectId` in
 * app.json, written by `eas init`). Android push also requires a development
 * build (Expo Go cannot receive remote push notifications).
 */

export type PushPermissionState = 'undetermined' | 'granted' | 'denied';

export const NOTIFICATION_CHANNEL_ID = 'linkflow-alerts';

/** Foreground behaviour: show the notification as a banner + in the tray. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function getEasProjectId(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, any>;
  const fromConfig = extra?.eas?.projectId;
  if (typeof fromConfig === 'string' && fromConfig.trim()) {
    return fromConfig.trim();
  }
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim();
  }
  return null;
}

function currentPlatform(): NotificationPlatform {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return 'web';
}

export function usePushNotifications() {
  const { getToken } = useAuth();
  const [permission, setPermission] = useState<PushPermissionState>('undetermined');
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const registeringRef = useRef(false);

  /** Creates the Android channel (required for Android 8+ notifications). */
  const ensureChannel = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'LinkFlow alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#792CF0',
        sound: 'default',
      });
    } catch (err: any) {
      console.warn('[Push] Failed to create notification channel:', err?.message);
    }
  }, []);

  /** Reads the current OS permission state without prompting the user. */
  const refreshPermission = useCallback(async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      const granted =
        current.granted ||
        current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
      setPermission(granted ? 'granted' : current.canAskAgain === false ? 'denied' : 'undetermined');
      return granted;
    } catch {
      return false;
    }
  }, []);

  /** Fetches the Expo push token and stores it on the backend. */
  const syncTokenWithBackend = useCallback(
    async (token: string) => {
      const authToken = await getToken();
      if (!authToken) return false;
      const res = await registerDeviceToken(
        authToken,
        token,
        currentPlatform(),
        Device.deviceName || undefined
      );
      if (res.error) {
        setStatusMessage(res.error);
        return false;
      }
      setStatusMessage(null);
      return true;
    },
    [getToken]
  );

  /**
   * Registers the device token with the backend. Safe to call repeatedly:
   * the backend upserts on the token value, so there are no duplicates.
   */
  const registerForPushNotifications = useCallback(async (): Promise<boolean> => {
    if (registeringRef.current) return false;
    registeringRef.current = true;

    try {
      await ensureChannel();

      const projectId = getEasProjectId();
      if (!projectId) {
        setStatusMessage(
          'Push notifications need an EAS project id. Run `eas init` and rebuild the app.'
        );
        return false;
      }

      const existing = await Notifications.getPermissionsAsync();
      const alreadyGranted =
        existing.granted ||
        existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

      const requested = alreadyGranted
        ? existing
        : await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true },
          });

      const granted =
        requested.granted ||
        requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

      if (!granted) {
        setPermission(requested.canAskAgain === false ? 'denied' : 'undetermined');
        setStatusMessage(
          requested.canAskAgain === false
            ? 'Notifications are blocked for LinkFlow. Enable them in your device settings.'
            : 'Notification permission was not granted.'
        );
        return false;
      }

      setPermission('granted');

      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResponse?.data;
      if (!token) {
        setStatusMessage('Could not obtain a push token for this device.');
        return false;
      }

      setExpoPushToken(token);
      const synced = await syncTokenWithBackend(token);
      if (!synced) {
        setStatusMessage('Registered the device, but the server could not be reached.');
      }
      return synced;
    } catch (err: any) {
      const message = err?.message || 'Could not set up notifications.';
      // Expo Go cannot issue push tokens; development builds are required.
      setStatusMessage(
        /Expo Go|not available|standalone/i.test(message)
          ? 'Push notifications require a development build of LinkFlow (not Expo Go).'
          : message
      );
      return false;
    } finally {
      registeringRef.current = false;
    }
  }, [ensureChannel, syncTokenWithBackend]);

  /** Removes this device's token from the backend (called on sign-out). */
  const unregisterFromPushNotifications = useCallback(async () => {
    try {
      const authToken = await getToken();
      if (!authToken) return;

      // The token may not be in this hook instance's state (the profile screen
      // mounts its own copy), so fall back to asking the OS for it.
      let token = expoPushToken;
      if (!token) {
        const projectId = getEasProjectId();
        if (!projectId) return;
        const current = await Notifications.getPermissionsAsync();
        const granted =
          current.granted ||
          current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
        if (!granted) return;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      }
      if (!token) return;

      await unregisterDeviceToken(authToken, token);
      setExpoPushToken(null);
    } catch {
      // Signing out must never fail because of the token cleanup.
    }
  }, [expoPushToken, getToken]);

  // Restore an already-granted registration (no prompt) and keep it fresh.
  useEffect(() => {
    let cancelled = false;

    // The web build has no push transport: Expo push tokens are native-only.
    if (Platform.OS === 'web') return;

    (async () => {
      const granted = await refreshPermission();
      if (cancelled || !granted) return;

      await ensureChannel();
      const projectId = getEasProjectId();
      if (!projectId) return;

      try {
        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenResponse?.data;
        if (!token || cancelled) return;
        setExpoPushToken(token);
        await syncTokenWithBackend(token);
      } catch {
        // Silent: the user has not opted in on this device yet.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshPermission, ensureChannel, syncTokenWithBackend]);

  // The OS can rotate the push token while the app runs; re-register it.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addPushTokenListener(async (event: any) => {
      const token = event?.data;
      if (!token) return;
      setExpoPushToken(token);
      await syncTokenWithBackend(token);
    });
    return () => subscription.remove();
  }, [syncTokenWithBackend]);

  return {
    permission,
    expoPushToken,
    statusMessage,
    refreshPermission,
    registerForPushNotifications,
    unregisterFromPushNotifications,
  };
}
