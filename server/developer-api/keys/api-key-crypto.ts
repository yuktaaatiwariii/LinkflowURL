import crypto from 'crypto';
import type {
  DeveloperApiKeyEnvironment,
  DeveloperApiScope,
} from '../../types';

/**
 * API key format, generation and hashing.
 *
 *   lf_<test|live>_<lookup-prefix>_<secret>
 *   e.g. lf_live_9f2c71a04b8de613_<43 base64url chars>
 *
 * - `lookup-prefix`: 16 hex chars (64 bits) used only to find the record
 *   efficiently. It is not secret and cannot authenticate on its own.
 * - `secret`: 32 random bytes (256 bits) encoded as base64url.
 * - Stored credential: HMAC-SHA256(secret, API_KEY_HASH_SECRET), hex.
 *
 * The plaintext key is returned exactly once, at creation or rotation.
 */

export const API_SCOPES: readonly DeveloperApiScope[] = [
  'links:read',
  'links:write',
  'links:delete',
  'qr:read',
  'qr:write',
  'qr:delete',
  'analytics:read',
];

export const API_ENVIRONMENTS: readonly DeveloperApiKeyEnvironment[] = ['test', 'live'];

const KEY_PATTERN = /^lf_(test|live)_([0-9a-f]{16})_([A-Za-z0-9_-]{43})$/;
const SECRET_BYTES = 32;
const PREFIX_BYTES = 8;
const MIN_HASH_SECRET_LENGTH = 32;

export interface GeneratedApiKey {
  fullKey: string;
  prefix: string;
  secret: string;
  environment: DeveloperApiKeyEnvironment;
}

export interface ParsedApiKey {
  environment: DeveloperApiKeyEnvironment;
  prefix: string;
  secret: string;
}

export class ApiKeyHashSecretMissingError extends Error {
  constructor(message = 'API_KEY_HASH_SECRET is not configured or too short.') {
    super(message);
    this.name = 'ApiKeyHashSecretMissingError';
  }
}

function hashSecret(): string {
  const secret = (process.env.API_KEY_HASH_SECRET || '').trim();
  if (secret.length < MIN_HASH_SECRET_LENGTH) {
    throw new ApiKeyHashSecretMissingError();
  }
  return secret;
}

/** True when `API_KEY_HASH_SECRET` exists and is long enough to be usable. */
export function isApiKeyHashingConfigured(): boolean {
  try {
    hashSecret();
    return true;
  } catch {
    return false;
  }
}

export function generateApiKey(environment: DeveloperApiKeyEnvironment): GeneratedApiKey {
  const prefix = crypto.randomBytes(PREFIX_BYTES).toString('hex');
  const secret = crypto.randomBytes(SECRET_BYTES).toString('base64url');
  return {
    fullKey: `lf_${environment}_${prefix}_${secret}`,
    prefix,
    secret,
    environment,
  };
}

export function parseApiKey(value: string): ParsedApiKey | null {
  const match = KEY_PATTERN.exec(value);
  if (!match) return null;
  return {
    environment: match[1] as DeveloperApiKeyEnvironment,
    prefix: match[2],
    secret: match[3],
  };
}

/**
 * Derives the stored credential hash. Throws when the dedicated hashing secret
 * is missing so callers can fail closed instead of storing anything weaker.
 */
export function hashApiKeySecret(secret: string): string {
  return crypto.createHmac('sha256', hashSecret()).update(secret, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex HMAC digests. */
export function verifyApiKeySecret(secret: string, storedHash: string): boolean {
  let computed: Buffer;
  let stored: Buffer;
  try {
    computed = Buffer.from(hashApiKeySecret(secret), 'hex');
    stored = Buffer.from(storedHash, 'hex');
  } catch {
    return false;
  }
  if (computed.length !== stored.length || computed.length === 0) return false;
  return crypto.timingSafeEqual(computed, stored);
}

export function isDeveloperApiScope(value: unknown): value is DeveloperApiScope {
  return typeof value === 'string' && (API_SCOPES as readonly string[]).includes(value);
}

export function isDeveloperApiEnvironment(
  value: unknown
): value is DeveloperApiKeyEnvironment {
  return value === 'test' || value === 'live';
}
