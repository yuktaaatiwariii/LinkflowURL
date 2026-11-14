/**
 * Shared persistence record shapes.
 *
 * These interfaces mirror the PostgreSQL rows and the in-memory fallback
 * records. They live in their own module so the developer API (and any other
 * module) can depend on them without importing the HTTP server entry point.
 */

export interface UserRecord {
  id: string;
  clerk_user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkRecord {
  id: string;
  user_id: string;
  original_url: string;
  short_code: string;
  custom_alias: string | null;
  title: string | null;
  is_active: boolean;
  expires_at: string | null;
  clicks_count: number;
  created_at: string;
  updated_at: string;
}

export interface QrRecord {
  id: string;
  user_id: string;
  link_id: string | null;
  title: string;
  target_url: string;
  created_at: string;
  updated_at: string;
}

export type DeveloperApiKeyEnvironment = 'test' | 'live';
export type DeveloperApiKeyStatus = 'active' | 'revoked';

export type DeveloperApiScope =
  | 'links:read'
  | 'links:write'
  | 'links:delete'
  | 'qr:read'
  | 'qr:write'
  | 'qr:delete'
  | 'analytics:read';

/**
 * Persisted developer API key metadata.
 *
 * `key_hash` is an HMAC-SHA256 digest of the secret part of the key. The
 * plaintext secret is never stored and is only returned once, at creation or
 * rotation time.
 */
export interface DeveloperApiKeyRecord {
  id: string;
  user_id: string;
  /**
   * Phase 3 project entity. `project_name` is kept and mirrored for backward
   * compatibility with Phase 2 records and clients.
   */
  project_id: string | null;
  project_name: string;
  key_prefix: string;
  key_hash: string;
  environment: DeveloperApiKeyEnvironment;
  scopes: DeveloperApiScope[];
  status: DeveloperApiKeyStatus;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  rotated_from_id: string | null;
}

/** Phase 3: groups API keys into an application. */
export interface DeveloperProjectRecord {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Phase 3: one persisted public-API request.
 *
 * Deliberately contains no credentials, headers or request bodies. `endpoint`
 * is a normalized route pattern (identifiers collapsed to `:id`) so grouping
 * and search stay stable and no user data leaks into analytics.
 */
export interface DeveloperApiUsageEventRecord {
  id: string;
  user_id: string;
  api_key_id: string | null;
  project_id: string | null;
  endpoint: string;
  method: string;
  environment: DeveloperApiKeyEnvironment;
  status_code: number;
  duration_ms: number;
  created_at: string;
}
