"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toApiKeyMetadata = toApiKeyMetadata;
exports.toApiKeyWithSecret = toApiKeyWithSecret;
function toApiKeyMetadata(record) {
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
function toApiKeyWithSecret(record, apiKey) {
    return {
        ...toApiKeyMetadata(record),
        apiKey,
    };
}
