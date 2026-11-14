import type { IncomingMessage } from 'http';
import type { ApiDeveloper } from '../interfaces/api-developer.interface';

/**
 * Request-scoped developer decoration.
 *
 * The project has no NestJS execution context, so the authenticated developer
 * is attached with a `WeakMap` keyed by the request object. Nothing leaks
 * between requests and no property is added to the shared `IncomingMessage`
 * prototype.
 */
const requestDevelopers = new WeakMap<IncomingMessage, ApiDeveloper>();

export function attachApiDeveloper(req: IncomingMessage, developer: ApiDeveloper): void {
  requestDevelopers.set(req, developer);
}

export function getApiDeveloper(req: IncomingMessage): ApiDeveloper | undefined {
  return requestDevelopers.get(req);
}
