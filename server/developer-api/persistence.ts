import { getDatabasePool } from '../db';

/**
 * Shared persistence guard for developer-dashboard stores.
 *
 * PostgreSQL is authoritative in production. The in-memory repositories only
 * exist for local development and tests; production fails closed instead of
 * silently accepting non-durable dashboard data.
 */
export class PersistenceUnavailableError extends Error {
  readonly code = 'DATABASE_NOT_CONFIGURED';

  constructor(
    message = 'PostgreSQL DATABASE_URL is required for developer dashboard persistence in production.'
  ) {
    super(message);
    this.name = 'PersistenceUnavailableError';
  }
}

/** Returns true when the in-memory fallback may be used. */
export function useMemoryStore(): boolean {
  if (getDatabasePool()) return false;
  if (process.env.NODE_ENV === 'production') {
    throw new PersistenceUnavailableError();
  }
  return true;
}

/** ISO-normalizes PostgreSQL timestamps (which arrive as Date objects). */
export function toIso(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * PostgreSQL `22P02`: invalid text representation, e.g. a regex-valid id that
 * is not a UUID being compared against a `uuid` column. Callers treat this as
 * "not found" so malformed ids never surface as 500 errors.
 */
export function isInvalidUuidError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '22P02'
  );
}
