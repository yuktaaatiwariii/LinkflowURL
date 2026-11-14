import { getApiBaseUrl } from './api';
import type { ApiEndpoint } from '../constants/apiReference';

/**
 * Documentation helpers.
 *
 * Nothing here persists an API key. Playground credentials live in React
 * state only and are sent directly from the client to the LinkFlow API; there
 * is no documentation proxy in the middle.
 */

export interface EndpointExamples {
  curl: string;
  javascript: string;
  node: string;
  python: string;
}

export interface PlaygroundResponse {
  status: number;
  statusText: string;
  durationMs: number;
  contentType: string | null;
  bodyText: string;
  json: unknown | null;
  sizeBytes: number;
  truncated: boolean;
}

export function docsApiBaseUrl(): string {
  return getApiBaseUrl();
}

export function artifactUrl(kind: 'openapi' | 'postman' | 'postmanEnvironment'): string {
  const base = getApiBaseUrl();
  if (kind === 'openapi') return `${base}/api/openapi.json`;
  if (kind === 'postman') return `${base}/api/postman/collection.json`;
  return `${base}/api/postman/environment.json`;
}

function trimBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function substitutePathParams(
  path: string,
  pathParams: { name: string }[],
  values: Record<string, string>,
  placeholderPrefix = 'YOUR_'
): string {
  let result = path;
  for (const param of pathParams) {
    const value = (values[param.name] || '').trim();
    if (value) {
      result = result.replace(`:${param.name}`, encodeURIComponent(value));
    } else {
      result = result.replace(`:${param.name}`, `${placeholderPrefix}${param.name.toUpperCase()}`);
    }
  }
  return result;
}

export function buildQueryString(values: Record<string, string>): string {
  const entries = Object.entries(values).filter(([, value]) => String(value).trim().length > 0);
  if (entries.length === 0) return '';
  const params = new URLSearchParams();
  for (const [key, value] of entries) params.set(key, String(value));
  return `?${params.toString()}`;
}

export function buildRequestUrl(
  endpoint: ApiEndpoint,
  baseUrl: string,
  pathParams: Record<string, string> = {},
  query: Record<string, string> = {}
): string {
  const path = substitutePathParams(endpoint.path, endpoint.pathParams, pathParams);
  return `${trimBase(baseUrl)}${path}${buildQueryString(query)}`;
}

export function defaultPathParams(endpoint: ApiEndpoint): Record<string, string> {
  return Object.fromEntries(endpoint.pathParams.map((param) => [param.name, '']));
}

export function defaultQueryParams(endpoint: ApiEndpoint): Record<string, string> {
  return Object.fromEntries(
    endpoint.queryParams.map((param) => [
      param.name,
      param.default !== undefined ? String(param.default) : '',
    ])
  );
}

