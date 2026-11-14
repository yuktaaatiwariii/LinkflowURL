import { parseCreateLinkDto } from '../dto/create-link.dto';
import { parseDays, parsePagination, parseResourceId } from '../dto/validation';
import { getLinkDailyClicks } from '../analytics';
import { readJsonBody } from '../http/body';
import { resolvePublicBaseUrl } from '../http/base-url';
import { sendError, sendSuccess } from '../http/envelope';
import { serializeLink } from './presenters';
import type { PublicApiContext } from './public-api.context';

const INVALID_ID = 'Link id is malformed.';

/** GET /api/v1/links */
export async function listLinks(ctx: PublicApiContext): Promise<void> {
  const pagination = parsePagination(ctx.searchParams);
  if (!pagination.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', pagination.message);
  }

  const links = await ctx.deps.listLinks(ctx.developer.userId);
  const { limit, offset } = pagination.value;
  const page = links.slice(offset, offset + limit);
  const baseUrl = resolvePublicBaseUrl(ctx.req);

  return sendSuccess(ctx.res, 200, 'Links retrieved successfully', {
    links: page.map((link) => serializeLink(link, baseUrl)),
    total: links.length,
    limit,
    offset,
  });
}

/** POST /api/v1/links */
export async function createLink(ctx: PublicApiContext): Promise<void> {
  const body = await readJsonBody(ctx.req);
  if (!body.ok) {
    return sendError(ctx.res, body.status, body.code, body.message);
  }

  const dto = parseCreateLinkDto(body.value);
  if (!dto.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', dto.message);
  }

  if (dto.value.customAlias) {
    const existing = await ctx.deps.findLinkByShortCode(dto.value.customAlias);
    if (existing) {
      return sendError(ctx.res, 409, 'ALIAS_TAKEN', 'That customAlias is already in use.');
    }
  }

  let link;
  try {
    // Ownership is decided here, from the API key — never from the body.
    link = await ctx.deps.createLink(ctx.developer.userId, dto.value);
  } catch (err) {
    // A concurrent insert can still win the unique index race. Only surface a
    // conflict for caller-controlled aliases; anything else is a real failure.
    if (dto.value.customAlias) {
      return sendError(ctx.res, 409, 'ALIAS_TAKEN', 'That customAlias is already in use.');
    }
    throw err;
  }

  return sendSuccess(
    ctx.res,
    201,
    'Short link created successfully',
    serializeLink(link, resolvePublicBaseUrl(ctx.req))
  );
}

/** GET /api/v1/links/:id */
export async function getLink(ctx: PublicApiContext, linkId: string): Promise<void> {
  const id = parseResourceId(linkId);
  if (!id.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
  }

  const link = await ctx.deps.getLink(ctx.developer.userId, id.value);
  if (!link) {
    return sendError(ctx.res, 404, 'NOT_FOUND', 'Link not found.');
  }

  return sendSuccess(
    ctx.res,
    200,
    'Link retrieved successfully',
    serializeLink(link, resolvePublicBaseUrl(ctx.req))
  );
}

/** DELETE /api/v1/links/:id */
export async function deleteLink(ctx: PublicApiContext, linkId: string): Promise<void> {
  const id = parseResourceId(linkId);
  if (!id.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
  }

  const deleted = await ctx.deps.deleteLink(id.value, ctx.developer.userId);
  if (!deleted) {
    return sendError(ctx.res, 404, 'NOT_FOUND', 'Link not found.');
  }

  return sendSuccess(ctx.res, 200, 'Link deleted successfully', { id: id.value });
}

/** GET /api/v1/links/:id/analytics */
export async function getLinkAnalytics(
  ctx: PublicApiContext,
  linkId: string
): Promise<void> {
  const id = parseResourceId(linkId);
  if (!id.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', INVALID_ID);
  }

  const days = parseDays(ctx.searchParams);
  if (!days.ok) {
    return sendError(ctx.res, 400, 'VALIDATION_ERROR', days.message);
  }

  const link = await ctx.deps.getLink(ctx.developer.userId, id.value);
  if (!link) {
    return sendError(ctx.res, 404, 'NOT_FOUND', 'Link not found.');
  }

  const daily = await getLinkDailyClicks(link.id, days.value);

  return sendSuccess(ctx.res, 200, 'Link analytics retrieved successfully', {
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
