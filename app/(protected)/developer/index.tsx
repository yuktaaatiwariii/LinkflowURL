import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import {
  DevBadge,
  DevButton,
  DevCard,
  DevEmptyState,
  DevErrorState,
  DevLoading,
  DevPageHeader,
  DevSegmented,
  DevSelect,
  DevStatCard,
  type DevBadgeTone,
} from '../../../src/components/developer/DeveloperUI';
import { DevPage } from '../../../src/components/developer/DeveloperPage';
import {
  EndpointUsageBars,
  EnvironmentDonut,
  RequestsOverTimeChart,
  SuccessFailureChart,
} from '../../../src/components/developer/DeveloperCharts';
import { useDeveloperToast } from '../../../src/components/developer/DeveloperToast';
import {
  apiErrorMessage,
  apiPayload,
  fetchDeveloperOverview,
  fetchDeveloperProjects,
  type DeveloperOverview,
  type DeveloperProject,
  type DeveloperRange,
  type DeveloperUsageLog,
} from '../../../src/services/developer';
import {
  DevColors,
  DevRadius,
  DevSpacing,
  formatCount,
  formatDevDate,
  formatDuration,
} from '../../../src/constants/developerTheme';

const RANGE_OPTIONS: { value: DeveloperRange; label: string }[] = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

const RANGE_LABEL: Record<DeveloperRange, string> = {
  '24h': 'last 24 hours',
  '7d': 'last 7 days',
  '30d': 'last 30 days',
};

