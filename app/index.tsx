import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Colors } from '../src/constants/colors';

export default function IndexScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const segmentList = segments as string[];
    const inAuthGroup = segmentList[0] === '(auth)';
    const inProtectedGroup = segmentList[0] === '(protected)';

    if (isSignedIn) {
      if (!inProtectedGroup) {
        router.replace('/(protected)' as any);
      }
    } else {
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome' as any);
      }
    }
  }, [isLoaded, isSignedIn, segments, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
