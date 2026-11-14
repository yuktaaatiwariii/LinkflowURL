import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Builds the public OpenAPI and Postman artifacts from the single endpoint
 * catalog in `src/constants/apiReference.json`.
 *
 * The catalog is transcribed from the real controllers/DTOs in
 * `server/developer-api`. Keeping every artifact downstream of it means the
 * documentation portal, the playground, OpenAPI and Postman cannot drift apart.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '..', '..');

export function loadCatalog(root = repoRoot) {
  const file = path.join(root, 'src', 'constants', 'apiReference.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const CATEGORY_TAGS = {
  links: 'Links',
  qr: 'QR codes',
  analytics: 'Analytics',
};

const CATEGORY_NAMES = {
  links: 'Links',
  qr: 'QR codes',
  analytics: 'Analytics',
};

const RANGE_SCHEMA = {
  type: 'object',
  required: ['days', 'since', 'until'],
  properties: {
    days: { type: 'integer', minimum: 1, maximum: 90 },
    since: { type: ['string', 'null'], description: 'First date in the series (YYYY-MM-DD).' },
    until: { type: ['string', 'null'], description: 'Last date in the series (YYYY-MM-DD).' },
  },
};

const ERROR_SCHEMA = {
  type: 'object',
  required: ['success', 'message', 'error'],
  properties: {
    success: { type: 'boolean', const: false },
    message: { type: 'string' },
    error: {
      type: 'object',
      required: ['code'],
      properties: { code: { type: 'string' } },
    },
  },
};

function successEnvelope(dataSchema) {
  return {
    type: 'object',
    required: ['success', 'message', 'data'],
    properties: {
      success: { type: 'boolean', const: true },
      message: { type: 'string' },
      data: dataSchema,
    },
  };
}

const LINK_SCHEMA = {
  type: 'object',
  required: [
    'id',
    'originalUrl',
    'shortUrl',
    'shortCode',
    'customAlias',
    'title',
    'isActive',
    'expiresAt',
    'clicks',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: { type: 'string' },
    originalUrl: { type: 'string', format: 'uri' },
    shortUrl: { type: 'string', format: 'uri' },
    shortCode: { type: 'string' },
    customAlias: { type: ['string', 'null'] },
    title: { type: ['string', 'null'] },
    isActive: { type: 'boolean' },
    expiresAt: { type: ['string', 'null'], format: 'date-time' },
    clicks: { type: 'integer', minimum: 0 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const QR_SCHEMA = {
  type: 'object',
  required: ['id', 'title', 'targetUrl', 'linkId', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    targetUrl: { type: 'string', format: 'uri' },
    linkId: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const QR_IMAGE_SCHEMA = {
  type: 'object',
  required: [
    'mimeType',
    'encoding',
    'dataUrl',
    'width',
    'margin',
    'errorCorrectionLevel',
    'dark',
    'light',
  ],
  properties: {
    mimeType: { type: 'string', const: 'image/png' },
    encoding: { type: 'string', const: 'data-uri' },
    dataUrl: { type: 'string', description: 'PNG encoded as a data URI.' },
    width: { type: 'integer' },
    margin: { type: 'integer' },
    errorCorrectionLevel: { type: 'string', enum: ['L', 'M', 'Q', 'H'] },
    dark: { type: 'string' },
    light: { type: 'string' },
  },
};

const DAILY_SCHEMA = {
  type: 'object',
  required: ['date', 'clicks'],
  properties: {
    date: { type: 'string', description: 'UTC calendar day (YYYY-MM-DD).' },
    clicks: { type: 'integer', minimum: 0 },
  },
};

const ID_ONLY_SCHEMA = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
};

const LIST_LINKS_DATA = {
  type: 'object',
  required: ['links', 'total', 'limit', 'offset'],
  properties: {
    links: { type: 'array', items: { $ref: '#/components/schemas/Link' } },
    total: { type: 'integer' },
    limit: { type: 'integer' },
    offset: { type: 'integer' },
  },
};

const LIST_QR_DATA = {
  type: 'object',
  required: ['qrs', 'total', 'limit', 'offset'],
  properties: {
    qrs: { type: 'array', items: { $ref: '#/components/schemas/QrCode' } },
    total: { type: 'integer' },
    limit: { type: 'integer' },
    offset: { type: 'integer' },
  },
};

const LINK_ANALYTICS_DATA = {
  type: 'object',
  required: ['link', 'totalClicks', 'range', 'daily'],
  properties: {
    link: { $ref: '#/components/schemas/Link' },
    totalClicks: { type: 'integer', minimum: 0 },
    range: { $ref: '#/components/schemas/DateRange' },
    daily: { type: 'array', items: { $ref: '#/components/schemas/DailyClickPoint' } },
  },
};

const QR_ANALYTICS_LINKED = {
  type: 'object',
  required: ['qr', 'supported', 'tracking', 'link', 'totalClicks', 'range', 'daily'],
  properties: {
    qr: { $ref: '#/components/schemas/QrCode' },
    supported: { type: 'boolean', const: true },
    tracking: { type: 'string', const: 'linked-link-clicks' },
    link: { $ref: '#/components/schemas/Link' },
    totalClicks: { type: 'integer', minimum: 0 },
    range: { $ref: '#/components/schemas/DateRange' },
    daily: { type: 'array', items: { $ref: '#/components/schemas/DailyClickPoint' } },
  },
};

const QR_ANALYTICS_UNSUPPORTED = {
  type: 'object',
  required: ['qr', 'supported', 'reason'],
  properties: {
    qr: { $ref: '#/components/schemas/QrCode' },
    supported: { type: 'boolean', const: false },
    reason: { type: 'string' },
  },
};

const QR_CREATE_DATA = {
  type: 'object',
  required: ['qr', 'image'],
  properties: {
    qr: { $ref: '#/components/schemas/QrCode' },
    image: { $ref: '#/components/schemas/QrImage' },
  },
};

const OVERVIEW_DATA = {
  type: 'object',
  required: ['totals', 'range', 'daily', 'mostClickedLink', 'recentQrCodes'],
  properties: {
    totals: {
      type: 'object',
      required: ['links', 'activeLinks', 'clicks', 'qrCodes', 'linkedQrCodes'],
      properties: {
        links: { type: 'integer' },
        activeLinks: { type: 'integer' },
        clicks: { type: 'integer' },
        qrCodes: { type: 'integer' },
        linkedQrCodes: { type: 'integer' },
      },
    },
    range: { $ref: '#/components/schemas/DateRange' },
    daily: { type: 'array', items: { $ref: '#/components/schemas/DailyClickPoint' } },
    mostClickedLink: {
      oneOf: [{ $ref: '#/components/schemas/Link' }, { type: 'null' }],
    },
    recentQrCodes: { type: 'array', items: { $ref: '#/components/schemas/QrCode' } },
  },
};

const SUCCESS_DATA = {
  'list-links': LIST_LINKS_DATA,
  'create-link': { $ref: '#/components/schemas/Link' },
  'get-link': { $ref: '#/components/schemas/Link' },
  'delete-link': ID_ONLY_SCHEMA,
  'link-analytics': LINK_ANALYTICS_DATA,
  'list-qr': LIST_QR_DATA,
  'create-qr': QR_CREATE_DATA,
  'get-qr': QR_CREATE_DATA,
  'delete-qr': ID_ONLY_SCHEMA,
  'qr-analytics': {
    oneOf: [
      { $ref: '#/components/schemas/QrAnalyticsLinked' },
      { $ref: '#/components/schemas/QrAnalyticsUnsupported' },
    ],
  },
  'analytics-overview': OVERVIEW_DATA,
};

function operationId(id) {
  return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function errorStatuses(endpoint, catalog) {
  const statuses = new Set();
  for (const code of endpoint.errorCodes || []) {
    const entry = catalog.errorCatalog.find((item) => item.code === code);
    if (entry) statuses.add(entry.status);
  }
  return [...statuses].sort((a, b) => a - b);
}

function parameterForQuery(param) {
  return {
    name: param.name,
    in: 'query',
    required: Boolean(param.required),
    description: param.description,
    schema: {
      type: param.type,
      ...(param.default !== undefined ? { default: param.default } : {}),
      ...(param.minimum !== undefined ? { minimum: param.minimum } : {}),
      ...(param.maximum !== undefined ? { maximum: param.maximum } : {}),
      ...(param.enum ? { enum: param.enum } : {}),
    },
  };
}

function parameterForPath(param) {
  return {
    name: param.name,
    in: 'path',
    required: true,
    description: param.description,
    schema: { type: 'string' },
  };
}

export function buildOpenApi(catalog) {
  const paths = {};

  for (const endpoint of catalog.endpoints) {
    const statusKey = String(endpoint.success.status);
    const responses = {
      [statusKey]: {
        description: endpoint.success.description,
        content: {
          'application/json': {
            schema: successEnvelope(SUCCESS_DATA[endpoint.id]),
            example: endpoint.success.example,
          },
        },
      },
    };

    for (const status of errorStatuses(endpoint, catalog)) {
      const codes = (endpoint.errorCodes || []).filter((code) => {
        const entry = catalog.errorCatalog.find((item) => item.code === code);
        return entry && entry.status === status;
      });
      responses[String(status)] = {
        description: codes
          .map((code) => catalog.errorCatalog.find((item) => item.code === code).message)
          .join(' '),
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            examples: Object.fromEntries(
              codes.map((code) => [
                code,
                {
                  value: {
                    success: false,
                    message: catalog.errorCatalog.find((item) => item.code === code).message,
                    error: { code },
                  },
                },
              ])
            ),
          },
        },
      };
    }

    // Authentication failures are common to every operation.
    if (!responses['401']) {
      responses['401'] = {
        description: 'Missing, invalid, revoked or expired API key.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            examples: {
              MISSING_API_KEY: {
                value: {
                  success: false,
                  message: 'An API key is required in the X-API-Key header.',
                  error: { code: 'MISSING_API_KEY' },
                },
              },
              INVALID_API_KEY: {
                value: {
                  success: false,
                  message: 'Invalid API credentials.',
                  error: { code: 'INVALID_API_KEY' },
                },
              },
            },
          },
        },
      };
    }
    if (!responses['403']) {
      responses['403'] = {
        description: 'The API key lacks the required scope, or the account no longer exists.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              message: `This API key lacks the required scope: ${endpoint.scope}.`,
              error: { code: 'INSUFFICIENT_SCOPE' },
            },
          },
        },
      };
    }
    if (!responses['405']) {
      responses['405'] = {
        description: 'The path exists but the method is not supported.',
        headers: {
          Allow: {
            description: 'Supported methods for this path.',
            schema: { type: 'string' },
          },
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              message: 'Method not allowed for this endpoint.',
              error: { code: 'METHOD_NOT_ALLOWED' },
            },
          },
        },
      };
    }
    if (!responses['500']) {
      responses['500'] = {
        description: 'Unexpected server error.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              message: 'An unexpected error occurred.',
              error: { code: 'INTERNAL_ERROR' },
            },
          },
        },
      };
    }

    const parameters = [
      ...(endpoint.pathParams || []).map(parameterForPath),
      ...(endpoint.queryParams || []).map(parameterForQuery),
    ];

    const operation = {
      operationId: operationId(endpoint.id),
      summary: endpoint.summary,
      description: endpoint.description,
      tags: [CATEGORY_TAGS[endpoint.category]],
      security: [{ ApiKeyAuth: [] }],
      'x-required-scope': endpoint.scope,
      ...(parameters.length ? { parameters } : {}),
      ...(endpoint.bodySchema
        ? {
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: endpoint.bodySchema.schema,
                  example: endpoint.bodySchema.example,
                },
              },
            },
          }
        : {}),
      responses,
    };

    const method = endpoint.method.toLowerCase();
    paths[endpoint.path] = paths[endpoint.path] || {};
    paths[endpoint.path][method] = operation;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: `${catalog.meta.title} (v${catalog.meta.apiVersion})`,
      version: catalog.meta.version,
      description: catalog.meta.description,
      license: { name: 'Proprietary' },
    },
    servers: [
      {
        url: catalog.meta.baseUrl,
        description: 'Production API',
      },
    ],
    tags: [
      { name: 'Links', description: 'Create, list, retrieve and delete short links.' },
      { name: 'QR codes', description: 'Generate QR images and manage QR metadata.' },
      {
        name: 'Analytics',
        description: 'Click analytics actually recorded by LinkFlow. QR scans are not tracked.',
      },
    ],
    paths,
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: catalog.meta.authHeader,
          description:
            'Send a test or live API key created in the LinkFlow Developer Dashboard. Keys are shown once.',
        },
      },
      schemas: {
        Error: ERROR_SCHEMA,
        Link: LINK_SCHEMA,
        QrCode: QR_SCHEMA,
        QrImage: QR_IMAGE_SCHEMA,
        DailyClickPoint: DAILY_SCHEMA,
        DateRange: RANGE_SCHEMA,
        QrAnalyticsLinked: QR_ANALYTICS_LINKED,
        QrAnalyticsUnsupported: QR_ANALYTICS_UNSUPPORTED,
      },
    },
    'x-linkflow-scopes': catalog.scopes,
    'x-linkflow-errors': catalog.errorCatalog,
  };
}