export default function DeveloperOverviewScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { showToast } = useDeveloperToast();
  const { width } = useWindowDimensions();
  const isWide = width >= 1120;

  const [range, setRange] = useState<DeveloperRange>('7d');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [projects, setProjects] = useState<DeveloperProject[]>([]);
  const [data, setData] = useState<DeveloperOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const projectId = projectFilter === 'all' ? null : projectFilter;

  const loadOverview = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          if (id === requestId.current) setError('Your session has expired. Please sign in again.');
          return;
        }
        const response = await fetchDeveloperOverview(token, range, projectId);
        const payload = apiPayload(response);
        if (id !== requestId.current) return;
        if (!payload) {
          setError(apiErrorMessage(response, 'Unable to load the developer overview.'));
          return;
        }
        setData(payload);
      } catch {
        if (id === requestId.current) {
          setError('Unable to load the developer overview. Please try again.');
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [getToken, projectId, range]
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetchDeveloperProjects(token);
        const payload = apiPayload(response);
        if (active && payload) setProjects(payload.projects);
      } catch {
        // The project filter is optional; keep the dashboard usable without it.
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken]);

  const projectOptions = useMemo(
    () => [
      { value: 'all', label: 'All projects' },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [projects]
  );

  const successRate =
    data && data.totals.requests > 0
      ? Math.round((data.totals.success / data.totals.requests) * 100)
      : 0;

  const refresh = () => {
    void loadOverview('refresh');
    showToast('Overview refreshed.', 'info');
  };

  return (
    <DevPage refreshing={refreshing} onRefresh={() => void loadOverview('refresh')}>
      <DevPageHeader
        eyebrow="Developer Platform"
        title="Overview"
        subtitle="A real-time view of your API traffic, credentials and projects. Every number is persisted from authenticated API requests."
        actions={
          <>
            <DevButton
              label="Refresh"
              icon="refresh-cw"
              size="sm"
              variant="secondary"
              onPress={refresh}
            />
            <DevButton
              label="API keys"
              icon="key"
              size="sm"
              variant="primary"
              onPress={() => router.navigate('/(protected)/developer/keys' as any)}
            />
          </>
        }
      />

      <View style={styles.filterBar}>
        <DevSegmented options={RANGE_OPTIONS} value={range} onChange={setRange} label="Date range" />
        <View style={styles.projectFilter}>
          <DevSelect
            label="Project"
            value={projectFilter}
            options={projectOptions}
            onChange={setProjectFilter}
            placeholder="All projects"
          />
        </View>
        {data ? (
          <Text style={styles.rangeWindow}>
            {formatDevDate(data.range.from)} → {formatDevDate(data.range.to)}
          </Text>
        ) : null}
      </View>

      {loading && !data ? <DevLoading label="Loading overview…" /> : null}

      {error && !data ? <DevErrorState message={error} onRetry={() => void loadOverview()} /> : null}

      {data ? (
        <>
          <View style={styles.statGrid}>
            <DevStatCard
              label="Total requests"
              value={formatCount(data.totals.requests)}
              helper={RANGE_LABEL[range]}
              icon="activity"
              tone="primary"
            />
            <DevStatCard
              label="Successful"
              value={formatCount(data.totals.success)}
              helper={data.totals.requests > 0 ? `${successRate}% of traffic` : 'No traffic yet'}
              icon="check-circle"
              tone="success"
            />
            <DevStatCard
              label="Failed"
              value={formatCount(data.totals.failed)}
              helper={
                data.totals.requests > 0
                  ? `${100 - successRate}% of traffic`
                  : 'No traffic yet'
              }
              icon="alert-triangle"
              tone="danger"
            />
            <DevStatCard
              label="Avg. response"
              value={formatDuration(data.totals.averageDurationMs)}
              helper="Server processing time"
              icon="clock"
              tone="info"
            />
          </View>

          <View style={styles.statGrid}>
            <DevStatCard
              label="Active keys"
              value={formatCount(data.keys.active)}
              helper={`${data.keys.total} keys total`}
              icon="key"
              tone="primary"
            />
            <DevStatCard
              label="Test keys"
              value={formatCount(data.keys.test)}
              helper={`${data.keys.activeTest} active`}
              icon="cpu"
              tone="info"
            />
            <DevStatCard
              label="Live keys"
              value={formatCount(data.keys.live)}
              helper={`${data.keys.activeLive} active`}
              icon="zap"
              tone="warning"
            />
            <DevStatCard
              label="Projects"
              value={formatCount(data.projects.total)}
              helper={`${data.projects.withKeys} with API keys`}
              icon="folder"
              tone="success"
            />
          </View>

          {error ? <DevErrorState message={error} onRetry={() => void loadOverview()} /> : null}

          <View style={styles.chartGrid}>
            <View style={[styles.chartCell, { flexBasis: '100%' }]}>
              <DevCard
                title="API requests over time"
                subtitle={`Request volume for the ${RANGE_LABEL[range]}, including failed calls.`}
                action={<DevBadge label={`${formatCount(data.totals.requests)} total`} tone="primary" />}
              >
                <RequestsOverTimeChart
                  data={data.requestsOverTime}
                  bucket={data.range.bucket}
                  height={224}
                />
              </DevCard>
            </View>

            <View style={[styles.chartCell, { flexBasis: isWide ? '59%' : '100%' }]}>
              <DevCard
                title="Successful vs failed"
                subtitle="Stacked response outcomes per time bucket."
                action={
                  <View style={styles.legendInline}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: DevColors.success }]} />
                      <Text style={styles.legendText}>Success</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: DevColors.danger }]} />
                      <Text style={styles.legendText}>Failed</Text>
                    </View>
                  </View>
                }
              >
                <SuccessFailureChart
                  data={data.requestsOverTime}
                  bucket={data.range.bucket}
                  height={198}
                />
              </DevCard>
            </View>

            <View style={[styles.chartCell, { flexBasis: isWide ? '38%' : '100%' }]}>
              <DevCard
                title="Test vs live"
                subtitle="Request split by key environment."
              >
                <EnvironmentDonut
                  test={
                    data.usageByEnvironment.find((item) => item.environment === 'test')?.requests || 0
                  }
                  live={
                    data.usageByEnvironment.find((item) => item.environment === 'live')?.requests || 0
                  }
                />
              </DevCard>
            </View>

            <View style={[styles.chartCell, { flexBasis: '100%' }]}>
              <DevCard
                title="Usage by endpoint"
                subtitle="Top route patterns in the selected range. Identifiers are collapsed to :id."
              >
                {data.usageByEndpoint.length > 0 ? (
                  <EndpointUsageBars data={data.usageByEndpoint} />
                ) : (
                  <DevEmptyState
                    icon="bar-chart-2"
                    title="No endpoint activity yet"
                    message="Make your first authenticated API call with one of your keys to populate this chart."
                    action={
                      <DevButton
                        label="Manage API keys"
                        size="sm"
                        variant="primary"
                        icon="key"
                        onPress={() => router.navigate('/(protected)/developer/keys' as any)}
                      />
                    }
                  />
                )}
              </DevCard>
            </View>
          </View>

          <DevCard
            title="Recent API activity"
            subtitle="The latest authenticated requests across your keys and projects."
            action={
              <DevButton
                label="View all logs"
                size="sm"
                variant="outline"
                icon="arrow-right"
                onPress={() => router.navigate('/(protected)/developer/logs' as any)}
              />
            }
          >
            {data.recentActivity.length === 0 ? (
              <DevEmptyState
                icon="activity"
                title="No API requests yet"
                message="Once you call the API with a live or test key, requests will appear here with their status and latency."
              />
            ) : (
              <View style={styles.activityList}>
                {data.recentActivity.map((event) => (
                  <ActivityRow
                    key={event.id}
                    event={event}
                    onPress={() =>
                      router.navigate({
                        pathname: '/(protected)/developer/logs',
                        params: { logId: event.id },
                      } as any)
                    }
                  />
                ))}
              </View>
            )}
          </DevCard>
        </>
      ) : null}
    </DevPage>
  );
}

