import "../global.css";
import React, { useEffect } from 'react';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables.');
}

/**
 * Global Navigation Guard:
 * Monitors authentication state and route segments to prevent unauthorized access
 * or redundant authentication screens.
 */
function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const segmentList = segments as string[];
    const inAuthGroup = segmentList[0] === '(auth)';
    const inProtectedGroup = segmentList[0] === '(protected)';

    if (isSignedIn && inAuthGroup) {
      // Authenticated user trying to access login/register/welcome -> redirect to protected dashboard
      router.replace('/(protected)' as any);
    } else if (!isSignedIn && inProtectedGroup) {
      // Unauthenticated user attempting to access dashboard or protected screens -> redirect to welcome
      router.replace('/(auth)/welcome' as any);
    }
  }, [isLoaded, isSignedIn, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={publishableKey!}
      tokenCache={tokenCache}
    >
      <StatusBar style="light" />
      <NavigationGuard>
        <Slot />
      </NavigationGuard>
    </ClerkProvider>
  );
}
