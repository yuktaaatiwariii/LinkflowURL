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
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Colors } from '../../../src/constants/colors';
import { AlertBanner, AppIcon, Card, ResponsiveContainer, Section } from '../../../src/components';
import {
  DEFAULT_PREFERENCES,
  fetchNotificationHistory,
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationHistoryItem,
  type NotificationPreferences,
} from '../../../src/services/notifications';
import { usePushNotifications } from '../../../src/hooks/usePushNotifications';

interface ToggleRowProps {
  icon: 'chart' | 'zap' | 'clock' | 'qr';
  title: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  badge?: string;
}

function ToggleRow({
  icon,
  title,
  description,
  value,
  onValueChange,
  disabled,
  badge,
}: ToggleRowProps) {
  return (
    <View style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}>
      <View style={styles.toggleIcon}>
        <AppIcon name={icon} size={18} color={disabled ? Colors.textMuted : Colors.accentLight} />
      </View>
      <View style={styles.toggleCopy}>
        <View style={styles.toggleTitleRow}>
          <Text style={styles.toggleTitle}>{title}</Text>
          {!!badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: Colors.border, true: Colors.primaryDeep }}
        thumbColor={value ? Colors.accent : Colors.textMuted}
        accessibilityLabel={title}
      />
    </View>
  );
}

