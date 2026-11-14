"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQrCodes = listQrCodes;
exports.createQrCode = createQrCode;
exports.getQrCode = getQrCode;
exports.deleteQrCode = deleteQrCode;
exports.getQrAnalytics = getQrAnalytics;
const analytics_1 = require("../analytics");
const create_qr_dto_1 = require("../dto/create-qr.dto");
const validation_1 = require("../dto/validation");
const body_1 = require("../http/body");
const base_url_1 = require("../http/base-url");
const envelope_1 = require("../http/envelope");
const qr_image_1 = require("../qr-image");
const presenters_1 = require("./presenters");
const INVALID_ID = 'QR code id is malformed.';
/** GET /api/v1/qr */
async function listQrCodes(ctx) {
    const pagination = (0, validation_1.parsePagination)(ctx.searchParams);
    if (!pagination.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', pagination.message);
    }
    const qrCodes = await ctx.deps.listQrCodes(ctx.developer.userId);
    const { limit, offset } = pagination.value;
    const page = qrCodes.slice(offset, offset + limit);
    return (0, envelope_1.sendSuccess)(ctx.res, 200, 'QR codes retrieved successfully', {
        qrs: page.map(presenters_1.serializeQrCode),
        total: qrCodes.length,
        limit,
        offset,
    });
}
/** POST /api/v1/qr */
async function createQrCode(ctx) {
    const body = await (0, body_1.readJsonBody)(ctx.req);
    if (!body.ok) {
        return (0, envelope_1.sendError)(ctx.res, body.status, body.code, body.message);
    }
    const dto = (0, create_qr_dto_1.parseCreateQrDto)(body.value);
    if (!dto.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', dto.message);
    }
    let targetUrl = dto.value.targetUrl;
    if (dto.value.linkId) {
        const link = await ctx.deps.getLink(ctx.developer.userId, dto.value.linkId);
        if (!link) {
            return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', 'linkId does not reference an accessible link.');
        }
        if (!targetUrl) {
            // Match the app: a QR attached to a link encodes its short URL so scans
            // flow through LinkFlow's existing click tracking.
            targetUrl = `${(0, base_url_1.resolvePublicBaseUrl)(ctx.req)}/${link.short_code}`;
        }
    }
    // Reuse the existing QR persistence path (including duplicate collapsing).
    const qr = await ctx.deps.createQrCode(ctx.developer.userId, {
        targetUrl,
        title: dto.value.title,
        linkId: dto.value.linkId,
    });
    const image = await renderQrImage(targetUrl, dto.value.image);
    return (0, envelope_1.sendSuccess)(ctx.res, 201, 'QR code created successfully', {
        qr: (0, presenters_1.serializeQrCode)(qr),
        image,
    });
}
/** GET /api/v1/qr/:id */
async function getQrCode(ctx, qrId) {
    const id = (0, validation_1.parseResourceId)(qrId);
    if (!id.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
    }
    const qr = await ctx.deps.getQrCode(id.value, ctx.developer.userId);
    if (!qr) {
        return (0, envelope_1.sendError)(ctx.res, 404, 'NOT_FOUND', 'QR code not found.');
    }
    // QR image options are not persisted (existing schema stores metadata only),
    // so detail reads render the canonical defaults.
    const image = await renderQrImage(qr.target_url, qr_image_1.QR_IMAGE_DEFAULTS);
    return (0, envelope_1.sendSuccess)(ctx.res, 200, 'QR code retrieved successfully', {
        qr: (0, presenters_1.serializeQrCode)(qr),
        image,
    });
}
/** DELETE /api/v1/qr/:id */
async function deleteQrCode(ctx, qrId) {
    const id = (0, validation_1.parseResourceId)(qrId);
    if (!id.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
    }
    const deleted = await ctx.deps.deleteQrCode(id.value, ctx.developer.userId);
    if (!deleted) {
        return (0, envelope_1.sendError)(ctx.res, 404, 'NOT_FOUND', 'QR code not found.');
    }
    return (0, envelope_1.sendSuccess)(ctx.res, 200, 'QR code deleted successfully', { id: id.value });
}
/** GET /api/v1/qr/:id/analytics */
async function getQrAnalytics(ctx, qrId) {
    const id = (0, validation_1.parseResourceId)(qrId);
    if (!id.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
    }
    const days = (0, validation_1.parseDays)(ctx.searchParams);
    if (!days.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', days.message);
    }
    const qr = await ctx.deps.getQrCode(id.value, ctx.developer.userId);
    if (!qr) {
        return (0, envelope_1.sendError)(ctx.res, 404, 'NOT_FOUND', 'QR code not found.');
    }
    // Phase 1 tracks URL redirects only. A QR attached to a link inherits that
    // link's click analytics; standalone QR codes have no scan tracking to report.
    if (!qr.link_id) {
        return (0, envelope_1.sendSuccess)(ctx.res, 200, 'QR code analytics retrieved successfully', {
            qr: (0, presenters_1.serializeQrCode)(qr),
            supported: false,
            reason: 'QR scans are not tracked. Create the QR from a short link to see its click analytics.',
        });
    }
    const link = await ctx.deps.getLink(ctx.developer.userId, qr.link_id);
    if (!link) {
        return (0, envelope_1.sendSuccess)(ctx.res, 200, 'QR code analytics retrieved successfully', {
            qr: (0, presenters_1.serializeQrCode)(qr),
            supported: false,
            reason: 'The linked short link no longer exists.',
        });
    }
    const daily = await (0, analytics_1.getLinkDailyClicks)(link.id, days.value);
    return (0, envelope_1.sendSuccess)(ctx.res, 200, 'QR code analytics retrieved successfully', {
        qr: (0, presenters_1.serializeQrCode)(qr),
        supported: true,
        tracking: 'linked-link-clicks',
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
async function renderQrImage(targetUrl, options) {
    const dataUrl = await (0, qr_image_1.renderQrDataUrl)(targetUrl, options);
    return (0, qr_image_1.describeQrImage)(dataUrl, options);
}
