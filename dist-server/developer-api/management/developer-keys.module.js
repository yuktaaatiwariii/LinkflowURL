"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleManagementRequest = handleManagementRequest;
const envelope_1 = require("../http/envelope");
const management_auth_1 = require("./management-auth");
const developer_keys_controller_1 = require("./developer-keys.controller");
const project_controller_1 = require("../projects/project.controller");
const usage_controller_1 = require("../usage/usage.controller");
function methodNotAllowed(res, allow) {
    (0, envelope_1.sendError)(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed for this endpoint.', {
        Allow: allow,
    });
}
/**
 * Router for `/api/developer/keys*`.
 *
 * Uses the existing LinkFlow JWT authentication (Clerk Bearer token), never the
 * developer API key. It is dispatched from `server/index.ts` before the
 * user-facing routes so its error envelope is consistent with `/api/v1`.
 */
async function handleManagementRequest(req, res, pathname, searchParams, deps) {
    const method = (req.method || 'GET').toUpperCase();
    try {
        const resolveUser = deps.resolveManagementUser ?? (0, management_auth_1.createDefaultManagementUserResolver)(deps);
        const user = await resolveUser(req);
        if (!user) {
            (0, envelope_1.sendError)(res, 401, 'UNAUTHORIZED', 'A valid Bearer token is required.');
            return;
        }
        if (pathname === '/api/developer/overview') {
            if (method === 'GET')
                return await (0, usage_controller_1.getDashboardOverview)(user, res, searchParams);
            return methodNotAllowed(res, 'GET');
        }
        if (pathname === '/api/developer/usage') {
            if (method === 'GET')
                return await (0, usage_controller_1.getDeveloperUsage)(user, res, searchParams);
            return methodNotAllowed(res, 'GET');
        }
        if (pathname === '/api/developer/logs') {
            if (method === 'GET')
                return await (0, usage_controller_1.getDeveloperLogs)(user, res, searchParams);
            return methodNotAllowed(res, 'GET');
        }
        const logMatch = pathname.match(/^\/api\/developer\/logs\/([^/]+)$/);
        if (logMatch) {
            if (method === 'GET')
                return await (0, usage_controller_1.getDeveloperLog)(user, res, logMatch[1]);
            return methodNotAllowed(res, 'GET');
        }
        if (pathname === '/api/developer/projects') {
            if (method === 'GET')
                return await (0, project_controller_1.listProjects)(user, res);
            if (method === 'POST')
                return await (0, project_controller_1.createProject)(user, req, res);
            return methodNotAllowed(res, 'GET, POST');
        }
        const projectMatch = pathname.match(/^\/api\/developer\/projects\/([^/]+)$/);
        if (projectMatch) {
            if (method === 'GET')
                return await (0, project_controller_1.getProject)(user, res, projectMatch[1]);
            if (method === 'PATCH')
                return await (0, project_controller_1.updateProject)(user, req, res, projectMatch[1]);
            if (method === 'DELETE')
                return await (0, project_controller_1.deleteDeveloperProject)(user, res, projectMatch[1]);
            return methodNotAllowed(res, 'GET, PATCH, DELETE');
        }
        if (pathname === '/api/developer/keys') {
            if (method === 'GET')
                return await (0, developer_keys_controller_1.listApiKeys)(user, res);
            if (method === 'POST')
                return await (0, developer_keys_controller_1.createApiKey)(user, req, res);
            return methodNotAllowed(res, 'GET, POST');
        }
        const rotateMatch = pathname.match(/^\/api\/developer\/keys\/([^/]+)\/rotate$/);
        if (rotateMatch) {
            if (method === 'POST')
                return await (0, developer_keys_controller_1.rotateDeveloperApiKey)(user, res, rotateMatch[1]);
            return methodNotAllowed(res, 'POST');
        }
        const keyMatch = pathname.match(/^\/api\/developer\/keys\/([^/]+)$/);
        if (keyMatch) {
            if (method === 'GET')
                return await (0, developer_keys_controller_1.getApiKey)(user, res, keyMatch[1]);
            if (method === 'DELETE')
                return await (0, developer_keys_controller_1.revokeDeveloperApiKey)(user, res, keyMatch[1]);
            return methodNotAllowed(res, 'GET, DELETE');
        }
        (0, envelope_1.sendError)(res, 404, 'NOT_FOUND', 'Endpoint not found.');
    }
    catch (err) {
        // Log only a sanitized message: never tokens, bodies, secrets or stacks.
        console.error(`[Developer API management] ${method} ${pathname} failed: ${err?.message || 'unknown error'}`);
        if (!res.headersSent) {
            (0, envelope_1.sendError)(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
        }
        else if (!res.writableEnded) {
            res.end();
        }
    }
}
