import type { ServerResponse } from 'http';
import type {
  DeveloperApiKeyRecord,
  DeveloperApiUsageEventRecord,
  DeveloperProjectRecord,
  UserRecord,
} from '../../types';
import { sendError, sendSuccess } from '../http/envelope';
import { parseResourceId, type ValidationResult } from '../dto/validation';
import { PersistenceUnavailableError } from '../persistence';
import { listApiKeysForUser } from '../keys/api-key.store';
import { listProjectsForUser } from '../projects/project.store';
import {
  findUsageLogForUser,
  getRecentUsage,
  getUsageByEndpoint,
  getUsageByEnvironment,
  getUsageSeries,
  getUsageTotals,
  listUsageLogs,
  parseUsageRange,
  type UsageRange,
} from './usage.store';
import { parseLogQuery, parseUsageProjectFilter } from './usage.dto';

/**
 * Developer dashboard analytics and request-log endpoints.
 *
 * Every query is scoped to the authenticated user id at the storage layer, so
 * one developer can never aggregate another developer's activity.
 */

function sendPersistenceFailure(res: ServerResponse, err: unknown): boolean {
  if (err instanceof PersistenceUnavailableError) {
    sendError(
      res,
      503,
      'DATABASE_NOT_CONFIGURED',
      'Developer dashboard persistence is not configured on this server.'
    );
    return true;
  }
  return false;
}

async function runWithPersistenceErrors<T>(
  res: ServerResponse,
  operation: () => Promise<T>
): Promise<T | null> {
  try {
    return await operation();
  } catch (err) {
    if (sendPersistenceFailure(res, err)) return null;
    throw err;
  }
}

function parseRange(res: ServerResponse, raw: string | null): UsageRange | null {
  const range = parseUsageRange(raw);
  if (!range) {
    sendError(res, 400, 'VALIDATION_ERROR', 'range must be one of: 24h, 7d, 30d.');
    return null;
  }
  return range;
}

function projectFilter(res: ServerResponse, params: URLSearchParams): string | null | undefined {
  const parsed: ValidationResult<{ projectId: string | null }> = parseUsageProjectFilter(params);
  if (!parsed.ok) {
    sendError(res, 400, 'VALIDATION_ERROR', parsed.message);
    return undefined;
  }
  return parsed.value.projectId;
}

function isActive(key: DeveloperApiKeyRecord): boolean {
  return (
    key.status === 'active' &&
    (!key.expires_at || new Date(key.expires_at).getTime() > Date.now())
  );
}

function statusGroup(statusCode: number): 'success' | 'redirect' | 'client_error' | 'server_error' {
  if (statusCode < 300) return 'success';
  if (statusCode < 400) return 'redirect';
  if (statusCode < 500) return 'client_error';
  return 'server_error';
}

export interface UsageEventView {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  statusGroup: string;
  durationMs: number;
  environment: 'test' | 'live';
  projectId: string | null;
  projectName: string | null;
  createdAt: string;
}

function toEventView(
  event: DeveloperApiUsageEventRecord,
  projects: Map<string, string>
): UsageEventView {
  return {
    id: event.id,
    endpoint: event.endpoint,
    method: event.method,
    statusCode: event.status_code,
    statusGroup: statusGroup(event.status_code),
    durationMs: event.duration_ms,
    environment: event.environment,
    projectId: event.project_id,
    projectName: event.project_id ? projects.get(event.project_id) || null : null,
    createdAt: event.created_at,
  };
}

function projectNameMap(projects: DeveloperProjectRecord[]): Map<string, string> {
  return new Map(projects.map((project) => [project.id, project.name]));
}

function rangeView(range: UsageRange) {
  return {
    key: range.key,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    bucket: range.bucket,
    buckets: range.bucketCount,
    generatedAt: new Date().toISOString(),
  };
}

