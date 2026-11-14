import type { DeveloperApiKeyRecord } from '../../types';

/** Public metadata for an API key. Never contains the secret or its hash. */
export interface ApiKeyMetadata {
  id: string;
  projectId: string | null;
  projectName: string;
  keyPrefix: string;
  environment: DeveloperApiKeyRecord['environment'];
  scopes: DeveloperApiKeyRecord['scopes'];
  status: DeveloperApiKeyRecord['status'];
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  rotatedFromId: string | null;
}

export function toApiKeyMetadata(record: DeveloperApiKeyRecord): ApiKeyMetadata {
  return {
    id: record.id,
    projectId: record.project_id,
    projectName: record.project_name,
    keyPrefix: record.key_prefix,
    environment: record.environment,
    scopes: [...record.scopes],
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    lastUsedAt: record.last_used_at,
    expiresAt: record.expires_at,
    revokedAt: record.revoked_at,
    rotatedFromId: record.rotated_from_id,
  };
}

/**
 * Creation/rotation payload. `apiKey` is the only time the full secret is
 * returned; every other endpoint returns metadata only.
 */
export function toApiKeyWithSecret(record: DeveloperApiKeyRecord, apiKey: string) {
  return {
    ...toApiKeyMetadata(record),
    apiKey,
  };
}
