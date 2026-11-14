'use strict';

/**
 * Developer Dashboard (Phase 3) integration tests.
 *
 * Covers projects CRUD, project-scoped key creation/rotation, persisted API
 * usage analytics, log filtering/pagination/detail and cross-developer
 * isolation. Runs against the compiled server with the in-memory repository,
 * so no PostgreSQL instance is required.
 *
 *   npm run test:server
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Force the in-memory repository before the server module is loaded.
process.env.DATABASE_URL = '';
process.env.API_KEY_HASH_SECRET =
  'phase3-test-hash-secret-0123456789abcdef0123456789abcdef';

const DEVELOPER_CLERK_ID = 'user_phase3_developer';
const OTHER_CLERK_ID = 'user_phase3_other';
const DEVELOPER_TOKEN = 'test-user_phase3_developer';
const OTHER_TOKEN = 'test-user_phase3_other';

const ALL_SCOPES = [
  'links:read',
  'links:write',
  'links:delete',
  'qr:read',
  'qr:write',
  'qr:delete',
  'analytics:read',
];

const { createServer, syncUserInDb, getUserFromDb } = require('../dist-server/index.js');
const { usageMemoryStore } = require('../dist-server/developer-api/usage/usage.store.js');
const { projectMemoryStore } = require('../dist-server/developer-api/projects/project.store.js');

const state = {
  server: null,
  baseUrl: '',
  developerUser: null,
  otherUser: null,
  keyedProjectId: null,
  keyedKeyId: null,
  keyedSecret: null,
  otherProjectId: null,
  otherKey: null,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveTestManagementUser(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer test-')) return null;
  const clerkUserId = header.slice('Bearer test-'.length);
  if (!clerkUserId) return null;
  return getUserFromDb(clerkUserId);
}

async function call(path, options = {}) {
  const { method = 'GET', key = null, body, headers = {}, auth } = options;
  const requestHeaders = { ...headers };
  if (auth) requestHeaders.Authorization = `Bearer ${auth}`;
  if (key) requestHeaders['X-API-Key'] = key;
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

/** Management API helper: JWT auth, no developer key. */
function manage(path, options = {}) {
  return call(path, { ...options, key: null, auth: options.auth || DEVELOPER_TOKEN });
}

/** Calls the public API and lets the finish listener persist usage. */
async function useApi(path, key, method = 'GET') {
  const response = await call(path, { method, key });
  await sleep(20);
  return response;
}

function developerEvents() {
  return usageMemoryStore.events.filter((event) => event.user_id === state.developerUser.id);
}

before(async () => {
  state.developerUser = await syncUserInDb(
    DEVELOPER_CLERK_ID,
    'phase3-developer@example.com',
    'Phase Three Developer'
  );
  state.otherUser = await syncUserInDb(
    OTHER_CLERK_ID,
    'phase3-other@example.com',
    'Phase Three Other'
  );

  state.server = createServer({ resolveManagementUser: resolveTestManagementUser });
  await new Promise((resolve) => state.server.listen(0, '127.0.0.1', resolve));
  state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;
});

