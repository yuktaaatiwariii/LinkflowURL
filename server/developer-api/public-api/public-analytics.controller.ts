import { getUserDailyClicks } from '../analytics';
import { parseDays } from '../dto/validation';
import { resolvePublicBaseUrl } from '../http/base-url';
import { sendError, sendSuccess } from '../http/envelope';
import { serializeLink, serializeQrCode } from './presenters';
import type { PublicApiContext } from './public-api.context';

/**
 * GET /api/v1/analytics/overview
 *
 * Aggregates data the product already records: link counts, active links,
 * total clicks, QR counts and a per-day click series summed across the
 * developer's links. No new tracking or schema is introduced.
 */
export async function getAnalyticsOverview(ctx: PublicApiContext): Promise<void> {
  const days = parseDays(ctx.searchParams);
  if (!days.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', days.message);
  }

  const [links, qrCodes] = await Promise.all([
    ctx.deps.listLinks(ctx.developer.userId),
    ctx.deps.listQrCodes(ctx.developer.userId),
  ]);

  const totalClicks = links.reduce((sum, link) => sum + (Number(link.clicks_count) || 0), 0);
  const activeLinks = links.filter((link) => link.is_active).length;
  const daily = await getUserDailyClicks(
    ctx.developer.userId,
    links.map((link) => link.id),
    days.value
  );

  const mostClicked = [...links].sort(
    (a, b) => (Number(b.clicks_count) || 0) - (Number(a.clicks_count) || 0)
  )[0];

  const baseUrl = resolvePublicBaseUrl(ctx.req);

  return sendSuccess(ctx.res, 200, 'Analytics overview retrieved successfully', {
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
    mostClickedLink: mostClicked ? serializeLink(mostClicked, baseUrl) : null,
    recentQrCodes: qrCodes.slice(0, 5).map(serializeQrCode),
  });
}
