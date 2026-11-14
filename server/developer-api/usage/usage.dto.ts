import { isDeveloperApiEnvironment } from '../keys/api-key-crypto';
import {
  invalid,
  parsePagination,
  parseResourceId,
  type ValidationResult,
} from '../dto/validation';
import type { DeveloperApiKeyEnvironment } from '../../types';
import type { UsageLogFilters } from './usage.store';

export interface UsageFilter {
  projectId: string | null;
}

/** Optional `projectId` filter shared by overview/usage/logs. */
export function parseUsageProjectFilter(params: URLSearchParams): ValidationResult<UsageFilter> {
  const raw = params.get('projectId');
  if (raw === null || raw === '') return { ok: true, value: { projectId: null } };
  const parsed = parseResourceId(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, value: { projectId: parsed.value } };
}

const METHOD_PATTERN = /^[A-Za-z]{1,10}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

function parseDate(value: string | null, field: string): ValidationResult<string | undefined> {
  if (value === null || value === '') return { ok: true, value: undefined };
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return invalid(`${field} must be a valid ISO 8601 date string.`);
  }
  return { ok: true, value: new Date(timestamp).toISOString() };
}

/** Validates `GET /api/developer/logs` query parameters. */
export function parseLogQuery(params: URLSearchParams): ValidationResult<UsageLogFilters> {
  const pagination = parsePagination(params);
  if (!pagination.ok) return pagination;

  const methodRaw = params.get('method');
  let method: string | undefined;
  if (methodRaw !== null && methodRaw !== '' && methodRaw.toUpperCase() !== 'ALL') {
    if (!METHOD_PATTERN.test(methodRaw)) {
      return invalid('method must be a valid HTTP method.');
    }
    method = methodRaw.toUpperCase();
  }

  const statusRaw = params.get('status');
  let status: 'success' | 'failed' | undefined;
  if (statusRaw !== null && statusRaw !== '' && statusRaw !== 'all') {
    if (statusRaw !== 'success' && statusRaw !== 'failed') {
      return invalid('status must be either "success" or "failed".');
    }
    status = statusRaw;
  }

  const statusCodeRaw = params.get('statusCode');
  let statusCode: number | undefined;
  if (statusCodeRaw !== null && statusCodeRaw !== '') {
    const parsed = Number(statusCodeRaw);
    if (!Number.isInteger(parsed) || parsed < 100 || parsed > 599) {
      return invalid('statusCode must be an integer between 100 and 599.');
    }
    statusCode = parsed;
  }

  const environmentRaw = params.get('environment');
  let environment: DeveloperApiKeyEnvironment | undefined;
  if (environmentRaw !== null && environmentRaw !== '' && environmentRaw !== 'all') {
    if (!isDeveloperApiEnvironment(environmentRaw)) {
      return invalid('environment must be either "test" or "live".');
    }
    environment = environmentRaw;
  }

  const project = parseUsageProjectFilter(params);
  if (!project.ok) return project;

  const endpointRaw = params.get('endpoint');
  let endpoint: string | undefined;
  if (endpointRaw !== null && endpointRaw.trim() !== '') {
    const trimmed = endpointRaw.trim();
    if (trimmed.length > 100) {
      return invalid('endpoint must not exceed 100 characters.');
    }
    if (CONTROL_CHARACTERS.test(trimmed)) {
      return invalid('endpoint must not contain control characters.');
    }
    endpoint = trimmed;
  }

  const from = parseDate(params.get('from'), 'from');
  if (!from.ok) return from;
  const to = parseDate(params.get('to'), 'to');
  if (!to.ok) return to;
  if (from.value && to.value && Date.parse(from.value) >= Date.parse(to.value)) {
    return invalid('from must be earlier than to.');
  }

  return {
    ok: true,
    value: {
      limit: pagination.value.limit,
      offset: pagination.value.offset,
      method,
      status,
      statusCode,
      environment,
      projectId: project.value.projectId || undefined,
      endpoint,
      from: from.value,
      to: to.value,
    },
  };
}
