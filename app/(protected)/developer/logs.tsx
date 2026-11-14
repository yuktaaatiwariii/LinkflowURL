import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import {
  DevBadge,
  DevButton,
  DevCard,
  DevEmptyState,
  DevErrorState,
  DevInfoRow,
  DevInput,
  DevLoading,
  DevPageHeader,
  DevSelect,
  type DevBadgeTone,
} from '../../../src/components/developer/DeveloperUI';
import { DevPage } from '../../../src/components/developer/DeveloperPage';
import { DeveloperModal } from '../../../src/components/developer/DeveloperModal';
import {
  apiErrorMessage,
  apiPayload,
  fetchDeveloperLog,
  fetchDeveloperLogs,
  fetchDeveloperProjects,
  type DeveloperEnvironment,
  type DeveloperLogFilters,
  type DeveloperProject,
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

const PAGE_SIZE = 25;

type StatusFilter = 'all' | 'success' | 'failed';
type PeriodFilter = 'all' | '24h' | '7d' | '30d';
type MethodFilter = 'ALL' | 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const METHOD_OPTIONS: { value: MethodFilter; label: string }[] = [
  { value: 'ALL', label: 'All methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All responses' },
  { value: 'success', label: 'Successful (< 400)' },
  { value: 'failed', label: 'Failed (>= 400)' },
];

const ENVIRONMENT_OPTIONS: { value: 'all' | DeveloperEnvironment; label: string }[] = [
  { value: 'all', label: 'All environments' },
  { value: 'test', label: 'Test' },
  { value: 'live', label: 'Live' },
];

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export default function DeveloperLogsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ logId?: string }>();
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 860;

  const [logs, setLogs] = useState<DeveloperUsageLog[]>([]);
  const [projects, setProjects] = useState<DeveloperProject[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Filters. `search` is debounced into `appliedSearch` so typing does not
  // issue one request per keystroke.
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [method, setMethod] = useState<MethodFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [environment, setEnvironment] = useState<'all' | DeveloperEnvironment>('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');

  const [detail, setDetail] = useState<DeveloperUsageLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const openedFromParams = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(0);
    }, 320);
    return () => clearTimeout(timer);
  }, [search]);

  const dateWindow = useMemo(() => {
    if (period === 'all') return { from: undefined, to: undefined };
    const hours = period === '24h' ? 24 : period === '7d' ? 24 * 7 : 24 * 30;
    const from = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return { from, to: undefined };
  }, [period]);

  const buildFilters = useCallback(
    (targetPage: number): DeveloperLogFilters => ({
      limit: PAGE_SIZE,
      offset: targetPage * PAGE_SIZE,
      method: method === 'ALL' ? undefined : method,
      status: status === 'all' ? undefined : status,
      environment: environment === 'all' ? undefined : environment,
      projectId: projectFilter === 'all' ? undefined : projectFilter,
      endpoint: appliedSearch || undefined,
      from: dateWindow.from,
      to: dateWindow.to,
    }),
    [appliedSearch, dateWindow.from, dateWindow.to, environment, method, projectFilter, status]
  );

  const load = useCallback(
    async (targetPage: number, mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'initial') setLoading(true);
      if (mode !== 'silent') setError(null);

      try {
        const token = await getToken();
        if (!token) {
          if (mode !== 'silent') setError('Your session has expired. Please sign in again.');
          return;
        }
        const response = await fetchDeveloperLogs(token, buildFilters(targetPage));
        if (id !== requestId.current) return;
        const payload = apiPayload(response);
        if (!payload) {
          if (mode !== 'silent') {
            setError(apiErrorMessage(response, 'Unable to load request logs.'));
          }
          return;
        }
        setLogs(payload.logs);
        setTotal(payload.total);
        setHasMore(payload.hasMore);
        setPage(targetPage);
      } catch {
        if (id === requestId.current && mode !== 'silent') {
          setError('Unable to load request logs. Please try again.');
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [buildFilters, getToken]
  );

  useEffect(() => {
    void load(0);
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
        // Project filter is optional.
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken]);

  const openDetail = useCallback(
    async (logId: string) => {
      setDetailError(null);
      setDetailLoading(true);
      // Show what we already know immediately, then refresh from the server.
      const local = logs.find((entry) => entry.id === logId) || null;
      if (local) setDetail(local);
      try {
        const token = await getToken();
        if (!token) {
          setDetailError('Your session has expired. Please sign in again.');
          return;
        }
        const response = await fetchDeveloperLog(token, logId);
        const payload = apiPayload(response);
        if (!payload) {
          setDetailError(apiErrorMessage(response, 'Unable to load this request.'));
          return;
        }
        setDetail(payload);
      } catch {
        setDetailError('Unable to load this request. Please try again.');
      } finally {
        setDetailLoading(false);
      }
    },
    [getToken, logs]
  );

  // Deep link from the Overview "recent activity" list.
  useEffect(() => {
    const logId = typeof params.logId === 'string' ? params.logId : null;
    if (!logId) {
      openedFromParams.current = null;
      return;
    }
    if (openedFromParams.current === logId) return;
    openedFromParams.current = logId;
    void openDetail(logId);
  }, [openDetail, params.logId]);

  const projectOptions = useMemo(
    () => [
      { value: 'all', label: 'All projects' },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [projects]
  );

  const resetFilters = () => {
    setSearch('');
    setAppliedSearch('');
    setMethod('ALL');
    setStatus('all');
    setEnvironment('all');
    setProjectFilter('all');
    setPeriod('all');
    setPage(0);
  };

  const filtersActive =
    search.length > 0 ||
    method !== 'ALL' ||
    status !== 'all' ||
    environment !== 'all' ||
    projectFilter !== 'all' ||
    period !== 'all';

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE + logs.length);
  const canGoBack = page > 0;
  const canGoForward = hasMore;

  return (
    <DevPage refreshing={refreshing} onRefresh={() => void load(page, 'refresh')}>
      <DevPageHeader
        eyebrow="Observability"
        title="API Logs"
        subtitle="Every authenticated request to the LinkFlow API, with the route pattern, status and server processing time. Secrets, headers and request bodies are never stored."
        actions={
          <>
            <DevButton
              label="Refresh"
              icon="refresh-cw"
              size="sm"
              variant="secondary"
              onPress={() => void load(page, 'refresh')}
            />
            <DevButton
              label="Usage analytics"
              icon="bar-chart-2"
              size="sm"
              variant="primary"
              onPress={() => router.navigate('/(protected)/developer/usage' as any)}
            />
          </>
        }
      />

      <DevCard style={styles.filterCard}>
        <View style={styles.filterGrid}>
          <View style={styles.searchWrap}>
            <DevInput
              label="Search endpoint"
              value={search}
              onChangeText={setSearch}
              placeholder="e.g. /api/v1/links"
              icon="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.filterItem}>
            <DevSelect<MethodFilter>
              label="Method"
              value={method}
              options={METHOD_OPTIONS}
              onChange={(value) => {
                setMethod(value);
                setPage(0);
              }}
            />
          </View>
          <View style={styles.filterItem}>
            <DevSelect<StatusFilter>
              label="Status"
              value={status}
              options={STATUS_OPTIONS}
              onChange={(value) => {
                setStatus(value);
                setPage(0);
              }}
            />
          </View>
          <View style={styles.filterItem}>
            <DevSelect<'all' | DeveloperEnvironment>
              label="Environment"
              value={environment}
              options={ENVIRONMENT_OPTIONS}
              onChange={(value) => {
                setEnvironment(value);
                setPage(0);
              }}
            />
          </View>
          <View style={styles.filterItem}>
            <DevSelect
              label="Project"
              value={projectFilter}
              options={projectOptions}
              onChange={(value) => {
                setProjectFilter(value);
                setPage(0);
              }}
            />
          </View>
          <View style={styles.filterItem}>
            <DevSelect<PeriodFilter>
              label="Date range"
              value={period}
              options={PERIOD_OPTIONS}
              onChange={(value) => {
                setPeriod(value);
                setPage(0);
              }}
            />
          </View>
        </View>
        <View style={styles.filterFooter}>
          <Text style={styles.filterSummary}>
            {loading && logs.length === 0
              ? 'Loading requests…'
              : `${formatCount(total)} request${total === 1 ? '' : 's'}${filtersActive ? ' match these filters' : ''}`}
          </Text>
          {filtersActive ? (
            <DevButton label="Clear filters" size="sm" variant="ghost" icon="x" onPress={resetFilters} />
          ) : null}
        </View>
      </DevCard>

      {loading && logs.length === 0 ? <DevLoading label="Loading request logs…" /> : null}
      {error && logs.length === 0 ? <DevErrorState message={error} onRetry={() => void load(page)} /> : null}

      {!loading && !error && logs.length === 0 ? (
        <DevCard>
          <DevEmptyState
            icon={filtersActive ? 'search' : 'list'}
            title={filtersActive ? 'No requests match these filters' : 'No API requests yet'}
            message={
              filtersActive
                ? 'Try clearing the filters or widening the date range.'
                : 'Authenticated calls to /api/v1 endpoints are recorded here. Only successful key authentication is logged.'
            }
            action={
              filtersActive ? (
                <DevButton label="Clear filters" size="sm" variant="outline" onPress={resetFilters} />
              ) : (
                <DevButton
                  label="View API keys"
                  size="sm"
                  variant="primary"
                  icon="key"
                  onPress={() => router.navigate('/(protected)/developer/keys' as any)}
                />
              )
            }
          />
        </DevCard>
      ) : null}

      {logs.length > 0 && isMobile ? (
        <View style={styles.mobileList}>
          {logs.map((log) => (
            <TouchableOpacity
              key={log.id}
              activeOpacity={0.82}
              onPress={() => void openDetail(log.id)}
              style={styles.logCard}
            >
              <View style={styles.logCardHeader}>
                <DevBadge label={log.method} tone={methodTone(log.method)} />
                <Text style={styles.logEndpoint} numberOfLines={1}>
                  {log.endpoint}
                </Text>
              </View>
              <View style={styles.logCardMeta}>
                <DevBadge label={String(log.statusCode)} tone={statusTone(log.statusCode)} />
                <Text style={styles.metaText}>{formatDuration(log.durationMs)}</Text>
                <DevBadge label={log.environment} tone={log.environment === 'live' ? 'primary' : 'info'} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {log.projectName || 'No project'}
                </Text>
              </View>
              <View style={styles.logCardFooter}>
                <Feather name="clock" size={12} color={DevColors.textMuted} />
                <Text style={styles.metaText}>{formatDevDate(log.createdAt)}</Text>
                <View style={{ flex: 1 }} />
                <Feather name="chevron-right" size={15} color={DevColors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {logs.length > 0 && !isMobile ? (
        <DevCard padding={0}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.th, { width: 148 }]}>Timestamp</Text>
                <Text style={[styles.th, { width: 74 }]}>Method</Text>
                <Text style={[styles.th, { flex: 1 }]}>Endpoint</Text>
                <Text style={[styles.th, { width: 70 }]}>Status</Text>
                <Text style={[styles.th, { width: 84 }]}>Duration</Text>
                <Text style={[styles.th, { width: 84 }]}>Env</Text>
                <Text style={[styles.th, { width: 150 }]}>Project</Text>
                <Text style={[styles.th, { width: 40 }]}> </Text>
              </View>
              {logs.map((log) => (
                <TouchableOpacity
                  key={log.id}
                  activeOpacity={0.82}
                  onPress={() => void openDetail(log.id)}
                  style={styles.tableRow}
                >
                  <Text style={[styles.tdMuted, { width: 148 }]}>{formatDevDate(log.createdAt)}</Text>
                  <View style={{ width: 74 }}>
                    <DevBadge label={log.method} tone={methodTone(log.method)} />
                  </View>
                  <Text style={[styles.tdMono, { flex: 1 }]} numberOfLines={1}>
                    {log.endpoint}
                  </Text>
                  <View style={{ width: 70 }}>
                    <DevBadge label={String(log.statusCode)} tone={statusTone(log.statusCode)} />
                  </View>
                  <Text style={[styles.td, { width: 84 }]}>{formatDuration(log.durationMs)}</Text>
                  <View style={{ width: 84 }}>
                    <DevBadge
                      label={log.environment}
                      tone={log.environment === 'live' ? 'primary' : 'info'}
                    />
                  </View>
                  <Text style={[styles.td, { width: 150 }]} numberOfLines={1}>
                    {log.projectName || '—'}
                  </Text>
                  <View style={{ width: 40, alignItems: 'flex-end' }}>
                    <Feather name="chevron-right" size={15} color={DevColors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </DevCard>
      ) : null}

      {logs.length > 0 ? (
        <View style={styles.pagination}>
          <Text style={styles.paginationText}>
            {`Showing ${formatCount(from)}–${formatCount(to)} of ${formatCount(total)}`}
          </Text>
          <View style={styles.paginationActions}>
            <DevButton
              label="Previous"
              icon="chevron-left"
              size="sm"
              variant="secondary"
              disabled={!canGoBack || loading}
              onPress={() => void load(page - 1, 'silent')}
            />
            <Text style={styles.pageIndicator}>
              Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            </Text>
            <DevButton
              label="Next"
              icon="chevron-right"
              size="sm"
              variant="secondary"
              disabled={!canGoForward || loading}
              onPress={() => void load(page + 1, 'silent')}
            />
          </View>
        </View>
      ) : null}

      {error && logs.length > 0 ? (
        <View style={{ marginTop: DevSpacing.lg }}>
          <DevErrorState message={error} onRetry={() => void load(page)} />
        </View>
      ) : null}

      <DeveloperModal
        visible={Boolean(detail) || detailLoading || Boolean(detailError)}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
          setDetailLoading(false);
          openedFromParams.current = null;
        }}
        title="Request details"
        subtitle="Routing and performance metadata only. No credentials, headers or bodies are stored."
        width={600}
      >
        {detailLoading && !detail ? <DevLoading label="Loading request…" /> : null}
        {detailError ? <DevErrorState message={detailError} /> : null}
        {detail ? (
          <View>
            <DevInfoRow label="Request id" value={detail.id} mono />
            <DevInfoRow label="Timestamp" value={formatDevDate(detail.createdAt)} />
            <DevInfoRow label="Method" value={<DevBadge label={detail.method} tone={methodTone(detail.method)} />} />
            <DevInfoRow label="Endpoint" value={detail.endpoint} mono />
            <DevInfoRow
              label="Status"
              value={<DevBadge label={String(detail.statusCode)} tone={statusTone(detail.statusCode)} />}
            />
            <DevInfoRow label="Outcome" value={detail.statusGroup.replace('_', ' ')} />
            <DevInfoRow label="Duration" value={formatDuration(detail.durationMs)} />
            <DevInfoRow
              label="Environment"
              value={
                <DevBadge
                  label={detail.environment}
                  tone={detail.environment === 'live' ? 'primary' : 'info'}
                />
              }
            />
            <DevInfoRow label="Project" value={detail.projectName || 'No project'} />
            <DevInfoRow label="Project id" value={detail.projectId || '—'} mono />
            {detailError ? <Text style={styles.detailError}>{detailError}</Text> : null}
          </View>
        ) : null}
      </DeveloperModal>
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

const styles = StyleSheet.create({
  filterCard: { marginBottom: DevSpacing.lg },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: DevSpacing.md,
  },
  searchWrap: { flexGrow: 1, flexBasis: 260, minWidth: 220 },
  filterItem: { width: 168, minWidth: 150 },
  filterFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DevSpacing.sm,
    marginTop: DevSpacing.md,
    paddingTop: DevSpacing.md,
    borderTopWidth: 1,
    borderTopColor: DevColors.border,
  },
  filterSummary: { color: DevColors.textMuted, fontSize: 11.5 },
  mobileList: { gap: DevSpacing.md },
  logCard: {
    backgroundColor: DevColors.surface,
    borderWidth: 1,
    borderColor: DevColors.border,
    borderRadius: DevRadius.lg,
    padding: DevSpacing.lg,
  },
  logCardHeader: { flexDirection: 'row', alignItems: 'center', gap: DevSpacing.sm },
  logEndpoint: {
    flex: 1,
    color: DevColors.text,
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  logCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: DevSpacing.sm,
    marginTop: DevSpacing.md,
  },
  logCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: DevSpacing.md,
    paddingTop: DevSpacing.md,
    borderTopWidth: 1,
    borderTopColor: DevColors.border,
  },
  metaText: { color: DevColors.textMuted, fontSize: 10.5 },
  table: { minWidth: 900, width: '100%' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DevSpacing.sm,
    paddingHorizontal: DevSpacing.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: DevColors.border,
  },
  tableHead: { backgroundColor: DevColors.backgroundAlt },
  th: {
    color: DevColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  td: { color: DevColors.textSecondary, fontSize: 11.5, paddingRight: 4 },
  tdMuted: { color: DevColors.textMuted, fontSize: 10.5, paddingRight: 4 },
  tdMono: {
    color: DevColors.text,
    fontSize: 11.5,
    fontFamily: 'monospace',
    paddingRight: 4,
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DevSpacing.md,
    marginTop: DevSpacing.lg,
  },
  paginationText: { color: DevColors.textMuted, fontSize: 11.5 },
  paginationActions: { flexDirection: 'row', alignItems: 'center', gap: DevSpacing.sm },
  pageIndicator: { color: DevColors.textSecondary, fontSize: 11.5, fontWeight: '600' },
  detailError: { color: DevColors.danger, fontSize: 12, marginTop: DevSpacing.md },
});
