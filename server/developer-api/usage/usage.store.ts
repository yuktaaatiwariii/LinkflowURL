import crypto from 'crypto';
import { query } from '../../db';
import type {
  DeveloperApiKeyEnvironment,
  DeveloperApiUsageEventRecord,
} from '../../types';
import { toIso, useMemoryStore, isInvalidUuidError } from '../persistence';

/**
 * Persistent developer API usage analytics.
 *
 * Only routing/performance metadata is stored. Credentials, headers and
 * request bodies are never passed to this module by design.
 *
 * Writes are fire-and-forget: analytics must never fail or slow down an
 * authenticated public API request.
 */

export type UsageRangeKey = '24h' | '7d' | '30d';

export interface UsageRange {
  key: UsageRangeKey;
  from: Date;
  to: Date;
  bucket: 'hour' | 'day';
  bucketCount: number;
}

export function parseUsageRange(raw: string | null): UsageRange | null {
  const key = (raw || '7d') as UsageRangeKey;
  if (key !== '24h' && key !== '7d' && key !== '30d') return null;

  const now = new Date();
  if (key === '24h') {
    const to = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours() + 1
      )
    );
    return {
      key,
      from: new Date(to.getTime() - 24 * 60 * 60 * 1000),
      to,
      bucket: 'hour',
      bucketCount: 24,
    };
  }

  const days = key === '7d' ? 7 : 30;
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return {
    key,
    from: new Date(to.getTime() - days * 24 * 60 * 60 * 1000),
    to,
    bucket: 'day',
    bucketCount: days,
  };
}

/**
 * Collapses concrete resource identifiers into `:id` so endpoints group into
 * stable route patterns. Query strings are never part of `pathname`.
 */
export function normalizeEndpoint(pathname: string): string {
  const withoutQuery = pathname.split('?')[0] || '/';
  const patterns: Array<[RegExp, string]> = [
    [/^\/api\/v1\/links\/[^/]+\/analytics$/, '/api/v1/links/:id/analytics'],
    [/^\/api\/v1\/qr\/[^/]+\/analytics$/, '/api/v1/qr/:id/analytics'],
    [/^\/api\/v1\/links\/[^/]+$/, '/api/v1/links/:id'],
    [/^\/api\/v1\/qr\/[^/]+$/, '/api/v1/qr/:id'],
  ];
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(withoutQuery)) return replacement;
  }
  return withoutQuery.slice(0, 255);
}

export interface RecordUsageInput {
  userId: string;
  apiKeyId: string | null;
  projectId: string | null;
  endpoint: string;
  method: string;
  environment: DeveloperApiKeyEnvironment;
  statusCode: number;
  durationMs: number;
}

class UsageMemoryStore {
  readonly events: DeveloperApiUsageEventRecord[] = [];

  insert(input: RecordUsageInput): DeveloperApiUsageEventRecord {
    const record: DeveloperApiUsageEventRecord = {
      id: `use_${crypto.randomBytes(10).toString('hex')}`,
      user_id: input.userId,
      api_key_id: input.apiKeyId,
      project_id: input.projectId,
      endpoint: normalizeEndpoint(input.endpoint),
      method: input.method.slice(0, 10).toUpperCase(),
      environment: input.environment,
      status_code: input.statusCode,
      duration_ms: Math.max(0, Math.round(input.durationMs)),
      created_at: new Date().toISOString(),
    };
    this.events.push(record);
    return { ...record };
  }

  clear(): void {
    this.events.length = 0;
  }
}

export const usageMemoryStore = new UsageMemoryStore();

