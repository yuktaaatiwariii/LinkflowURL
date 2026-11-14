"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCreateApiKeyDto = parseCreateApiKeyDto;
const api_key_crypto_1 = require("../keys/api-key-crypto");
const validation_1 = require("./validation");
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
function parseProjectName(value) {
    if (value === undefined || value === null) {
        return { ok: true, value: null };
    }
    if (typeof value !== 'string') {
        return (0, validation_1.invalid)('projectName must be a string.');
    }
    const trimmed = value.trim();
    if (trimmed.length < 1) {
        return (0, validation_1.invalid)('projectName is required.');
    }
    if (trimmed.length > 100) {
        return (0, validation_1.invalid)('projectName must not exceed 100 characters.');
    }
    if (CONTROL_CHARACTERS.test(trimmed)) {
        return (0, validation_1.invalid)('projectName must not contain control characters.');
    }
    return { ok: true, value: trimmed };
}
function parseProjectId(value) {
    if (value === undefined || value === null || value === '') {
        return { ok: true, value: null };
    }
    if (typeof value !== 'string') {
        return (0, validation_1.invalid)('projectId must be a string.');
    }
    const parsed = (0, validation_1.parseResourceId)(value);
    if (!parsed.ok)
        return parsed;
    return { ok: true, value: parsed.value };
}
function parseScopes(value) {
    if (!Array.isArray(value)) {
        return (0, validation_1.invalid)('scopes must be an array of scope strings.');
    }
    if (value.length === 0) {
        return (0, validation_1.invalid)('scopes must contain at least one scope.');
    }
    if (value.length > api_key_crypto_1.API_SCOPES.length) {
        return (0, validation_1.invalid)(`scopes must contain at most ${api_key_crypto_1.API_SCOPES.length} entries.`);
    }
    const scopes = [];
    for (const entry of value) {
        if (!(0, api_key_crypto_1.isDeveloperApiScope)(entry)) {
            return (0, validation_1.invalid)(`Unknown scope. Supported scopes: ${api_key_crypto_1.API_SCOPES.join(', ')}.`);
        }
        if (scopes.includes(entry)) {
            return (0, validation_1.invalid)(`Duplicate scope: ${entry}.`);
        }
        scopes.push(entry);
    }
    return { ok: true, value: scopes };
}
function parseExpiresAt(value) {
    if (value === undefined || value === null) {
        return { ok: true, value: null };
    }
    if (typeof value !== 'string') {
        return (0, validation_1.invalid)('expiresAt must be an ISO 8601 date string or null.');
    }
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return (0, validation_1.invalid)('expiresAt must be a valid ISO 8601 date string.');
    }
    if (timestamp <= Date.now()) {
        return (0, validation_1.invalid)('expiresAt must be in the future.');
    }
    return { ok: true, value: new Date(timestamp).toISOString() };
}
/** DTO for `POST /api/developer/keys`. */
function parseCreateApiKeyDto(body) {
    if (!(0, validation_1.isPlainObject)(body)) {
        return (0, validation_1.invalid)('Request body must be a JSON object.');
    }
    const projectId = parseProjectId(body.projectId);
    if (!projectId.ok)
        return projectId;
    const projectName = parseProjectName(body.projectName);
    if (!projectName.ok)
        return projectName;
    if (!projectId.value && !projectName.value) {
        return (0, validation_1.invalid)('projectName or projectId is required.');
    }
    if (!(0, api_key_crypto_1.isDeveloperApiEnvironment)(body.environment)) {
        return (0, validation_1.invalid)('environment must be either "test" or "live".');
    }
    const scopes = parseScopes(body.scopes);
    if (!scopes.ok)
        return scopes;
    const expiresAt = parseExpiresAt(body.expiresAt);
    if (!expiresAt.ok)
        return expiresAt;
    return {
        ok: true,
        value: {
            projectId: projectId.value,
            projectName: projectName.value,
            environment: body.environment,
            scopes: scopes.value,
            expiresAt: expiresAt.value,
        },
    };
}
