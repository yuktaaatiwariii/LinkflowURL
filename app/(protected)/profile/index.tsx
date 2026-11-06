import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { Colors } from '../../../src/constants/colors';
import {
  Card,
  AppIcon,
  LogoutConfirmModal,
} from '../../../src/components';
import { useIsDesktop } from '../../../src/hooks/useBreakpoint';

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const isDesktop = useIsDesktop();

  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const displayName =
    user?.firstName ||
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Member';
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
      })
    : '';

  const confirmLogout = async () => {
    setLogoutError(null);
    setLoading(true);
    try {
      await signOut();
      router.replace('/(auth)/welcome' as any);
    } catch (err: any) {
      console.error('Sign Out error:', err);
      setLoading(false);
      setLogoutError(err?.message || 'Sign out failed. Please try again.');
    }
  };

  const handleLogout = () => {
    setLogoutError(null);
    setShowLogoutModal(true);
  };

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.container, { width: isDesktop ? 480 : '100%' }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <AppIcon name="arrow-left" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Profile & Settings</Text>
              <Text style={styles.subtitle}>Manage your LinkFlow URL account</Text>
            </View>
          </View>

          {/* Profile Card */}
          <Card style={styles.profileCard} variant="elevated">
            <View style={styles.profileHeader}>
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{displayName}</Text>
                {email && <Text style={styles.profileEmail}>{email}</Text>}
                {memberSince && (
                  <Text style={styles.memberSince}>Member since {memberSince}</Text>
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Settings Items */}
            <View style={styles.settingsList}>
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => router.push('/(protected)/links' as any)}
              >
                <AppIcon name="link" size={20} color={Colors.textSecondary} />
                <Text style={styles.settingsTitle}>Manage Short Links</Text>
                <AppIcon name="arrow-left" size={16} color={Colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => router.push('/(protected)/qr' as any)}
              >
                <AppIcon name="qr" size={20} color={Colors.textSecondary} />
                <Text style={styles.settingsTitle}>QR Codes</Text>
                <AppIcon name="arrow-left" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Danger Zone */}
            <View style={styles.dangerZone}>
              <Text style={styles.dangerTitle}>Danger Zone</Text>
              <TouchableOpacity
                style={styles.dangerButton}
                onPress={handleLogout}
                disabled={loading}
              >
                <AppIcon name="logout" size={20} color={Colors.error} />
                <Text style={styles.dangerText}>
                  {loading ? 'Signing out...' : 'Sign Out'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </ScrollView>
      </SafeAreaView>
      <LogoutConfirmModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        loading={loading}
        error={logoutError}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  profileCard: {
    padding: 24,
    width: '100%',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  avatarBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  settingsList: {
    gap: 0,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  dangerZone: {
    marginTop: 8,
  },
  dangerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 12,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 12,
  },
  dangerText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },
});
