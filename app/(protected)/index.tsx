import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { Colors } from '../../src/constants/colors';
import {
  CustomButton,
  Card,
  AppIcon,
  LogoutConfirmModal,
} from '../../src/components';
import { syncUserWithBackend, fetchUserLinks } from '../../src/services/api';
import { useIsDesktop } from '../../src/hooks/useBreakpoint';

const { width: screenWidth } = Dimensions.get('window');

export default function HomeDashboard() {
  const router = useRouter();
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const isDesktop = useIsDesktop();

  const [links, setLinks] = useState<any[]>([]);
  const [totalLinks, setTotalLinks] = useState<number>(0);
  const [activeLinks, setActiveLinks] = useState<number>(0);
  const [qrCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      const token = await getToken();
      if (token) {
        const primaryEmail = user?.primaryEmailAddress?.emailAddress;
        const fullName =
          user?.fullName ||
          [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
          null;

        await syncUserWithBackend(token, primaryEmail, fullName);

        const res = await fetchUserLinks(token);
        if (res.data) {
          setLinks(res.data.links || []);
          setTotalLinks(res.data.total || 0);
          setActiveLinks(res.data.active || 0);
        }
      }
    } catch (err: any) {
      console.warn('Dashboard sync/fetch notice:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, user]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const confirmLogout = async () => {
    setLogoutError(null);
    setLoggingOut(true);
    try {
      await signOut();
      router.replace('/(auth)/welcome' as any);
    } catch (err: any) {
      console.error('Sign Out error:', err);
      setLoggingOut(false);
      setLogoutError(err?.message || 'Sign out failed. Please try again.');
    }
  };

  const handleLogout = () => {
    setLogoutError(null);
    setShowLogoutModal(true);
  };

  const displayName =
    user?.firstName ||
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Member';

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      {isDesktop && screenWidth >= 1024 ? (
        <DesktopDashboard
          router={router}
          signOut={signOut}
          getToken={getToken}
          user={user}
          links={links}
          totalLinks={totalLinks}
          activeLinks={activeLinks}
          qrCount={qrCount}
          loading={loading}
          refreshing={refreshing}
          loggingOut={loggingOut}
          loadDashboardData={loadDashboardData}
          onRefresh={onRefresh}
          handleLogout={handleLogout}
          displayName={displayName}
          initial={initial}
        />
      ) : (
        <MobileDashboard
          router={router}
          signOut={signOut}
          getToken={getToken}
          user={user}
          links={links}
          totalLinks={totalLinks}
          activeLinks={activeLinks}
          qrCount={qrCount}
          loading={loading}
          refreshing={refreshing}
          loggingOut={loggingOut}
          loadDashboardData={loadDashboardData}
          onRefresh={onRefresh}
          handleLogout={handleLogout}
          displayName={displayName}
          initial={initial}
        />
      )}
      <LogoutConfirmModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        loading={loggingOut}
        error={logoutError}
      />
    </>
  );
}

interface DashboardProps {
  router: any;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null | undefined>;
  user: any;
  links: any[];
  totalLinks: number;
  activeLinks: number;
  qrCount: number;
  loading: boolean;
  refreshing: boolean;
  loggingOut: boolean;
  loadDashboardData: () => Promise<void>;
  onRefresh: () => void;
  handleLogout: () => void;
  displayName: string;
  initial: string;
}

function MobileDashboard({
  router,
  signOut,
  getToken,
  user,
  links,
  totalLinks,
  activeLinks,
  qrCount,
  loading,
  refreshing,
  loggingOut,
  loadDashboardData,
  onRefresh,
  handleLogout,
  displayName,
  initial,
}: DashboardProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userIntro}>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
            <View>
              <Text style={styles.welcomeGreeting}>Welcome back,</Text>
              <Text style={styles.welcomeName}>{displayName}!</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.logoutBtn,
              loggingOut && { opacity: 0.6 },
            ]}
            onPress={handleLogout}
            disabled={loggingOut}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppIcon name="logout" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Manage your links</Text>
          <Text style={styles.welcomeDesc}>
            Create short links and QR codes in one place.
          </Text>
        </View>

        {/* Primary Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[styles.actionCard, styles.actionPrimary]}
              onPress={() => router.push('/(protected)/links' as any)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={styles.actionIconContainerPrimary}>
                <AppIcon name="link" size={26} color={Colors.textPrimary} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitlePrimary}>Shorten a URL</Text>
                <Text style={styles.actionDesc}>
                  Create clean, trackable short links.
                </Text>
              </View>
              <AppIcon name="arrow-right" size={20} color={Colors.accentLight} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(protected)/qr' as any)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={styles.actionIconContainerSecondary}>
                <AppIcon name="qr" size={26} color={Colors.textPrimary} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Generate QR Code</Text>
                <Text style={styles.actionDesc}>
                  Create scannable QR codes instantly.
                </Text>
              </View>
              <AppIcon name="arrow-right" size={20} color={Colors.accentLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsRow}>
            <Card style={{ ...styles.statCard, ...styles.statPrimary }} variant="secondary">
              <Text style={{ ...styles.statNumber, color: Colors.textPrimary }}>
                {loading ? '-' : totalLinks}
              </Text>
              <Text style={styles.statLabel}>Total Links</Text>
            </Card>
            <Card style={{ ...styles.statCard, ...styles.statActive }} variant="secondary">
              <Text style={{ ...styles.statNumber, color: Colors.success }}>
                {loading ? '-' : activeLinks}
              </Text>
              <Text style={styles.statLabel}>Active Links</Text>
            </Card>
            <Card style={{ ...styles.statCard, ...styles.statQr }} variant="secondary">
              <Text style={{ ...styles.statNumber, color: Colors.accent }}>
                {loading ? '-' : qrCount}
              </Text>
              <Text style={styles.statLabel}>QR Codes</Text>
            </Card>
          </View>
        </View>

        {/* Recent Links */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent Links</Text>
            {links.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(protected)/links' as any)}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.accent} size="large" />
            </View>
          ) : links.length === 0 ? (
            <Card style={styles.emptyCard} variant="secondary">
              <View style={styles.emptyIconBadge}>
                <AppIcon name="link" size={32} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No shortened links yet</Text>
              <Text style={styles.emptyText}>
                Create your first short link to see it here with click analytics.
              </Text>
              <CustomButton
                title="Create First Link"
                size="md"
                variant="primary"
                onPress={() => router.push('/(protected)/links' as any)}
                fullWidth
                style={styles.createBtn}
              />
            </Card>
          ) : (
            <View style={styles.linksList}>
              {links.slice(0, 5).map((item) => (
                <Card key={item.id} style={styles.linkItem} variant="elevated">
                  <View style={styles.linkTopRow}>
                    <Text style={styles.linkTitle} numberOfLines={1}>
                      {item.title || item.short_code}
                    </Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
                    </View>
                  </View>
                  <Text style={styles.shortUrlText}>linkflow.url/{item.short_code}</Text>
                  <Text style={styles.originalUrlText} numberOfLines={1}>
                    {item.original_url}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DesktopDashboard({
  router,
  signOut,
  getToken,
  user,
  links,
  totalLinks,
  activeLinks,
  qrCount,
  loading,
  refreshing,
  loggingOut,
  loadDashboardData,
  onRefresh,
  handleLogout,
  displayName,
  initial,
}: DashboardProps) {
  return (
    <SafeAreaView style={styles.desktopSafeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.desktopContainer}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          <View style={styles.sidebarBrand}>
            <View style={styles.sidebarLogoBadge}>
              <AppIcon name="link" size={22} color={Colors.accentLight} />
            </View>
            <Text style={styles.sidebarBrandName}>LinkFlow URL</Text>
          </View>

          <View style={styles.sidebarNav}>
            <TouchableOpacity
              style={[styles.navItem, styles.navItemActive]}
              onPress={() => router.replace('/(protected)' as any)}
            >
              <AppIcon name="chart" size={20} color={Colors.accentLight} />
              <Text style={styles.navItemText}>Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(protected)/links' as any)}
            >
              <AppIcon name="link" size={20} color={Colors.textSecondary} />
              <Text style={styles.navItemText}>Short Links</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(protected)/qr' as any)}
            >
              <AppIcon name="qr" size={20} color={Colors.textSecondary} />
              <Text style={styles.navItemText}>QR Codes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(protected)/profile' as any)}
            >
              <AppIcon name="user" size={20} color={Colors.textSecondary} />
              <Text style={styles.navItemText}>Profile</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sidebarSpacer} />

          <View style={styles.sidebarUser}>
            <View style={styles.sidebarUserIntro}>
              <View style={[styles.avatarBadge, { width: 36, height: 36, borderRadius: 18 }]}>
                <Text style={[styles.avatarInitial, { fontSize: 16 }]}>{initial}</Text>
              </View>
              <View>
                <Text style={styles.sidebarUserName}>{displayName}</Text>
                <Text style={styles.sidebarUserEmail}>
                  {user?.primaryEmailAddress?.emailAddress}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.sidebarLogout} onPress={handleLogout} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <AppIcon name="logout" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <View style={styles.mainHeader}>
            <View style={styles.mainHeaderLeft}>
              <Text style={styles.mainTitle}>Dashboard</Text>
              <Text style={styles.mainSubtitle}>Manage your links and QR codes</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.logoutBtn,
                loggingOut && { opacity: 0.6 },
              ]}
              onPress={handleLogout}
              disabled={loggingOut}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <AppIcon name="logout" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Welcome */}
          <View style={styles.welcomeSectionDesktop}>
            <Text style={styles.welcomeTitleDesktop}>Welcome back, {displayName}!</Text>
            <Text style={styles.welcomeDescDesktop}>
              Here&apos;s what&apos;s happening with your links today.
            </Text>
          </View>

          {/* Primary Actions */}
          <View style={styles.actionsSectionDesktop}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionGridDesktop}>
              <TouchableOpacity
                style={[styles.actionCard, styles.actionPrimary]}
                onPress={() => router.push('/(protected)/links' as any)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <View style={styles.actionIconContainerPrimary}>
                  <AppIcon name="link" size={28} color={Colors.textPrimary} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitlePrimary}>Shorten a URL</Text>
                  <Text style={styles.actionDesc}>
                    Create clean, trackable short links with click analytics.
                  </Text>
                </View>
                <AppIcon name="arrow-right" size={22} color={Colors.accentLight} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(protected)/qr' as any)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <View style={styles.actionIconContainerSecondary}>
                  <AppIcon name="qr" size={28} color={Colors.textPrimary} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Generate QR Code</Text>
                  <Text style={styles.actionDesc}>
                    Create scannable QR codes for instant sharing.
                  </Text>
                </View>
                <AppIcon name="arrow-right" size={22} color={Colors.accentLight} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Statistics */}
          <View style={styles.statsSectionDesktop}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.statsRowDesktop}>
              <Card style={{ ...styles.statCard, flex: 1 }} variant="secondary">
                <Text style={{ ...styles.statNumber, color: Colors.textPrimary }}>
                  {loading ? '-' : totalLinks}
                </Text>
                <Text style={styles.statLabel}>Total Links</Text>
              </Card>
              <Card style={{ ...styles.statCard, flex: 1 }} variant="secondary">
                <Text style={{ ...styles.statNumber, color: Colors.success }}>
                  {loading ? '-' : activeLinks}
                </Text>
                <Text style={styles.statLabel}>Active Links</Text>
              </Card>
              <Card style={{ ...styles.statCard, flex: 1 }} variant="secondary">
                <Text style={{ ...styles.statNumber, color: Colors.accent }}>
                  {loading ? '-' : qrCount}
                </Text>
                <Text style={styles.statLabel}>QR Codes</Text>
              </Card>
            </View>
          </View>

          {/* Recent Links */}
          <View style={styles.recentSectionDesktop}>
            <View style={styles.recentHeaderDesktop}>
              <Text style={styles.sectionTitle}>Recent Links</Text>
              {links.length > 0 && (
                <TouchableOpacity onPress={() => router.push('/(protected)/links' as any)}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={Colors.accent} size="large" />
              </View>
            ) : links.length === 0 ? (
              <Card style={styles.emptyCardDesktop} variant="secondary">
                <View style={styles.emptyIconBadge}>
                  <AppIcon name="link" size={32} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No shortened links yet</Text>
                <Text style={styles.emptyText}>
                  Create your first short link to see it here with click analytics.
                </Text>
                <CustomButton
                  title="Create First Link"
                  size="md"
                  variant="primary"
                  onPress={() => router.push('/(protected)/links' as any)}
                />
              </Card>
            ) : (
              <View style={styles.linksListDesktop}>
                {links.slice(0, 10).map((item) => (
                  <Card key={item.id} style={styles.linkItem} variant="elevated">
                    <View style={styles.linkTopRow}>
                      <Text style={styles.linkTitle} numberOfLines={1}>
                        {item.title || item.short_code}
                      </Text>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
                      </View>
                    </View>
                    <Text style={styles.shortUrlText}>linkflow.url/{item.short_code}</Text>
                    <Text style={styles.originalUrlText} numberOfLines={1}>
                      {item.original_url}
                    </Text>
                  </Card>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* Mobile */
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  userIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  welcomeGreeting: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  welcomeName: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Welcome Section */
  welcomeSection: {
    marginBottom: 28,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  welcomeDesc: {
    fontSize: 15,
    color: Colors.textSecondary,
  },

  /* Actions Section */
  actionsSection: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  actionGrid: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    minHeight: 72,
  },
  actionPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionIconContainerPrimary: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconContainerSecondary: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  actionTitlePrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  /* Stats Section */
  statsSection: {
    marginBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 14,
    minWidth: 90,
  },
  statPrimary: {
    backgroundColor: Colors.surfaceSecondary,
  },
  statActive: {
    backgroundColor: Colors.surfaceSecondary,
  },
  statQr: {
    backgroundColor: Colors.surfaceSecondary,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },

  /* Recent Links Section */
  recentSection: {
    marginBottom: 24,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  viewAllText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  emptyIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  createBtn: {
    marginTop: 16,
    width: '80%',
    alignSelf: 'center',
  },
  linksList: {
    gap: 10,
  },
  linkItem: {
    padding: 16,
    flex: 1,
  },
  linkTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '600',
  },
  shortUrlText: {
    color: Colors.accentLight,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  originalUrlText: {
    color: Colors.textMuted,
    fontSize: 12,
  },

  /* Desktop */
  desktopSafeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  sidebar: {
    width: 260,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  sidebarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 36,
  },
  sidebarLogoBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sidebarBrandName: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sidebarNav: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: Colors.primary,
  },
  navItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sidebarSpacer: {
    flex: 1,
  },
  sidebarUser: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sidebarUserIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  sidebarUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sidebarUserEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sidebarLogout: {
    padding: 8,
  },
  mainContent: {
    flex: 1,
    padding: 40,
    paddingTop: 32,
    maxWidth: 1200,
    alignSelf: 'center',
  },
  mainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  mainHeaderLeft: {
    flex: 1,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  mainSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  welcomeSectionDesktop: {
    marginBottom: 32,
  },
  welcomeTitleDesktop: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  welcomeDescDesktop: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  actionsSectionDesktop: {
    marginBottom: 32,
  },
  actionGridDesktop: {
    gap: 16,
  },
  statsSectionDesktop: {
    marginBottom: 32,
  },
  statsRowDesktop: {
    flexDirection: 'row',
    gap: 16,
  },
  recentSectionDesktop: {
    marginBottom: 24,
  },
  recentHeaderDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyCardDesktop: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    borderStyle: 'dashed',
    borderRadius: 16,
    width: '100%',
  },
  linksListDesktop: {
    gap: 12,
  },
});
