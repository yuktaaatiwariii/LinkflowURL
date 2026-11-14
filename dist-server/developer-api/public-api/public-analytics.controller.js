"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalyticsOverview = getAnalyticsOverview;
const analytics_1 = require("../analytics");
const validation_1 = require("../dto/validation");
const base_url_1 = require("../http/base-url");
const envelope_1 = require("../http/envelope");
const presenters_1 = require("./presenters");
/**
 * GET /api/v1/analytics/overview
 *
 * Aggregates data the product already records: link counts, active links,
 * total clicks, QR counts and a per-day click series summed across the
 * developer's links. No new tracking or schema is introduced.
 */
async function getAnalyticsOverview(ctx) {
    const days = (0, validation_1.parseDays)(ctx.searchParams);
    if (!days.ok) {
        return (0, envelope_1.sendError)(ctx.res, 400, 'VALIDATION_ERROR', days.message);
    }
    const [links, qrCodes] = await Promise.all([
        ctx.deps.listLinks(ctx.developer.userId),
        ctx.deps.listQrCodes(ctx.developer.userId),
    ]);
    const totalClicks = links.reduce((sum, link) => sum + (Number(link.clicks_count) || 0), 0);
    const activeLinks = links.filter((link) => link.is_active).length;
    const daily = await (0, analytics_1.getUserDailyClicks)(ctx.developer.userId, links.map((link) => link.id), days.value);
    const mostClicked = [...links].sort((a, b) => (Number(b.clicks_count) || 0) - (Number(a.clicks_count) || 0))[0];
    const baseUrl = (0, base_url_1.resolvePublicBaseUrl)(ctx.req);
    return (0, envelope_1.sendSuccess)(ctx.res, 200, 'Analytics overview retrieved successfully', {
        totals: {
            links: links.length,
            activeLinks,
            clicks: totalClicks,
            qrCodes: qrCodes.length,
            linkedQrCodes: qrCodes.filter((qr) => !!qr.link_id).length,
        },
        range: {
            days: days.value,
            since: daily[0]?.date ?? null,
            until: daily[daily.length - 1]?.date ?? null,
        },
        daily,
        mostClickedLink: mostClicked ? (0, presenters_1.serializeLink)(mostClicked, baseUrl) : null,
        recentQrCodes: qrCodes.slice(0, 5).map(presenters_1.serializeQrCode),
    });
}