function indentJson(value: unknown, spaces: number): string {
  const raw = JSON.stringify(value, null, 2) || 'null';
  return raw
    .split('\n')
    .map((line, index) => (index === 0 ? line : ' '.repeat(spaces) + line))
    .join('\n');
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildEndpointExamples(endpoint: ApiEndpoint): EndpointExamples {
  const apiBase = 'https://api.linkflowurl.com';
  const url = `${apiBase}${endpoint.request.path}${buildQueryString(endpoint.request.query)}`;
  const body = endpoint.request.body;
  const bodyJson = body ? JSON.stringify(body, null, 2) : '';

  const curlLines = [`curl -X ${endpoint.method} ${shellQuote(url)}`, '  -H "X-API-Key: $LINKFLOW_API_KEY"'];
  if (body) {
    curlLines[curlLines.length - 1] += ' \\';
    curlLines.push('  -H "Content-Type: application/json" \\');
    curlLines.push(`  -d ${shellQuote(bodyJson)}`);
  }
  const curl = curlLines.join('\n');

  const jsBody = body
    ? `\nconst body = ${indentJson(body, 0)};\n`
    : '';
  const jsRequestOptions = [
    `  method: "${endpoint.method}",`,
    '  headers: {',
    '    "X-API-Key": apiKey,',
    ...(body ? ['    "Content-Type": "application/json",'] : []),
    '  },',
    ...(body ? ['  body: JSON.stringify(body),'] : []),
  ].join('\n');

  const javascript = `const baseUrl = "${apiBase}";
const apiKey = process.env.LINKFLOW_API_KEY;
if (!apiKey) throw new Error("Set LINKFLOW_API_KEY in your server environment.");
${jsBody}
const response = await fetch(
  \`\${baseUrl}${endpoint.request.path}${buildQueryString(endpoint.request.query)}\`,
  {
${jsRequestOptions}
  }
);

const payload = await response.json();
if (!response.ok) {
  throw new Error(\`\${payload.error?.code}: \${payload.message}\`);
}
console.log(payload);
`;

  const node = `// Node.js 18+ (built-in fetch). Never run this in a browser.
import process from "node:process";

const apiKey = process.env.LINKFLOW_API_KEY;
if (!apiKey) throw new Error("Set LINKFLOW_API_KEY in your server environment.");
${jsBody}
const response = await fetch(
  "${url.replace(/\?/g, '?')}",
  {
${jsRequestOptions.replace(/\n/g, '\n')}
  }
);

const payload = await response.json();
console.log(response.status, payload);
`;

  const pythonParams = Object.keys(endpoint.request.query).length
    ? `    params=${JSON.stringify(endpoint.request.query)},\n`
    : '';
  const pythonBody = body
    ? `    json=${indentJson(body, 4)},\n`
    : '';
  const python = `import os
import requests

api_key = os.environ["LINKFLOW_API_KEY"]
url = "${apiBase}${endpoint.request.path}"

response = requests.${endpoint.method.toLowerCase()}(
    url,
${pythonParams}${pythonBody}    headers={"X-API-Key": api_key},
    timeout=30,
)

print(response.status_code)
print(response.json())
`;

  return { curl, javascript, node, python };
}

export function buildCurlCommand(input: {
  method: string;
  url: string;
  body?: string | null;
}): string {
  const lines = [
    `curl -X ${input.method} ${shellQuote(input.url)}`,
    '  -H "X-API-Key: $LINKFLOW_API_KEY"',
  ];
  if (input.body && input.body.trim()) {
    lines[lines.length - 1] += ' \\';
    lines.push('  -H "Content-Type: application/json" \\');
    lines.push(`  -d ${shellQuote(input.body)}`);
  }
  return lines.join('\n');
}

export interface ValidationIssue {
  path: string;
  message: string;
}

const INTEGER = /^-?\d+$/;

function typeMatches(expected: unknown, value: unknown): boolean {
  if (Array.isArray(expected)) {
    return expected.some((entry) => typeMatches(entry, value));
  }
  switch (expected) {
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return true;
  }
}

/**
 * Lightweight JSON Schema validation for the fields the public API actually
 * validates. It mirrors the DTO rules closely enough for the playground to
 * catch mistakes before a round trip.
 */
export function validateAgainstSchema(
  schema: Record<string, any> | null | undefined,
  value: unknown,
  path = 'body'
): ValidationIssue[] {
  if (!schema) return [];
  const issues: ValidationIssue[] = [];

  if (schema.anyOf) {
    const results: ValidationIssue[][] = schema.anyOf.map((entry: Record<string, any>) =>
      validateAgainstSchema(entry, value, path)
    );
    if (!results.some((entry) => entry.length === 0)) {
      issues.push({ path, message: 'Provide at least one supported set of fields.' });
      return issues;
    }
  }

  if (schema.type && !typeMatches(schema.type, value)) {
    const expected = Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type;
    issues.push({ path, message: `Expected ${expected}.` });
    return issues;
  }

  if (typeof value === 'string') {
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      issues.push({ path, message: `Must be ${schema.maxLength} characters or fewer.` });
    }
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      issues.push({ path, message: `Must be at least ${schema.minLength} characters.` });
    }
    if (schema.pattern) {
      try {
        if (!new RegExp(schema.pattern).test(value)) {
          issues.push({ path, message: `Does not match the required format (${schema.pattern}).` });
        }
      } catch {
        // A malformed pattern in the catalog should never break the UI.
      }
    }
    if (schema.enum && !schema.enum.includes(value)) {
      issues.push({ path, message: `Must be one of: ${schema.enum.join(', ')}.` });
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      issues.push({ path, message: `Must be at least ${schema.minimum}.` });
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      issues.push({ path, message: `Must be at most ${schema.maximum}.` });
    }
  }

  if (schema.type === 'object' && typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    for (const required of schema.required || []) {
      if (record[required] === undefined || record[required] === null || record[required] === '') {
        issues.push({ path: `${path}.${required}`, message: 'This field is required.' });
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (record[key] !== undefined) {
        issues.push(
          ...validateAgainstSchema(childSchema as Record<string, any>, record[key], `${path}.${key}`)
        );
      }
    }
  }

  return issues;
}

export function validateIntegerParam(
  value: string,
  label: string,
  minimum?: number,
  maximum?: number
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!INTEGER.test(trimmed)) return `${label} must be a whole number.`;
  const parsed = Number(trimmed);
  if (minimum !== undefined && parsed < minimum) return `${label} must be at least ${minimum}.`;
  if (maximum !== undefined && parsed > maximum) return `${label} must be at most ${maximum}.`;
  return null;
}

export interface ExecuteRequestInput {
  url: string;
  method: string;
  apiKey: string;
  body?: string | null;
  timeoutMs?: number;
}

/**
 * Sends a real request to the real LinkFlow API. No mock responses, no proxy,
 * no credential logging.
 */
export async function executeApiRequest(
  input: ExecuteRequestInput
): Promise<PlaygroundResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 30000);
  const startedAt = Date.now();

  try {
    const headers: Record<string, string> = {
      'X-API-Key': input.apiKey.trim(),
      Accept: 'application/json',
    };
    const hasBody = Boolean(input.body && input.body.trim());
    if (hasBody) headers['Content-Type'] = 'application/json';

    const response = await fetch(input.url, {
      method: input.method,
      headers,
      body: hasBody ? input.body! : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    const durationMs = Date.now() - startedAt;
    let json: unknown | null = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      durationMs,
      contentType: response.headers.get('content-type'),
      bodyText: raw,
      json,
      sizeBytes: raw.length,
      truncated: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Formats bytes for the playground response summary. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
