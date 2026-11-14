import type { ServerResponse } from 'http';
import type { ApiDeveloper } from '../interfaces/api-developer.interface';
import type { DeveloperApiScope } from '../../types';
import { sendError } from '../http/envelope';

/**
 * Reusable scope enforcement for public developer endpoints.
 *
 * Scopes come from the persisted key record resolved by the API-key guard;
 * they are never read from the request body.
 */
export function hasScope(developer: ApiDeveloper, scope: DeveloperApiScope): boolean {
  return developer.scopes.includes(scope);
}

export function requireScope(
  developer: ApiDeveloper,
  scope: DeveloperApiScope,
  res: ServerResponse
): boolean {
  if (hasScope(developer, scope)) return true;
  sendError(
    res,
    403,
    'INSUFFICIENT_SCOPE',
    `This API key lacks the required scope: ${scope}.`
  );
  return false;
}
