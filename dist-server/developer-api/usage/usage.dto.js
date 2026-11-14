"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseUsageProjectFilter = parseUsageProjectFilter;
exports.parseLogQuery = parseLogQuery;
const api_key_crypto_1 = require("../keys/api-key-crypto");
const validation_1 = require("../dto/validation");
/** Optional `projectId` filter shared by overview/usage/logs. */
function parseUsageProjectFilter(params) {
    const raw = params.get('projectId');
    if (raw === null || raw === '')
        return { ok: true, value: { projectId: null } };
    const parsed = (0, validation_1.parseResourceId)(raw);
    if (!parsed.ok)
        return parsed;
    return { ok: true, value: { projectId: parsed.value } };
}
const METHOD_PATTERN = /^[A-Za-z]{1,10}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
function parseDate(value, field) {
    if (value === null || value === '')
        return { ok: true, value: undefined };
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return (0, validation_1.invalid)(`${field} must be a valid ISO 8601 date string.`);
    }
    return { ok: true, value: new Date(timestamp).toISOString() };
}
/** Validates `GET /api/developer/logs` query parameters. */
function parseLogQuery(params) {
    const pagination = (0, validation_1.parsePagination)(params);
    if (!pagination.ok)
        return pagination;
    const methodRaw = params.get('method');
    let method;
    if (methodRaw !== null && methodRaw !== '' && methodRaw.toUpperCase() !== 'ALL') {
        if (!METHOD_PATTERN.test(methodRaw)) {
            return (0, validation_1.invalid)('method must be a valid HTTP method.');
        }
        method = methodRaw.toUpperCase();
    }
    const statusRaw = params.get('status');
    let status;
    if (statusRaw !== null && statusRaw !== '' && statusRaw !== 'all') {
        if (statusRaw !== 'success' && statusRaw !== 'failed') {
            return (0, validation_1.invalid)('status must be either "success" or "failed".');
        }
        status = statusRaw;
    }
    const statusCodeRaw = params.get('statusCode');
    let statusCode;
    if (statusCodeRaw !== null && statusCodeRaw !== '') {
        const parsed = Number(statusCodeRaw);
        if (!Number.isInteger(parsed) || parsed < 100 || parsed > 599) {
            return (0, validation_1.invalid)('statusCode must be an integer between 100 and 599.');
        }
        statusCode = parsed;
    }
    const environmentRaw = params.get('environment');
    let environment;
    if (environmentRaw !== null && environmentRaw !== '' && environmentRaw !== 'all') {
        if (!(0, api_key_crypto_1.isDeveloperApiEnvironment)(environmentRaw)) {
            return (0, validation_1.invalid)('environment must be either "test" or "live".');
        }
        environment = environmentRaw;
    }
    const project = parseUsageProjectFilter(params);
    if (!project.ok)
        return project;
    const endpointRaw = params.get('endpoint');
    let endpoint;
    if (endpointRaw !== null && endpointRaw.trim() !== '') {
        const trimmed = endpointRaw.trim();
        if (trimmed.length > 100) {
            return (0, validation_1.invalid)('endpoint must not exceed 100 characters.');
        }
        if (CONTROL_CHARACTERS.test(trimmed)) {
            return (0, validation_1.invalid)('endpoint must not contain control characters.');
        }
        endpoint = trimmed;
    }
    const from = parseDate(params.get('from'), 'from');
    if (!from.ok)
        return from;
    const to = parseDate(params.get('to'), 'to');
    if (!to.ok)
        return to;
    if (from.value && to.value && Date.parse(from.value) >= Date.parse(to.value)) {
        return (0, validation_1.invalid)('from must be earlier than to.');
    }
    return {
        ok: true,
        value: {
            limit: pagination.value.limit,
            offset: pagination.value.offset,
            method,
            status,
            statusCode,
            environment,
            projectId: project.value.projectId || undefined,
            endpoint,
            from: from.value,
            to: to.value,
        },
    };
}
