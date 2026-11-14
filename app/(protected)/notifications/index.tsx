import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../../src/constants/colors';
import { AlertBanner, AppIcon, Card, ResponsiveContainer, Section } from '../../../src/components';
import { useNotificationCenter } from '../../../src/hooks/useNotificationCenter';
import { usePushNotifications } from '../../../src/hooks/usePushNotifications';

interface ToggleRowProps {
  icon: 'chart' | 'zap' | 'clock' | 'qr';
  title: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}

const ICON_MAP: Record<ToggleRowProps['icon'], string> = {
  chart: '📈',
  zap: '⚡',
  clock: '⏰',
  qr: '📱',
};

function ToggleRow({ icon, title, description, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleIcon}>{ICON_MAP[icon]}</View>
      <View style={styles.toggleContent}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch
        trackColor={{ false: Colors.border, true: Colors.accent }}
        thumbColor={value ? Colors.accent : Colors.textMuted}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const {
    history,
    preferences,
    errorMessage,
    totalHistory,
    isLoading,
    isRefreshing,
    isError,
    isUnauthorized,
    isEmpty,
    loadHistory,
    loadPreferences,
    refreshAll,
    savePreferences,
    forceTokenRefresh,
  } = useNotificationCenter();

  const { permission, registerForPushNotifications } = usePushNotifications();
  const [refreshing, setRefreshing] = useState(false);

  // Initial data load
  useEffect(() => {
    (async () => {
      await Promise.allSettled([loadHistory(50), loadPreferences()]);
    })();
  }, [loadHistory, loadPreferences]);

  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll(50);
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);

  // Handle preference toggle
  const handlePreferenceChange = useCallback(
    async (key: keyof typeof preferences, next: boolean) => {
      try {
        await savePreferences({ [key]: next });
      } catch (err: any) {
        // Error already handled in store (optimistic revert)
        console.warn('[Notifications] Preference save failed:', err?.message);
      }
    },
    [savePreferences]
  );

  // Handle retry after error/unauthorized
  const handleRetry = useCallback(async () => {
    if (isUnauthorized) {
      const refreshed = await forceTokenRefresh();
      if (refreshed) {
        await Promise.allSettled([loadHistory(50, true), loadPreferences(true)]);
      }
    } else {
      await Promise.allSettled([loadHistory(50, true), loadPreferences(true)]);
    }
  }, [isUnauthorized, forceTokenRefresh, loadHistory, loadPreferences]);

  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render unauthorized state
  if (isUnauthorized) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.accent]} />
          }
        >
          <ResponsiveContainer>
            <View style={styles.emptyState}>
              <AppIcon name="shield" size={48} color={Colors.error} />
              <Text style={styles.emptyTitle}>Session Expired</Text>
              <Text style={styles.emptyDescription}>
                {errorMessage || 'Your session has expired. Please sign in again.'}
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
                <Text style={styles.retryButtonText}>Sign In Again</Text>
              </TouchableOpacity>
            </View>
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render error state
  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.accent]} />
          }
        >
          <ResponsiveContainer>
            <AlertBanner type="error" message={errorMessage || 'Failed to load notifications'} />
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render success/empty state
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing || isRefreshing} onRefresh={onRefresh} colors={[Colors.accent]} />
        }
      >
        <ResponsiveContainer>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {totalHistory > 0 ? `${totalHistory} notification${totalHistory !== 1 ? 's' : ''}` : 'No notifications yet'}
            </Text>
          </View>

          {/* Push Permission Section */}
          <Section title="Push Notifications">
            <Card>
              <View style={styles.permissionRow}>
                <View style={styles.permissionInfo}>
                  <Text style={styles.permissionTitle}>
                    {permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Blocked' : 'Not configured'}
                  </Text>
                  <Text style={styles.permissionDescription}>
                    {permission === 'granted'
                      ? 'You will receive push notifications for important updates.'
                      : permission === 'denied'
                      ? 'Enable in device settings to receive push notifications.'
                      : 'Tap to enable push notifications for link milestones and alerts.'}
                  </Text>
                </View>
                {permission !== 'granted' && (
                  <TouchableOpacity
                    style={[styles.permissionButton, permission === 'denied' && styles.permissionButtonSecondary]}
                    onPress={registerForPushNotifications}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.permissionButtonText}>
                      {permission === 'denied' ? 'Open Settings' : 'Enable'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          </Section>

          {/* Preferences Section */}
          <Section title="Notification Preferences">
            <Card>
              <ToggleRow
                icon="chart"
                title="Milestones"
                description="Link click milestones (100, 1K, 10K…)"
                value={preferences.milestones}
                onValueChange={(v) => handlePreferenceChange('milestones', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="zap"
                title="Performance Alerts"
                description="Sudden traffic spikes or drops"
                value={preferences.performance}
                onValueChange={(v) => handlePreferenceChange('performance', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="clock"
                title="Link Expiration"
                description="Links expiring in 24 hours"
                value={preferences.expiration}
                onValueChange={(v) => handlePreferenceChange('expiration', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="qr"
                title="QR Activity"
                description="QR code scan notifications"
                value={preferences.qr_activity}
                onValueChange={(v) => handlePreferenceChange('qr_activity', v)}
              />
            </Card>
          </Section>

          {/* Master Toggle */}
          <Section title="Master Control">
            <Card>
              <View style={styles.toggleRow}>
                <View style={styles.toggleIcon}>🔔</View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>All Notifications</Text>
                  <Text style={styles.toggleDescription}>
                    Master switch for all notification types
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: Colors.border, true: Colors.accent }}
                  thumbColor={preferences.master_enabled ? Colors.accent : Colors.textMuted}
                  value={preferences.master_enabled}
                  onValueChange={(v) => handlePreferenceChange('master_enabled', v)}
                />
              </View>
            </Card>
          </Section>

          {/* Notification History */}
          <Section title="History">
            {isEmpty ? (
              <Card style={styles.emptyCard}>
                <View style={styles.emptyState}>
                  <AppIcon name="bell" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No notifications yet</Text>
                  <Text style={styles.emptyDescription}>
                    Notifications will appear here when your links hit milestones,
                    experience traffic changes, or approach expiration.
                  </Text>
                </View>
              </Card>
            ) : (
              <>
                {history.map((notification) => (
                  <Card key={notification.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <View style={styles.historyIconContainer}>
                        <Text style={styles.historyIcon}>
                          {notification.type === 'milestone'
                            ? '📈'
                            : notification.type === 'performance'
                            ? '⚡'
                            : notification.type === 'expiration'
                            ? '⏰'
                            : '📱'}
                        </Text>
                      </View>
                      <View style={styles.historyContent}>
                        <Text style={styles.historyTitle}>{notification.title}</Text>
                        <Text style={styles.historyBody}>{notification.body}</Text>
                      </View>
                      <Text style={styles.historyTime}>
                        {new Date(notification.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </Card>
                ))}
                {history.length > 0 && history.length < totalHistory && (
                  <TouchableOpacity style={styles.loadMoreButton} onPress={() => loadHistory(totalHistory, true)} activeOpacity={0.8}>
                    <Text style={styles.loadMoreButtonText}>Load more ({totalHistory} total)</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </Section>
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textMuted,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.textMuted,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  permissionDescription: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  permissionButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  permissionButtonSecondary: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  permissionButtonText: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  toggleIcon: {
    // fontSize is for Text; this View just centers the emoji
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  toggleDescription: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  historyCard: {
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  historyIconContainer: {
    marginTop: 2,
  },
  historyIcon: {
    fontSize: 20,
  },
  historyContent: {
    flex: 1,
    minWidth: 0,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  historyBody: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  historyTime: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textMuted,
  },
  emptyCard: {
    paddingVertical: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyDescription: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  loadMoreButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreButtonText: {
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
});