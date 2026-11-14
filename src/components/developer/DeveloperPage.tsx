import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { DevColors, DevSpacing } from '../../constants/developerTheme';

/**
 * Standard scroll container for developer pages: consistent padding, a
 * centered max-width column on large screens and optional pull-to-refresh.
 */
export function DevPage({
  children,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={DevColors.primary}
            colors={[DevColors.primary]}
            progressBackgroundColor={DevColors.surfaceRaised}
          />
        ) : undefined
      }
    >
      <View style={[styles.inner, contentStyle]}>{children}</View>
    </ScrollView>
  );
}

export const devPageStyles = StyleSheet.create({
  pageHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: DevSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DevSpacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DevSpacing.md,
  },
  mono: { fontFamily: 'monospace' },
});

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: DevColors.background },
  content: { flexGrow: 1, paddingBottom: 48 },
  inner: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    paddingHorizontal: DevSpacing.lg,
    paddingTop: DevSpacing.xl,
  },
});