after(async () => {
  if (state.server) {
    await new Promise((resolve) => state.server.close(resolve));
  }
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

test('dashboard endpoints reject requests without a JWT', async () => {
  for (const path of [
    '/api/developer/overview',
    '/api/developer/projects',
    '/api/developer/usage',
    '/api/developer/logs',
  ]) {
    const res = await call(path, { key: null });
    assert.equal(res.status, 401, `${path} must require a JWT`);
    assert.equal(res.body.success, false);
  }

  const create = await call('/api/developer/projects', {
    method: 'POST',
    key: null,
    body: { name: 'Unauthorized' },
  });
  assert.equal(create.status, 401);
});

// ---------------------------------------------------------------------------
// Projects CRUD
// ---------------------------------------------------------------------------

test('creates, lists, renames and deletes an empty project', async () => {
  const empty = await manage('/api/developer/projects');
  assert.equal(empty.status, 200);
  assert.equal(empty.body.data.total, 0);

  const created = await manage('/api/developer/projects', {
    method: 'POST',
    body: { name: 'Dashboard App' },
  });
  assert.equal(created.status, 201, created.raw);
  assert.equal(created.body.data.name, 'Dashboard App');
  assert.equal(created.body.data.keyCount, 0);
  assert.ok(created.body.data.id.startsWith('prj_'));
  const projectId = created.body.data.id;

  const duplicate = await manage('/api/developer/projects', {
    method: 'POST',
    body: { name: 'dashboard app' },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'PROJECT_NAME_TAKEN');

  const invalid = await manage('/api/developer/projects', {
    method: 'POST',
    body: { name: '   ' },
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

  const longName = await manage('/api/developer/projects', {
    method: 'POST',
    body: { name: 'x'.repeat(101) },
  });
  assert.equal(longName.status, 400);

  const list = await manage('/api/developer/projects');
  assert.equal(list.body.data.total, 1);
  assert.equal(list.body.data.projects[0].keyCount, 0);

  const renamed = await manage(`/api/developer/projects/${projectId}`, {
    method: 'PATCH',
    body: { name: 'Dashboard App v2' },
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.data.name, 'Dashboard App v2');

  const detail = await manage(`/api/developer/projects/${projectId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.project.name, 'Dashboard App v2');
  assert.deepEqual(detail.body.data.keys, []);

  const removed = await manage(`/api/developer/projects/${projectId}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.id, projectId);

  const missing = await manage(`/api/developer/projects/${projectId}`);
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'PROJECT_NOT_FOUND');
});

test('isolates project names and ids between developers', async () => {
  const created = await manage('/api/developer/projects', {
    method: 'POST',
    body: { name: 'Shared Name' },
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(created.status, 201);
  const developerProjectId = created.body.data.id;

  const otherCreated = await manage('/api/developer/projects', {
    method: 'POST',
    body: { name: 'Shared Name' },
    auth: OTHER_TOKEN,
  });
  assert.equal(otherCreated.status, 201);
  state.otherProjectId = otherCreated.body.data.id;
  assert.notEqual(otherCreated.body.data.id, developerProjectId);

  const otherList = await manage('/api/developer/projects', { auth: OTHER_TOKEN });
  assert.equal(otherList.body.data.total, 1);
  assert.equal(otherList.body.data.projects[0].id, state.otherProjectId);

  const crossRead = await manage(`/api/developer/projects/${state.otherProjectId}`, {
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(crossRead.status, 404);

  const crossRename = await manage(`/api/developer/projects/${state.otherProjectId}`, {
    method: 'PATCH',
    body: { name: 'Hijacked' },
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(crossRename.status, 404);

  const crossDelete = await manage(`/api/developer/projects/${state.otherProjectId}`, {
    method: 'DELETE',
    auth: DEVELOPER_TOKEN,
  });
  assert.equal(crossDelete.status, 404);

  // The owner can still read the untouched project.
  const stillThere = await manage(`/api/developer/projects/${state.otherProjectId}`, {
    auth: OTHER_TOKEN,
  });
  assert.equal(stillThere.status, 200);
  assert.equal(stillThere.body.data.project.name, 'Shared Name');

  // Clean up the developer's duplicate so later counts stay predictable.
  await manage(`/api/developer/projects/${developerProjectId}`, { method: 'DELETE' });
});

// ---------------------------------------------------------------------------
// Project-scoped API keys
// ---------------------------------------------------------------------------

test('creates a project-scoped key and refuses to delete a non-empty project', async () => {
  const project = await manage('/api/developer/projects', {
    method: 'POST',
    body: { name: 'Keyed Project' },
  });
  assert.equal(project.status, 201);
  state.keyedProjectId = project.body.data.id;

  const key = await manage('/api/developer/keys', {
    method: 'POST',
    body: {
      projectId: state.keyedProjectId,
      environment: 'live',
      scopes: ALL_SCOPES,
    },
  });
  assert.equal(key.status, 201, key.raw);
  assert.equal(key.body.data.projectId, state.keyedProjectId);
  assert.equal(key.body.data.projectName, 'Keyed Project');
  assert.match(key.body.data.apiKey, /^lf_live_/);
  assert.equal(key.body.data.status, 'active');
  assert.equal(typeof key.body.data.apiKey, 'string');

  state.keyedKeyId = key.body.data.id;
  state.keyedSecret = key.body.data.apiKey;

  const list = await manage('/api/developer/projects');
  const view = list.body.data.projects.find((entry) => entry.id === state.keyedProjectId);
  assert.equal(view.keyCount, 1);
  assert.equal(view.activeKeyCount, 1);
  assert.equal(view.liveKeyCount, 1);
  assert.equal(view.testKeyCount, 0);
  assert.deepEqual(view.environments, ['live']);

  const detail = await manage(`/api/developer/projects/${state.keyedProjectId}`);
  assert.equal(detail.body.data.keys.length, 1);
  assert.equal(detail.body.data.keys[0].id, state.keyedKeyId);
  assert.equal(detail.body.data.keys[0].projectId, state.keyedProjectId);

  const blocked = await manage(`/api/developer/projects/${state.keyedProjectId}`, {
    method: 'DELETE',
  });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, 'PROJECT_NOT_EMPTY');

  const unknownProject = await manage('/api/developer/keys', {
    method: 'POST',
    body: { projectId: 'prj_does_not_exist', environment: 'test', scopes: ['links:read'] },
  });
  assert.equal(unknownProject.status, 404);
  assert.equal(unknownProject.body.error.code, 'PROJECT_NOT_FOUND');

  const missingProject = await manage('/api/developer/keys', {
    method: 'POST',
    body: { environment: 'test', scopes: ['links:read'] },
  });
  assert.equal(missingProject.status, 400);
});

test('rotates a project key and invalidates the previous secret immediately', async () => {
  const before = await useApi('/api/v1/links', state.keyedSecret);
  assert.equal(before.status, 200);

  const rotated = await manage(`/api/developer/keys/${state.keyedKeyId}/rotate`, {
    method: 'POST',
  });
  assert.equal(rotated.status, 200, rotated.raw);
  assert.match(rotated.body.data.apiKey, /^lf_live_/);
  assert.notEqual(rotated.body.data.apiKey, state.keyedSecret);
  assert.equal(rotated.body.data.projectId, state.keyedProjectId);
  assert.equal(rotated.body.data.rotatedFromId, state.keyedKeyId);

  const oldSecret = await call('/api/v1/links', { key: state.keyedSecret });
  assert.equal(oldSecret.status, 401);
  assert.equal(oldSecret.body.error.code, 'API_KEY_REVOKED');

  const newSecret = await useApi('/api/v1/links', rotated.body.data.apiKey);
  assert.equal(newSecret.status, 200);

  state.keyedKeyId = rotated.body.data.id;
  state.keyedSecret = rotated.body.data.apiKey;
});

test('auto-creates a project when only projectName is supplied (Phase 2 compatibility)', async () => {
  const created = await manage('/api/developer/keys', {
    method: 'POST',
    body: {
      projectName: 'Legacy Suite',
      environment: 'test',
      scopes: ['links:read'],
    },
  });
  assert.equal(created.status, 201, created.raw);
  assert.ok(created.body.data.projectId);
  assert.equal(created.body.data.projectName, 'Legacy Suite');

  const list = await manage('/api/developer/projects');
  const legacy = list.body.data.projects.find((entry) => entry.name === 'Legacy Suite');
  assert.ok(legacy);
  assert.equal(legacy.keyCount, 1);
  assert.equal(legacy.testKeyCount, 1);
});

// ---------------------------------------------------------------------------
// Usage persistence
// ---------------------------------------------------------------------------

test('records usage only after API key authentication succeeds', async () => {
  const before = developerEvents().length;

  const invalid = await call('/api/v1/links', {
    key: 'lf_live_deadbeefdeadbeef_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });
  assert.equal(invalid.status, 401);
  await sleep(25);
  assert.equal(developerEvents().length, before, 'auth failures must not be recorded');

  const valid = await useApi('/api/v1/links', state.keyedSecret);
  assert.equal(valid.status, 200);
  assert.equal(developerEvents().length, before + 1);

  const event = developerEvents().slice(-1)[0];
  assert.equal(event.endpoint, '/api/v1/links');
  assert.equal(event.method, 'GET');
  assert.equal(event.status_code, 200);
  assert.equal(event.environment, 'live');
  assert.equal(event.project_id, state.keyedProjectId);
  assert.equal(event.api_key_id, state.keyedKeyId);
  assert.ok(event.duration_ms >= 0);
  assert.ok(event.created_at);

  // No credential material may ever reach an analytics record.
  const serialized = JSON.stringify(event);
  assert.ok(!serialized.includes(state.keyedSecret));
  assert.ok(!serialized.includes('key_hash'));
  assert.ok(!serialized.includes('authorization'));
});

// ---------------------------------------------------------------------------
// Overview and usage aggregation
// ---------------------------------------------------------------------------

test('aggregates overview and usage from persisted requests', async () => {
  const missing = await useApi('/api/v1/not-a-real-endpoint', state.keyedSecret);
  assert.equal(missing.status, 404);

  const overview = await manage('/api/developer/overview?range=24h');
  assert.equal(overview.status, 200, overview.raw);
  const data = overview.body.data;

  assert.equal(data.range.key, '24h');
  assert.equal(data.range.bucket, 'hour');
  assert.equal(data.requestsOverTime.length, 24);
  assert.ok(data.totals.requests >= 2);
  assert.ok(data.totals.success >= 1);
  assert.ok(data.totals.failed >= 1);
  assert.ok(data.totals.averageDurationMs >= 0);
  assert.ok(data.keys.active >= 1);
  assert.ok(data.projects.total >= 2);
  assert.ok(data.usageByEndpoint.some((entry) => entry.endpoint === '/api/v1/links'));
  assert.ok(data.recentActivity.length > 0);

  const recent = data.recentActivity[0];
  for (const field of [
    'id',
    'endpoint',
    'method',
    'statusCode',
    'statusGroup',
    'durationMs',
    'environment',
    'createdAt',
  ]) {
    assert.ok(field in recent, `recent activity is missing ${field}`);
  }

  const scoped = await manage(
    `/api/developer/overview?range=24h&projectId=${state.keyedProjectId}`
  );
  assert.equal(scoped.status, 200);
  assert.ok(scoped.body.data.totals.requests >= 2);
  assert.ok(
    scoped.body.data.usageByEndpoint.every((entry) => typeof entry.endpoint === 'string')
  );

  const usage = await manage(`/api/developer/usage?range=7d&projectId=${state.keyedProjectId}`);
  assert.equal(usage.status, 200);
  assert.equal(usage.body.data.range.bucket, 'day');
  assert.equal(usage.body.data.requestsOverTime.length, 7);
  assert.ok(usage.body.data.totals.requests >= 2);

  const invalidRange = await manage('/api/developer/overview?range=1y');
  assert.equal(invalidRange.status, 400);
  assert.equal(invalidRange.body.error.code, 'VALIDATION_ERROR');

  const badProject = await manage('/api/developer/usage?range=7d&projectId=bad%20id');
  assert.equal(badProject.status, 400);
});

// ---------------------------------------------------------------------------
// Logs: pagination, filters and detail
// ---------------------------------------------------------------------------

test('returns server-side paginated logs with working filters', async () => {
  // Generate a few more records so pagination has something to page through.
  await useApi('/api/v1/links', state.keyedSecret);
  await useApi('/api/v1/analytics/overview', state.keyedSecret);
  await useApi('/api/v1/links/does-not-exist', state.keyedSecret);

  const firstPage = await manage('/api/developer/logs?limit=2&offset=0');
  assert.equal(firstPage.status, 200, firstPage.raw);
  const page = firstPage.body.data;
  assert.equal(page.limit, 2);
  assert.equal(page.offset, 0);
  assert.ok(page.logs.length <= 2);
  assert.ok(page.total >= 3);
  assert.equal(page.hasMore, true);
  assert.equal(
    page.hasMore,
    page.offset + page.logs.length < page.total,
    'hasMore must match the real total'
  );

  const secondPage = await manage('/api/developer/logs?limit=2&offset=2');
  assert.equal(secondPage.status, 200);
  assert.equal(secondPage.body.data.offset, 2);
  assert.ok(secondPage.body.data.logs.length >= 1);
  const firstIds = new Set(page.logs.map((log) => log.id));
  for (const log of secondPage.body.data.logs) {
    assert.ok(!firstIds.has(log.id), 'pages must not overlap');
  }

  const byMethod = await manage('/api/developer/logs?limit=100&method=GET');
  assert.equal(byMethod.status, 200);
  assert.ok(byMethod.body.data.logs.length >= 1);
  assert.ok(byMethod.body.data.logs.every((log) => log.method === 'GET'));

  const failures = await manage('/api/developer/logs?limit=100&status=failed');
  assert.equal(failures.status, 200);
  assert.ok(failures.body.data.logs.length >= 1);
  assert.ok(failures.body.data.logs.every((log) => log.statusCode >= 400));

  const successes = await manage('/api/developer/logs?limit=100&status=success');
  assert.equal(successes.status, 200);
  assert.ok(successes.body.data.logs.every((log) => log.statusCode < 400));

  const search = await manage('/api/developer/logs?limit=100&endpoint=analytics');
  assert.equal(search.status, 200);
  assert.ok(search.body.data.logs.length >= 1);
  assert.ok(search.body.data.logs.every((log) => log.endpoint.includes('analytics')));

  const live = await manage('/api/developer/logs?limit=100&environment=live');
  assert.equal(live.status, 200);
  assert.ok(live.body.data.logs.every((log) => log.environment === 'live'));

  const scoped = await manage(
    `/api/developer/logs?limit=100&projectId=${state.keyedProjectId}`
  );
  assert.equal(scoped.status, 200);
  assert.ok(scoped.body.data.logs.length >= 1);
  assert.ok(scoped.body.data.logs.every((log) => log.projectId === state.keyedProjectId));
  assert.ok(scoped.body.data.logs.every((log) => log.projectName === 'Keyed Project'));

  const from = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const future = await manage(`/api/developer/logs?limit=100&from=${encodeURIComponent(from)}`);
  assert.equal(future.status, 200);
  assert.equal(future.body.data.total, 0);

  for (const bad of [
    '/api/developer/logs?limit=0',
    '/api/developer/logs?limit=101',
    '/api/developer/logs?offset=-1',
    '/api/developer/logs?status=nope',
    '/api/developer/logs?environment=prod',
    '/api/developer/logs?method=%20',
    '/api/developer/logs?from=not-a-date',
  ]) {
    const response = await manage(bad);
    assert.equal(response.status, 400, `${bad} must be rejected`);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
});

test('returns log detail and enforces ownership', async () => {
  const logs = await manage('/api/developer/logs?limit=1');
  assert.equal(logs.status, 200);
  const log = logs.body.data.logs[0];
  assert.ok(log);

  const detail = await manage(`/api/developer/logs/${log.id}`);
  assert.equal(detail.status, 200, detail.raw);
  assert.equal(detail.body.data.id, log.id);
  assert.equal(detail.body.data.endpoint, log.endpoint);
  assert.equal(detail.body.data.statusCode, log.statusCode);
  assert.equal(detail.body.data.durationMs, log.durationMs);

  const crossUser = await manage(`/api/developer/logs/${log.id}`, { auth: OTHER_TOKEN });
  assert.equal(crossUser.status, 404);
  assert.equal(crossUser.body.error.code, 'LOG_NOT_FOUND');

  const malformed = await manage('/api/developer/logs/bad%20id!');
  assert.equal(malformed.status, 400);

  const missing = await manage('/api/developer/logs/use_does_not_exist');
  assert.equal(missing.status, 404);
});

// ---------------------------------------------------------------------------
// Cross-developer isolation for analytics
// ---------------------------------------------------------------------------

test('never leaks another developer analytics through filters or queries', async () => {
  const otherKey = await manage('/api/developer/keys', {
    method: 'POST',
    auth: OTHER_TOKEN,
    body: {
      projectId: state.otherProjectId,
      environment: 'live',
      scopes: ALL_SCOPES,
    },
  });
  assert.equal(otherKey.status, 201, otherKey.raw);
  state.otherKey = otherKey.body.data.apiKey;
  assert.equal(otherKey.body.data.projectId, state.otherProjectId);

  const otherCall = await useApi('/api/v1/links', state.otherKey);
  assert.equal(otherCall.status, 200);

  // An endpoint only this developer called must not be visible to the other
  // developer, even with the same search term.
  const developerSearch = await manage(
    '/api/developer/logs?limit=100&endpoint=not-a-real-endpoint'
  );
  assert.equal(developerSearch.status, 200);
  assert.ok(developerSearch.body.data.total >= 1);

  const otherLeak = await manage(
    '/api/developer/logs?limit=100&endpoint=not-a-real-endpoint',
    { auth: OTHER_TOKEN }
  );
  assert.equal(otherLeak.status, 200);
  assert.equal(otherLeak.body.data.total, 0);

  // Filtering by a project id owned by someone else returns no rows instead
  // of the other developer's data.
  const foreignUsage = await manage(
    `/api/developer/usage?range=7d&projectId=${state.otherProjectId}`
  );
  assert.equal(foreignUsage.status, 200);
  assert.equal(foreignUsage.body.data.totals.requests, 0);

  const foreignLogs = await manage(
    `/api/developer/logs?limit=100&projectId=${state.otherProjectId}`
  );
  assert.equal(foreignLogs.status, 200);
  assert.equal(foreignLogs.body.data.total, 0);

  // The other developer sees their own traffic.
  const otherLogs = await manage('/api/developer/logs?limit=100', { auth: OTHER_TOKEN });
  assert.equal(otherLogs.status, 200);
  assert.ok(otherLogs.body.data.total >= 1);
  assert.ok(
    otherLogs.body.data.logs.every(
      (log) => log.projectId === state.otherProjectId && log.environment === 'live'
    )
  );

  const otherOverview = await manage('/api/developer/overview?range=24h', { auth: OTHER_TOKEN });
  assert.equal(otherOverview.status, 200);
  assert.ok(otherOverview.body.data.totals.requests >= 1);
  assert.equal(otherOverview.body.data.projects.total, 1);
  assert.ok(
    otherOverview.body.data.recentActivity.every(
      (activity) => activity.projectId === state.otherProjectId
    )
  );
});

test('keeps the in-memory project store consistent with the API views', () => {
  const stored = projectMemoryStore.records;
  assert.ok(stored.size >= 3);
  for (const project of stored.values()) {
    assert.ok(project.name.length > 0);
    assert.ok(project.user_id);
  }
});
