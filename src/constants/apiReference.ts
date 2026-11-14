import raw from './apiReference.json';

/**
 * Typed view over the single endpoint catalog.
 *
 * Every documentation page, the API playground, the OpenAPI generator and the
 * Postman generator read this same data. It is transcribed from the actual
 * controllers and DTO validators in `server/developer-api`.
 */

export type ApiCategory = 'links' | 'qr' | 'analytics';
export type ApiMethod = 'GET' | 'POST' | 'DELETE';

export interface ApiParameter {
  name: string;
  type: string;
  required: boolean;
  default?: number | string;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  description: string;
}

export interface ApiBodySchema {
  /** JSON Schema fragment used by OpenAPI and the playground validator. */
  schema: Record<string, any>;
  example: Record<string, any>;
}

export interface ApiSuccess {
  status: number;
  description: string;
  example: any;
  alternativeExample?: any;
}

export interface ApiEndpoint {
  id: string;
  category: ApiCategory;
  name: string;
  method: ApiMethod;
  path: string;
  scope: string;
  summary: string;
  description: string;
  pathParams: ApiParameter[];
  queryParams: ApiParameter[];
  bodySchema: ApiBodySchema | null;
  request: {
    path: string;
    query: Record<string, string>;
    body: Record<string, any> | null;
  };
  success: ApiSuccess;
  errorCodes: string[];
  notes: string[];
}

export interface ApiScope {
  id: string;
  label: string;
  description: string;
  endpoints: string[];
}

export interface ApiErrorEntry {
  status: number;
  code: string;
  message: string;
  meaning: string;
  handling: string;
}

export interface ApiReference {
  meta: {
    title: string;
    version: string;
    apiVersion: string;
    baseUrl: string;
    description: string;
    authHeader: string;
    keyEnvironments: string[];
    pagination: {
      limit: { default: number; minimum: number; maximum: number };
      offset: { default: number; minimum: number; maximum: number };
    };
    days: { default: number; minimum: number; maximum: number };
  };
  scopes: ApiScope[];
  errorCatalog: ApiErrorEntry[];
  endpoints: ApiEndpoint[];
}

export const API_REFERENCE = raw as unknown as ApiReference;

export const API_ENDPOINTS: ApiEndpoint[] = API_REFERENCE.endpoints;
export const API_ERRORS: ApiErrorEntry[] = API_REFERENCE.errorCatalog;
export const API_SCOPES: ApiScope[] = API_REFERENCE.scopes;

export const API_CATEGORY_LABELS: Record<ApiCategory, string> = {
  links: 'Links',
  qr: 'QR codes',
  analytics: 'Analytics',
};

export function endpointsByCategory(category: ApiCategory): ApiEndpoint[] {
  return API_ENDPOINTS.filter((endpoint) => endpoint.category === category);
}

export function findEndpoint(id: string): ApiEndpoint {
  const endpoint = API_ENDPOINTS.find((entry) => entry.id === id);
  if (!endpoint) {
    throw new Error(`Unknown API endpoint in catalog: ${id}`);
  }
  return endpoint;
}

export function findError(code: string): ApiErrorEntry | undefined {
  return API_ERRORS.find((entry) => entry.code === code);
}
