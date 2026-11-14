import React, { useState } from 'react';
import {
  Linking,
  Modal,
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
import {
  DOCS_CONTENT_MAX_WIDTH,
  DOCS_SHELL_MAX_WIDTH,
  DOCS_SIDEBAR_WIDTH,
  DOCS_TOC_WIDTH,
  DocsColors,
  DocsRadius,
  DocsSpacing,
} from '../../constants/docsTheme';
import type { FeatherName } from '../developer/DeveloperUI';
import { API_REFERENCE } from '../../constants/apiReference';
import { artifactUrl } from '../../services/docs';
import { DocsTocProvider, useDocsToc } from './DocsTocContext';

interface NavItem {
  label: string;
  href: string;
  icon: FeatherName;
  exact?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Getting started',
    items: [
      { label: 'Introduction', href: '/developers', icon: 'home', exact: true },
      { label: 'Getting started', href: '/developers/getting-started', icon: 'play-circle' },
      { label: 'Authentication', href: '/developers/authentication', icon: 'shield' },
    ],
  },
  {
    title: 'API reference',
    items: [
      { label: 'Links', href: '/developers/api/links', icon: 'link' },
      { label: 'QR codes', href: '/developers/api/qr', icon: 'grid' },
      { label: 'Analytics', href: '/developers/api/analytics', icon: 'bar-chart-2' },
    ],
  },
  {
    title: 'Tools',
    items: [{ label: 'API playground', href: '/developers/playground', icon: 'terminal' }],
  },
  {
    title: 'Reference',
    items: [
      { label: 'Errors', href: '/developers/errors', icon: 'alert-triangle' },
      { label: 'Changelog', href: '/developers/changelog', icon: 'clock' },
    ],
  },
];

const MOBILE_LINKS = NAV_GROUPS.flatMap((group) => group.items);

function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Brand({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel="LinkFlow developer documentation home"
      style={styles.brand}
    >
      <View style={styles.brandMark}>
        <Feather name="terminal" size={17} color="#FFFFFF" />
      </View>
      <View>
        <Text style={styles.brandTitle}>LinkFlow</Text>
        <Text style={styles.brandSubtitle}>Developer Documentation</Text>
      </View>
    </TouchableOpacity>
  );
}

