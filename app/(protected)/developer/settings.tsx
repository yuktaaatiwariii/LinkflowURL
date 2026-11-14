import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import * as Clipboard from 'expo-clipboard';
import {
  DevBadge,
  DevButton,
  DevCard,
  DevDivider,
  DevErrorState,
  DevInfoRow,
  DevLoading,
  DevPageHeader,
} from '../../../src/components/developer/DeveloperUI';
import { DevPage } from '../../../src/components/developer/DeveloperPage';
import { DeveloperConfirmModal } from '../../../src/components/developer/DeveloperModal';
import { useDeveloperToast } from '../../../src/components/developer/DeveloperToast';
import { getApiBaseUrl } from '../../../src/services/api';
import {
  fetchApiHealth,
  type HealthResponse,
} from '../../../src/services/developer';
import { clearDismissedClipboardUrls } from '../../../src/services/clipboard';
import {
  DevColors,
  DevRadius,
  DevSpacing,
  formatDevDay,
} from '../../../src/constants/developerTheme';

type HealthState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok'; result: HealthResponse }
  | { status: 'error'; message: string };

export default function DeveloperSettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { showToast } = useDeveloperToast();

  const [health, setHealth] = useState<HealthState>({ status: 'idle' });
  const [clearingClipboard, setClearingClipboard] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const baseUrl = getApiBaseUrl();

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Developer';
  const email = user?.primaryEmailAddress?.emailAddress || '—';
  const memberSince = user?.createdAt ? formatDevDay(new Date(user.createdAt).toISOString()) : '—';
  const initial = displayName.charAt(0).toUpperCase() || 'D';

  const copyBaseUrl = async () => {
    await Clipboard.setStringAsync(baseUrl);
    showToast('API base URL copied to clipboard.');
  };

  const runHealthCheck = useCallback(async () => {
    setHealth({ status: 'checking' });
    try {
      const result = await fetchApiHealth();
      setHealth({ status: 'ok', result });
    } catch (err: any) {
      setHealth({
        status: 'error',
        message:
          err?.name === 'AbortError'
            ? 'The health check timed out. The API may be unreachable from this device.'
            : err?.message || 'Unable to reach the API health endpoint.',
      });
    }
  }, []);

  const clearClipboardHistory = async () => {
    setClearingClipboard(true);
    try {
      await clearDismissedClipboardUrls();
      showToast('Dismissed clipboard suggestions cleared.');
    } catch {
      showToast('Unable to clear clipboard suggestions.', 'error');
    } finally {
      setClearingClipboard(false);
    }
  };

  const confirmSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      router.replace('/(auth)/welcome' as any);
    } catch (err: any) {
      setSignOutError(err?.message || 'Sign out failed. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <DevPage>
      <DevPageHeader
        eyebrow="Account"
        title="Settings"
        subtitle="Review your developer account, verify connectivity and manage local preferences for this device."
        actions={
          <DevButton
            label="Back to LinkFlow"
            icon="arrow-left"
            size="sm"
            variant="secondary"
            onPress={() => router.navigate('/(protected)' as any)}
          />
        }
      />

      <View style={styles.grid}>
        <DevCard title="Account" subtitle="Provided by your LinkFlow sign-in." style={styles.accountCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {email}
              </Text>
            </View>
            <DevBadge label="Developer" tone="primary" icon="terminal" />
          </View>
          <DevDivider />
          <DevInfoRow label="Email" value={email} />
          <DevInfoRow label="Member since" value={memberSince} />
          <DevInfoRow label="Clerk user id" value={user?.id || '—'} mono />
        </DevCard>

        <DevCard title="API connectivity" subtitle="Direct health probe to the configured backend.">
          <DevInfoRow
            label="Base URL"
            value={
              <View style={styles.copyRow}>
                <Text style={styles.mono} selectable numberOfLines={1}>
                  {baseUrl}
                </Text>
                <DevButton label="Copy" size="sm" variant="secondary" icon="copy" onPress={() => void copyBaseUrl()} />
              </View>
            }
          />
          <DevInfoRow
            label="Environment"
            value={<DevBadge label={__DEV__ ? 'Development' : 'Production'} tone={__DEV__ ? 'warning' : 'success'} />}
          />
          <View style={styles.healthBox}>
            {health.status === 'idle' ? (
              <Text style={styles.hint}>
                Run a health check to confirm this device can reach the LinkFlow API.
              </Text>
            ) : null}
            {health.status === 'checking' ? <DevLoading label="Contacting the API…" /> : null}
            {health.status === 'error' ? (
              <DevErrorState message={health.message} onRetry={() => void runHealthCheck()} />
            ) : null}
            {health.status === 'ok' ? (
              <View style={styles.healthResult}>
                <DevBadge
                  label={health.result.status === 'ok' ? 'Healthy' : 'Degraded'}
                  tone={health.result.status === 'ok' ? 'success' : 'warning'}
                  icon={health.result.status === 'ok' ? 'check-circle' : 'alert-triangle'}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.healthService}>{health.result.service || 'LinkFlow API'}</Text>
                  <Text style={styles.hint}>
                    Database: {health.result.database || 'unknown'}
                    {health.result.databaseLatencyMs !== null
                      ? ` · ${health.result.databaseLatencyMs} ms`
                      : ''}
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.healthActions}>
              <DevButton
                label={health.status === 'ok' ? 'Check again' : 'Run health check'}
                icon="activity"
                size="sm"
                variant="primary"
                loading={health.status === 'checking'}
                onPress={() => void runHealthCheck()}
              />
            </View>
          </View>
        </DevCard>

        <DevCard
          title="Local preferences"
          subtitle="Stored on this device only. No URL content is uploaded."
        >
          <View style={styles.preferenceRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.preferenceTitle}>Dismissed clipboard suggestions</Text>
              <Text style={styles.hint}>
                LinkFlow remembers which clipboard URLs you dismissed so it does not suggest them again.
                Clearing this list only removes those local dismissals.
              </Text>
            </View>
            <DevButton
              label="Clear"
              size="sm"
              variant="outline"
              icon="trash-2"
              loading={clearingClipboard}
              onPress={() => void clearClipboardHistory()}
            />
          </View>
          <DevDivider />
          <View style={styles.preferenceRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.preferenceTitle}>Clipboard privacy</Text>
              <Text style={styles.hint}>
                The clipboard is only read at app open and return-to-foreground. Contents are never
                uploaded automatically and API secrets are never written to device storage.
              </Text>
            </View>
            <DevBadge label="On-device" tone="info" icon="shield" />
          </View>
        </DevCard>

        <DevCard title="Session" subtitle="Sign out of this device.">
          <View style={styles.preferenceRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.preferenceTitle}>Sign out</Text>
              <Text style={styles.hint}>
                You will be returned to the welcome screen. Existing API keys stay active until you
                revoke them in API Keys.
              </Text>
            </View>
            <DevButton
              label="Sign out"
              size="sm"
              variant="danger"
              icon="log-out"
              onPress={() => {
                setSignOutError(null);
                setSignOutOpen(true);
              }}
            />
          </View>
        </DevCard>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          LinkFlow Developer Platform · Phase 3 dashboard
        </Text>
        <View style={styles.footerLinks}>
          <DevButton
            label="API keys"
            size="sm"
            variant="ghost"
            icon="key"
            onPress={() => router.navigate('/(protected)/developer/keys' as any)}
          />
          <DevButton
            label="Request logs"
            size="sm"
            variant="ghost"
            icon="list"
            onPress={() => router.navigate('/(protected)/developer/logs' as any)}
          />
        </View>
      </View>

      <DeveloperConfirmModal
        visible={signOutOpen}
        title="Sign out"
        message="Sign out of LinkFlow on this device? Your projects and API keys will remain available when you sign back in."
        confirmLabel="Sign out"
        destructive
        loading={signingOut}
        onCancel={() => {
          if (!signingOut) setSignOutOpen(false);
        }}
        onConfirm={() => void confirmSignOut()}
      >
        {signOutError ? <Text style={styles.errorText}>{signOutError}</Text> : null}
      </DeveloperConfirmModal>
    </DevPage>
  );
}

const styles = StyleSheet.create({
  grid: { gap: DevSpacing.md },
  accountCard: { width: '100%' },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DevSpacing.md,
    marginBottom: DevSpacing.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DevColors.primaryBg,
    borderWidth: 1,
    borderColor: DevColors.primaryBorder,
  },
  avatarText: { color: DevColors.primarySoft, fontSize: 18, fontWeight: '800' },
  profileName: { color: DevColors.text, fontSize: 15, fontWeight: '700' },
  profileEmail: { color: DevColors.textMuted, fontSize: 11.5, marginTop: 3 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: DevSpacing.sm, justifyContent: 'flex-end' },
  mono: { color: DevColors.textSecondary, fontSize: 11, fontFamily: 'monospace', flexShrink: 1 },
  healthBox: { marginTop: DevSpacing.md, gap: DevSpacing.sm },
  healthActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  healthResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DevSpacing.md,
    backgroundColor: DevColors.backgroundAlt,
    borderWidth: 1,
    borderColor: DevColors.border,
    borderRadius: DevRadius.md,
    padding: DevSpacing.md,
  },
  healthService: { color: DevColors.text, fontSize: 12.5, fontWeight: '700' },
  hint: { color: DevColors.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DevSpacing.md,
    flexWrap: 'wrap',
    paddingVertical: DevSpacing.sm,
  },
  preferenceTitle: { color: DevColors.text, fontSize: 12.5, fontWeight: '700' },
  footer: {
    marginTop: DevSpacing.xl,
    paddingTop: DevSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: DevColors.border,
    gap: DevSpacing.sm,
  },
  footerText: { color: DevColors.textMuted, fontSize: 10.5 },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: DevSpacing.sm },
  errorText: { color: DevColors.danger, fontSize: 12, lineHeight: 17 },
});
