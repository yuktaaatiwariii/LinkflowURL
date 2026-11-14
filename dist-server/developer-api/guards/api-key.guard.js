"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateApiKey = authenticateApiKey;
const api_key_crypto_1 = require("../keys/api-key-crypto");
const api_key_store_1 = require("../keys/api-key.store");
function reject(status, code, message) {
    return { ok: false, status, code, message };
}
function readHeader(value) {
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
function isPersistenceError(err) {
    return err instanceof api_key_store_1.PersistenceUnavailableError;
}
async function authenticateApiKey(req, deps) {
    const presentedKey = readHeader(req.headers['x-api-key']);
    if (!presentedKey) {
        return reject(401, 'MISSING_API_KEY', 'An API key is required in the X-API-Key header.');
    }
    // Fail closed everywhere when hashing is not configured: never store or
    // verify credentials with a weaker fallback.
    if (!(0, api_key_crypto_1.isApiKeyHashingConfigured)()) {
        return reject(503, 'API_KEY_HASH_NOT_CONFIGURED', 'Developer API key hashing is not configured on this server.');
    }
    const parsed = (0, api_key_crypto_1.parseApiKey)(presentedKey);
    if (!parsed) {
        // Same response for malformed and unknown keys: no enumeration signal.
        return reject(401, 'INVALID_API_KEY', 'Invalid API credentials.');
    }
    let record;
    try {
        record = await (0, api_key_store_1.findApiKeyByPrefix)(parsed.prefix);
    }
    catch (err) {
        if (isPersistenceError(err)) {
            return reject(503, 'DATABASE_NOT_CONFIGURED', 'Developer API key persistence is not configured on this server.');
        }
        throw err;
    }
    if (!record || record.environment !== parsed.environment) {
        return reject(401, 'INVALID_API_KEY', 'Invalid API credentials.');
    }
    if (!(0, api_key_crypto_1.verifyApiKeySecret)(parsed.secret, record.key_hash)) {
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
        return reject(403, 'DEVELOPER_NOT_PROVISIONED', 'The developer account for this API key no longer exists.');
    }
    // Throttled metadata update; never blocks or fails the request.
    (0, api_key_store_1.touchApiKeyLastUsed)(record.id);
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
