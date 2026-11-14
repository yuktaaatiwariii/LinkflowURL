"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyHashSecretMissingError = exports.API_ENVIRONMENTS = exports.API_SCOPES = void 0;
exports.isApiKeyHashingConfigured = isApiKeyHashingConfigured;
exports.generateApiKey = generateApiKey;
exports.parseApiKey = parseApiKey;
exports.hashApiKeySecret = hashApiKeySecret;
exports.verifyApiKeySecret = verifyApiKeySecret;
exports.isDeveloperApiScope = isDeveloperApiScope;
exports.isDeveloperApiEnvironment = isDeveloperApiEnvironment;
const crypto_1 = __importDefault(require("crypto"));
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
exports.API_SCOPES = [
    'links:read',
    'links:write',
    'links:delete',
    'qr:read',
    'qr:write',
    'qr:delete',
    'analytics:read',
];
exports.API_ENVIRONMENTS = ['test', 'live'];
const KEY_PATTERN = /^lf_(test|live)_([0-9a-f]{16})_([A-Za-z0-9_-]{43})$/;
const SECRET_BYTES = 32;
const PREFIX_BYTES = 8;
const MIN_HASH_SECRET_LENGTH = 32;
class ApiKeyHashSecretMissingError extends Error {
    constructor(message = 'API_KEY_HASH_SECRET is not configured or too short.') {
        super(message);
        this.name = 'ApiKeyHashSecretMissingError';
    }
}
exports.ApiKeyHashSecretMissingError = ApiKeyHashSecretMissingError;
function hashSecret() {
    const secret = (process.env.API_KEY_HASH_SECRET || '').trim();
    if (secret.length < MIN_HASH_SECRET_LENGTH) {
        throw new ApiKeyHashSecretMissingError();
    }
    return secret;
}
/** True when `API_KEY_HASH_SECRET` exists and is long enough to be usable. */
function isApiKeyHashingConfigured() {
    try {
        hashSecret();
        return true;
    }
    catch {
        return false;
    }
}
function generateApiKey(environment) {
    const prefix = crypto_1.default.randomBytes(PREFIX_BYTES).toString('hex');
    const secret = crypto_1.default.randomBytes(SECRET_BYTES).toString('base64url');
    return {
        fullKey: `lf_${environment}_${prefix}_${secret}`,
        prefix,
        secret,
        environment,
    };
}
function parseApiKey(value) {
    const match = KEY_PATTERN.exec(value);
    if (!match)
        return null;
    return {
        environment: match[1],
        prefix: match[2],
        secret: match[3],
    };
}
/**
 * Derives the stored credential hash. Throws when the dedicated hashing secret
 * is missing so callers can fail closed instead of storing anything weaker.
 */
function hashApiKeySecret(secret) {
    return crypto_1.default.createHmac('sha256', hashSecret()).update(secret, 'utf8').digest('hex');
}
/** Constant-time comparison of two hex HMAC digests. */
function verifyApiKeySecret(secret, storedHash) {
    let computed;
    let stored;
    try {
        computed = Buffer.from(hashApiKeySecret(secret), 'hex');
        stored = Buffer.from(storedHash, 'hex');
    }
    catch {
        return false;
    }
    if (computed.length !== stored.length || computed.length === 0)
        return false;
    return crypto_1.default.timingSafeEqual(computed, stored);
}
function isDeveloperApiScope(value) {
    return typeof value === 'string' && exports.API_SCOPES.includes(value);
}
function isDeveloperApiEnvironment(value) {
    return value === 'test' || value === 'live';
}
