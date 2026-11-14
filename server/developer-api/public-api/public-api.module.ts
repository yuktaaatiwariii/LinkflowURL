import type { IncomingMessage, ServerResponse } from 'http';
import { attachApiDeveloper } from '../decorators/api-developer.decorator';
import { authenticateApiKey } from '../guards/api-key.guard';
import { requireScope } from '../guards/scope.guard';
import { sendError } from '../http/envelope';
import type { DeveloperApiDependencies } from '../interfaces/api-developer.interface';
import { getAnalyticsOverview } from './public-analytics.controller';
import {
  createLink,
  deleteLink,
  getLink,
  getLinkAnalytics,
  listLinks,
} from './public-links.controller';
import {
  createQrCode,
  deleteQrCode,
  getQrAnalytics,
  getQrCode,
  listQrCodes,
} from './public-qr.controller';
import type { PublicApiContext } from './public-api.context';
import { recordApiUsage } from '../usage/usage.store';

function methodNotAllowed(res: ServerResponse, allow: string): void {
  sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed for this endpoint.', {
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
export async function handlePublicApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
  deps: DeveloperApiDependencies
): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();
  const requestStartedAt = Date.now();

  try {
    const auth = await authenticateApiKey(req, deps);
    if (!auth.ok) {
      sendError(res, auth.status, auth.code, auth.message);
      return;
    }

    attachApiDeveloper(req, auth.developer);

    // Analytics is attached only after authentication succeeds and is written
    // from the response lifecycle so the real status code and duration are
    // recorded. The insert is fire-and-forget and never affects the response.
    res.once('finish', () => {
      recordApiUsage({
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

    const ctx: PublicApiContext = {
      req,
      res,
      deps,
      developer: auth.developer,
      searchParams,
    };

    if (pathname === '/api/v1/links') {
      if (method === 'GET') {
        if (!requireScope(ctx.developer, 'links:read', res)) return;
        return await listLinks(ctx);
      }
      if (method === 'POST') {
        if (!requireScope(ctx.developer, 'links:write', res)) return;
        return await createLink(ctx);
      }
      return methodNotAllowed(res, 'GET, POST');
    }

    if (pathname === '/api/v1/qr') {
      if (method === 'GET') {
        if (!requireScope(ctx.developer, 'qr:read', res)) return;
        return await listQrCodes(ctx);
      }
      if (method === 'POST') {
        if (!requireScope(ctx.developer, 'qr:write', res)) return;
        return await createQrCode(ctx);
      }
      return methodNotAllowed(res, 'GET, POST');
    }

    if (pathname === '/api/v1/analytics/overview') {
      if (method === 'GET') {
        if (!requireScope(ctx.developer, 'analytics:read', res)) return;
        return await getAnalyticsOverview(ctx);
      }
      return methodNotAllowed(res, 'GET');
    }

    const linkAnalyticsMatch = pathname.match(/^\/api\/v1\/links\/([^/]+)\/analytics$/);
    if (linkAnalyticsMatch) {
      if (method === 'GET') {
        if (!requireScope(ctx.developer, 'analytics:read', res)) return;
        return await getLinkAnalytics(ctx, linkAnalyticsMatch[1]);
      }
      return methodNotAllowed(res, 'GET');
    }

    const linkMatch = pathname.match(/^\/api\/v1\/links\/([^/]+)$/);
    if (linkMatch) {
      if (method === 'GET') {
        if (!requireScope(ctx.developer, 'links:read', res)) return;
        return await getLink(ctx, linkMatch[1]);
      }
      if (method === 'DELETE') {
        if (!requireScope(ctx.developer, 'links:delete', res)) return;
        return await deleteLink(ctx, linkMatch[1]);
      }
      return methodNotAllowed(res, 'GET, DELETE');
    }

    const qrAnalyticsMatch = pathname.match(/^\/api\/v1\/qr\/([^/]+)\/analytics$/);
    if (qrAnalyticsMatch) {
      if (method === 'GET') {
        if (!requireScope(ctx.developer, 'analytics:read', res)) return;
        return await getQrAnalytics(ctx, qrAnalyticsMatch[1]);
      }
      return methodNotAllowed(res, 'GET');
    }

    const qrMatch = pathname.match(/^\/api\/v1\/qr\/([^/]+)$/);
    if (qrMatch) {
      if (method === 'GET') {
        if (!requireScope(ctx.developer, 'qr:read', res)) return;
        return await getQrCode(ctx, qrMatch[1]);
      }
      if (method === 'DELETE') {
        if (!requireScope(ctx.developer, 'qr:delete', res)) return;
        return await deleteQrCode(ctx, qrMatch[1]);
      }
      return methodNotAllowed(res, 'GET, DELETE');
    }

    sendError(res, 404, 'NOT_FOUND', 'Endpoint not found.');
  } catch (err: any) {
    // Log only the message: never request bodies, headers, tokens or stacks.
    console.error(
      `[Developer API] ${method} ${pathname} failed: ${err?.message || 'unknown error'}`
    );
    if (!res.headersSent) {
      sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}
