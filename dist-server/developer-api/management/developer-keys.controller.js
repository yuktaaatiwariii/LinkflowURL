"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiKey = createApiKey;
exports.listApiKeys = listApiKeys;
exports.getApiKey = getApiKey;
exports.revokeDeveloperApiKey = revokeDeveloperApiKey;
exports.rotateDeveloperApiKey = rotateDeveloperApiKey;
const create_api_key_dto_1 = require("../dto/create-api-key.dto");
const validation_1 = require("../dto/validation");
const body_1 = require("../http/body");
const envelope_1 = require("../http/envelope");
const api_key_crypto_1 = require("../keys/api-key-crypto");
const api_key_presenter_1 = require("../keys/api-key.presenter");
const api_key_store_1 = require("../keys/api-key.store");
const project_store_1 = require("../projects/project.store");
/**
 * JWT-authenticated API key management.
 *
 * Every handler receives the already-authenticated owner resolved from the
 * Bearer token. Ownership is enforced by passing `user.id` into every store
 * query, so a caller can never read or mutate another account's keys.
 *
 * Responses carry metadata only except `create` and `rotate`, which return the
 * full secret exactly once.
 */
const KEY_NOT_FOUND = 'API key not found.';
function sendPersistenceFailure(res, err) {
    if (err instanceof api_key_crypto_1.ApiKeyHashSecretMissingError) {
        (0, envelope_1.sendError)(res, 503, 'API_KEY_HASH_NOT_CONFIGURED', 'Developer API key hashing is not configured on this server.');
        return true;
    }
    if (err instanceof api_key_store_1.PersistenceUnavailableError) {
        (0, envelope_1.sendError)(res, 503, 'DATABASE_NOT_CONFIGURED', 'Developer API key persistence is not configured on this server.');
        return true;
    }
    return false;
}
async function runWithPersistenceErrors(res, operation) {
    try {
        return await operation();
    }
    catch (err) {
        if (sendPersistenceFailure(res, err))
            return null;
        throw err;
    }
}
function hashConfigured(res) {
    if ((0, api_key_crypto_1.isApiKeyHashingConfigured)())
        return true;
    (0, envelope_1.sendError)(res, 503, 'API_KEY_HASH_NOT_CONFIGURED', 'Developer API key hashing is not configured on this server.');
    return false;
}
function parseKeyId(res, rawId) {
    const parsed = (0, validation_1.parseResourceId)(rawId);
    if (!parsed.ok) {
        (0, envelope_1.sendError)(res, 400, 'VALIDATION_ERROR', parsed.message);
        return null;
    }
    return parsed.value;
}
/** POST /api/developer/keys */
async function createApiKey(user, req, res) {
    const body = await (0, body_1.readJsonBody)(req);
    if (!body.ok) {
        return (0, envelope_1.sendError)(res, body.status, body.code, body.message);
    }
    const dto = (0, create_api_key_dto_1.parseCreateApiKeyDto)(body.value);
    if (!dto.ok) {
        return (0, envelope_1.sendError)(res, 400, 'VALIDATION_ERROR', dto.message);
    }
    if (!hashConfigured(res))
        return;
    let project = null;
    try {
        if (dto.value.projectId) {
            project = await (0, project_store_1.findProjectForUser)(dto.value.projectId, user.id);
            if (!project) {
                return (0, envelope_1.sendError)(res, 404, 'PROJECT_NOT_FOUND', 'Project not found.');
            }
        }
        else if (dto.value.projectName) {
            // Phase 2 compatibility: a projectName creates the project on demand.
            project = await (0, project_store_1.insertProject)(user.id, dto.value.projectName);
        }
    }
    catch (err) {
        if (sendPersistenceFailure(res, err))
            return;
        throw err;
    }
    if (!project) {
        return (0, envelope_1.sendError)(res, 400, 'VALIDATION_ERROR', 'projectName or projectId is required.');
    }
    const generated = (0, api_key_crypto_1.generateApiKey)(dto.value.environment);
    let record = null;
    try {
        record = await (0, api_key_store_1.insertApiKey)({
            userId: user.id,
            projectId: project.id,
            projectName: project.name,
            keyPrefix: generated.prefix,
            keyHash: (0, api_key_crypto_1.hashApiKeySecret)(generated.secret),
            environment: dto.value.environment,
            scopes: dto.value.scopes,
            expiresAt: dto.value.expiresAt,
        });
    }
    catch (err) {
        if (sendPersistenceFailure(res, err))
            return;
        throw err;
    }
    return (0, envelope_1.sendSuccess)(res, 201, 'API key created successfully', (0, api_key_presenter_1.toApiKeyWithSecret)(record, generated.fullKey));
}
/** GET /api/developer/keys */
async function listApiKeys(user, res) {
    const records = await runWithPersistenceErrors(res, () => (0, api_key_store_1.listApiKeysForUser)(user.id));
    if (!records)
        return;
    return (0, envelope_1.sendSuccess)(res, 200, 'API keys retrieved successfully', {
        keys: records.map(api_key_presenter_1.toApiKeyMetadata),
        total: records.length,
    });
}
/** GET /api/developer/keys/:id */
async function getApiKey(user, res, rawId) {
    const id = parseKeyId(res, rawId);
    if (!id)
        return;
    const record = await runWithPersistenceErrors(res, () => (0, api_key_store_1.findApiKeyForUser)(id, user.id));
    if (!record) {
        return (0, envelope_1.sendError)(res, 404, 'API_KEY_NOT_FOUND', KEY_NOT_FOUND);
    }
    return (0, envelope_1.sendSuccess)(res, 200, 'API key retrieved successfully', (0, api_key_presenter_1.toApiKeyMetadata)(record));
}
/** DELETE /api/developer/keys/:id */
async function revokeDeveloperApiKey(user, res, rawId) {
    const id = parseKeyId(res, rawId);
    if (!id)
        return;
    const record = await runWithPersistenceErrors(res, () => (0, api_key_store_1.revokeApiKey)(id, user.id));
    if (!record) {
        return (0, envelope_1.sendError)(res, 404, 'API_KEY_NOT_FOUND', KEY_NOT_FOUND);
    }
    return (0, envelope_1.sendSuccess)(res, 200, 'API key revoked successfully', (0, api_key_presenter_1.toApiKeyMetadata)(record));
}
/** POST /api/developer/keys/:id/rotate */
async function rotateDeveloperApiKey(user, res, rawId) {
    const id = parseKeyId(res, rawId);
    if (!id)
        return;
    if (!hashConfigured(res))
        return;
    // Read the existing record first: the environment is immutable and must be
    // encoded into the replacement secret. Status/expiry are re-checked inside
    // the store's transaction so a concurrent rotation cannot be bypassed.
    const existing = await runWithPersistenceErrors(res, () => (0, api_key_store_1.findApiKeyForUser)(id, user.id));
    if (!existing) {
        return (0, envelope_1.sendError)(res, 404, 'API_KEY_NOT_FOUND', KEY_NOT_FOUND);
    }
    if (existing.status !== 'active') {
        return (0, envelope_1.sendError)(res, 409, 'API_KEY_REVOKED', 'This API key has been revoked.');
    }
    if (existing.expires_at && new Date(existing.expires_at).getTime() <= Date.now()) {
        return (0, envelope_1.sendError)(res, 409, 'API_KEY_EXPIRED', 'This API key has expired.');
    }
    const generated = (0, api_key_crypto_1.generateApiKey)(existing.environment);
    const result = await runWithPersistenceErrors(res, () => (0, api_key_store_1.rotateApiKey)(id, user.id, {
        keyPrefix: generated.prefix,
        keyHash: (0, api_key_crypto_1.hashApiKeySecret)(generated.secret),
    }));
    if (!result)
        return;
    if (!result.ok) {
        if (result.reason === 'not_found') {
            return (0, envelope_1.sendError)(res, 404, 'API_KEY_NOT_FOUND', KEY_NOT_FOUND);
        }
        if (result.reason === 'revoked') {
            return (0, envelope_1.sendError)(res, 409, 'API_KEY_REVOKED', 'This API key has been revoked.');
        }
        return (0, envelope_1.sendError)(res, 409, 'API_KEY_EXPIRED', 'This API key has expired.');
    }
    return (0, envelope_1.sendSuccess)(res, 200, 'API key rotated successfully', (0, api_key_presenter_1.toApiKeyWithSecret)(result.created, generated.fullKey));
}
