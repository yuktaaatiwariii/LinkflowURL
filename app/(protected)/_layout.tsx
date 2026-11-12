import React, { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Colors } from '../../src/constants/colors';
import { useSharedUrl } from '../../src/hooks/useSharedUrl';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';

export default function ProtectedLayout() {
  const router = useRouter();
  const { sharedUrl, rejectedContent, clearSharedUrl, clearRejectedContent } = useSharedUrl();

  // Keeps an existing push registration alive across app restarts without
  // ever prompting the user (the prompt lives in the notifications screen).
  usePushNotifications();

  // Share-to-LinkFlow: a URL shared from another app is handed to the
  // existing Create Link screen, where the user can edit it before shortening.
  useEffect(() => {
    if (!sharedUrl) return;
    router.push({
      pathname: '/(protected)/links',
      params: { url: sharedUrl },
    } as any);
    clearSharedUrl();
  }, [sharedUrl, router, clearSharedUrl]);

  // Shared content that is not a link: explain it instead of failing silently.
  useEffect(() => {
    if (!rejectedContent) return;
    Alert.alert(
      'Nothing to shorten',
      'The content you shared does not contain a valid http(s) link.',
      [{ text: 'OK', onPress: () => clearRejectedContent() }]
    );
  }, [rejectedContent, clearRejectedContent]);

  // Tapping a push notification opens the notification center.
  const lastResponseId = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      const identifier = response?.notification?.request?.identifier;
      if (!identifier || lastResponseId.current === identifier) return;
      lastResponseId.current = identifier;
      router.push('/(protected)/notifications' as any);
    };

    // Taps received while the app was running…
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

    // …and the tap that cold-started the app.
    Notifications.getLastNotificationResponseAsync()
      .then(handleResponse)
      .catch(() => undefined);

    return () => subscription.remove();
  }, [router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
