import {
  API_SCOPES,
  isDeveloperApiEnvironment,
  isDeveloperApiScope,
} from '../keys/api-key-crypto';
import {
  invalid,
  isPlainObject,
  parseResourceId,
  type ValidationResult,
} from './validation';
import type { DeveloperApiKeyEnvironment, DeveloperApiScope } from '../../types';

export interface CreateApiKeyDtoInput {
  /** Phase 3 project reference. When set it takes precedence over projectName. */
  projectId: string | null;
  /** Phase 2-compatible project name; auto-creates a project when needed. */
  projectName: string | null;
  environment: DeveloperApiKeyEnvironment;
  scopes: DeveloperApiScope[];
  expiresAt: string | null;
}

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

function parseProjectName(value: unknown): ValidationResult<string | null> {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return invalid('projectName must be a string.');
  }
  const trimmed = value.trim();
  if (trimmed.length < 1) {
    return invalid('projectName is required.');
  }
  if (trimmed.length > 100) {
    return invalid('projectName must not exceed 100 characters.');
  }
  if (CONTROL_CHARACTERS.test(trimmed)) {
    return invalid('projectName must not contain control characters.');
  }
  return { ok: true, value: trimmed };
}

function parseProjectId(value: unknown): ValidationResult<string | null> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return invalid('projectId must be a string.');
  }
  const parsed = parseResourceId(value);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value };
}

function parseScopes(value: unknown): ValidationResult<DeveloperApiScope[]> {
  if (!Array.isArray(value)) {
    return invalid('scopes must be an array of scope strings.');
  }
  if (value.length === 0) {
    return invalid('scopes must contain at least one scope.');
  }
  if (value.length > API_SCOPES.length) {
    return invalid(`scopes must contain at most ${API_SCOPES.length} entries.`);
  }

  const scopes: DeveloperApiScope[] = [];
  for (const entry of value) {
    if (!isDeveloperApiScope(entry)) {
      return invalid(
        `Unknown scope. Supported scopes: ${API_SCOPES.join(', ')}.`
      );
    }
    if (scopes.includes(entry)) {
      return invalid(`Duplicate scope: ${entry}.`);
    }
    scopes.push(entry);
  }
  return { ok: true, value: scopes };
}

function parseExpiresAt(value: unknown): ValidationResult<string | null> {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return invalid('expiresAt must be an ISO 8601 date string or null.');
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return invalid('expiresAt must be a valid ISO 8601 date string.');
  }
  if (timestamp <= Date.now()) {
    return invalid('expiresAt must be in the future.');
  }
  return { ok: true, value: new Date(timestamp).toISOString() };
}

/** DTO for `POST /api/developer/keys`. */
export function parseCreateApiKeyDto(body: unknown): ValidationResult<CreateApiKeyDtoInput> {
  if (!isPlainObject(body)) {
    return invalid('Request body must be a JSON object.');
  }

  const projectId = parseProjectId(body.projectId);
  if (!projectId.ok) return projectId;

  const projectName = parseProjectName(body.projectName);
  if (!projectName.ok) return projectName;

  if (!projectId.value && !projectName.value) {
    return invalid('projectName or projectId is required.');
  }

  if (!isDeveloperApiEnvironment(body.environment)) {
    return invalid('environment must be either "test" or "live".');
  }

  const scopes = parseScopes(body.scopes);
  if (!scopes.ok) return scopes;

  const expiresAt = parseExpiresAt(body.expiresAt);
  if (!expiresAt.ok) return expiresAt;

  return {
    ok: true,
    value: {
      projectId: projectId.value,
      projectName: projectName.value,
      environment: body.environment,
      scopes: scopes.value,
      expiresAt: expiresAt.value,
    },
  };
}
