import { getLinkDailyClicks } from '../analytics';
import { parseCreateQrDto } from '../dto/create-qr.dto';
import { parseDays, parsePagination, parseResourceId } from '../dto/validation';
import { readJsonBody } from '../http/body';
import { resolvePublicBaseUrl } from '../http/base-url';
import { sendError, sendSuccess } from '../http/envelope';
import {
  QR_IMAGE_DEFAULTS,
  describeQrImage,
  renderQrDataUrl,
  type QrImageOptions,
} from '../qr-image';
import { serializeLink, serializeQrCode } from './presenters';
import type { PublicApiContext } from './public-api.context';

const INVALID_ID = 'QR code id is malformed.';

/** GET /api/v1/qr */
export async function listQrCodes(ctx: PublicApiContext): Promise<void> {
  const pagination = parsePagination(ctx.searchParams);
  if (!pagination.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', pagination.message);
  }

  const qrCodes = await ctx.deps.listQrCodes(ctx.developer.userId);
  const { limit, offset } = pagination.value;
  const page = qrCodes.slice(offset, offset + limit);

  return sendSuccess(ctx.res, 200, 'QR codes retrieved successfully', {
    qrs: page.map(serializeQrCode),
    total: qrCodes.length,
    limit,
    offset,
  });
}

/** POST /api/v1/qr */
export async function createQrCode(ctx: PublicApiContext): Promise<void> {
  const body = await readJsonBody(ctx.req);
  if (!body.ok) {
    return sendError(ctx.res, body.status, body.code, body.message);
  }

  const dto = parseCreateQrDto(body.value);
  if (!dto.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', dto.message);
  }

  let targetUrl = dto.value.targetUrl;

  if (dto.value.linkId) {
    const link = await ctx.deps.getLink(ctx.developer.userId, dto.value.linkId);
    if (!link) {
      return sendError(
        ctx.res,
        400,
        'VALIDATION_ERROR',
        'linkId does not reference an accessible link.'
      );
    }
    if (!targetUrl) {
      // Match the app: a QR attached to a link encodes its short URL so scans
      // flow through LinkFlow's existing click tracking.
      targetUrl = `${resolvePublicBaseUrl(ctx.req)}/${link.short_code}`;
    }
  }

  // Reuse the existing QR persistence path (including duplicate collapsing).
  const qr = await ctx.deps.createQrCode(ctx.developer.userId, {
    targetUrl,
    title: dto.value.title,
    linkId: dto.value.linkId,
  });

  const image = await renderQrImage(targetUrl, dto.value.image);

  return sendSuccess(ctx.res, 201, 'QR code created successfully', {
    qr: serializeQrCode(qr),
    image,
  });
}

/** GET /api/v1/qr/:id */
export async function getQrCode(ctx: PublicApiContext, qrId: string): Promise<void> {
  const id = parseResourceId(qrId);
  if (!id.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
  }

  const qr = await ctx.deps.getQrCode(id.value, ctx.developer.userId);
  if (!qr) {
    return sendError(ctx.res, 404, 'NOT_FOUND', 'QR code not found.');
  }

  // QR image options are not persisted (existing schema stores metadata only),
  // so detail reads render the canonical defaults.
  const image = await renderQrImage(qr.target_url, QR_IMAGE_DEFAULTS);

  return sendSuccess(ctx.res, 200, 'QR code retrieved successfully', {
    qr: serializeQrCode(qr),
    image,
  });
}

/** DELETE /api/v1/qr/:id */
export async function deleteQrCode(ctx: PublicApiContext, qrId: string): Promise<void> {
  const id = parseResourceId(qrId);
  if (!id.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
  }

  const deleted = await ctx.deps.deleteQrCode(id.value, ctx.developer.userId);
  if (!deleted) {
    return sendError(ctx.res, 404, 'NOT_FOUND', 'QR code not found.');
  }

  return sendSuccess(ctx.res, 200, 'QR code deleted successfully', { id: id.value });
}

/** GET /api/v1/qr/:id/analytics */
export async function getQrAnalytics(ctx: PublicApiContext, qrId: string): Promise<void> {
  const id = parseResourceId(qrId);
  if (!id.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
  }

  const days = parseDays(ctx.searchParams);
  if (!days.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', days.message);
  }

  const qr = await ctx.deps.getQrCode(id.value, ctx.developer.userId);
  if (!qr) {
    return sendError(ctx.res, 404, 'NOT_FOUND', 'QR code not found.');
  }

  // Phase 1 tracks URL redirects only. A QR attached to a link inherits that
  // link's click analytics; standalone QR codes have no scan tracking to report.
  if (!qr.link_id) {
    return sendSuccess(ctx.res, 200, 'QR code analytics retrieved successfully', {
      qr: serializeQrCode(qr),
      supported: false,
      reason: 'QR scans are not tracked. Create the QR from a short link to see its click analytics.',
    });
  }

  const link = await ctx.deps.getLink(ctx.developer.userId, qr.link_id);
  if (!link) {
    return sendSuccess(ctx.res, 200, 'QR code analytics retrieved successfully', {
      qr: serializeQrCode(qr),
      supported: false,
      reason: 'The linked short link no longer exists.',
    });
  }

  const daily = await getLinkDailyClicks(link.id, days.value);

  return sendSuccess(ctx.res, 200, 'QR code analytics retrieved successfully', {
    qr: serializeQrCode(qr),
    supported: true,
    tracking: 'linked-link-clicks',
    link: serializeLink(link, resolvePublicBaseUrl(ctx.req)),
    totalClicks: link.clicks_count,
    range: {
      days: days.value,
      since: daily[0]?.date ?? null,
      until: daily[daily.length - 1]?.date ?? null,
    },
    daily,
  });
}

async function renderQrImage(targetUrl: string, options: QrImageOptions) {
  const dataUrl = await renderQrDataUrl(targetUrl, options);
  return describeQrImage(dataUrl, options);
}
