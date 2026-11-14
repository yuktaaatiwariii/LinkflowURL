"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardOverview = getDashboardOverview;
exports.getDeveloperUsage = getDeveloperUsage;
exports.getDeveloperLogs = getDeveloperLogs;
exports.getDeveloperLog = getDeveloperLog;
const envelope_1 = require("../http/envelope");
const validation_1 = require("../dto/validation");
const persistence_1 = require("../persistence");
const api_key_store_1 = require("../keys/api-key.store");
const project_store_1 = require("../projects/project.store");
const usage_store_1 = require("./usage.store");
const usage_dto_1 = require("./usage.dto");
/**
 * Developer dashboard analytics and request-log endpoints.
 *
 * Every query is scoped to the authenticated user id at the storage layer, so
 * one developer can never aggregate another developer's activity.
 */
function sendPersistenceFailure(res, err) {
    if (err instanceof persistence_1.PersistenceUnavailableError) {
        (0, envelope_1.sendError)(res, 503, 'DATABASE_NOT_CONFIGURED', 'Developer dashboard persistence is not configured on this server.');
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
function parseRange(res, raw) {
    const range = (0, usage_store_1.parseUsageRange)(raw);
    if (!range) {
        (0, envelope_1.sendError)(res, 400, 'VALIDATION_ERROR', 'range must be one of: 24h, 7d, 30d.');
        return null;
    }
    return range;
}
function projectFilter(res, params) {
    const parsed = (0, usage_dto_1.parseUsageProjectFilter)(params);
    if (!parsed.ok) {
        (0, envelope_1.sendError)(res, 400, 'VALIDATION_ERROR', parsed.message);
        return undefined;
    }
    return parsed.value.projectId;
}
function isActive(key) {
    return (key.status === 'active' &&
        (!key.expires_at || new Date(key.expires_at).getTime() > Date.now()));
}
function statusGroup(statusCode) {
    if (statusCode < 300)
        return 'success';
    if (statusCode < 400)
        return 'redirect';
    if (statusCode < 500)
        return 'client_error';
    return 'server_error';
}
function toEventView(event, projects) {
    return {
        id: event.id,
        endpoint: event.endpoint,
        method: event.method,
        statusCode: event.status_code,
        statusGroup: statusGroup(event.status_code),
        durationMs: event.duration_ms,
        environment: event.environment,
        projectId: event.project_id,
        projectName: event.project_id ? projects.get(event.project_id) || null : null,
        createdAt: event.created_at,
    };
}
function projectNameMap(projects) {
    return new Map(projects.map((project) => [project.id, project.name]));
}
function rangeView(range) {
    return {
        key: range.key,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        bucket: range.bucket,
        buckets: range.bucketCount,
        generatedAt: new Date().toISOString(),
    };
}
/** GET /api/developer/overview?range=7d */
async function getDashboardOverview(user, res, params) {
    const range = parseRange(res, params.get('range'));
    if (!range)
        return;
    const projectId = projectFilter(res, params);
    if (projectId === undefined)
        return;
    const data = await runWithPersistenceErrors(res, async () => {
        const [totals, series, byEndpoint, byEnvironment, recent, keys, projects] = await Promise.all([
            (0, usage_store_1.getUsageTotals)(user.id, range, projectId),
            (0, usage_store_1.getUsageSeries)(user.id, range, projectId),
            (0, usage_store_1.getUsageByEndpoint)(user.id, range, projectId, 8),
            (0, usage_store_1.getUsageByEnvironment)(user.id, range, projectId),
            (0, usage_store_1.getRecentUsage)(user.id, 8, projectId),
            (0, api_key_store_1.listApiKeysForUser)(user.id),
            (0, project_store_1.listProjectsForUser)(user.id),
        ]);
        return { totals, series, byEndpoint, byEnvironment, recent, keys, projects };
    });
    if (!data)
        return;
    const scopedKeys = projectId
        ? data.keys.filter((key) => key.project_id === projectId)
        : data.keys;
    const activeKeys = scopedKeys.filter(isActive);
    const names = projectNameMap(data.projects);
    return (0, envelope_1.sendSuccess)(res, 200, 'Developer overview retrieved successfully', {
        range: rangeView(range),
        totals: data.totals,
        keys: {
            total: scopedKeys.length,
            active: activeKeys.length,
            revoked: scopedKeys.filter((key) => key.status === 'revoked').length,
            test: scopedKeys.filter((key) => key.environment === 'test').length,
            live: scopedKeys.filter((key) => key.environment === 'live').length,
            activeTest: activeKeys.filter((key) => key.environment === 'test').length,
            activeLive: activeKeys.filter((key) => key.environment === 'live').length,
        },
        projects: {
            total: data.projects.length,
            withKeys: new Set(data.keys.map((key) => key.project_id).filter((id) => Boolean(id))).size,
        },
        requestsOverTime: data.series,
        usageByEndpoint: data.byEndpoint,
        usageByEnvironment: data.byEnvironment,
        recentActivity: data.recent.map((event) => toEventView(event, names)),
    });
}
/** GET /api/developer/usage?range=7d */
async function getDeveloperUsage(user, res, params) {
    const range = parseRange(res, params.get('range'));
    if (!range)
        return;
    const projectId = projectFilter(res, params);
    if (projectId === undefined)
        return;
    const data = await runWithPersistenceErrors(res, async () => {
        const [totals, series, byEndpoint, byEnvironment] = await Promise.all([
            (0, usage_store_1.getUsageTotals)(user.id, range, projectId),
            (0, usage_store_1.getUsageSeries)(user.id, range, projectId),
            (0, usage_store_1.getUsageByEndpoint)(user.id, range, projectId, 20),
            (0, usage_store_1.getUsageByEnvironment)(user.id, range, projectId),
        ]);
        return { totals, series, byEndpoint, byEnvironment };
    });
    if (!data)
        return;
    return (0, envelope_1.sendSuccess)(res, 200, 'Usage analytics retrieved successfully', {
        range: rangeView(range),
        totals: data.totals,
        requestsOverTime: data.series,
        usageByEndpoint: data.byEndpoint,
        usageByEnvironment: data.byEnvironment,
    });
}
/** GET /api/developer/logs */
async function getDeveloperLogs(user, res, params) {
    const filters = (0, usage_dto_1.parseLogQuery)(params);
    if (!filters.ok) {
        return (0, envelope_1.sendError)(res, 400, 'VALIDATION_ERROR', filters.message);
    }
    const data = await runWithPersistenceErrors(res, async () => {
        const [page, projects] = await Promise.all([
            (0, usage_store_1.listUsageLogs)(user.id, filters.value),
            (0, project_store_1.listProjectsForUser)(user.id),
        ]);
        return { page, projects };
    });
    if (!data)
        return;
    const names = projectNameMap(data.projects);
    return (0, envelope_1.sendSuccess)(res, 200, 'API logs retrieved successfully', {
        logs: data.page.logs.map((event) => toEventView(event, names)),
        total: data.page.total,
        limit: data.page.limit,
        offset: data.page.offset,
        hasMore: data.page.offset + data.page.logs.length < data.page.total,
    });
}
/** GET /api/developer/logs/:id */
async function getDeveloperLog(user, res, rawId) {
    const parsed = (0, validation_1.parseResourceId)(rawId);
    if (!parsed.ok) {
        return (0, envelope_1.sendError)(res, 400, 'VALIDATION_ERROR', parsed.message);
    }
    const data = await runWithPersistenceErrors(res, async () => {
        const [event, projects] = await Promise.all([
            (0, usage_store_1.findUsageLogForUser)(parsed.value, user.id),
            (0, project_store_1.listProjectsForUser)(user.id),
        ]);
        return { event, projects };
    });
    if (!data)
        return;
    if (!data.event) {
        return (0, envelope_1.sendError)(res, 404, 'LOG_NOT_FOUND', 'Request log not found.');
    }
    return (0, envelope_1.sendSuccess)(res, 200, 'Request log retrieved successfully', toEventView(data.event, projectNameMap(data.projects)));
}