function ExternalNavItem({
  label,
  url,
  icon,
  onNavigate,
}: {
  label: string;
  url: string;
  icon: FeatherName;
  onNavigate?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      accessibilityRole="link"
      onPress={() => {
        onNavigate?.();
        void Linking.openURL(url);
      }}
      style={styles.navItem}
    >
      <Feather name={icon} size={15} color={DocsColors.textMuted} />
      <Text style={styles.navLabel}>{label}</Text>
      <Feather name="external-link" size={12} color={DocsColors.textMuted} />
    </TouchableOpacity>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.sidebarContent}
      showsVerticalScrollIndicator={false}
    >
      {NAV_GROUPS.map((group) => (
        <View key={group.title} style={styles.navGroup}>
          <Text style={styles.navGroupTitle}>{group.title}</Text>
          {group.items.map((item) => {
            const active = isActive(item, pathname);
            return (
              <TouchableOpacity
                key={item.href}
                activeOpacity={0.78}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                onPress={() => onNavigate(item.href)}
                style={[styles.navItem, active && styles.navItemActive]}
              >
                <Feather
                  name={item.icon}
                  size={15}
                  color={active ? DocsColors.primarySoft : DocsColors.textMuted}
                />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {item.label}
                </Text>
                {active ? <View style={styles.navDot} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={styles.navGroup}>
        <Text style={styles.navGroupTitle}>Resources</Text>
        <ExternalNavItem
          label="OpenAPI specification"
          url={artifactUrl('openapi')}
          icon="file-text"
        />
        <ExternalNavItem
          label="Postman collection"
          url={artifactUrl('postman')}
          icon="download"
        />
        <ExternalNavItem
          label="Postman environment"
          url={artifactUrl('postmanEnvironment')}
          icon="sliders"
        />
      </View>

      <View style={styles.sidebarFooter}>
        <Text style={styles.sidebarFooterText}>
          API {API_REFERENCE.meta.apiVersion} · {API_REFERENCE.meta.version}
        </Text>
        <Text style={styles.sidebarFooterText}>
          {API_REFERENCE.endpoints.length} documented endpoints
        </Text>
      </View>
    </ScrollView>
  );
}

function TableOfContents() {
  const { sections, activeId, scrollToSection } = useDocsToc();

  if (sections.length === 0) {
    return <View style={styles.toc} />;
  }

  return (
    <View style={styles.toc}>
      <Text style={styles.tocTitle}>On this page</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.tocList}>
          {sections.map((section) => {
            const active = section.id === activeId;
            return (
              <TouchableOpacity
                key={section.id}
                activeOpacity={0.75}
                accessibilityRole="link"
                onPress={() => scrollToSection(section.id)}
                style={styles.tocItem}
              >
                <View style={[styles.tocBar, active && styles.tocBarActive]} />
                <Text style={[styles.tocLabel, active && styles.tocLabelActive]} numberOfLines={2}>
                  {section.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function Header({
  onMenu,
  isCompact,
}: {
  onMenu: () => void;
  isCompact: boolean;
}) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.headerInner}>
        <Brand onPress={() => router.navigate('/developers' as any)} />
        {!isCompact ? (
          <View style={styles.headerLinks}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.navigate('/developers/getting-started' as any)}
            >
              <Text style={styles.headerLink}>Guides</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.navigate('/developers/api/links' as any)}
            >
              <Text style={styles.headerLink}>API reference</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.navigate('/developers/playground' as any)}
            >
              <Text style={styles.headerLink}>Playground</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <View style={styles.versionBadge}>
          <View style={styles.versionDot} />
          <Text style={styles.versionLabel}>{API_REFERENCE.meta.apiVersion}</Text>
        </View>
        {!isCompact ? (
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => router.navigate('/(protected)/developer' as any)}
            style={styles.dashboardButton}
          >
            <Feather name="grid" size={14} color={DocsColors.text} />
            <Text style={styles.dashboardButtonLabel}>Dashboard</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onMenu}
            accessibilityRole="button"
            accessibilityLabel="Open documentation menu"
            style={styles.menuButton}
          >
            <Feather name="menu" size={19} color={DocsColors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function MobileTabs({ pathname, onNavigate }: { pathname: string; onNavigate: (href: string) => void }) {
  return (
    <View style={styles.mobileTabs}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mobileTabsContent}
      >
        {MOBILE_LINKS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <TouchableOpacity
              key={item.href}
              activeOpacity={0.78}
              onPress={() => onNavigate(item.href)}
              style={[styles.mobileTab, active && styles.mobileTabActive]}
            >
              <Text style={[styles.mobileTabLabel, active && styles.mobileTabLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function DocsShell() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  // Static web export renders on the server, where the window width is unknown.
  // Keep the first client render identical to the server output, then apply the
  // real breakpoints after mount to avoid a hydration mismatch.
  const [measured, setMeasured] = useState(false);
  React.useEffect(() => setMeasured(true), []);
  const layoutWidth = measured ? width : 0;

  const showSidebar = layoutWidth >= 980;
  const showToc = layoutWidth >= 1200;
  const isCompact = layoutWidth > 0 && layoutWidth < 900;

  const navigate = (href: string) => {
    setMenuOpen(false);
    router.navigate(href as any);
  };

  return (
    <DocsTocProvider>
      <StatusBar style="light" />
      <SafeAreaView
        style={[styles.root, { paddingTop: Platform.OS === 'web' ? 0 : insets.top }]}
        edges={['left', 'right']}
      >
        <Header onMenu={() => setMenuOpen(true)} isCompact={isCompact} />
        {!showSidebar ? (
          <MobileTabs pathname={pathname} onNavigate={navigate} />
        ) : null}

        <View style={styles.body}>
          {showSidebar ? (
            <View style={[styles.sidebar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <SidebarContent pathname={pathname} onNavigate={navigate} />
            </View>
          ) : null}

          <View style={styles.mainRow}>
            <View
              style={[
                styles.main,
                !showSidebar && styles.mainCompact,
                { paddingHorizontal: isCompact ? DocsSpacing.lg : DocsSpacing.xl },
              ]}
            >
              <Slot />
            </View>

            {showToc ? (
              <View
                style={[
                  styles.tocColumn,
                  { paddingRight: Math.max(insets.right, DocsSpacing.xl) },
                ]}
              >
                <TableOfContents />
              </View>
            ) : null}
          </View>
        </View>

        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <View style={styles.drawerRoot}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.drawerBackdrop}
              onPress={() => setMenuOpen(false)}
              accessibilityLabel="Close menu"
            />
            <SafeAreaView style={styles.drawer} edges={['left']}>
              <View style={styles.drawerHeader}>
                <Brand onPress={() => navigate('/developers')} />
                <TouchableOpacity
                  onPress={() => setMenuOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close menu"
                  style={styles.drawerClose}
                >
                  <Feather name="x" size={18} color={DocsColors.text} />
                </TouchableOpacity>
              </View>
              <SidebarContent pathname={pathname} onNavigate={navigate} />
              <View style={styles.drawerFooter}>
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={() => navigate('/(protected)/developer')}
                  style={styles.drawerDashboard}
                >
                  <Feather name="grid" size={14} color={DocsColors.text} />
                  <Text style={styles.drawerDashboardLabel}>Developer Dashboard</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </DocsTocProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DocsColors.background },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: DocsColors.border,
    backgroundColor: DocsColors.backgroundAlt,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DocsSpacing.md,
    height: 62,
    width: '100%',
    maxWidth: DOCS_SHELL_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: DocsSpacing.xl,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: DocsColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DocsColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  brandTitle: { color: DocsColors.text, fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  brandSubtitle: { color: DocsColors.textMuted, fontSize: 9.5, fontWeight: '600', letterSpacing: 0.3 },
  headerLinks: { flexDirection: 'row', alignItems: 'center', gap: DocsSpacing.lg, marginLeft: DocsSpacing.xl },
  headerLink: { color: DocsColors.textSecondary, fontSize: 12.5, fontWeight: '600' },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: DocsColors.border,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  versionDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: DocsColors.success },
  versionLabel: { color: DocsColors.textSecondary, fontSize: 10.5, fontWeight: '700' },
  dashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: DocsColors.borderStrong,
    backgroundColor: DocsColors.surfaceRaised,
    borderRadius: DocsRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dashboardButtonLabel: { color: DocsColors.text, fontSize: 12, fontWeight: '700' },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: DocsRadius.sm,
    borderWidth: 1,
    borderColor: DocsColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTabs: {
    borderBottomWidth: 1,
    borderBottomColor: DocsColors.border,
    backgroundColor: DocsColors.backgroundAlt,
  },
  mobileTabsContent: {
    gap: 4,
    paddingHorizontal: DocsSpacing.md,
    paddingVertical: 7,
  },
  mobileTab: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: DocsRadius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mobileTabActive: {
    backgroundColor: DocsColors.primaryBg,
    borderColor: DocsColors.primaryBorder,
  },
  mobileTabLabel: { color: DocsColors.textMuted, fontSize: 11.5, fontWeight: '700' },
  mobileTabLabelActive: { color: DocsColors.primarySoft },
  body: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    maxWidth: DOCS_SHELL_MAX_WIDTH,
    alignSelf: 'center',
    minHeight: 0,
  },
  sidebar: {
    width: DOCS_SIDEBAR_WIDTH,
    borderRightWidth: 1,
    borderRightColor: DocsColors.border,
    backgroundColor: DocsColors.backgroundAlt,
  },
  sidebarContent: { paddingHorizontal: DocsSpacing.md, paddingTop: DocsSpacing.xl },
  navGroup: { marginBottom: DocsSpacing.xl },
  navGroupTitle: {
    color: DocsColors.textMuted,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 9,
    marginBottom: 7,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: DocsRadius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: DocsColors.primaryBg,
    borderColor: DocsColors.primaryBorder,
  },
  navLabel: { flex: 1, color: DocsColors.textSecondary, fontSize: 12.5, fontWeight: '600' },
  navLabelActive: { color: DocsColors.primarySoft, fontWeight: '700' },
  navDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: DocsColors.primary },
  sidebarFooter: {
    marginTop: DocsSpacing.sm,
    paddingTop: DocsSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: DocsColors.border,
    gap: 4,
    paddingHorizontal: 9,
  },
  sidebarFooterText: { color: DocsColors.textMuted, fontSize: 10, lineHeight: 15 },
  mainRow: { flex: 1, flexDirection: 'row', minWidth: 0 },
  main: {
    flex: 1,
    minWidth: 0,
    paddingTop: DocsSpacing.xl,
    maxWidth: DOCS_CONTENT_MAX_WIDTH + 80,
    alignSelf: 'center',
    width: '100%',
  },
  mainCompact: { maxWidth: 960 },
  tocColumn: { width: DOCS_TOC_WIDTH, paddingTop: DocsSpacing.xl, paddingLeft: DocsSpacing.sm },
  toc: { flex: 1 },
  tocTitle: {
    color: DocsColors.textMuted,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  tocList: { gap: 2, paddingBottom: DocsSpacing.xl },
  tocItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 5 },
  tocBar: { width: 2, height: 16, borderRadius: 2, backgroundColor: DocsColors.border, marginTop: 2 },
  tocBarActive: { backgroundColor: DocsColors.primary },
  tocLabel: { flex: 1, color: DocsColors.textMuted, fontSize: 11.5, lineHeight: 17 },
  tocLabelActive: { color: DocsColors.primarySoft, fontWeight: '600' },
  drawerRoot: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(4, 4, 8, 0.62)' },
  drawer: {
    width: 310,
    backgroundColor: DocsColors.backgroundAlt,
    borderLeftWidth: 1,
    borderLeftColor: DocsColors.border,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DocsSpacing.md,
    paddingVertical: DocsSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: DocsColors.border,
  },
  drawerClose: {
    width: 32,
    height: 32,
    borderRadius: DocsRadius.sm,
    borderWidth: 1,
    borderColor: DocsColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerFooter: {
    padding: DocsSpacing.md,
    borderTopWidth: 1,
    borderTopColor: DocsColors.border,
  },
  drawerDashboard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: DocsColors.primaryBorder,
    backgroundColor: DocsColors.primaryBg,
    borderRadius: DocsRadius.sm,
    paddingVertical: 10,
  },
  drawerDashboardLabel: { color: DocsColors.primarySoft, fontSize: 12, fontWeight: '700' },
});
