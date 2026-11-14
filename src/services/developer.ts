import { authenticatedFetch, getApiBaseUrl, type ApiResponse } from './api';

/**
 * Developer dashboard API client.
 *
 * All calls use the existing Clerk bearer-token wrapper. Full API secrets are
 * only ever held in component memory while the one-time reveal modal is open;
 * nothing in this module writes credentials to storage or logs.
 */

export type DeveloperRange = '24h' | '7d' | '30d';
export type DeveloperEnvironment = 'test' | 'live';
export type DeveloperScope =
  | 'links:read'
  | 'links:write'
  | 'links:delete'
  | 'qr:read'
  | 'qr:write'
  | 'qr:delete'
  | 'analytics:read';

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DeveloperProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  keyCount: number;
  activeKeyCount: number;
  testKeyCount: number;
  liveKeyCount: number;
  environments: DeveloperEnvironment[];
  lastUsedAt: string | null;
}

export interface DeveloperApiKey {
  id: string;
  projectId: string | null;
  projectName: string;
  keyPrefix: string;
  environment: DeveloperEnvironment;
  scopes: DeveloperScope[];
  status: 'active' | 'revoked';
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  rotatedFromId: string | null;
}

export interface DeveloperApiKeyWithSecret extends DeveloperApiKey {
  apiKey: string;
}

export interface DeveloperUsageBucket {
  bucketStart: string;
  requests: number;
  success: number;
  failed: number;
}

export interface DeveloperEndpointUsage {
  endpoint: string;
  requests: number;
  success: number;
  failed: number;
  averageDurationMs: number;
}

export interface DeveloperEnvironmentUsage {
  environment: DeveloperEnvironment;
  requests: number;
  success: number;
  failed: number;
}

export interface DeveloperUsageTotals {
  requests: number;
  success: number;
  failed: number;
  averageDurationMs: number;
}

export interface DeveloperUsageRange {
  key: DeveloperRange;
  from: string;
  to: string;
  bucket: 'hour' | 'day';
  buckets: number;
  generatedAt: string;
}

export interface DeveloperOverview {
  range: DeveloperUsageRange;
  totals: DeveloperUsageTotals;
  keys: {
    total: number;
    active: number;
    revoked: number;
    test: number;
    live: number;
    activeTest: number;
    activeLive: number;
  };
  projects: { total: number; withKeys: number };
  requestsOverTime: DeveloperUsageBucket[];
  usageByEndpoint: DeveloperEndpointUsage[];
  usageByEnvironment: DeveloperEnvironmentUsage[];
  recentActivity: DeveloperUsageLog[];
}

export interface DeveloperUsage {
  range: DeveloperUsageRange;
  totals: DeveloperUsageTotals;
  requestsOverTime: DeveloperUsageBucket[];
  usageByEndpoint: DeveloperEndpointUsage[];
  usageByEnvironment: DeveloperEnvironmentUsage[];
}

export type DeveloperStatusGroup = 'success' | 'redirect' | 'client_error' | 'server_error';

export interface DeveloperUsageLog {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  statusGroup: DeveloperStatusGroup;
  durationMs: number;
  environment: DeveloperEnvironment;
  projectId: string | null;
  projectName: string | null;
  createdAt: string;
}

export interface DeveloperLogFilters {
  limit?: number;
  offset?: number;
  method?: string;
  status?: 'success' | 'failed';
  environment?: DeveloperEnvironment;
  projectId?: string;
  endpoint?: string;
  from?: string;
  to?: string;
}

