'use strict';

/**
 * Phase 4 — developer documentation portal checks.
 *
 * These tests deliberately verify documentation against source rather than
 * restating the catalog: routes are read from the public API module, error
 * codes from the guards/controllers, and validation limits from the DTOs and
 * presenters. Generated OpenAPI/Postman artifacts must be identical to a fresh
 * build of the catalog so the portal, specs and collection cannot drift.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(ROOT, relative));

const PUBLIC_API_DIR = 'server/developer-api/public-api';
const GUARDS_DIR = 'server/developer-api/guards';
const DTO_DIR = 'server/developer-api/dto';

const PUBLIC_SOURCE_FILES = [
  ...fs
    .readdirSync(path.join(ROOT, PUBLIC_API_DIR))
    .filter((file) => file.endsWith('.ts'))
    .map((file) => path.join(PUBLIC_API_DIR, file)),
  ...fs
    .readdirSync(path.join(ROOT, GUARDS_DIR))
    .filter((file) => file.endsWith('.ts'))
    .map((file) => path.join(GUARDS_DIR, file)),
  path.join('server/developer-api/http/body.ts'),
];

let lib = null;
const apiLib = async () => {
  if (!lib) lib = await import('../scripts/lib/api-artifacts.mjs');
  return lib;
};

const catalog = JSON.parse(read('src/constants/apiReference.json'));

function walkRefs(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.$ref === 'string') visit(node.$ref);
  for (const value of Object.values(node)) walkRefs(value, visit);
}

function resolveRef(document, ref) {
  assert.ok(ref.startsWith('#/'), `Only local refs are supported: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((current, part) => (current == null ? current : current[part]), document);
}

test('documentation routes exist for every required page', () => {
  const routes = [
    'app/developers/_layout.tsx',
    'app/developers/index.tsx',
    'app/developers/getting-started.tsx',
    'app/developers/authentication.tsx',
    'app/developers/api/links.tsx',
    'app/developers/api/qr.tsx',
    'app/developers/api/analytics.tsx',
    'app/developers/errors.tsx',
    'app/developers/changelog.tsx',
    'app/developers/playground.tsx',
  ];
  for (const route of routes) {
    assert.ok(exists(route), `Missing documentation route: ${route}`);
  }

  const layout = read('app/developers/_layout.tsx');
  assert.match(layout, /DocsShell/, 'The docs layout must render the docs shell');
  assert.doesNotMatch(
    layout,
    /useAuth|from '\.\.\/\(protected\)/,
    'Documentation must stay public and not depend on a session'
  );

  const shell = read('src/components/docs/DocsShell.tsx');
  for (const href of [
    '/developers',
    '/developers/getting-started',
    '/developers/authentication',
    '/developers/api/links',
    '/developers/api/qr',
    '/developers/api/analytics',
    '/developers/errors',
    '/developers/changelog',
    '/developers/playground',
  ]) {
    assert.ok(shell.includes(`'${href}'`), `Sidebar is missing ${href}`);
  }
});

test('every catalog endpoint is implemented by the public API router', () => {
  const module = read(path.join(PUBLIC_API_DIR, 'public-api.module.ts'));
  const compact = module.replace(/\s+/g, '');

  for (const endpoint of catalog.endpoints) {
    if (endpoint.path.includes(':')) {
      const segments = endpoint.path
        .split('/')
        .map((segment) => (segment.startsWith(':') ? '([^/]+)' : segment));
      const literal = `pathname.match(/^${segments.join('\\/')}$/)`;
      assert.ok(
        compact.includes(literal),
        `Router has no matcher for ${endpoint.method} ${endpoint.path}`
      );
    } else {
      assert.ok(
        module.includes(`pathname === '${endpoint.path}'`),
        `Router has no handler for ${endpoint.method} ${endpoint.path}`
      );
    }

    assert.ok(
      module.includes(`method === '${endpoint.method}'`),
      `Router never checks ${endpoint.method} for ${endpoint.path}`
    );
    assert.ok(
      module.includes(`requireScope(ctx.developer, '${endpoint.scope}'`),
      `Scope ${endpoint.scope} is documented but not enforced by requireScope`
    );
  }

  const documented = new Set(
    catalog.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)
  );
  assert.equal(documented.size, catalog.endpoints.length, 'Catalog has duplicate endpoints');
  assert.equal(catalog.endpoints.length, 11, 'Unexpected endpoint count in catalog');
});

test('documented scopes match the scopes the backend defines', () => {
  const crypto = read('server/developer-api/keys/api-key-crypto.ts');
  const block = crypto.match(/API_SCOPES[^=]*=\s*\[([\s\S]*?)\]/);
  assert.ok(block, 'API_SCOPES not found');
  const backendScopes = new Set(
    [...block[1].matchAll(/'([a-z]+:[a-z]+)'/g)].map((match) => match[1])
  );
  const documentedScopes = new Set(catalog.scopes.map((scope) => scope.id));

  assert.deepEqual([...documentedScopes].sort(), [...backendScopes].sort());
  for (const scope of catalog.scopes) {
    assert.ok(scope.endpoints.length > 0, `${scope.id} lists no endpoints`);
    for (const endpoint of scope.endpoints) {
      const [, method, endpointPath] = endpoint.match(/^([A-Z]+) (\S+)$/) || [];
      assert.ok(method && endpointPath, `Malformed scope endpoint: ${endpoint}`);
      assert.ok(
        catalog.endpoints.some(
          (entry) => entry.method === method && entry.path === endpointPath
        ),
        `${scope.id} references a non-existent endpoint: ${endpoint}`
      );
    }
  }
});

test('error catalog is verified against emitted backend codes', () => {
  const emitted = new Set();
  for (const file of PUBLIC_SOURCE_FILES) {
    const source = read(file);
    for (const match of source.matchAll(
      /(?:sendError|failure|reject)\(\s*(?:ctx\.res|res)?,?\s*\d{3},\s*'([A-Z][A-Z0-9_]+)'/g
    )) {
      emitted.add(match[1]);
    }
    for (const match of source.matchAll(/\d{3},\s*\n\s*'([A-Z][A-Z0-9_]+)'/g)) {
      emitted.add(match[1]);
    }
  }

  const documented = new Set(catalog.errorCatalog.map((entry) => entry.code));
  for (const code of emitted) {
    assert.ok(documented.has(code), `Backend emits undocumented error code: ${code}`);
  }
  for (const code of documented) {
    assert.ok(
      PUBLIC_SOURCE_FILES.some((file) => read(file).includes(`'${code}'`)),
      `Documented error code is not emitted anywhere: ${code}`
    );
  }

  assert.ok(!documented.has('UNAUTHORIZED'), 'UNAUTHORIZED is not emitted by /api/v1');
  assert.ok(!documented.has('FORBIDDEN'), 'FORBIDDEN is not emitted by /api/v1');

  const seen = new Set();
  for (const entry of catalog.errorCatalog) {
    assert.ok(!seen.has(entry.code), `Duplicate error code in catalog: ${entry.code}`);
    seen.add(entry.code);
    assert.ok(entry.meaning && entry.handling, `${entry.code} lacks guidance`);
  }
});

test('validation limits in the catalog match the DTOs', () => {
  const validation = read(path.join(DTO_DIR, 'validation.ts'));
  assert.match(validation, /trimmed\.length > 2048/);
  assert.match(validation, /trimmed\.length > 255/);
  assert.match(validation, /trimmed\.length > 50/);
  assert.match(validation, /parsed < 1 \|\| parsed > 100/);
  assert.match(validation, /parsed < 0 \|\| parsed > 100000/);
  assert.match(validation, /parsed < 1 \|\| parsed > 90/);

  const { pagination, days } = catalog.meta;
  assert.deepEqual(pagination.limit, { default: 20, minimum: 1, maximum: 100 });
  assert.deepEqual(pagination.offset, { default: 0, minimum: 0, maximum: 100000 });
  assert.deepEqual(days, { default: 7, minimum: 1, maximum: 90 });

  const linkBody = catalog.endpoints.find((entry) => entry.id === 'create-link').bodySchema.schema;
  assert.equal(linkBody.properties.originalUrl.maxLength, 2048);
  assert.equal(linkBody.properties.title.maxLength, 255);
  assert.equal(linkBody.properties.customAlias.maxLength, 50);
  assert.equal(linkBody.properties.customAlias.pattern, '^[A-Za-z0-9]+$');
  assert.deepEqual(linkBody.required, ['originalUrl']);

  const qrBody = catalog.endpoints.find((entry) => entry.id === 'create-qr').bodySchema.schema;
  assert.equal(qrBody.properties.image.properties.size.minimum, 128);
  assert.equal(qrBody.properties.image.properties.size.maximum, 1024);
  assert.equal(qrBody.properties.image.properties.margin.minimum, 0);
  assert.equal(qrBody.properties.image.properties.margin.maximum, 16);
  assert.deepEqual(qrBody.properties.image.properties.errorCorrectionLevel.enum, [
    'L',
    'M',
    'Q',
    'H',
  ]);

  const qrImage = read('server/developer-api/qr-image.ts');
  assert.match(qrImage, /size:\s*512/);
  assert.match(qrImage, /margin:\s*2/);
  assert.match(qrImage, /errorCorrectionLevel:\s*'M'/);
});

test('response fields in the catalog match the presenters', () => {
  const presenters = read(path.join(PUBLIC_API_DIR, 'presenters.ts'));
  const linkBlock = presenters.match(/interface PublicLink \{([\s\S]*?)\}/);
  const qrBlock = presenters.match(/interface PublicQrCode \{([\s\S]*?)\}/);
  assert.ok(linkBlock && qrBlock, 'Presenters not found');

  const linkFields = new Set(
    [...linkBlock[1].matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1])
  );
  const qrFields = new Set(
    [...qrBlock[1].matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1])
  );

  const linkExample = catalog.endpoints.find((entry) => entry.id === 'get-link').success.example
    .data;
  const qrExample = catalog.endpoints.find((entry) => entry.id === 'get-qr').success.example.data
    .qr;

  assert.deepEqual(Object.keys(linkExample).sort(), [...linkFields].sort());
  assert.deepEqual(Object.keys(qrExample).sort(), [...qrFields].sort());

  const qrImageExample = catalog.endpoints.find((entry) => entry.id === 'get-qr').success.example
    .data.image;
  assert.deepEqual(Object.keys(qrImageExample).sort(), [
    'dark',
    'dataUrl',
    'encoding',
    'errorCorrectionLevel',
    'light',
    'margin',
    'mimeType',
    'width',
  ]);
});

test('QR documentation never claims scan analytics', () => {
  const qrDocs = read('app/developers/api/qr.tsx');
  assert.match(qrDocs, /scan/i);
  assert.match(qrDocs, /supported: false|supported:false/);
  assert.match(qrDocs, /not persisted|not be persisted|not stored/i);

  const qrCatalog = catalog.endpoints.find((entry) => entry.id === 'qr-analytics');
  assert.ok(qrCatalog.success.alternativeExample, 'QR analytics needs an unsupported example');
  const unsupported = qrCatalog.success.alternativeExample.data;
  assert.equal(unsupported.supported, false);
  assert.ok(!('daily' in unsupported), 'Unsupported QR analytics must not invent a daily series');
  assert.ok(!('totalClicks' in unsupported), 'Unsupported QR analytics must not invent clicks');
  assert.equal(qrCatalog.success.example.data.tracking, 'linked-link-clicks');
});

test('OpenAPI artifact is valid and synchronized with the catalog', async () => {
  const { buildOpenApi } = await apiLib();
  const generated = buildOpenApi(catalog);
  const stored = JSON.parse(read('public/openapi.json'));

  assert.deepEqual(
    stored,
    generated,
    'public/openapi.json is stale; run npm run docs:generate'
  );
  assert.equal(stored.openapi, '3.1.0');
  assert.equal(stored.components.securitySchemes.ApiKeyAuth.type, 'apiKey');
  assert.equal(stored.components.securitySchemes.ApiKeyAuth.in, 'header');
  assert.equal(stored.components.securitySchemes.ApiKeyAuth.name, 'X-API-Key');

  const paths = new Set();
  for (const [routePath, operations] of Object.entries(stored.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      paths.add(`${method.toUpperCase()} ${routePath}`);
      assert.ok(operation.summary, `${method} ${routePath} has no summary`);
      assert.ok(operation.description, `${method} ${routePath} has no description`);
      assert.deepEqual(operation.security, [{ ApiKeyAuth: [] }]);
      assert.ok(operation.responses['200'] || operation.responses['201']);
      assert.ok(operation.responses['401'], `${method} ${routePath} lacks a 401 response`);
      assert.ok(operation.responses['403'], `${method} ${routePath} lacks a 403 response`);
      const catalogEndpoint = catalog.endpoints.find(
        (entry) => entry.method === method.toUpperCase() && entry.path === routePath
      );
      assert.ok(catalogEndpoint, 'OpenAPI documents an endpoint absent from the catalog');
      assert.equal(operation['x-required-scope'], catalogEndpoint.scope);
      assert.equal(
        Boolean(operation.requestBody),
        Boolean(catalogEndpoint.bodySchema),
        `${method} ${routePath} request body mismatch`
      );
    }
  }

  const documented = new Set(
    catalog.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)
  );
  assert.deepEqual([...paths].sort(), [...documented].sort());

  const refs = [];
  walkRefs(stored, (ref) => refs.push(ref));
  assert.ok(refs.length > 0, 'OpenAPI has no schema refs');
  for (const ref of refs) {
    assert.ok(resolveRef(stored, ref), `Unresolved OpenAPI ref: ${ref}`);
  }

  for (const [status, response] of Object.entries(
    stored.paths['/api/v1/links'].post.responses
  )) {
    assert.ok(response.description, `Response ${status} has no description`);
  }
});

test('Postman artifacts are importable and synchronized with the catalog', async () => {
  const { buildPostmanCollection, buildPostmanEnvironment } = await apiLib();
  const storedCollection = JSON.parse(read('public/linkflow-postman-collection.json'));
  const storedEnvironment = JSON.parse(read('public/linkflow-postman-environment.json'));

  assert.deepEqual(
    storedCollection,
    buildPostmanCollection(catalog),
    'public/linkflow-postman-collection.json is stale; run npm run docs:generate'
  );
  assert.deepEqual(
    storedEnvironment,
    buildPostmanEnvironment(catalog),
    'public/linkflow-postman-environment.json is stale; run npm run docs:generate'
  );

  assert.equal(
    storedCollection.info.schema,
    'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  );
  const variables = new Map(storedCollection.variable.map((entry) => [entry.key, entry.value]));
  assert.equal(variables.get('baseUrl'), catalog.meta.baseUrl);
  assert.ok(variables.has('apiKey'));
  assert.equal(storedCollection.auth.type, 'apikey');
  assert.equal(storedCollection.auth.apikey[0].key, 'X-API-Key');
  assert.equal(storedCollection.auth.apikey[0].in, 'header');

  const requests = [];
  for (const group of storedCollection.item) {
    for (const item of group.item) requests.push(item);
  }
  assert.equal(requests.length, catalog.endpoints.length);

  for (const item of requests) {
    assert.ok(item.request.method);
    assert.ok(item.request.url.raw.includes('{{baseUrl}}'));
    const keyHeader = item.request.header.find((header) => header.key === 'X-API-Key');
    assert.ok(keyHeader, `${item.name} is missing the X-API-Key header`);
    assert.equal(keyHeader.value, '{{apiKey}}');
    assert.ok(item.response.length > 0, `${item.name} has no example response`);
    assert.ok(item.response[0].body, `${item.name} has an empty example response`);
    assert.doesNotThrow(() => JSON.parse(item.response[0].body));
    if (item.request.body) {
      assert.equal(item.request.body.mode, 'raw');
      assert.doesNotThrow(() => JSON.parse(item.request.body.raw));
    }
    assert.ok(!item.request.url.raw.includes('YOUR_API_KEY'));
  }

  const environmentKeys = storedEnvironment.values.map((entry) => entry.key);
  assert.ok(environmentKeys.includes('baseUrl'));
  assert.ok(environmentKeys.includes('apiKey'));
  assert.equal(storedEnvironment._postman_variable_scope, 'environment');
});

test('server exposes the generated artifacts and keeps CORS allowlisted', () => {
  const server = read('server/index.ts');
  assert.match(server, /'\/api\/openapi\.json':\s*'openapi\.json'/);
  assert.match(server, /'\/api\/postman\/collection\.json'/);
  assert.match(server, /'\/api\/postman\/environment\.json'/);
  assert.match(server, /resolveAllowedCorsOrigins/);
  assert.match(server, /CORS_ALLOWED_ORIGINS/);
  assert.match(server, /Vary',\s*'Origin'/);

  const unconditionalWildcard = /setHeader\(\s*'Access-Control-Allow-Origin'\s*,\s*'\*'\s*\)/;
  assert.doesNotMatch(
    server,
    unconditionalWildcard,
    'CORS must not grant * unconditionally'
  );
});

test('playground sends real requests and never persists credentials', () => {
  const playground = read('src/components/docs/ApiPlayground.tsx');
  const service = read('src/services/docs.ts');

  assert.match(playground, /executeApiRequest/);
  assert.match(playground, /X-API-Key/);
  assert.match(playground, /buildCurlCommand/);
  assert.match(playground, /setApiKey\(''\)/);

  assert.doesNotMatch(
    playground,
    /(?:localStorage|sessionStorage|AsyncStorage|SecureStore)\./
  );
  assert.doesNotMatch(
    service,
    /(?:localStorage|sessionStorage|AsyncStorage|SecureStore)\./
  );
  assert.doesNotMatch(playground, /console\.(log|info|warn|error)/);

  assert.match(service, /await fetch\(/);
  assert.doesNotMatch(service, /mockResponse|fakeResponse|hardcodedResponse/);

  const curlBuilder = service.slice(service.indexOf('export function buildCurlCommand'));
  assert.ok(
    curlBuilder.includes('$LINKFLOW_API_KEY'),
    'Copied cURL must use an environment variable instead of a real key'
  );
});

test('code examples use environment secrets rather than literal keys', () => {
  const pages = [
    'app/developers/getting-started.tsx',
    'app/developers/authentication.tsx',
    'app/developers/api/links.tsx',
    'app/developers/api/qr.tsx',
    'app/developers/api/analytics.tsx',
    'app/developers/playground.tsx',
  ];
  for (const page of pages) {
    const source = read(page);
    assert.doesNotMatch(
      source,
      /lf_(?:test|live)_[0-9a-f]{16}_(?!X{43})[A-Za-z0-9_-]{43}/,
      `${page} contains something shaped like a real API key`
    );
  }

  const endpointReference = read('src/components/docs/EndpointReference.tsx');
  for (const language of ['cURL', 'JavaScript', 'Node.js', 'Python']) {
    assert.ok(endpointReference.includes(language), `Examples are missing ${language}`);
  }
  assert.match(read('src/services/docs.ts'), /LINKFLOW_API_KEY/);
});

test('changelog only documents the shipped version', () => {
  const changelog = read('app/developers/changelog.tsx');
  assert.ok(changelog.includes('API_REFERENCE.meta.version'));
  assert.match(changelog, /initial public release/i);
  assert.match(changelog, /Breaking changes/i);
  assert.doesNotMatch(changelog, /v0\.\d/, 'Changelog invents an earlier release');
});
