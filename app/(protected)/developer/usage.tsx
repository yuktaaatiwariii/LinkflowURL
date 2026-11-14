import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
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
} from '../../../src/components/developer/DeveloperUI';
import { DevPage } from '../../../src/components/developer/DeveloperPage';
import {
  EndpointUsageBars,
  EnvironmentDonut,
  RequestsOverTimeChart,
  SuccessFailureChart,
} from '../../../src/components/developer/DeveloperCharts';
import {
  apiErrorMessage,
  apiPayload,
  fetchDeveloperProjects,
  fetchDeveloperUsage,
  type DeveloperProject,
  type DeveloperRange,
  type DeveloperUsage,
} from '../../../src/services/developer';
import {
  DevColors,
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

export default function DeveloperUsageScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 1120;

  const [range, setRange] = useState<DeveloperRange>('7d');
  const [projectFilter, setProjectFilter] = useState('all');
  const [projects, setProjects] = useState<DeveloperProject[]>([]);
  const [data, setData] = useState<DeveloperUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const projectId = projectFilter === 'all' ? null : projectFilter;

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) {
          setError('Your session has expired. Please sign in again.');
          return;
        }
        const response = await fetchDeveloperUsage(token, range, projectId);
        const payload = apiPayload(response);
        if (id !== requestId.current) return;
        if (!payload) {
          setError(apiErrorMessage(response, 'Unable to load usage analytics.'));
          return;
        }
        setData(payload);
      } catch {
        if (id === requestId.current) setError('Unable to load usage analytics. Please try again.');
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
    void load();
  }, [load]);

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
        // Optional filter only.
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

  const testTraffic =
    data?.usageByEnvironment.find((item) => item.environment === 'test')?.requests || 0;
  const liveTraffic =
    data?.usageByEnvironment.find((item) => item.environment === 'live')?.requests || 0;

  return (
    <DevPage refreshing={refreshing} onRefresh={() => void load('refresh')}>
      <DevPageHeader
        eyebrow="Analytics"
        title="Usage Analytics"
        subtitle="Persisted request analytics for your API keys. Only authenticated requests are counted, and identifiers are collapsed into route patterns."
        actions={
          <DevButton
            label="Open request logs"
            icon="list"
            size="sm"
            variant="secondary"
            onPress={() => router.navigate('/(protected)/developer/logs' as any)}
          />
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
          />
        </View>
        {data ? (
          <Text style={styles.rangeWindow}>
            {formatDevDate(data.range.from)} → {formatDevDate(data.range.to)}
          </Text>
        ) : null}
      </View>

      {loading && !data ? <DevLoading label="Loading usage analytics…" /> : null}
      {error && !data ? <DevErrorState message={error} onRetry={() => void load()} /> : null}

      {data ? (
        <>
          {error ? <DevErrorState message={error} onRetry={() => void load()} /> : null}

          {data.totals.requests === 0 ? (
            <DevCard style={{ marginBottom: DevSpacing.md }}>
              <DevEmptyState
                icon="activity"
                title="No requests in this range"
                message="Usage analytics only include authenticated calls to /api/v1 endpoints. Once a key is used, totals, latency and endpoint breakdowns appear here."
                action={
                  <DevButton
                    label="View API keys"
                    size="sm"
                    variant="primary"
                    icon="key"
                    onPress={() => router.navigate('/(protected)/developer/keys' as any)}
                  />
                }
              />
            </DevCard>
          ) : null}

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
              helper={`${successRate}% success rate`}
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
              helper="Across all endpoints"
              icon="clock"
              tone="info"
            />
          </View>

          <View style={styles.chartGrid}>
            <View style={[styles.chartCell, { flexBasis: '100%' }]}>
              <DevCard
                title="Requests over time"
                subtitle="Volume by time bucket for the selected range."
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
              <DevCard title="Successful vs failed" subtitle="Stacked outcomes per bucket.">
                <SuccessFailureChart
                  data={data.requestsOverTime}
                  bucket={data.range.bucket}
                  height={198}
                />
              </DevCard>
            </View>

            <View style={[styles.chartCell, { flexBasis: isWide ? '38%' : '100%' }]}>
              <DevCard title="Test vs live" subtitle="Request split by environment.">
                <EnvironmentDonut test={testTraffic} live={liveTraffic} />
              </DevCard>
            </View>

            <View style={[styles.chartCell, { flexBasis: '100%' }]}>
              <DevCard
                title="Usage by endpoint"
                subtitle="Top route patterns, including success/failure and average latency."
              >
                {data.usageByEndpoint.length > 0 ? (
                  <>
                    <EndpointUsageBars data={data.usageByEndpoint} />
                    <View style={styles.endpointTable}>
                      <View style={[styles.endpointTableRow, styles.endpointTableHead]}>
                        <Text style={[styles.endpointTh, { flex: 2 }]}>Endpoint</Text>
                        <Text style={[styles.endpointTh, { width: 72, textAlign: 'right' }]}>Requests</Text>
                        <Text style={[styles.endpointTh, { width: 72, textAlign: 'right' }]}>Success</Text>
                        <Text style={[styles.endpointTh, { width: 62, textAlign: 'right' }]}>Failed</Text>
                        <Text style={[styles.endpointTh, { width: 86, textAlign: 'right' }]}>Avg. time</Text>
                      </View>
                      {data.usageByEndpoint.map((item) => (
                        <View key={item.endpoint} style={styles.endpointTableRow}>
                          <Text style={[styles.endpointTd, styles.mono, { flex: 2 }]} numberOfLines={1}>
                            {item.endpoint}
                          </Text>
                          <Text style={[styles.endpointTd, { width: 72, textAlign: 'right' }]}>
                            {formatCount(item.requests)}
                          </Text>
                          <Text style={[styles.endpointTd, { width: 72, textAlign: 'right', color: DevColors.success }]}>
                            {formatCount(item.success)}
                          </Text>
                          <Text
                            style={[
                              styles.endpointTd,
                              {
                                width: 62,
                                textAlign: 'right',
                                color: item.failed > 0 ? DevColors.danger : DevColors.textMuted,
                              },
                            ]}
                          >
                            {formatCount(item.failed)}
                          </Text>
                          <Text style={[styles.endpointTd, { width: 86, textAlign: 'right' }]}>
                            {formatDuration(item.averageDurationMs)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <DevEmptyState
                    icon="bar-chart-2"
                    title="No endpoint activity yet"
                    message="Endpoint breakdowns are populated from authenticated API requests."
                  />
                )}
              </DevCard>
            </View>
          </View>
        </>
      ) : null}
    </DevPage>
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
  },
  chartCell: { flexGrow: 1, minWidth: 290 },
  endpointTable: {
    marginTop: DevSpacing.lg,
    borderWidth: 1,
    borderColor: DevColors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  endpointTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: DevColors.border,
  },
  endpointTableHead: { backgroundColor: DevColors.backgroundAlt },
  endpointTh: {
    color: DevColors.textMuted,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  endpointTd: { color: DevColors.textSecondary, fontSize: 11 },
  mono: { fontFamily: 'monospace' },
});
