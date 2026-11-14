"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePublicApiRequest = handlePublicApiRequest;
const api_developer_decorator_1 = require("../decorators/api-developer.decorator");
const api_key_guard_1 = require("../guards/api-key.guard");
const scope_guard_1 = require("../guards/scope.guard");
const envelope_1 = require("../http/envelope");
const public_analytics_controller_1 = require("./public-analytics.controller");
const public_links_controller_1 = require("./public-links.controller");
const public_qr_controller_1 = require("./public-qr.controller");
const usage_store_1 = require("../usage/usage.store");
function methodNotAllowed(res, allow) {
    (0, envelope_1.sendError)(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed for this endpoint.', {
        Allow: allow,
    });
}
/**
 * Developer API router for `/api/v1/*`.
 *
 * Flow: API-key guard -> request decoration -> controller -> envelope.
 * Every route (including unknown ones) is guarded so no endpoint is reachable
 * without a valid key.
 *
 * This module is dispatched from `server/index.ts` before the Clerk/JWT block,
 * keeping the two authentication systems independent.
 */
async function handlePublicApiRequest(req, res, pathname, searchParams, deps) {
    const method = (req.method || 'GET').toUpperCase();
    const requestStartedAt = Date.now();
    try {
        const auth = await (0, api_key_guard_1.authenticateApiKey)(req, deps);
        if (!auth.ok) {
            (0, envelope_1.sendError)(res, auth.status, auth.code, auth.message);
            return;
        }
        (0, api_developer_decorator_1.attachApiDeveloper)(req, auth.developer);
        // Analytics is attached only after authentication succeeds and is written
        // from the response lifecycle so the real status code and duration are
        // recorded. The insert is fire-and-forget and never affects the response.
        res.once('finish', () => {
            (0, usage_store_1.recordApiUsage)({
                userId: auth.developer.userId,
                apiKeyId: auth.developer.apiKeyId,
                projectId: auth.developer.projectId,
                endpoint: pathname,
                method,
                environment: auth.developer.environment,
                statusCode: res.statusCode,
                durationMs: Date.now() - requestStartedAt,
            });
        });
        const ctx = {
            req,
            res,
            deps,
            developer: auth.developer,
            searchParams,
        };
        if (pathname === '/api/v1/links') {
            if (method === 'GET') {
                if (!(0, scope_guard_1.requireScope)(ctx.developer, 'links:read', res))
                    return;
                return await (0, public_links_controller_1.listLinks)(ctx);
            }
            if (method === 'POST') {
                if (!(0, scope_guard_1.requireScope)(ctx.developer, 'links:write', res))
                    return;
                return await (0, public_links_controller_1.createLink)(ctx);
            }
            return methodNotAllowed(res, 'GET, POST');
        }
        if (pathname === '/api/v1/qr') {
            if (method === 'GET') {
                if (!(0, scope_guard_1.requireScope)(ctx.developer, 'qr:read', res))
                    return;
                return await (0, public_qr_controller_1.listQrCodes)(ctx);
            }
            if (method === 'POST') {
                if (!(0, scope_guard_1.requireScope)(ctx.developer, 'qr:write', res))
                    return;
                return await (0, public_qr_controller_1.createQrCode)(ctx);
            }
            return methodNotAllowed(res, 'GET, POST');
        }
        if (pathname === '/api/v1/analytics/overview') {
            if (method === 'GET') {
                if (!(0, scope_guard_1.requireScope)(ctx.developer, 'analytics:read', res))
                    return;
                return await (0, public_analytics_controller_1.getAnalyticsOverview)(ctx);
            }
            return methodNotAllowed(res, 'GET');
        }
        const linkAnalyticsMatch = pathname.match(/^\/api\/v1\/links\/([^/]+)\/analytics$/);
        if (linkAnalyticsMatch) {
            if (method === 'GET') {
                if (!(0, scope_guard_1.requireScope)(ctx.developer, 'analytics:read', res))
                    return;
                return await (0, public_links_controller_1.getLinkAnalytics)(ctx, linkAnalyticsMatch[1]);
            }
            return methodNotAllowed(res, 'GET');
        }
        const linkMatch = pathname.match(/^\/api\/v1\/links\/([^/]+)$/);
        if (linkMatch) {
            if (method === 'GET') {
                if (!(0, scope_guard_1.requireScope)(ctx.developer, 'links:read', res))
                    return;
                return await (0, public_links_controller_1.getLink)(ctx, linkMatch[1]);
            }
            if (method === 'DELETE') {
                if (!(0, scope_guard_1.requireScope)(ctx.developer, 'links:delete', res))
                    return;
                return await (0, public_links_controller_1.deleteLink)(ctx, linkMatch[1]);
            }
            return methodNotAllowed(res, 'GET, DELETE');
        }
        const qrAnalyticsMatch = pathname.match(/^\/api\/v1\/qr\/([^/]+)\/analytics$/);
        if (qrAnalyticsMatch) {
            if (method === 'GET') {
                if (!(0, scope_guard_1.requireScope)(ctx.developer, 'analytics:read', res))
                    return;
                return await (0, public_qr_controller_1.getQrAnalytics)(ctx, qrAnalyticsMatch[1]);
            }
            return methodNotAllowed(res, 'GET');
        }
        const qrMatch = pathname.match(/^\/api\/v1\/qr\/([^/]+)$/);
        if (qrMatch) {
            if (method === 'GET') {
                if (!(0, scope_guard_1.requireScope)(ctx.developer, 'qr:read', res))
                    return;
                return await (0, public_qr_controller_1.getQrCode)(ctx, qrMatch[1]);
            }
            if (method === 'DELETE') {
                if (!(0, scope_guard_1.requireScope)(ctx.developer, 'qr:delete', res))
                    return;
                return await (0, public_qr_controller_1.deleteQrCode)(ctx, qrMatch[1]);
            }
            return methodNotAllowed(res, 'GET, DELETE');
        }
        (0, envelope_1.sendError)(res, 404, 'NOT_FOUND', 'Endpoint not found.');
    }
    catch (err) {
        // Log only the message: never request bodies, headers, tokens or stacks.
        console.error(`[Developer API] ${method} ${pathname} failed: ${err?.message || 'unknown error'}`);
        if (!res.headersSent) {
            (0, envelope_1.sendError)(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
        }
        else if (!res.writableEnded) {
            res.end();
        }
    }
}
