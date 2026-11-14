'use strict';

/**
 * Developer API (Phase 1 + Phase 2) integration tests.
 *
 * Runs against the compiled server (`dist-server`) with the in-memory fallback
 * repository, so no PostgreSQL instance is required. Start with:
 *
 *   npm run test:server
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Force the in-memory repository before the server module is loaded.
process.env.DATABASE_URL = '';
process.env.API_KEY_HASH_SECRET =
  'phase2-test-hash-secret-0123456789abcdef0123456789abcdef';

const DEVELOPER_CLERK_ID = 'user_phase2_developer';
const OTHER_CLERK_ID = 'user_phase2_other';
const DEVELOPER_TOKEN = 'test-user_phase2_developer';
const OTHER_TOKEN = 'test-user_phase2_other';
const SHORT_BASE = 'https://short.test';
const ALL_SCOPES = [
  'links:read',
  'links:write',
  'links:delete',
  'qr:read',
  'qr:write',
  'qr:delete',
  'analytics:read',
];

process.env.PUBLIC_SHORT_URL_BASE = SHORT_BASE;

const { createServer, syncUserInDb, getUserFromDb, memoryStore } = require('../dist-server/index.js');
const { notificationMemoryStore } = require('../dist-server/notifications.js');
const { apiKeyMemoryStore } = require('../dist-server/developer-api/keys/api-key.store.js');

const state = {
  server: null,
  baseUrl: '',
  developerUser: null,
  otherUser: null,
  otherLink: null,
  otherQr: null,
  primaryLinkId: null,
  aliasLinkId: null,
  apiKey: null,
  primaryKeyId: null,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Constructor-only management auth seam: maps `Bearer test-<clerkId>` to the
 * seeded user. Production never injects this; it always verifies a Clerk JWT.
 */
async function resolveTestManagementUser(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer test-')) return null;
  const clerkUserId = header.slice('Bearer test-'.length);
  if (!clerkUserId) return null;
  return getUserFromDb(clerkUserId);
}

async function call(path, options = {}) {
  const { method = 'GET', key = state.apiKey, body, headers = {}, auth } = options;
  const requestHeaders = { ...headers };
  if (auth) requestHeaders.Authorization = `Bearer ${auth}`;
  if (key !== null) requestHeaders['X-API-Key'] = key;
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';

  const response = await fetch(state.baseUrl + path, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    redirect: 'manual',
  });

  const raw = await response.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }
  return { status: response.status, body: parsed, headers: response.headers, raw };
}

function pngWidth(dataUrl) {
  assert.match(dataUrl, /^data:image\/png;base64,/);
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  assert.equal(buffer.slice(0, 8).toString('hex'), '89504e470d0a1a0a');
  return buffer.readUInt32BE(16);
}

/** Creates a key through the management API and returns the creation payload. */
async function createManagedKey(overrides = {}, token = DEVELOPER_TOKEN) {
  const res = await call('/api/developer/keys', {
    method: 'POST',
    key: null,
    auth: token,
    body: {
      projectName: 'Test Project',
      environment: 'live',
      scopes: ALL_SCOPES,
      ...overrides,
    },
  });
  return res;
}

before(async () => {
  state.developerUser = await syncUserInDb(
    DEVELOPER_CLERK_ID,
    'phase2-developer@example.com',
    'Phase Two Developer'
  );
  state.otherUser = await syncUserInDb(OTHER_CLERK_ID, 'other@example.com', 'Other Developer');

  state.otherLink = memoryStore.createLink(
    state.otherUser.id,
    'https://other.example/private',
    'Other private link'
  );
  state.otherQr = memoryStore.createQrCode(
    state.otherUser.id,
    'https://other.example/qr',
    'Other private QR'
  );

  state.server = createServer({ resolveManagementUser: resolveTestManagementUser });
  await new Promise((resolve) => state.server.listen(0, '127.0.0.1', resolve));
  state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;

  // Primary credential used by the Phase 1 regression coverage below.
  const created = await createManagedKey({ projectName: 'Phase 2 Suite' });
  assert.equal(created.status, 201, created.raw);
  state.apiKey = created.body.data.apiKey;
  state.primaryKeyId = created.body.data.id;
});