function postmanUrl(endpoint, catalog) {
  const query = Object.entries(endpoint.request.query || {}).map(([key, value]) => ({
    key,
    value: String(value),
  }));
  const pathSegments = endpoint.path.split('/').filter(Boolean);
  return {
    raw:
      `{{baseUrl}}${endpoint.path}` +
      (query.length
        ? `?${query.map((entry) => `${entry.key}=${entry.value}`).join('&')}`
        : ''),
    host: ['{{baseUrl}}'],
    path: pathSegments,
    ...(query.length ? { query } : {}),
    ...(endpoint.pathParams.length
      ? {
          variable: endpoint.pathParams.map((param) => ({
            key: param.name,
            value: 'YOUR_' + param.name.toUpperCase(),
          })),
        }
      : {}),
  };
}

export function buildPostmanCollection(catalog) {
  const grouped = new Map();

  for (const endpoint of catalog.endpoints) {
    const category = endpoint.category;
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(endpoint);
  }

  const bodyRaw = endpoint =>
    endpoint.request.body ? JSON.stringify(endpoint.request.body, null, 2) : null;

  const items = [...grouped.entries()].map(([category, endpoints]) => ({
    name: CATEGORY_NAMES[category],
    item: endpoints.map(endpoint => {
      const raw = bodyRaw(endpoint);
      return {
        name: `${endpoint.method} ${endpoint.path} — ${endpoint.name}`,
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                'pm.test("Response is JSON", function () {',
                '  pm.response.to.have.jsonBody();',
                '});',
              ],
            },
          },
        ],
        request: {
          method: endpoint.method,
          header: [
            { key: 'X-API-Key', value: '{{apiKey}}' },
            ...(raw ? [{ key: 'Content-Type', value: 'application/json' }] : []),
          ],
          url: postmanUrl(endpoint, catalog),
          ...(raw
            ? {
                body: {
                  mode: 'raw',
                  raw,
                  options: { raw: { language: 'json' } },
                },
              }
            : {}),
          description: `${endpoint.description}\n\nRequired scope: ${endpoint.scope}`,
        },
        response: [
          {
            name: `${endpoint.success.status} ${endpoint.name}`,
            originalRequest: {
              method: endpoint.method,
              header: [{ key: 'X-API-Key', value: '{{apiKey}}' }],
              url: postmanUrl(endpoint, catalog),
            },
            status: endpoint.success.status === 201 ? 'Created' : 'OK',
            code: endpoint.success.status,
            _postman_previewlanguage: 'json',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify(endpoint.success.example, null, 2),
          },
        ],
      };
    }),
  }));

  return {
    info: {
      name: 'LinkFlow API',
      description: [
        'Import this collection, set the `apiKey` collection variable to a test key from the LinkFlow Developer Dashboard, and run any request.',
        '',
        'Authentication uses the X-API-Key header. Never commit a real key to source control.',
        '',
        'QR scan analytics are not supported. QR analytics report linked-link clicks only.',
      ].join('\n'),
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
    variable: [
      { key: 'baseUrl', value: catalog.meta.baseUrl, type: 'string' },
      { key: 'apiKey', value: 'YOUR_API_KEY', type: 'string' },
    ],
    auth: {
      type: 'apikey',
      apikey: [{ key: 'X-API-Key', value: '{{apiKey}}', in: 'header' }],
    },
  };
}

export function buildPostmanEnvironment(catalog) {
  return {
    name: 'LinkFlow API',
    values: [
      { key: 'baseUrl', value: catalog.meta.baseUrl, type: 'default', enabled: true },
      { key: 'apiKey', value: 'YOUR_API_KEY', type: 'secret', enabled: true },
    ],
    _postman_variable_scope: 'environment',
  };
}

export function buildArtifacts(catalog) {
  return {
    'openapi.json': buildOpenApi(catalog),
    'linkflow-postman-collection.json': buildPostmanCollection(catalog),
    'linkflow-postman-environment.json': buildPostmanEnvironment(catalog),
  };
}

export function writeArtifacts(root = repoRoot) {
  const catalog = loadCatalog(root);
  const artifacts = buildArtifacts(catalog);
  const publicDir = path.join(root, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  for (const [filename, payload] of Object.entries(artifacts)) {
    fs.writeFileSync(path.join(publicDir, filename), JSON.stringify(payload, null, 2) + '\n');
  }
  return Object.keys(artifacts);
}