/** GET /api/developer/overview?range=7d */
export async function getDashboardOverview(
  user: UserRecord,
  res: ServerResponse,
  params: URLSearchParams
): Promise<void> {
  const range = parseRange(res, params.get('range'));
  if (!range) return;
  const projectId = projectFilter(res, params);
  if (projectId === undefined) return;

  const data = await runWithPersistenceErrors(res, async () => {
    const [totals, series, byEndpoint, byEnvironment, recent, keys, projects] = await Promise.all([
      getUsageTotals(user.id, range, projectId),
      getUsageSeries(user.id, range, projectId),
      getUsageByEndpoint(user.id, range, projectId, 8),
      getUsageByEnvironment(user.id, range, projectId),
      getRecentUsage(user.id, 8, projectId),
      listApiKeysForUser(user.id),
      listProjectsForUser(user.id),
    ]);
    return { totals, series, byEndpoint, byEnvironment, recent, keys, projects };
  });
  if (!data) return;

  const scopedKeys = projectId
    ? data.keys.filter(
        (key) => key.project_id === projectId
      )
    : data.keys;
  const activeKeys = scopedKeys.filter(isActive);

  const names = projectNameMap(data.projects);

  return sendSuccess(res, 200, 'Developer overview retrieved successfully', {
    range: rangeView(range),
    totals: data.totals,
    keys: {
      total: scopedKeys.length,
      active: activeKeys.length,
      revoked: scopedKeys.filter((key) => key.status === 'revoked').length,
      test: scopedKeys.filter((key) => key.environment === 'test').length,
      live: scopedKeys.filter((key) => key.environment === 'live').length,
      activeTest: activeKeys.filter((key) => key.environment === 'test').length,
      activeLive: activeKeys.filter((key) => key.environment === 'live').length,
    },
    projects: {
      total: data.projects.length,
      withKeys: new Set(
        data.keys.map((key) => key.project_id).filter((id): id is string => Boolean(id))
      ).size,
    },
    requestsOverTime: data.series,
    usageByEndpoint: data.byEndpoint,
    usageByEnvironment: data.byEnvironment,
    recentActivity: data.recent.map((event) => toEventView(event, names)),
  });
}

/** GET /api/developer/usage?range=7d */
export async function getDeveloperUsage(
  user: UserRecord,
  res: ServerResponse,
  params: URLSearchParams
): Promise<void> {
  const range = parseRange(res, params.get('range'));
  if (!range) return;
  const projectId = projectFilter(res, params);
  if (projectId === undefined) return;

  const data = await runWithPersistenceErrors(res, async () => {
    const [totals, series, byEndpoint, byEnvironment] = await Promise.all([
      getUsageTotals(user.id, range, projectId),
      getUsageSeries(user.id, range, projectId),
      getUsageByEndpoint(user.id, range, projectId, 20),
      getUsageByEnvironment(user.id, range, projectId),
    ]);
    return { totals, series, byEndpoint, byEnvironment };
  });
  if (!data) return;

  return sendSuccess(res, 200, 'Usage analytics retrieved successfully', {
    range: rangeView(range),
    totals: data.totals,
    requestsOverTime: data.series,
    usageByEndpoint: data.byEndpoint,
    usageByEnvironment: data.byEnvironment,
  });
}

/** GET /api/developer/logs */
export async function getDeveloperLogs(
  user: UserRecord,
  res: ServerResponse,
  params: URLSearchParams
): Promise<void> {
  const filters = parseLogQuery(params);
  if (!filters.ok) {
    return sendError(res, 400, 'VALIDATION_ERROR', filters.message);
  }

  const data = await runWithPersistenceErrors(res, async () => {
    const [page, projects] = await Promise.all([
      listUsageLogs(user.id, filters.value),
      listProjectsForUser(user.id),
    ]);
    return { page, projects };
  });
  if (!data) return;

  const names = projectNameMap(data.projects);
  return sendSuccess(res, 200, 'API logs retrieved successfully', {
    logs: data.page.logs.map((event) => toEventView(event, names)),
    total: data.page.total,
    limit: data.page.limit,
    offset: data.page.offset,
    hasMore: data.page.offset + data.page.logs.length < data.page.total,
  });
}

/** GET /api/developer/logs/:id */
export async function getDeveloperLog(
  user: UserRecord,
  res: ServerResponse,
  rawId: string
): Promise<void> {
  const parsed = parseResourceId(rawId);
  if (!parsed.ok) {
    return sendError(res, 400, 'VALIDATION_ERROR', parsed.message);
  }

  const data = await runWithPersistenceErrors(res, async () => {
    const [event, projects] = await Promise.all([
      findUsageLogForUser(parsed.value, user.id),
      listProjectsForUser(user.id),
    ]);
    return { event, projects };
  });
  if (!data) return;
  if (!data.event) {
    return sendError(res, 404, 'LOG_NOT_FOUND', 'Request log not found.');
  }

  return sendSuccess(
    res,
    200,
    'Request log retrieved successfully',
    toEventView(data.event, projectNameMap(data.projects))
  );
}
