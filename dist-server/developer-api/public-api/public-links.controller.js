"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listLinks = listLinks;
exports.createLink = createLink;
exports.getLink = getLink;
exports.deleteLink = deleteLink;
exports.getLinkAnalytics = getLinkAnalytics;
const create_link_dto_1 = require("../dto/create-link.dto");
const validation_1 = require("../dto/validation");
const analytics_1 = require("../analytics");
const body_1 = require("../http/body");
const base_url_1 = require("../http/base-url");
const envelope_1 = require("../http/envelope");
const presenters_1 = require("./presenters");
const INVALID_ID = 'Link id is malformed.';
/** GET /api/v1/links */
async function listLinks(ctx) {
    const pagination = (0, validation_1.parsePagination)(ctx.searchParams);
    if (!pagination.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', pagination.message);
    }
    const links = await ctx.deps.listLinks(ctx.developer.userId);
    const { limit, offset } = pagination.value;
    const page = links.slice(offset, offset + limit);
    const baseUrl = (0, base_url_1.resolvePublicBaseUrl)(ctx.req);
    return (0, envelope_1.sendSuccess)(ctx.res, 200, 'Links retrieved successfully', {
        links: page.map((link) => (0, presenters_1.serializeLink)(link, baseUrl)),
        total: links.length,
        limit,
        offset,
    });
}
/** POST /api/v1/links */
async function createLink(ctx) {
    const body = await (0, body_1.readJsonBody)(ctx.req);
    if (!body.ok) {
        return (0, envelope_1.sendError)(ctx.res, body.status, body.code, body.message);
    }
    const dto = (0, create_link_dto_1.parseCreateLinkDto)(body.value);
    if (!dto.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', dto.message);
    }
    if (dto.value.customAlias) {
        const existing = await ctx.deps.findLinkByShortCode(dto.value.customAlias);
        if (existing) {
            return (0, envelope_1.sendError)(ctx.res, 409, 'ALIAS_TAKEN', 'That customAlias is already in use.');
        }
    }
    let link;
    try {
        // Ownership is decided here, from the API key — never from the body.
        link = await ctx.deps.createLink(ctx.developer.userId, dto.value);
    }
    catch (err) {
        // A concurrent insert can still win the unique index race. Only surface a
        // conflict for caller-controlled aliases; anything else is a real failure.
        if (dto.value.customAlias) {
            return (0, envelope_1.sendError)(ctx.res, 409, 'ALIAS_TAKEN', 'That customAlias is already in use.');
        }
        throw err;
    }
    return (0, envelope_1.sendSuccess)(ctx.res, 201, 'Short link created successfully', (0, presenters_1.serializeLink)(link, (0, base_url_1.resolvePublicBaseUrl)(ctx.req)));
}
/** GET /api/v1/links/:id */
async function getLink(ctx, linkId) {
    const id = (0, validation_1.parseResourceId)(linkId);
    if (!id.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
    }
    const link = await ctx.deps.getLink(ctx.developer.userId, id.value);
    if (!link) {
        return (0, envelope_1.sendError)(ctx.res, 404, 'NOT_FOUND', 'Link not found.');
    }
    return (0, envelope_1.sendSuccess)(ctx.res, 200, 'Link retrieved successfully', (0, presenters_1.serializeLink)(link, (0, base_url_1.resolvePublicBaseUrl)(ctx.req)));
}
/** DELETE /api/v1/links/:id */
async function deleteLink(ctx, linkId) {
    const id = (0, validation_1.parseResourceId)(linkId);
    if (!id.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
    }
    const deleted = await ctx.deps.deleteLink(id.value, ctx.developer.userId);
    if (!deleted) {
        return (0, envelope_1.sendError)(ctx.res, 404, 'NOT_FOUND', 'Link not found.');
    }
    return (0, envelope_1.sendSuccess)(ctx.res, 200, 'Link deleted successfully', { id: id.value });
}
/** GET /api/v1/links/:id/analytics */
async function getLinkAnalytics(ctx, linkId) {
    const id = (0, validation_1.parseResourceId)(linkId);
    if (!id.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
    }
    const days = (0, validation_1.parseDays)(ctx.searchParams);
    if (!days.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', days.message);
    }
    const link = await ctx.deps.getLink(ctx.developer.userId, id.value);
    if (!link) {
        return (0, envelope_1.sendError)(ctx.res, 404, 'NOT_FOUND', 'Link not found.');
    }
    const daily = await (0, analytics_1.getLinkDailyClicks)(link.id, days.value);
    return (0, envelope_1.sendSuccess)(ctx.res, 200, 'Link analytics retrieved successfully', {
        link: (0, presenters_1.serializeLink)(link, (0, base_url_1.resolvePublicBaseUrl)(ctx.req)),
        totalClicks: link.clicks_count,
        range: {
            days: days.value,
            since: daily[0]?.date ?? null,
            until: daily[daily.length - 1]?.date ?? null,
        },
        daily,
    });
}