after(async () => {
  if (state.server) {
    await new Promise((resolve) => state.server.close(resolve));
  }
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

test('rejects requests without an API key', async () => {
  const res = await call('/api/v1/links', { key: null });
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, {
    success: false,
    message: 'An API key is required in the X-API-Key header.',
    error: { code: 'MISSING_API_KEY' },
  });
});

test('rejects malformed and invalid API keys without enumeration detail', async () => {
  for (const key of ['totally-wrong-key', 'lf_live_short', 'lf_prod_deadbeefdeadbeef_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']) {
    const res = await call('/api/v1/links', { key });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_API_KEY');
  }
});

test('rejects a key presented under the wrong environment', async () => {
  const res = await call('/api/v1/links', {
    key: state.apiKey.replace('lf_live_', 'lf_test_'),
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('rejects a key whose secret has been tampered with', async () => {
  const tampered = state.apiKey.slice(0, -1) + (state.apiKey.endsWith('A') ? 'B' : 'A');
  const res = await call('/api/v1/links', { key: tampered });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('rejects a revoked key immediately', async () => {
  const created = await createManagedKey({ projectName: 'Revoke Me' });
  assert.equal(created.status, 201);
  const key = created.body.data.apiKey;
  const id = created.body.data.id;

  const okBefore = await call('/api/v1/links', { key });
  assert.equal(okBefore.status, 200);

  const revoked = await call(`/api/developer/keys/${id}`, {
    method: 'DELETE',
    key: null,
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.data.status, 'revoked');
  assert.ok(revoked.body.data.revokedAt);

  const afterRevoke = await call('/api/v1/links', { key });
  assert.equal(afterRevoke.status, 401);
  assert.equal(afterRevoke.body.error.code, 'API_KEY_REVOKED');
});

test('rejects an expired key', async () => {
  const created = await createManagedKey({ projectName: 'Expire Me' });
  assert.equal(created.status, 201);

  const record = apiKeyMemoryStore.records.get(created.body.data.id);
  record.expires_at = new Date(Date.now() - 60_000).toISOString();

  const res = await call('/api/v1/links', { key: created.body.data.apiKey });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'API_KEY_EXPIRED');
});

test('fails closed when API key hashing is not configured', async () => {
  const original = process.env.API_KEY_HASH_SECRET;
  delete process.env.API_KEY_HASH_SECRET;
  try {
    const res = await call('/api/v1/links');
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'API_KEY_HASH_NOT_CONFIGURED');
  } finally {
    process.env.API_KEY_HASH_SECRET = original;
  }
});

test('fails closed when persistence is unavailable in production', async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await call('/api/v1/links');
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'DATABASE_NOT_CONFIGURED');
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('updates lastUsedAt after a successful authenticated request', async () => {
  const created = await createManagedKey({ projectName: 'Usage Tracking' });
  assert.equal(created.status, 201);
  const record = apiKeyMemoryStore.records.get(created.body.data.id);
  assert.equal(record.last_used_at, null);

  const res = await call('/api/v1/links', { key: created.body.data.apiKey });
  assert.equal(res.status, 200);

  const refreshed = apiKeyMemoryStore.records.get(created.body.data.id);
  assert.ok(refreshed.last_used_at, 'last_used_at should be populated');
});

// ---------------------------------------------------------------------------
// Key management (JWT-authenticated)
// ---------------------------------------------------------------------------

test('management endpoints require a Bearer token', async () => {
  const missing = await call('/api/developer/keys', { key: null });
  assert.equal(missing.status, 401);
  assert.equal(missing.body.error.code, 'UNAUTHORIZED');

  const bogus = await call('/api/developer/keys', { key: null, auth: 'not-a-real-token' });
  assert.equal(bogus.status, 401);
  assert.equal(bogus.body.error.code, 'UNAUTHORIZED');
});

test('creates test and live keys with the correct format', async () => {
  const testKey = await createManagedKey({
    projectName: 'Test Env App',
    environment: 'test',
    scopes: ['links:read'],
  });
  assert.equal(testKey.status, 201);
  assert.match(testKey.body.data.apiKey, /^lf_test_[0-9a-f]{16}_[A-Za-z0-9_-]{43}$/);
  assert.equal(testKey.body.data.environment, 'test');
  assert.deepEqual(testKey.body.data.scopes, ['links:read']);
  assert.equal(testKey.body.data.apiKey.length, 'lf_test_'.length + 16 + 1 + 43);

  const liveKey = await createManagedKey({
    projectName: 'Live Env App',
    environment: 'live',
    scopes: ['links:read'],
  });
  assert.equal(liveKey.status, 201);
  assert.match(liveKey.body.data.apiKey, /^lf_live_[0-9a-f]{16}_[A-Za-z0-9_-]{43}$/);
});

test('generates unique keys with 256-bit secrets', async () => {
  const first = await createManagedKey({ projectName: 'Unique A' });
  const second = await createManagedKey({ projectName: 'Unique B' });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.notEqual(first.body.data.apiKey, second.body.data.apiKey);
  assert.notEqual(first.body.data.keyPrefix, second.body.data.keyPrefix);

  const secret = /_([A-Za-z0-9_-]{43})$/.exec(first.body.data.apiKey)[1];
  assert.equal(Buffer.from(secret, 'base64url').length, 32);
});

test('never stores or re-exposes the plaintext secret', async () => {
  const created = await createManagedKey({ projectName: 'Storage Audit' });
  assert.equal(created.status, 201);

  const { apiKey, id, keyPrefix } = created.body.data;
  const secret = /_([A-Za-z0-9_-]{43})$/.exec(apiKey)[1];
  const record = apiKeyMemoryStore.records.get(id);

  assert.ok(record, 'record should be persisted');
  assert.deepEqual(record.scopes, ALL_SCOPES);
  assert.match(record.key_hash, /^[0-9a-f]{64}$/);
  assert.notEqual(record.key_hash, secret);
  assert.equal(record.key_prefix, keyPrefix);
  assert.equal(JSON.stringify(record).includes(secret), false);

  const list = await call('/api/developer/keys', {
    key: null,
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(list.status, 200);
  assert.equal(list.raw.includes(secret), false);
  assert.equal(list.raw.includes('keyHash'), false);
  assert.equal(list.raw.includes('key_hash'), false);
  assert.equal(list.body.data.keys.some((key) => key.apiKey !== undefined), false);

  const detail = await call(`/api/developer/keys/${id}`, {
    key: null,
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.apiKey, undefined);
  assert.equal(detail.raw.includes(secret), false);
});

test('validates project name, environment, scopes and expiry', async () => {
  const cases = [
    { projectName: '' },
    { projectName: '   ' },
    { projectName: 'x'.repeat(101) },
    { projectName: 123 },
    { environment: 'staging' },
    { environment: undefined },
    { scopes: [] },
    { scopes: 'links:read' },
    { scopes: ['links:admin'] },
    { scopes: ['links:read', 'links:read'] },
    { expiresAt: 'not-a-date' },
    { expiresAt: new Date(Date.now() - 60_000).toISOString() },
  ];

  for (const overrides of cases) {
    const res = await createManagedKey(overrides);
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(overrides)}`);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});

test('lists only the authenticated user keys', async () => {
  const mine = await call('/api/developer/keys', { key: null, auth: DEVELOPER_TOKEN });
  assert.equal(mine.status, 200);
  assert.ok(mine.body.data.total >= 2);
  assert.equal(
    mine.body.data.keys.every((key) => key.projectName !== undefined),
    true
  );

  const theirs = await call('/api/developer/keys', { key: null, auth: OTHER_TOKEN });
  assert.equal(theirs.status, 200);
  assert.equal(theirs.body.data.keys.length, 0);
});

test('retrieves a key by id', async () => {
  const res = await call(`/api/developer/keys/${state.primaryKeyId}`, {
    key: null,
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, state.primaryKeyId);
  assert.equal(res.body.data.environment, 'live');
});

test('cross-user key access is rejected as not found', async () => {
  const get = await call(`/api/developer/keys/${state.primaryKeyId}`, {
    key: null,
    auth: OTHER_TOKEN,
  });
  assert.equal(get.status, 404);
  assert.equal(get.body.error.code, 'API_KEY_NOT_FOUND');

  const revoke = await call(`/api/developer/keys/${state.primaryKeyId}`, {
    method: 'DELETE',
    key: null,
    auth: OTHER_TOKEN,
  });
  assert.equal(revoke.status, 404);

  const rotate = await call(`/api/developer/keys/${state.primaryKeyId}/rotate`, {
    method: 'POST',
    key: null,
    auth: OTHER_TOKEN,
  });
  assert.equal(rotate.status, 404);

  // The owner's key is still active after the cross-user attempts.
  const stillWorks = await call('/api/v1/links', { key: state.apiKey });
  assert.equal(stillWorks.status, 200);
});

test('returns 404 for unknown keys and 400 for malformed ids', async () => {
  const unknown = await call('/api/developer/keys/key_doesnotexist', {
    key: null,
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(unknown.status, 404);

  const malformed = await call('/api/developer/keys/bad$id', {
    key: null,
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error.code, 'VALIDATION_ERROR');
});

test('rotation returns a new secret, invalidates the old key and preserves audit', async () => {
  const created = await createManagedKey({
    projectName: 'Rotate Me',
    environment: 'live',
    scopes: ['links:read'],
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  assert.equal(created.status, 201);
  const oldKey = created.body.data.apiKey;
  const oldId = created.body.data.id;

  const before = await call('/api/v1/links', { key: oldKey });
  assert.equal(before.status, 200);

  const rotated = await call(`/api/developer/keys/${oldId}/rotate`, {
    method: 'POST',
    key: null,
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(rotated.status, 200);
  assert.equal(rotated.body.success, true);

  const newKey = rotated.body.data.apiKey;
  const newId = rotated.body.data.id;
  assert.notEqual(newKey, oldKey);
  assert.notEqual(newId, oldId);
  assert.match(newKey, /^lf_live_/);
  assert.deepEqual(rotated.body.data.scopes, ['links:read']);
  assert.equal(rotated.body.data.rotatedFromId, oldId);
  assert.equal(rotated.body.data.expiresAt, created.body.data.expiresAt);

  const oldAttempt = await call('/api/v1/links', { key: oldKey });
  assert.equal(oldAttempt.status, 401);
  assert.equal(oldAttempt.body.error.code, 'API_KEY_REVOKED');

  const newAttempt = await call('/api/v1/links', { key: newKey });
  assert.equal(newAttempt.status, 200);

  const oldRecord = apiKeyMemoryStore.records.get(oldId);
  assert.equal(oldRecord.status, 'revoked');
  assert.ok(oldRecord.revoked_at);

  // A revoked key can never be rotated back into service.
  const rotateAgain = await call(`/api/developer/keys/${oldId}/rotate`, {
    method: 'POST',
    key: null,
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(rotateAgain.status, 409);
  assert.equal(rotateAgain.body.error.code, 'API_KEY_REVOKED');
});

test('rotation rejects expired keys', async () => {
  const created = await createManagedKey({ projectName: 'Rotate Expired' });
  assert.equal(created.status, 201);
  const record = apiKeyMemoryStore.records.get(created.body.data.id);
  record.expires_at = new Date(Date.now() - 60_000).toISOString();

  const res = await call(`/api/developer/keys/${created.body.data.id}/rotate`, {
    method: 'POST',
    key: null,
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'API_KEY_EXPIRED');
});

test('management router rejects unsupported methods', async () => {
  const res = await call('/api/developer/keys', {
    method: 'PUT',
    key: null,
    auth: DEVELOPER_TOKEN,
    body: {},
  });
  assert.equal(res.status, 405);
  assert.equal(res.body.error.code, 'METHOD_NOT_ALLOWED');
});

// ---------------------------------------------------------------------------
// Scope authorization
// ---------------------------------------------------------------------------

test('enforces per-scope access on links, QR and analytics', async () => {
  const readOnly = await createManagedKey({
    projectName: 'Read Only',
    scopes: ['links:read'],
  });
  assert.equal(readOnly.status, 201);
  const readOnlyKey = readOnly.body.data.apiKey;

  const list = await call('/api/v1/links', { key: readOnlyKey });
  assert.equal(list.status, 200);

  const create = await call('/api/v1/links', {
    method: 'POST',
    key: readOnlyKey,
    body: { originalUrl: 'https://example.com/scope-denied' },
  });
  assert.equal(create.status, 403);
  assert.equal(create.body.error.code, 'INSUFFICIENT_SCOPE');

  const remove = await call(`/api/v1/links/${state.primaryLinkId}`, {
    method: 'DELETE',
    key: readOnlyKey,
  });
  assert.equal(remove.status, 403);
  assert.equal(remove.body.error.code, 'INSUFFICIENT_SCOPE');

  const qrList = await call('/api/v1/qr', { key: readOnlyKey });
  assert.equal(qrList.status, 403);

  const overview = await call('/api/v1/analytics/overview', { key: readOnlyKey });
  assert.equal(overview.status, 403);

  // The owner's primary key still has full scope.
  const ownerList = await call('/api/v1/links');
  assert.equal(ownerList.status, 200);
});

test('analytics scope is independent from link read scope', async () => {
  const analyticsOnly = await createManagedKey({
    projectName: 'Analytics Only',
    scopes: ['analytics:read'],
  });
  assert.equal(analyticsOnly.status, 201);
  const key = analyticsOnly.body.data.apiKey;

  const links = await call('/api/v1/links', { key });
  assert.equal(links.status, 403);
  assert.equal(links.body.error.code, 'INSUFFICIENT_SCOPE');

  const overview = await call('/api/v1/analytics/overview', { key });
  assert.equal(overview.status, 200);
});

test('QR delete scope is enforced independently', async () => {
  const qrWrite = await createManagedKey({
    projectName: 'QR Write Only',
    scopes: ['qr:read', 'qr:write'],
  });
  assert.equal(qrWrite.status, 201);
  const key = qrWrite.body.data.apiKey;

  const created = await call('/api/v1/qr', {
    method: 'POST',
    key,
    body: { targetUrl: 'https://example.com/qr-scope' },
  });
  assert.equal(created.status, 201);

  const removed = await call(`/api/v1/qr/${created.body.data.qr.id}`, {
    method: 'DELETE',
    key,
  });
  assert.equal(removed.status, 403);
  assert.equal(removed.body.error.code, 'INSUFFICIENT_SCOPE');
});

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

test('creates a short link from a valid URL', async () => {
  const res = await call('/api/v1/links', {
    method: 'POST',
    body: { originalUrl: 'https://example.com/a/very/long/path?utm=api' },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Short link created successfully');

  const link = res.body.data;
  assert.ok(link.id);
  assert.equal(link.originalUrl, 'https://example.com/a/very/long/path?utm=api');
  assert.equal(link.shortUrl, `${SHORT_BASE}/${link.shortCode}`);
  assert.equal(link.clicks, 0);
  assert.equal(link.isActive, true);
  assert.equal(link.user_id, undefined);
  assert.equal(link.userId, undefined);

  state.primaryLinkId = link.id;
});

test('validates URLs and required fields', async () => {
  for (const originalUrl of ['ftp://example.com/file', 'javascript:alert(1)', '', 123, undefined]) {
    const res = await call('/api/v1/links', {
      method: 'POST',
      body: originalUrl === undefined ? {} : { originalUrl },
    });
    assert.equal(res.status, 400, `expected 400 for ${String(originalUrl)}`);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});

test('rejects malformed custom aliases', async () => {
  const res = await call('/api/v1/links', {
    method: 'POST',
    body: { originalUrl: 'https://example.com', customAlias: 'bad alias!' },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('creates a link with a Base62 custom alias', async () => {
  const res = await call('/api/v1/links', {
    method: 'POST',
    body: { originalUrl: 'https://example.com/alias', customAlias: 'Phase1Alias' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.shortCode, 'Phase1Alias');
  assert.equal(res.body.data.customAlias, 'Phase1Alias');
  assert.equal(res.body.data.shortUrl, `${SHORT_BASE}/Phase1Alias`);

  state.aliasLinkId = res.body.data.id;
});

test('returns 409 for a taken custom alias', async () => {
  const res = await call('/api/v1/links', {
    method: 'POST',
    body: { originalUrl: 'https://example.com/alias-2', customAlias: 'Phase1Alias' },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ALIAS_TAKEN');
});

test('ignores user ids supplied in the request body', async () => {
  const res = await call('/api/v1/links', {
    method: 'POST',
    body: {
      originalUrl: 'https://example.com/ownership',
      userId: state.otherUser.id,
      user_id: state.otherUser.id,
    },
  });
  assert.equal(res.status, 201);

  const list = await call('/api/v1/links?limit=100');
  const ids = list.body.data.links.map((link) => link.id);
  assert.ok(ids.includes(res.body.data.id));
});

test('lists only the developer links with pagination', async () => {
  const res = await call('/api/v1/links?limit=2&offset=0');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.links.length, 2);
  assert.equal(res.body.data.limit, 2);
  assert.equal(res.body.data.offset, 0);
  assert.ok(res.body.data.total >= 3);
  assert.ok(!res.body.data.links.some((link) => link.id === state.otherLink.id));
});

test('validates pagination parameters', async () => {
  for (const query of ['limit=0', 'limit=101', 'limit=abc', 'offset=-1', 'offset=abc']) {
    const res = await call(`/api/v1/links?${query}`);
    assert.equal(res.status, 400, `expected 400 for ${query}`);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});

test('retrieves one of the developer links', async () => {
  const res = await call(`/api/v1/links/${state.primaryLinkId}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, state.primaryLinkId);
  assert.equal(res.body.data.user_id, undefined);
});

test('does not expose another developer link', async () => {
  const res = await call(`/api/v1/links/${state.otherLink.id}`);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('returns 404 for unknown link ids and 400 for malformed ids', async () => {
  const unknown = await call('/api/v1/links/lnk_doesnotexist');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, 'NOT_FOUND');

  const malformed = await call('/api/v1/links/bad$id');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error.code, 'VALIDATION_ERROR');
});

test('does not allow deleting another developer link', async () => {
  const res = await call(`/api/v1/links/${state.otherLink.id}`, { method: 'DELETE' });
  assert.equal(res.status, 404);
  assert.equal(memoryStore.getLinks(state.otherUser.id).length, 1);
});

test('deletes an owned link', async () => {
  const created = await call('/api/v1/links', {
    method: 'POST',
    body: { originalUrl: 'https://example.com/to-delete' },
  });
  const id = created.body.data.id;

  const deleted = await call(`/api/v1/links/${id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.success, true);
  assert.equal(deleted.body.data.id, id);

  const afterDelete = await call(`/api/v1/links/${id}`);
  assert.equal(afterDelete.status, 404);
});

test('returns link analytics with totals and a daily series', async () => {
  const created = await call('/api/v1/links', {
    method: 'POST',
    body: { originalUrl: 'https://example.com/analytics' },
  });
  const id = created.body.data.id;

  const stored = memoryStore.links.get(id);
  stored.clicks_count = 4;
  notificationMemoryStore.incrementDailyClicks(id);
  notificationMemoryStore.incrementDailyClicks(id);

  const res = await call(`/api/v1/links/${id}/analytics?days=7`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.totalClicks, 4);
  assert.equal(res.body.data.range.days, 7);
  assert.equal(res.body.data.daily.length, 7);
  assert.equal(res.body.data.daily.at(-1).date, new Date().toISOString().slice(0, 10));
  assert.equal(res.body.data.daily.at(-1).clicks, 2);
  assert.equal(res.body.data.link.id, id);
});

test('validates analytics day ranges', async () => {
  for (const days of ['0', '91', 'abc']) {
    const res = await call(`/api/v1/links/${state.primaryLinkId}/analytics?days=${days}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});

test('analytics cannot read another developer link', async () => {
  const res = await call(`/api/v1/links/${state.otherLink.id}/analytics`);
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------------------
// QR codes
// ---------------------------------------------------------------------------

test('creates a QR code returning a usable PNG data URI', async () => {
  const res = await call('/api/v1/qr', {
    method: 'POST',
    body: { targetUrl: 'https://example.com/qr-target', title: 'API QR' },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.qr.title, 'API QR');
  assert.equal(res.body.data.qr.targetUrl, 'https://example.com/qr-target');
  assert.equal(res.body.data.image.mimeType, 'image/png');
  assert.equal(res.body.data.image.encoding, 'data-uri');
  assert.equal(res.body.data.image.width, 512);
  assert.equal(pngWidth(res.body.data.image.dataUrl), 512);

  state.qrId = res.body.data.qr.id;
});

test('honours QR image customization', async () => {
  const res = await call('/api/v1/qr', {
    method: 'POST',
    body: {
      targetUrl: 'https://example.com/qr-custom',
      title: 'Custom QR',
      image: {
        size: 256,
        margin: 4,
        errorCorrectionLevel: 'H',
        dark: '#112233',
        light: '#FFFFFF',
      },
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.image.width, 256);
  assert.equal(res.body.data.image.margin, 4);
  assert.equal(res.body.data.image.errorCorrectionLevel, 'H');
  assert.equal(res.body.data.image.dark, '#112233');
  assert.equal(pngWidth(res.body.data.image.dataUrl), 256);
});

test('validates QR image options', async () => {
  const cases = [
    { image: { size: 64 } },
    { image: { size: 2048 } },
    { image: { margin: 99 } },
    { image: { errorCorrectionLevel: 'Z' } },
    { image: { dark: 'black' } },
    { image: 'nope' },
  ];
  for (const extra of cases) {
    const res = await call('/api/v1/qr', {
      method: 'POST',
      body: { targetUrl: 'https://example.com/qr-invalid', ...extra },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});

test('requires targetUrl or linkId for QR creation', async () => {
  const res = await call('/api/v1/qr', { method: 'POST', body: { title: 'No target' } });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('creates a QR code from an owned link and encodes its short URL', async () => {
  const link = await call(`/api/v1/links/${state.primaryLinkId}`);
  const res = await call('/api/v1/qr', {
    method: 'POST',
    body: { linkId: state.primaryLinkId, title: 'Linked QR' },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.qr.linkId, state.primaryLinkId);
  assert.equal(res.body.data.qr.targetUrl, link.body.data.shortUrl);

  state.linkedQrId = res.body.data.qr.id;
});

test('rejects a QR code linked to another developer link', async () => {
  const res = await call('/api/v1/qr', {
    method: 'POST',
    body: { linkId: state.otherLink.id, title: 'Cross-tenant QR' },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('lists QR history with pagination', async () => {
  const res = await call('/api/v1/qr?limit=10&offset=0');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.total >= 3);
  assert.ok(res.body.data.qrs.every((qr) => qr.id !== state.otherQr.id));
  assert.equal(res.body.data.limit, 10);
});

test('retrieves QR details with a rendered image', async () => {
  const res = await call(`/api/v1/qr/${state.qrId}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.qr.id, state.qrId);
  assert.equal(pngWidth(res.body.data.image.dataUrl), 512);
});

test('does not expose another developer QR code', async () => {
  const res = await call(`/api/v1/qr/${state.otherQr.id}`);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('QR analytics reports standalone QR scans as unsupported', async () => {
  const res = await call(`/api/v1/qr/${state.qrId}/analytics`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.supported, false);
  assert.match(res.body.data.reason, /scans are not tracked/i);
});

test('QR analytics returns linked link click data', async () => {
  const res = await call(`/api/v1/qr/${state.linkedQrId}/analytics?days=7`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.supported, true);
  assert.equal(res.body.data.tracking, 'linked-link-clicks');
  assert.equal(res.body.data.link.id, state.primaryLinkId);
  assert.equal(res.body.data.daily.length, 7);
});

test('QR analytics hides another developer QR code', async () => {
  const res = await call(`/api/v1/qr/${state.otherQr.id}/analytics`);
  assert.equal(res.status, 404);
});

test('does not delete another developer QR code', async () => {
  const res = await call(`/api/v1/qr/${state.otherQr.id}`, { method: 'DELETE' });
  assert.equal(res.status, 404);
  assert.ok(memoryStore.getQrCode(state.otherQr.id, state.otherUser.id));
});

test('deletes an owned QR code', async () => {
  const res = await call(`/api/v1/qr/${state.qrId}`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, state.qrId);

  const afterDelete = await call(`/api/v1/qr/${state.qrId}`);
  assert.equal(afterDelete.status, 404);
});

// ---------------------------------------------------------------------------
// Aggregate analytics namespace
// ---------------------------------------------------------------------------

test('serves an analytics overview for the developer only', async () => {
  const res = await call('/api/v1/analytics/overview?days=7');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.daily.length, 7);
  assert.ok(res.body.data.totals.links >= 3);
  assert.ok(res.body.data.totals.qrCodes >= 2);
  assert.ok(res.body.data.totals.clicks >= 4);
  assert.ok(res.body.data.mostClickedLink);
  assert.ok(
    res.body.data.recentQrCodes.every((qr) => qr.id !== state.otherQr.id),
    'overview must not include other developers QR codes'
  );
});

// ---------------------------------------------------------------------------
// Envelope, routing and compatibility
// ---------------------------------------------------------------------------

test('unknown developer endpoints return NOT_FOUND', async () => {
  const res = await call('/api/v1/does-not-exist');
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, {
    success: false,
    message: 'Endpoint not found.',
    error: { code: 'NOT_FOUND' },
  });
});

test('unsupported methods return METHOD_NOT_ALLOWED with Allow header', async () => {
  const res = await call('/api/v1/links', { method: 'PATCH' });
  assert.equal(res.status, 405);
  assert.equal(res.body.error.code, 'METHOD_NOT_ALLOWED');
  assert.equal(res.headers.get('allow'), 'GET, POST');
});

test('invalid JSON is rejected without a stack trace', async () => {
  const res = await call('/api/v1/links', { method: 'POST', body: '{"originalUrl":' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_JSON');
  assert.equal(res.body.message.includes('at '), false);
});

test('oversized bodies are rejected', async () => {
  const res = await call('/api/v1/links', {
    method: 'POST',
    body: JSON.stringify({ originalUrl: `https://example.com/${'a'.repeat(70 * 1024)}` }),
  });
  assert.equal(res.status, 413);
  assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('CORS preflight advertises the X-API-Key header', async () => {
  const res = await call('/api/v1/links', { method: 'OPTIONS', key: null });
  assert.equal(res.status, 204);
  assert.match(res.headers.get('access-control-allow-headers'), /X-API-Key/i);
});

test('existing JWT routes stay separate from API-key auth', async () => {
  const withoutAuth = await call('/api/links', { key: null });
  assert.equal(withoutAuth.status, 401);
  assert.equal(withoutAuth.body.error, 'Unauthorized');

  // An API key must not authenticate a user-facing route.
  const withApiKey = await call('/api/links');
  assert.equal(withApiKey.status, 401);
  assert.equal(withApiKey.body.error, 'Unauthorized');

  const me = await call('/api/users/me', { key: null });
  assert.equal(me.status, 401);
});

test('existing short-link redirects still work and feed analytics', async () => {
  const created = await call('/api/v1/links', {
    method: 'POST',
    body: { originalUrl: 'https://example.com/redirect-target' },
  });
  const { id, shortCode } = created.body.data;

  const redirect = await call(`/${shortCode}`, { key: null });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'https://example.com/redirect-target');

  // Daily click aggregation is fire-and-forget on the redirect path.
  await sleep(250);

  const analytics = await call(`/api/v1/links/${id}/analytics?days=1`);
  assert.equal(analytics.status, 200);
  assert.equal(analytics.body.data.totalClicks, 1);
  assert.equal(analytics.body.data.daily.at(-1).clicks, 1);
});