export interface DeveloperLogPage {
  logs: DeveloperUsageLog[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface CreateDeveloperKeyInput {
  projectId: string;
  environment: DeveloperEnvironment;
  scopes: DeveloperScope[];
}

function withQuery(path: string, params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

export function apiErrorMessage(response: ApiResponse<unknown>, fallback: string): string {
  // The shared wrapper maps 401/403/5xx to safe copy; prefer that over raw text.
  if (response.error) return response.error;
  const message = (response.data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message.length > 0 ? message : fallback;
}

export function apiPayload<T>(response: ApiResponse<ApiEnvelope<T>>): T | null {
  if (!isSuccess(response.status) || !response.data?.data) return null;
  return response.data.data;
}

/** Mirrors the backend fallback for legacy keys without a project id. */
export function keysBelongingToProject(
  project: DeveloperProject,
  keys: DeveloperApiKey[]
): DeveloperApiKey[] {
  const name = project.name.trim().toLowerCase();
  return keys.filter(
    (key) =>
      key.projectId === project.id ||
      (key.projectId === null && key.projectName.trim().toLowerCase() === name)
  );
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function fetchDeveloperProjects(token: string) {
  return authenticatedFetch<ApiEnvelope<{ projects: DeveloperProject[]; total: number }>>(
    '/api/developer/projects',
    token
  );
}

export async function createDeveloperProject(token: string, name: string) {
  return authenticatedFetch<ApiEnvelope<DeveloperProject>>('/api/developer/projects', token, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function updateDeveloperProject(token: string, id: string, name: string) {
  return authenticatedFetch<ApiEnvelope<DeveloperProject>>(
    `/api/developer/projects/${encodeURIComponent(id)}`,
    token,
    { method: 'PATCH', body: JSON.stringify({ name }) }
  );
}

export async function deleteDeveloperProject(token: string, id: string) {
  return authenticatedFetch<ApiEnvelope<{ id: string }>>(
    `/api/developer/projects/${encodeURIComponent(id)}`,
    token,
    { method: 'DELETE' }
  );
}

export async function fetchDeveloperProject(token: string, id: string) {
  return authenticatedFetch<
    ApiEnvelope<{ project: DeveloperProject; keys: DeveloperApiKey[] }>
  >(`/api/developer/projects/${encodeURIComponent(id)}`, token);
}

// ---------------------------------------------------------------------------
// API keys (Phase 2 endpoints)
// ---------------------------------------------------------------------------

export async function fetchDeveloperKeys(token: string) {
  return authenticatedFetch<ApiEnvelope<{ keys: DeveloperApiKey[]; total: number }>>(
    '/api/developer/keys',
    token
  );
}

export async function createDeveloperKey(token: string, input: CreateDeveloperKeyInput) {
  return authenticatedFetch<ApiEnvelope<DeveloperApiKeyWithSecret>>(
    '/api/developer/keys',
    token,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export async function revokeDeveloperKey(token: string, id: string) {
  return authenticatedFetch<ApiEnvelope<DeveloperApiKey>>(
    `/api/developer/keys/${encodeURIComponent(id)}`,
    token,
    { method: 'DELETE' }
  );
}

export async function rotateDeveloperKey(token: string, id: string) {
  return authenticatedFetch<ApiEnvelope<DeveloperApiKeyWithSecret>>(
    `/api/developer/keys/${encodeURIComponent(id)}/rotate`,
    token,
    { method: 'POST' }
  );
}

// ---------------------------------------------------------------------------
// Analytics and logs
// ---------------------------------------------------------------------------

export async function fetchDeveloperOverview(
  token: string,
  range: DeveloperRange,
  projectId?: string | null
) {
  return authenticatedFetch<ApiEnvelope<DeveloperOverview>>(
    withQuery('/api/developer/overview', { range, projectId }),
    token
  );
}

export async function fetchDeveloperUsage(
  token: string,
  range: DeveloperRange,
  projectId?: string | null
) {
  return authenticatedFetch<ApiEnvelope<DeveloperUsage>>(
    withQuery('/api/developer/usage', { range, projectId }),
    token
  );
}

export async function fetchDeveloperLogs(token: string, filters: DeveloperLogFilters) {
  return authenticatedFetch<ApiEnvelope<DeveloperLogPage>>(
    withQuery('/api/developer/logs', {
      limit: filters.limit,
      offset: filters.offset,
      method: filters.method,
      status: filters.status,
      environment: filters.environment,
      projectId: filters.projectId,
      endpoint: filters.endpoint,
      from: filters.from,
      to: filters.to,
    }),
    token
  );
}

export async function fetchDeveloperLog(token: string, id: string) {
  return authenticatedFetch<ApiEnvelope<DeveloperUsageLog>>(
    `/api/developer/logs/${encodeURIComponent(id)}`,
    token
  );
}

// ---------------------------------------------------------------------------
// Settings / diagnostics
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  database: string;
  databaseLatencyMs: number | null;
  timestamp: string;
}

/** Unauthenticated health probe used by the settings page. */
export async function fetchApiHealth(): Promise<HealthResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/health`, {
      signal: controller.signal,
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!body || typeof body.status !== 'string') {
      throw new Error('The server returned an unexpected health response.');
    }
    return body as HealthResponse;
  } finally {
    clearTimeout(timeout);
  }
}