/** Fire-and-forget insert. Never throws into the request path. */
export function recordApiUsage(input: RecordUsageInput): void {
  try {
    const sanitized: RecordUsageInput = {
      ...input,
      endpoint: normalizeEndpoint(input.endpoint),
      method: String(input.method || 'GET').slice(0, 10).toUpperCase(),
      statusCode: Math.min(599, Math.max(100, Math.round(input.statusCode))),
      durationMs: Math.max(0, Math.round(input.durationMs)),
    };

    if (useMemoryStore()) {
      usageMemoryStore.insert(sanitized);
      return;
    }

    void query(
      `INSERT INTO developer_api_usage_events
         (user_id, api_key_id, project_id, endpoint, method, environment, status_code, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sanitized.userId,
        sanitized.apiKeyId,
        sanitized.projectId,
        sanitized.endpoint,
        sanitized.method,
        sanitized.environment,
        sanitized.statusCode,
        sanitized.durationMs,
      ]
    ).catch((err: any) => {
      console.warn('[Usage] Failed to persist API request event:', err.message);
    });
  } catch (err: any) {
    // Missing DATABASE_URL in production, or any unexpected analytics failure.
    console.warn('[Usage] Usage tracking unavailable:', err?.message || 'unknown error');
  }
}

export interface UsageTotals {
  requests: number;
  success: number;
  failed: number;
  averageDurationMs: number;
}

export interface UsageBucket {
  bucketStart: string;
  requests: number;
  success: number;
  failed: number;
}

export interface UsageByEndpoint {
  endpoint: string;
  requests: number;
  success: number;
  failed: number;
  averageDurationMs: number;
}

export interface UsageByEnvironment {
  environment: DeveloperApiKeyEnvironment;
  requests: number;
  success: number;
  failed: number;
}

interface EventRow extends Omit<DeveloperApiUsageEventRecord, 'created_at'> {
  created_at: string | Date;
}

function normalizeEvent(row: EventRow): DeveloperApiUsageEventRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    api_key_id: row.api_key_id,
    project_id: row.project_id,
    endpoint: row.endpoint,
    method: row.method,
    environment: row.environment,
    status_code: Number(row.status_code),
    duration_ms: Number(row.duration_ms),
    created_at: toIso(row.created_at) as string,
  };
}

function bucketKey(date: Date, bucket: 'hour' | 'day'): string {
  const iso = date.toISOString();
  return bucket === 'hour' ? `${iso.slice(0, 13)}:00:00.000Z` : `${iso.slice(0, 10)}T00:00:00.000Z`;
}

function inRange(
  event: DeveloperApiUsageEventRecord,
  range: UsageRange,
  projectId: string | null
): boolean {
  if (projectId && event.project_id !== projectId) return false;
  const created = new Date(event.created_at).getTime();
  return created >= range.from.getTime() && created < range.to.getTime();
}

function memoryEventsFor(
  userId: string,
  range: UsageRange,
  projectId: string | null
): DeveloperApiUsageEventRecord[] {
  return usageMemoryStore.events.filter(
    (event) => event.user_id === userId && inRange(event, range, projectId)
  );
}

export async function getUsageTotals(
  userId: string,
  range: UsageRange,
  projectId: string | null = null
): Promise<UsageTotals> {
  if (useMemoryStore()) {
    const events = memoryEventsFor(userId, range, projectId);
    const success = events.filter((event) => event.status_code < 400).length;
    const totalDuration = events.reduce((sum, event) => sum + event.duration_ms, 0);
    return {
      requests: events.length,
      success,
      failed: events.length - success,
      averageDurationMs: events.length === 0 ? 0 : Math.round(totalDuration / events.length),
    };
  }

  const rows = await query<{
    requests: number;
    success: number;
    failed: number;
    average_duration_ms: number;
  }>(
    `SELECT
       COUNT(*)::int AS requests,
       COALESCE(SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END), 0)::int AS success,
       COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END), 0)::int AS failed,
       COALESCE(AVG(duration_ms), 0)::float8 AS average_duration_ms
     FROM developer_api_usage_events
     WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
       ${projectId ? 'AND project_id = $4' : ''}`,
    projectId ? [userId, range.from, range.to, projectId] : [userId, range.from, range.to]
  );
  const row = rows[0];
  return {
    requests: Number(row?.requests) || 0,
    success: Number(row?.success) || 0,
    failed: Number(row?.failed) || 0,
    averageDurationMs: Math.round(Number(row?.average_duration_ms) || 0),
  };
}

export async function getUsageSeries(
  userId: string,
  range: UsageRange,
  projectId: string | null = null
): Promise<UsageBucket[]> {
  const buckets = new Map<string, UsageBucket>();
  for (let index = 0; index < range.bucketCount; index += 1) {
    const start = new Date(
      range.from.getTime() + index * (range.bucket === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
    );
    const key = bucketKey(start, range.bucket);
    buckets.set(key, { bucketStart: key, requests: 0, success: 0, failed: 0 });
  }

  if (useMemoryStore()) {
    for (const event of memoryEventsFor(userId, range, projectId)) {
      const key = bucketKey(new Date(event.created_at), range.bucket);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.requests += 1;
      if (event.status_code < 400) bucket.success += 1;
      else bucket.failed += 1;
    }
    return Array.from(buckets.values());
  }

  const format =
    range.bucket === 'hour'
      ? `'YYYY-MM-DD"T"HH24:00:00.000"Z"'`
      : `'YYYY-MM-DD"T"00:00:00.000"Z"'`;
  const rows = await query<{
    bucket_start: string;
    requests: number;
    success: number;
    failed: number;
  }>(
    `SELECT
       to_char(date_trunc('${range.bucket}', created_at AT TIME ZONE 'UTC'), ${format}) AS bucket_start,
       COUNT(*)::int AS requests,
       COALESCE(SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END), 0)::int AS success,
       COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END), 0)::int AS failed
     FROM developer_api_usage_events
     WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
       ${projectId ? 'AND project_id = $4' : ''}
     GROUP BY 1
     ORDER BY 1`,
    projectId ? [userId, range.from, range.to, projectId] : [userId, range.from, range.to]
  );

  for (const row of rows) {
    const bucket = buckets.get(row.bucket_start);
    if (!bucket) continue;
    bucket.requests = Number(row.requests) || 0;
    bucket.success = Number(row.success) || 0;
    bucket.failed = Number(row.failed) || 0;
  }
  return Array.from(buckets.values());
}

export async function getUsageByEndpoint(
  userId: string,
  range: UsageRange,
  projectId: string | null = null,
  limit = 8
): Promise<UsageByEndpoint[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);

  if (useMemoryStore()) {
    const grouped = new Map<string, { requests: number; success: number; failed: number; total: number }>();
    for (const event of memoryEventsFor(userId, range, projectId)) {
      const entry = grouped.get(event.endpoint) || { requests: 0, success: 0, failed: 0, total: 0 };
      entry.requests += 1;
      entry.total += event.duration_ms;
      if (event.status_code < 400) entry.success += 1;
      else entry.failed += 1;
      grouped.set(event.endpoint, entry);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => b[1].requests - a[1].requests)
      .slice(0, safeLimit)
      .map(([endpoint, entry]) => ({
        endpoint,
        requests: entry.requests,
        success: entry.success,
        failed: entry.failed,
        averageDurationMs: Math.round(entry.total / entry.requests),
      }));
  }

  const rows = await query<{
    endpoint: string;
    requests: number;
    success: number;
    failed: number;
    average_duration_ms: number;
  }>(
    `SELECT
       endpoint,
       COUNT(*)::int AS requests,
       COALESCE(SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END), 0)::int AS success,
       COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END), 0)::int AS failed,
       COALESCE(AVG(duration_ms), 0)::float8 AS average_duration_ms
     FROM developer_api_usage_events
     WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
       ${projectId ? 'AND project_id = $4' : ''}
     GROUP BY endpoint
     ORDER BY requests DESC
     LIMIT ${safeLimit}`,
    projectId ? [userId, range.from, range.to, projectId] : [userId, range.from, range.to]
  );
  return rows.map((row) => ({
    endpoint: row.endpoint,
    requests: Number(row.requests) || 0,
    success: Number(row.success) || 0,
    failed: Number(row.failed) || 0,
    averageDurationMs: Math.round(Number(row.average_duration_ms) || 0),
  }));
}

export async function getUsageByEnvironment(
  userId: string,
  range: UsageRange,
  projectId: string | null = null
): Promise<UsageByEnvironment[]> {
  const base: UsageByEnvironment[] = [
    { environment: 'test', requests: 0, success: 0, failed: 0 },
    { environment: 'live', requests: 0, success: 0, failed: 0 },
  ];

  if (useMemoryStore()) {
    for (const event of memoryEventsFor(userId, range, projectId)) {
      const entry = base.find((item) => item.environment === event.environment);
      if (!entry) continue;
      entry.requests += 1;
      if (event.status_code < 400) entry.success += 1;
      else entry.failed += 1;
    }
    return base;
  }

  const rows = await query<{
    environment: DeveloperApiKeyEnvironment;
    requests: number;
    success: number;
    failed: number;
  }>(
    `SELECT
       environment,
       COUNT(*)::int AS requests,
       COALESCE(SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END), 0)::int AS success,
       COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END), 0)::int AS failed
     FROM developer_api_usage_events
     WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
       ${projectId ? 'AND project_id = $4' : ''}
     GROUP BY environment`,
    projectId ? [userId, range.from, range.to, projectId] : [userId, range.from, range.to]
  );
  for (const row of rows) {
    const entry = base.find((item) => item.environment === row.environment);
    if (!entry) continue;
    entry.requests = Number(row.requests) || 0;
    entry.success = Number(row.success) || 0;
    entry.failed = Number(row.failed) || 0;
  }
  return base;
}

export async function getRecentUsage(
  userId: string,
  limit = 8,
  projectId: string | null = null
): Promise<DeveloperApiUsageEventRecord[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);

  if (useMemoryStore()) {
    return usageMemoryStore.events
      .filter((event) => event.user_id === userId && (!projectId || event.project_id === projectId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, safeLimit)
      .map((event) => ({ ...event }));
  }

  const rows = await query<EventRow>(
    `SELECT id, user_id, api_key_id, project_id, endpoint, method, environment,
            status_code, duration_ms, created_at
     FROM developer_api_usage_events
     WHERE user_id = $1 ${projectId ? 'AND project_id = $2' : ''}
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
    projectId ? [userId, projectId] : [userId]
  );
  return rows.map(normalizeEvent);
}

