import type { IncomingMessage, ServerResponse } from 'http';
import { sendError } from '../http/envelope';
import {
  createDefaultManagementUserResolver,
  type ManagementApiDependencies,
} from './management-auth';
import {
  createApiKey,
  getApiKey,
  listApiKeys,
  revokeDeveloperApiKey,
  rotateDeveloperApiKey,
} from './developer-keys.controller';
import {
  createProject,
  deleteDeveloperProject,
  getProject,
  listProjects,
  updateProject,
} from '../projects/project.controller';
import {
  getDashboardOverview,
  getDeveloperLog,
  getDeveloperLogs,
  getDeveloperUsage,
} from '../usage/usage.controller';

function methodNotAllowed(res: ServerResponse, allow: string): void {
  sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed for this endpoint.', {
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
export async function handleManagementRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
  deps: ManagementApiDependencies
): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();

  try {
    const resolveUser = deps.resolveManagementUser ?? createDefaultManagementUserResolver(deps);
    const user = await resolveUser(req);
    if (!user) {
      sendError(res, 401, 'UNAUTHORIZED', 'A valid Bearer token is required.');
      return;
    }

    if (pathname === '/api/developer/overview') {
      if (method === 'GET') return await getDashboardOverview(user, res, searchParams);
      return methodNotAllowed(res, 'GET');
    }

    if (pathname === '/api/developer/usage') {
      if (method === 'GET') return await getDeveloperUsage(user, res, searchParams);
      return methodNotAllowed(res, 'GET');
    }

    if (pathname === '/api/developer/logs') {
      if (method === 'GET') return await getDeveloperLogs(user, res, searchParams);
      return methodNotAllowed(res, 'GET');
    }

    const logMatch = pathname.match(/^\/api\/developer\/logs\/([^/]+)$/);
    if (logMatch) {
      if (method === 'GET') return await getDeveloperLog(user, res, logMatch[1]);
      return methodNotAllowed(res, 'GET');
    }

    if (pathname === '/api/developer/projects') {
      if (method === 'GET') return await listProjects(user, res);
      if (method === 'POST') return await createProject(user, req, res);
      return methodNotAllowed(res, 'GET, POST');
    }

    const projectMatch = pathname.match(/^\/api\/developer\/projects\/([^/]+)$/);
    if (projectMatch) {
      if (method === 'GET') return await getProject(user, res, projectMatch[1]);
      if (method === 'PATCH') return await updateProject(user, req, res, projectMatch[1]);
      if (method === 'DELETE') return await deleteDeveloperProject(user, res, projectMatch[1]);
      return methodNotAllowed(res, 'GET, PATCH, DELETE');
    }

    if (pathname === '/api/developer/keys') {
      if (method === 'GET') return await listApiKeys(user, res);
      if (method === 'POST') return await createApiKey(user, req, res);
      return methodNotAllowed(res, 'GET, POST');
    }

    const rotateMatch = pathname.match(/^\/api\/developer\/keys\/([^/]+)\/rotate$/);
    if (rotateMatch) {
      if (method === 'POST') return await rotateDeveloperApiKey(user, res, rotateMatch[1]);
      return methodNotAllowed(res, 'POST');
    }

    const keyMatch = pathname.match(/^\/api\/developer\/keys\/([^/]+)$/);
    if (keyMatch) {
      if (method === 'GET') return await getApiKey(user, res, keyMatch[1]);
      if (method === 'DELETE') return await revokeDeveloperApiKey(user, res, keyMatch[1]);
      return methodNotAllowed(res, 'GET, DELETE');
    }

    sendError(res, 404, 'NOT_FOUND', 'Endpoint not found.');
  } catch (err: any) {
    // Log only a sanitized message: never tokens, bodies, secrets or stacks.
    console.error(
      `[Developer API management] ${method} ${pathname} failed: ${err?.message || 'unknown error'}`
    );
    if (!res.headersSent) {
      sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}
