import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { DevColors, DevRadius, DevSpacing } from '../../../src/constants/developerTheme';
import { DeveloperToastProvider } from '../../../src/components/developer/DeveloperToast';
import type { FeatherName } from '../../../src/components/developer/DeveloperUI';

interface NavItem {
  key: string;
  label: string;
  icon: FeatherName;
  path: string;
  match: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: 'grid',
    path: '/(protected)/developer',
    match: '/developer',
  },
  {
    key: 'projects',
    label: 'Projects',
    icon: 'folder',
    path: '/(protected)/developer/projects',
    match: '/developer/projects',
  },
  {
    key: 'keys',
    label: 'API Keys',
    icon: 'key',
    path: '/(protected)/developer/keys',
    match: '/developer/keys',
  },
  {
    key: 'usage',
    label: 'Usage Analytics',
    icon: 'bar-chart-2',
    path: '/(protected)/developer/usage',
    match: '/developer/usage',
  },
  {
    key: 'logs',
    label: 'API Logs',
    icon: 'list',
    path: '/(protected)/developer/logs',
    match: '/developer/logs',
  },
  {
    key: 'docs',
    label: 'Documentation',
    icon: 'book-open',
    path: '/developers',
    match: '/developers',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'settings',
    path: '/(protected)/developer/settings',
    match: '/developer/settings',
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}>
        <Feather name="terminal" size={17} color="#FFFFFF" />
      </View>
      {!compact ? (
        <View>
          <Text style={styles.brandTitle}>LinkFlow</Text>
          <Text style={styles.brandSubtitle}>Developer Platform</Text>
        </View>
      ) : null}
    </View>
  );
}

function isActive(item: NavItem, pathname: string): boolean {
  if (item.key === 'overview') return pathname === item.match;
  return pathname === item.match || pathname.startsWith(`${item.match}/`);
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate: (path: string) => void }) {
  return (
    <View style={styles.sidebarNav}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(item, pathname);
        return (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onNavigate(item.path)}
            style={[styles.navItem, active && styles.navItemActive]}
          >
            <Feather
              name={item.icon}
              size={16}
              color={active ? DevColors.primarySoft : DevColors.textMuted}
            />
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            {active ? <View style={styles.navIndicator} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TopNav({ pathname, onNavigate }: { pathname: string; onNavigate: (path: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.topNavContent}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item, pathname);
        return (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onNavigate(item.path)}
            style={[styles.tabItem, active && styles.tabItemActive]}
          >
            <Feather
              name={item.icon}
              size={14}
              color={active ? DevColors.primarySoft : DevColors.textMuted}
            />
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function DeveloperLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const navigate = (path: string) => {
    router.navigate(path as any);
  };

  const content = (
    <View style={styles.content}>
      <View style={styles.contentInner}>
        <Slot />
      </View>
    </View>
  );

  return (
    <DeveloperToastProvider>
      <StatusBar style="light" />
      <SafeAreaView
        style={[styles.root, { paddingTop: Platform.OS === 'web' ? 0 : insets.top }]}
        edges={['left', 'right']}
      >
        {isDesktop ? (
          <View style={styles.desktopRow}>
            <View style={[styles.sidebar, { paddingBottom: Math.max(insets.bottom, 18) }]}>
              <Brand />
              <View style={styles.sidebarDivider} />
              <SidebarNav pathname={pathname} onNavigate={navigate} />
              <View style={{ flex: 1 }} />
              <View style={styles.sidebarFooter}>
                <Text style={styles.footerNote}>API dashboard</Text>
                <TouchableOpacity
                  onPress={() => router.navigate('/(protected)' as any)}
                  style={styles.backLink}
                >
                  <Feather name="arrow-left" size={14} color={DevColors.textSecondary} />
                  <Text style={styles.backLinkText}>Back to LinkFlow</Text>
                </TouchableOpacity>
              </View>
            </View>
            {content}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={[styles.mobileHeader, isTablet && styles.tabletHeader]}>
              <TouchableOpacity
                onPress={() => router.navigate('/(protected)' as any)}
                accessibilityRole="button"
                accessibilityLabel="Back to LinkFlow"
                style={styles.mobileBack}
              >
                <Feather name="arrow-left" size={16} color={DevColors.textSecondary} />
              </TouchableOpacity>
              <Brand />
              <View style={{ flex: 1 }} />
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>Developer</Text>
            </View>
            <View style={styles.tabBar}>
              <TopNav pathname={pathname} onNavigate={navigate} />
            </View>
            {content}
          </View>
        )}
      </SafeAreaView>
    </DeveloperToastProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DevColors.background },
  desktopRow: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 252,
    backgroundColor: DevColors.backgroundAlt,
    borderRightWidth: 1,
    borderRightColor: DevColors.border,
    paddingHorizontal: DevSpacing.lg,
    paddingTop: DevSpacing.xl,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: DevColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DevColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  brandTitle: { color: DevColors.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  brandSubtitle: { color: DevColors.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  sidebarDivider: { height: 1, backgroundColor: DevColors.border, marginVertical: DevSpacing.xl },
  sidebarNav: { gap: 4 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: DevRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: DevColors.primaryBg,
    borderColor: DevColors.primaryBorder,
  },
  navLabel: { color: DevColors.textSecondary, fontSize: 12.5, fontWeight: '600', flex: 1 },
  navLabelActive: { color: DevColors.primarySoft, fontWeight: '700' },
  navIndicator: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: DevColors.primary,
  },
  sidebarFooter: { gap: 10, paddingBottom: 8 },
  footerNote: { color: DevColors.textMuted, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  backLinkText: { color: DevColors.textSecondary, fontSize: 12, fontWeight: '600' },
  content: { flex: 1, minWidth: 0 },
  contentInner: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: 1240 },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: DevSpacing.lg,
    paddingVertical: DevSpacing.md,
    backgroundColor: DevColors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: DevColors.border,
  },
  tabletHeader: { paddingHorizontal: DevSpacing.xl },
  mobileBack: {
    width: 32,
    height: 32,
    borderRadius: DevRadius.sm,
    borderWidth: 1,
    borderColor: DevColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DevColors.success },
  liveLabel: { color: DevColors.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 },
  tabBar: {
    backgroundColor: DevColors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: DevColors.border,
  },
  topNavContent: {
    gap: 4,
    paddingHorizontal: DevSpacing.md,
    paddingVertical: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: DevRadius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabItemActive: { backgroundColor: DevColors.primaryBg, borderColor: DevColors.primaryBorder },
  tabLabel: { color: DevColors.textMuted, fontSize: 11.5, fontWeight: '700' },
  tabLabelActive: { color: DevColors.primarySoft },
});