const TYPE_LABELS: Record<string, string> = {
  milestone: 'Click milestone',
  performance: 'Daily performance',
  expiration: 'Expiration reminder',
  qr_activity: 'QR activity',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { getToken } = useAuth();

  const {
    permission,
    statusMessage: pushStatus,
    registerForPushNotifications,
    refreshPermission,
  } = usePushNotifications();

  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const token = await getToken();
        if (!token) {
          setErrorMessage('Your session has expired. Please sign in again.');
          return;
        }

        const [prefsRes, historyRes] = await Promise.all([
          fetchNotificationPreferences(token),
          fetchNotificationHistory(token, 50),
        ]);

        if (prefsRes.error) {
          setErrorMessage(prefsRes.error);
        } else if (prefsRes.data?.preferences) {
          setPreferences(prefsRes.data.preferences);
          setErrorMessage('');
        }

        if (historyRes.error) {
          setErrorMessage(historyRes.error);
        } else if (Array.isArray(historyRes.data?.notifications)) {
          setHistory(historyRes.data.notifications);
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Unable to load your notification settings.');
      } finally {
        setLoading(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
    await refreshPermission();
    setRefreshing(false);
  }, [loadData, refreshPermission]);

  const persist = useCallback(
    async (next: NotificationPreferences) => {
      setPreferences(next);
      setSaving(true);
      setErrorMessage('');
      try {
        const token = await getToken();
        if (!token) {
          setErrorMessage('Your session has expired. Please sign in again.');
          return;
        }
        const res = await updateNotificationPreferences(token, next);
        if (res.error) {
          setErrorMessage(res.error);
          // Re-sync with the server so the UI reflects the stored truth.
          await loadData(false);
        } else if (res.data?.preferences) {
          setPreferences(res.data.preferences);
          setSuccessMessage('Preferences saved.');
          setTimeout(() => setSuccessMessage(''), 2500);
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Unable to save your preferences.');
      } finally {
        setSaving(false);
      }
    },
    [getToken, loadData]
  );

  const updatePreference = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      const next = { ...preferences, [key]: value };
      // Turning the master switch off disables every category as well.
      if (key === 'master_enabled' && !value) {
        next.milestones = false;
        next.performance = false;
        next.expiration = false;
        next.qr_activity = false;
      } else if (key !== 'master_enabled' && value && !preferences.master_enabled) {
        next.master_enabled = true;
      }
      persist(next);
    },
    [persist, preferences]
  );

  const handleEnablePush = useCallback(async () => {
    setErrorMessage('');
    setSuccessMessage('');
    const ok = await registerForPushNotifications();
    if (ok) {
      setSuccessMessage('Notifications are enabled on this device.');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  }, [registerForPushNotifications]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        <ResponsiveContainer padding={20}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <AppIcon name="arrow-left" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            Choose what LinkFlow tells you about your links. Settings sync across your devices.
          </Text>

          {!!errorMessage && (
            <View style={styles.bannerWrap}>
              <AlertBanner type="error" message={errorMessage} />
            </View>
          )}
          {!!successMessage && (
            <View style={styles.bannerWrap}>
              <AlertBanner type="success" message={successMessage} />
            </View>
          )}

          {/* Device permission */}
          <Card style={styles.permissionCard} variant="elevated">
            <View style={styles.permissionRow}>
              <View style={styles.permissionIcon}>
                <AppIcon
                  name={permission === 'granted' ? 'check' : 'bell'}
                  size={20}
                  color={permission === 'granted' ? Colors.success : Colors.accentLight}
                />
              </View>
              <View style={styles.permissionCopy}>
                <Text style={styles.permissionTitle}>
                  {permission === 'granted'
                    ? 'Push enabled on this device'
                    : 'Enable push notifications'}
                </Text>
                <Text style={styles.permissionText}>
                  {permission === 'granted'
                    ? 'LinkFlow can notify you about clicks and expiring links.'
                    : 'Allow notifications so LinkFlow can tell you when a link reaches a milestone.'}
                </Text>
              </View>
            </View>

            {!!pushStatus && <Text style={styles.pushStatus}>{pushStatus}</Text>}

            {permission !== 'granted' && (
              <TouchableOpacity
                style={styles.enableButton}
                onPress={handleEnablePush}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <AppIcon name="zap" size={17} color="#FFFFFF" />
                <Text style={styles.enableButtonText}>Enable notifications</Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* Preferences */}
          <Section title="What should we notify you about?" />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.accent} size="large" />
              <Text style={styles.loadingText}>Loading your settings…</Text>
            </View>
          ) : (
            <Card style={styles.preferencesCard} variant="elevated">
              <View style={[styles.toggleRow, styles.masterRow]}>
                <View style={styles.toggleIcon}>
                  <AppIcon name="bell" size={18} color={Colors.accentLight} />
                </View>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>All notifications</Text>
                  <Text style={styles.toggleDescription}>
                    Master switch for every notification type.
                  </Text>
                </View>
                <Switch
                  value={preferences.master_enabled}
                  onValueChange={(next) => updatePreference('master_enabled', next)}
                  trackColor={{ false: Colors.border, true: Colors.primaryDeep }}
                  thumbColor={preferences.master_enabled ? Colors.accent : Colors.textMuted}
                  accessibilityLabel="All notifications"
                />
              </View>

              <View style={styles.divider} />

              <ToggleRow
                icon="zap"
                title="Link click milestones"
                description="Get a push when a link crosses 10, 50, 100, 500, 1,000 or 10,000 clicks."
                value={preferences.milestones}
                onValueChange={(next) => updatePreference('milestones', next)}
                disabled={!preferences.master_enabled}
              />

              <ToggleRow
                icon="chart"
                title="Daily performance"
                description="Get a daily summary when a link receives 100 or more new clicks."
                value={preferences.performance}
                onValueChange={(next) => updatePreference('performance', next)}
                disabled={!preferences.master_enabled}
              />

              <ToggleRow
                icon="clock"
                title="Expiration reminders"
                description="Get a reminder the day before one of your links expires."
                value={preferences.expiration}
                onValueChange={(next) => updatePreference('expiration', next)}
                disabled={!preferences.master_enabled}
              />

              <ToggleRow
                icon="qr"
                title="QR activity"
                description="Notify when a QR code is scanned."
                value={preferences.qr_activity}
                onValueChange={(next) => updatePreference('qr_activity', next)}
                disabled={!preferences.master_enabled}
                badge="Soon"
              />

              <Text style={styles.qrNote}>
                QR scans are not tracked yet — LinkFlow currently only measures clicks on the link
                a QR code points to. This switch is stored and will start working as soon as scan
                tracking is available.
              </Text>

              {saving && <Text style={styles.savingText}>Saving…</Text>}
            </Card>
          )}

          {/* History */}
          <Section title="Recent notifications" />

          {history.length === 0 ? (
            <Card style={styles.emptyCard} variant="secondary">
              <AppIcon name="bell" size={26} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>
                Milestone, performance and expiration notifications will appear here.
              </Text>
            </Card>
          ) : (
            <View style={styles.historyList}>
              {history.map((item) => (
                <Card key={item.id} style={styles.historyCard} variant="elevated">
                  <View style={styles.historyHeader}>
                    <View style={styles.historyIcon}>
                      <AppIcon
                        name={
                          item.type === 'milestone'
                            ? 'zap'
                            : item.type === 'performance'
                              ? 'chart'
                              : item.type === 'expiration'
                                ? 'clock'
                                : 'qr'
                        }
                        size={16}
                        color={Colors.accentLight}
                      />
                    </View>
                    <Text style={styles.historyType}>
                      {TYPE_LABELS[item.type] || 'Notification'}
                    </Text>
                    <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  <Text style={styles.historyTitle}>{item.title}</Text>
                  <Text style={styles.historyBody}>{item.body}</Text>
                </Card>
              ))}
            </View>
          )}
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
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
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14.5,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 22,
  },
  bannerWrap: {
    marginBottom: 16,
  },
  permissionCard: {
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionCopy: {
    flex: 1,
    gap: 3,
  },
  permissionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  permissionText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  pushStatus: {
    fontSize: 12.5,
    color: Colors.warning,
    lineHeight: 18,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minHeight: 48,
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  preferencesCard: {
    padding: 16,
    marginBottom: 24,
  },
  masterRow: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  toggleRowDisabled: {
    opacity: 0.55,
  },
  toggleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleCopy: {
    flex: 1,
    gap: 3,
  },
  toggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  toggleDescription: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.accentLight,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  qrNote: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  savingText: {
    marginTop: 10,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 26,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  historyList: {
    gap: 12,
  },
  historyCard: {
    padding: 15,
    gap: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyType: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accentLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyDate: {
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  historyTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  historyBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
});