function statusTone(statusCode: number): DevBadgeTone {
  if (statusCode < 300) return 'success';
  if (statusCode < 400) return 'info';
  if (statusCode < 500) return 'warning';
  return 'danger';
}

function methodTone(method: string): DevBadgeTone {
  if (method === 'POST') return 'primary';
  if (method === 'DELETE') return 'danger';
  if (method === 'PUT' || method === 'PATCH') return 'warning';
  return 'info';
}

function ActivityRow({ event, onPress }: { event: DeveloperUsageLog; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.activityRow}>
      <DevBadge label={event.method} tone={methodTone(event.method)} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.activityEndpoint} numberOfLines={1}>
          {event.endpoint}
        </Text>
        <Text style={styles.activityMeta} numberOfLines={1}>
          {event.projectName || 'No project'} · {event.environment} · {formatDevDate(event.createdAt)}
        </Text>
      </View>
      <View style={styles.activityRight}>
        <DevBadge label={String(event.statusCode)} tone={statusTone(event.statusCode)} />
        <Text style={styles.activityDuration}>{formatDuration(event.durationMs)}</Text>
      </View>
      <Feather name="chevron-right" size={15} color={DevColors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: DevSpacing.md,
    marginBottom: DevSpacing.xl,
  },
  projectFilter: { width: 220, minWidth: 180 },
  rangeWindow: { color: DevColors.textMuted, fontSize: 11, paddingBottom: 11 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DevSpacing.md,
    marginBottom: DevSpacing.md,
  },
  chartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DevSpacing.md,
    marginTop: DevSpacing.sm,
    marginBottom: DevSpacing.md,
  },
  chartCell: { flexGrow: 1, minWidth: 290 },
  legendInline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: DevColors.textMuted, fontSize: 10.5, fontWeight: '600' },
  activityList: {
    borderWidth: 1,
    borderColor: DevColors.border,
    borderRadius: DevRadius.md,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DevSpacing.md,
    paddingHorizontal: DevSpacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DevColors.border,
    backgroundColor: DevColors.surface,
  },
  activityEndpoint: { color: DevColors.text, fontSize: 12.5, fontWeight: '600', fontFamily: 'monospace' },
  activityMeta: { color: DevColors.textMuted, fontSize: 10.5, marginTop: 3 },
  activityRight: { alignItems: 'flex-end', gap: 4 },
  activityDuration: { color: DevColors.textMuted, fontSize: 10.5 },
});
