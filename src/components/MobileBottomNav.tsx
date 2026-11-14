import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { Colors } from '../constants/colors';

type TabIcon = 'home' | 'link' | 'qr' | 'user';

interface TabItem {
  key: string;
  label: string;
  icon: TabIcon;
  path: string;
  /** Normalised pathname without the route group. */
  match: string;
}

const TABS: TabItem[] = [
  { key: 'home', label: 'Home', icon: 'home', path: '/(protected)', match: '/' },
  { key: 'links', label: 'Short Links', icon: 'link', path: '/(protected)/links', match: '/links' },
  { key: 'qr', label: 'QR Codes', icon: 'qr', path: '/(protected)/qr', match: '/qr' },
  { key: 'profile', label: 'Profile', icon: 'user', path: '/(protected)/profile', match: '/profile' },
];

const ACTIVE_BG = Colors.primary;
const MUTED = Colors.textMuted;

/** Removes Expo Router group segments and trailing slashes. */
function normalizePath(pathname: string | null | undefined): string {
  const raw = pathname || '/';
  const withoutGroup = raw.replace('/(protected)', '');
  const trimmed = withoutGroup.replace(/\/+$/, '');
  return trimmed || '/';
}

/**
 * Fixed mobile bottom navigation.
 * Rendered as a sibling of the scrollable content so it never covers it.
 */
export function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const current = normalizePath(pathname);

  // The dashboard's SafeAreaView intentionally excludes the bottom edge so the
  // nav background can extend to the home indicator; the inset is applied here
  // on every platform so labels never sit under the gesture bar.
  const bottomPadding = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPadding }]}>
      <View style={styles.row}>
        {TABS.map((tab) => {
          const active =
            tab.match === '/'
              ? current === '/'
              : current === tab.match || current.startsWith(`${tab.match}/`);

          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.85}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
              style={[styles.item, active && styles.itemActive]}
              onPress={() => {
                if (active) return;
                // `navigate` reuses an existing tab route instead of stacking
                // duplicate screens when switching back and forth.
                router.navigate(tab.path as any);
              }}
            >
              <AppIcon
                name={tab.icon}
                size={20}
                color={active ? Colors.background : MUTED}
              />
              <Text
                style={[styles.label, active && styles.labelActive]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#1C1C1C',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 9,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 52,
  },
  itemActive: {
    backgroundColor: ACTIVE_BG,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 0.1,
  },
  labelActive: {
    color: Colors.background,
  },
});
