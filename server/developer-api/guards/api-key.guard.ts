import type { IncomingMessage } from 'http';
import type { ApiDeveloper, DeveloperApiDependencies } from '../interfaces/api-developer.interface';
import {
  isApiKeyHashingConfigured,
  parseApiKey,
  verifyApiKeySecret,
} from '../keys/api-key-crypto';
import {
  PersistenceUnavailableError,
  findApiKeyByPrefix,
  touchApiKeyLastUsed,
} from '../keys/api-key.store';

/**
 * Phase 2 API-key authentication.
 *
 * Flow: header -> format -> prefix lookup -> HMAC verification -> status ->
 * expiry -> environment -> identity. Revoked/expired codes are only revealed
 * after the secret verifies, so unauthenticated probes cannot enumerate key
 * state. Bootstrap env credentials are gone; only persisted keys authenticate.
 *
 * Independent from Clerk JWT: API keys cannot access user routes and JWTs
 * cannot access `/api/v1/*`.
 */

export type ApiKeyAuthResult =
  | { ok: true; developer: ApiDeveloper }
  | { ok: false; status: number; code: string; message: string };

function reject(status: number, code: string, message: string): ApiKeyAuthResult {
  return { ok: false, status, code, message };
}

function readHeader(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    const trimmed = value[0].trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function isPersistenceError(err: unknown): boolean {
  return err instanceof PersistenceUnavailableError;
}

export async function authenticateApiKey(
  req: IncomingMessage,
  deps: DeveloperApiDependencies
): Promise<ApiKeyAuthResult> {
  const presentedKey = readHeader(req.headers['x-api-key']);
  if (!presentedKey) {
    return reject(401, 'MISSING_API_KEY', 'An API key is required in the X-API-Key header.');
  }

  // Fail closed everywhere when hashing is not configured: never store or
  // verify credentials with a weaker fallback.
  if (!isApiKeyHashingConfigured()) {
    return reject(
      503,
      'API_KEY_HASH_NOT_CONFIGURED',
      'Developer API key hashing is not configured on this server.'
    );
  }

  const parsed = parseApiKey(presentedKey);
  if (!parsed) {
    // Same response for malformed and unknown keys: no enumeration signal.
    return reject(401, 'INVALID_API_KEY', 'Invalid API credentials.');
  }

  let record;
  try {
    record = await findApiKeyByPrefix(parsed.prefix);
  } catch (err) {
    if (isPersistenceError(err)) {
      return reject(
        503,
        'DATABASE_NOT_CONFIGURED',
        'Developer API key persistence is not configured on this server.'
      );
    }
    throw err;
  }

  if (!record || record.environment !== parsed.environment) {
    return reject(401, 'INVALID_API_KEY', 'Invalid API credentials.');
  }

  if (!verifyApiKeySecret(parsed.secret, record.key_hash)) {
    return reject(401, 'INVALID_API_KEY', 'Invalid API credentials.');
  }

  if (record.status !== 'active') {
    return reject(401, 'API_KEY_REVOKED', 'This API key has been revoked.');
  }

  if (record.expires_at && new Date(record.expires_at).getTime() <= Date.now()) {
    return reject(401, 'API_KEY_EXPIRED', 'This API key has expired.');
  }

  const user = await deps.getUserById(record.user_id);
  if (!user) {
    return reject(
      403,
      'DEVELOPER_NOT_PROVISIONED',
      'The developer account for this API key no longer exists.'
    );
  }

  // Throttled metadata update; never blocks or fails the request.
  touchApiKeyLastUsed(record.id);

  return {
    ok: true,
    developer: {
      userId: user.id,
      clerkUserId: user.clerk_user_id,
      email: user.email,
      fullName: user.full_name,
      apiKeyId: record.id,
      projectId: record.project_id,
      environment: record.environment,
      scopes: record.scopes,
    },
  };
}
