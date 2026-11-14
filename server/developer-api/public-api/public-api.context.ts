import type { IncomingMessage, ServerResponse } from 'http';
import type { ApiDeveloper, DeveloperApiDependencies } from '../interfaces/api-developer.interface';

/** Everything a public controller needs for one authenticated request. */
export interface PublicApiContext {
  req: IncomingMessage;
  res: ServerResponse;
  deps: DeveloperApiDependencies;
  developer: ApiDeveloper;
  searchParams: URLSearchParams;
}