export interface UsageLogFilters {
  limit: number;
  offset: number;
  method?: string;
  status?: 'success' | 'failed';
  statusCode?: number;
  environment?: DeveloperApiKeyEnvironment;
  projectId?: string;
  endpoint?: string;
  from?: string;
  to?: string;
}

export interface UsageLogPage {
  logs: DeveloperApiUsageEventRecord[];
  total: number;
  limit: number;
  offset: number;
}

function memoryLogs(userId: string, filters: UsageLogFilters): DeveloperApiUsageEventRecord[] {
  const fromMs = filters.from ? Date.parse(filters.from) : null;
  const toMs = filters.to ? Date.parse(filters.to) : null;
  const needle = filters.endpoint?.trim().toLowerCase() || null;

  return usageMemoryStore.events
    .filter((event) => {
      if (event.user_id !== userId) return false;
      if (filters.method && event.method !== filters.method) return false;
      if (filters.status === 'success' && event.status_code >= 400) return false;
      if (filters.status === 'failed' && event.status_code < 400) return false;
      if (filters.statusCode && event.status_code !== filters.statusCode) return false;
      if (filters.environment && event.environment !== filters.environment) return false;
      if (filters.projectId && event.project_id !== filters.projectId) return false;
      if (needle && !event.endpoint.toLowerCase().includes(needle)) return false;
      const created = Date.parse(event.created_at);
      if (fromMs !== null && Number.isFinite(fromMs) && created < fromMs) return false;
      if (toMs !== null && Number.isFinite(toMs) && created >= toMs) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function buildLogWhere(userId: string, filters: UsageLogFilters): { clause: string; params: any[] } {
  const params: any[] = [userId];
  const parts: string[] = ['user_id = $1'];

  const add = (sql: (placeholder: string) => string, value: any) => {
    params.push(value);
    parts.push(sql(`$${params.length}`));
  };

  if (filters.method) add((p) => `method = ${p}`, filters.method);
  if (filters.status === 'success') parts.push('status_code < 400');
  if (filters.status === 'failed') parts.push('status_code >= 400');
  if (filters.statusCode) add((p) => `status_code = ${p}`, filters.statusCode);
  if (filters.environment) add((p) => `environment = ${p}`, filters.environment);
  if (filters.projectId) add((p) => `project_id = ${p}`, filters.projectId);
  if (filters.endpoint) add((p) => `endpoint ILIKE ${p}`, `%${filters.endpoint}%`);
  if (filters.from) add((p) => `created_at >= ${p}`, filters.from);
  if (filters.to) add((p) => `created_at < ${p}`, filters.to);

  return { clause: parts.join(' AND '), params };
}

export async function listUsageLogs(
  userId: string,
  filters: UsageLogFilters
): Promise<UsageLogPage> {
  if (useMemoryStore()) {
    const filtered = memoryLogs(userId, filters);
    return {
      logs: filtered.slice(filters.offset, filters.offset + filters.limit).map((event) => ({ ...event })),
      total: filtered.length,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  const { clause, params } = buildLogWhere(userId, filters);
  const countRows = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM developer_api_usage_events WHERE ${clause}`,
    params
  );
  const total = Number(countRows[0]?.total) || 0;

  const logs = await query<EventRow>(
    `SELECT id, user_id, api_key_id, project_id, endpoint, method, environment,
            status_code, duration_ms, created_at
     FROM developer_api_usage_events
     WHERE ${clause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, filters.offset]
  );

  return {
    logs: logs.map(normalizeEvent),
    total,
    limit: filters.limit,
    offset: filters.offset,
  };
}

export async function findUsageLogForUser(
  id: string,
  userId: string
): Promise<DeveloperApiUsageEventRecord | null> {
  if (useMemoryStore()) {
    const event = usageMemoryStore.events.find(
      (entry) => entry.id === id && entry.user_id === userId
    );
    return event ? { ...event } : null;
  }
  const rows = await query<EventRow>(
    `SELECT id, user_id, api_key_id, project_id, endpoint, method, environment,
            status_code, duration_ms, created_at
     FROM developer_api_usage_events
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [id, userId]
  ).catch((err) => {
    if (isInvalidUuidError(err)) return [] as EventRow[];
    throw err;
  });
  return rows.length > 0 ? normalizeEvent(rows[0]) : null;
}
