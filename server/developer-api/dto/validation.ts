import { isValidBase62 } from '../../short-code';

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function invalid<T = never>(message: string): ValidationResult<T> {
  return { ok: false, message };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Accepts only absolute http/https URLs and returns a normalized form.
 * Relative URLs, `javascript:`, `file:` and other schemes are rejected.
 */
export function parseHttpUrl(value: unknown, field: string): ValidationResult<string> {
  if (typeof value !== 'string') {
    return invalid(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return invalid(`${field} is required.`);
  }
  if (trimmed.length > 2048) {
    return invalid(`${field} must not exceed 2048 characters.`);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return invalid(`${field} must be a valid http or https URL.`);
    }
    if (!parsed.hostname) {
      return invalid(`${field} must be a valid http or https URL.`);
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return invalid(`${field} must be a valid http or https URL.`);
  }
}

export function parseOptionalTitle(value: unknown): ValidationResult<string | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== 'string') {
    return invalid('title must be a string.');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: undefined };
  }
  if (trimmed.length > 255) {
    return invalid('title must not exceed 255 characters.');
  }
  return { ok: true, value: trimmed };
}

export function parseOptionalAlias(value: unknown): ValidationResult<string | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== 'string') {
    return invalid('customAlias must be a string.');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: undefined };
  }
  if (trimmed.length > 50) {
    return invalid('customAlias must not exceed 50 characters.');
  }
  if (!isValidBase62(trimmed)) {
    return invalid('customAlias must contain only Base62 characters (A-Z, a-z, 0-9).');
  }
  return { ok: true, value: trimmed };
}

export function parseResourceId(value: string): ValidationResult<string> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    return invalid('Resource id is malformed.');
  }
  return { ok: true, value };
}

export interface Pagination {
  limit: number;
  offset: number;
}

export function parsePagination(params: URLSearchParams): ValidationResult<Pagination> {
  const rawLimit = params.get('limit');
  const rawOffset = params.get('offset');

  let limit = 20;
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      return invalid('limit must be an integer between 1 and 100.');
    }
    limit = parsed;
  }

  let offset = 0;
  if (rawOffset !== null) {
    const parsed = Number(rawOffset);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000) {
      return invalid('offset must be an integer between 0 and 100000.');
    }
    offset = parsed;
  }

  return { ok: true, value: { limit, offset } };
}

export function parseDays(params: URLSearchParams, fallback = 7): ValidationResult<number> {
  const raw = params.get('days');
  if (raw === null) {
    return { ok: true, value: fallback };
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 90) {
    return invalid('days must be an integer between 1 and 90.');
  }
  return { ok: true, value: parsed };
}
