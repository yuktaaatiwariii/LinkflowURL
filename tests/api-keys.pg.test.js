'use strict';

/**
 * PostgreSQL-backed tests for the Phase 2 `developer_api_keys` table.
 *
 * Opt-in: they run only when TEST_DATABASE_URL points at a disposable
 * PostgreSQL database. They are skipped otherwise, so a normal
 * `npm run test:server` never touches a real database.
 *
 *   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/linkflow_test \
 *     npm run test:server:pg
 *
 * These cover what the in-memory suite cannot: the SQL migration, the unique
 * prefix index, the foreign keys, constraint enforcement and the atomic
 * rotation transaction.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const skip = TEST_DATABASE_URL
  ? false
  : 'Set TEST_DATABASE_URL to a disposable PostgreSQL database to run these tests.';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.API_KEY_HASH_SECRET =
  process.env.API_KEY_HASH_SECRET ||
  'phase2-pg-test-hash-secret-0123456789abcdef0123456789abcdef';

const { runMigrations } = require('../dist-server/schema.js');
const { query } = require('../dist-server/db.js');
const { syncUserInDb } = require('../dist-server/index.js');
const {
  generateApiKey,
  hashApiKeySecret,
} = require('../dist-server/developer-api/keys/api-key-crypto.js');
const {
  insertApiKey,
  findApiKeyByPrefix,
  findApiKeyForUser,
  listApiKeysForUser,
  revokeApiKey,
  rotateApiKey,
} = require('../dist-server/developer-api/keys/api-key.store.js');
const {
  insertProject,
  findProjectForUser,
  findProjectByName,
  listProjectsForUser,
  renameProject,
  deleteProject,
} = require('../dist-server/developer-api/projects/project.store.js');
const {
  recordApiUsage,
  listUsageLogs,
  findUsageLogForUser,
  getUsageTotals,
  getUsageSeries,
  getUsageByEndpoint,
  parseUsageRange,
} = require('../dist-server/developer-api/usage/usage.store.js');

const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const state = { owner: null, other: null };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanup() {
  if (!TEST_DATABASE_URL) return;
  try {
    if (state.owner) {
      await query('DELETE FROM developer_api_usage_events WHERE user_id = $1', [state.owner.id]);
      await query('DELETE FROM developer_api_keys WHERE user_id = $1', [state.owner.id]);
      await query('DELETE FROM developer_projects WHERE user_id = $1', [state.owner.id]);
    }
    if (state.other) {
      await query('DELETE FROM developer_api_usage_events WHERE user_id = $1', [state.other.id]);
      await query('DELETE FROM developer_api_keys WHERE user_id = $1', [state.other.id]);
      await query('DELETE FROM developer_projects WHERE user_id = $1', [state.other.id]);
    }
    for (const user of [state.owner, state.other]) {
      if (user) await query('DELETE FROM users WHERE id = $1', [user.id]);
    }
  } catch (err) {
    console.warn('[api-keys.pg.test cleanup]:', err.message);
  }
}

before(async () => {
  if (!TEST_DATABASE_URL) return;
  const result = await runMigrations();
  assert.equal(result.success, true, result.message);

  state.owner = await syncUserInDb(
    `pg_key_owner_${suffix}`,
    `pg-owner-${suffix}@example.com`,
    'PG Owner'
  );
  state.other = await syncUserInDb(
    `pg_key_other_${suffix}`,
    `pg-other-${suffix}@example.com`,
    'PG Other'
  );
});

after(cleanup);

test('creates the developer_api_keys table with the expected columns', { skip }, async () => {
  const columns = await query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'developer_api_keys'
     ORDER BY ordinal_position`
  );
  const names = columns.map((row) => row.column_name);
  for (const expected of [
    'id',
    'user_id',
    'project_id',
    'project_name',
    'key_prefix',
    'key_hash',
    'environment',
    'scopes',
    'status',
    'created_at',
    'updated_at',
    'last_used_at',
    'expires_at',
    'revoked_at',
    'rotated_from_id',
  ]) {
    assert.ok(names.includes(expected), `missing column ${expected}`);
  }
});

test('creates a unique prefix index and user/status indexes', { skip }, async () => {
  const indexes = await query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'developer_api_keys'`
  );
  const prefix = indexes.find((row) => row.indexname === 'idx_developer_api_keys_prefix');
  assert.ok(prefix, 'prefix index missing');
  assert.match(prefix.indexdef, /UNIQUE/i);
  assert.ok(indexes.some((row) => row.indexname === 'idx_developer_api_keys_user'));
  assert.ok(indexes.some((row) => row.indexname === 'idx_developer_api_keys_status'));
});

test('enforces the user foreign key', { skip }, async () => {
  const constraints = await query(
    `SELECT conname, pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE conrelid = 'developer_api_keys'::regclass AND contype = 'f'`
  );
  const userFk = constraints.find((row) => row.conname === 'developer_api_keys_user_id_fkey');
  assert.ok(userFk, 'user_id foreign key missing');
  assert.match(userFk.definition, /REFERENCES users\(id\)/);
  assert.match(userFk.definition, /ON DELETE CASCADE/i);

  const generated = generateApiKey('test');
  await assert.rejects(
    () =>
      insertApiKey({
        userId: '00000000-0000-0000-0000-000000000000',
        projectName: 'Orphan',
        keyPrefix: generated.prefix,
        keyHash: hashApiKeySecret(generated.secret),
        environment: 'test',
        scopes: ['links:read'],
        expiresAt: null,
      }),
    /foreign key|violates/i
  );
});

test('persists only the HMAC hash, never the plaintext secret', { skip }, async () => {
  const generated = generateApiKey('live');
  const hash = hashApiKeySecret(generated.secret);

  const record = await insertApiKey({
    userId: state.owner.id,
    projectName: 'PG Storage',
    keyPrefix: generated.prefix,
    keyHash: hash,
    environment: 'live',
    scopes: ['links:read', 'links:write'],
    expiresAt: null,
  });

  const rows = await query(
    'SELECT key_hash, key_prefix, environment, scopes FROM developer_api_keys WHERE id = $1',
    [record.id]
  );
  assert.equal(rows[0].key_hash, hash);
  assert.equal(rows[0].key_prefix, generated.prefix);
  assert.equal(rows[0].environment, 'live');
  assert.deepEqual(rows[0].scopes, ['links:read', 'links:write']);

  const raw = JSON.stringify(rows[0]);
  assert.equal(raw.includes(generated.secret), false);
  assert.equal(raw.includes(generated.fullKey), false);
});

test('looks up by prefix and enforces owner isolation', { skip }, async () => {
  const generated = generateApiKey('test');
  const record = await insertApiKey({
    userId: state.owner.id,
    projectName: 'PG Lookup',
    keyPrefix: generated.prefix,
    keyHash: hashApiKeySecret(generated.secret),
    environment: 'test',
    scopes: ['links:read'],
    expiresAt: null,
  });

  const found = await findApiKeyByPrefix(generated.prefix);
  assert.ok(found);
  assert.equal(found.id, record.id);
  assert.equal(found.key_hash, hashApiKeySecret(generated.secret));

  const owned = await findApiKeyForUser(record.id, state.owner.id);
  assert.ok(owned);
  const foreign = await findApiKeyForUser(record.id, state.other.id);
  assert.equal(foreign, null);

  const ownerList = await listApiKeysForUser(state.owner.id);
  assert.ok(ownerList.some((key) => key.id === record.id));
  const otherList = await listApiKeysForUser(state.other.id);
  assert.equal(otherList.some((key) => key.id === record.id), false);
  assert.equal(await revokeApiKey(record.id, state.other.id), null);
});

test('rejects a duplicate lookup prefix at the database level', { skip }, async () => {
  const generated = generateApiKey('test');
  await insertApiKey({
    userId: state.owner.id,
    projectName: 'PG Duplicate A',
    keyPrefix: generated.prefix,
    keyHash: hashApiKeySecret(generated.secret),
    environment: 'test',
    scopes: ['links:read'],
    expiresAt: null,
  });

  const second = generateApiKey('test');
  await assert.rejects(
    () =>
      insertApiKey({
        userId: state.owner.id,
        projectName: 'PG Duplicate B',
        keyPrefix: generated.prefix,
        keyHash: hashApiKeySecret(second.secret),
        environment: 'test',
        scopes: ['links:read'],
        expiresAt: null,
      }),
    /duplicate key|unique/i
  );
});

test('rotation is atomic and preserves the revoked audit trail', { skip }, async () => {
  const original = generateApiKey('live');
  const record = await insertApiKey({
    userId: state.owner.id,
    projectName: 'PG Rotate',
    keyPrefix: original.prefix,
    keyHash: hashApiKeySecret(original.secret),
    environment: 'live',
    scopes: ['links:read'],
    expiresAt: null,
  });

  const replacement = generateApiKey('live');
  const result = await rotateApiKey(record.id, state.owner.id, {
    keyPrefix: replacement.prefix,
    keyHash: hashApiKeySecret(replacement.secret),
  });
  assert.equal(result.ok, true);
  assert.equal(result.revoked.id, record.id);
  assert.equal(result.revoked.status, 'revoked');
  assert.ok(result.revoked.revoked_at);
  assert.equal(result.created.status, 'active');
  assert.equal(result.created.rotated_from_id, record.id);
  assert.equal(result.created.environment, 'live');

  const oldLookup = await findApiKeyByPrefix(original.prefix);
  assert.equal(oldLookup.status, 'revoked');
  const newLookup = await findApiKeyByPrefix(replacement.prefix);
  assert.equal(newLookup.status, 'active');

  const again = await rotateApiKey(record.id, state.owner.id, {
    keyPrefix: generateApiKey('live').prefix,
    keyHash: hashApiKeySecret(generateApiKey('live').secret),
  });
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'revoked');
});

test('rotation by a non-owner reports not_found and changes nothing', { skip }, async () => {
  const original = generateApiKey('test');
  const record = await insertApiKey({
    userId: state.owner.id,
    projectName: 'PG Rotate Isolation',
    keyPrefix: original.prefix,
    keyHash: hashApiKeySecret(original.secret),
    environment: 'test',
    scopes: ['links:read'],
    expiresAt: null,
  });

  const replacement = generateApiKey('test');
  const result = await rotateApiKey(record.id, state.other.id, {
    keyPrefix: replacement.prefix,
    keyHash: hashApiKeySecret(replacement.secret),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not_found');

  const unchanged = await findApiKeyForUser(record.id, state.owner.id);
  assert.equal(unchanged.status, 'active');
});

// ---------------------------------------------------------------------------
// Phase 3: projects, usage analytics and migration backfill
// ---------------------------------------------------------------------------

test('creates the Phase 3 project and usage tables with their indexes', { skip }, async () => {
  const columns = await query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('developer_projects', 'developer_api_usage_events')
     ORDER BY table_name, ordinal_position`
  );

  const byTable = (name) =>
    columns.filter((row) => row.table_name === name).map((row) => row.column_name);

  const projectColumns = byTable('developer_projects');
  for (const expected of ['id', 'user_id', 'name', 'created_at', 'updated_at']) {
    assert.ok(projectColumns.includes(expected), `developer_projects missing ${expected}`);
  }

  const usageColumns = byTable('developer_api_usage_events');
  for (const expected of [
    'id',
    'user_id',
    'api_key_id',
    'project_id',
    'endpoint',
    'method',
    'environment',
    'status_code',
    'duration_ms',
    'created_at',
  ]) {
    assert.ok(usageColumns.includes(expected), `developer_api_usage_events missing ${expected}`);
  }

  const indexes = await query(
    `SELECT tablename, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename IN ('developer_projects', 'developer_api_usage_events')`
  );
  const names = indexes.map((row) => row.indexname);
  for (const expected of [
    'idx_developer_projects_user',
    'idx_developer_projects_user_name',
    'idx_developer_usage_user_created',
    'idx_developer_usage_project_created',
    'idx_developer_usage_endpoint',
  ]) {
    assert.ok(names.includes(expected), `missing index ${expected}`);
  }

  const projectNameIndex = indexes.find(
    (row) => row.indexname === 'idx_developer_projects_user_name'
  );
  assert.match(projectNameIndex.indexdef, /UNIQUE/i);
});

test('persists projects with case-insensitive uniqueness and ownership', { skip }, async () => {
  const created = await insertProject(state.owner.id, 'PG Project');
  assert.ok(created.id);
  assert.equal(created.name, 'PG Project');

  // insertProject returns the existing row instead of failing on a duplicate.
  const duplicate = await insertProject(state.owner.id, 'pg project');
  assert.equal(duplicate.id, created.id);

  const byName = await findProjectByName(state.owner.id, 'PG PROJECT');
  assert.equal(byName.id, created.id);

  const listed = await listProjectsForUser(state.owner.id);
  assert.equal(listed.filter((row) => row.id === created.id).length, 1);

  const foreign = await findProjectForUser(created.id, state.other.id);
  assert.equal(foreign, null);

  const renameForeign = await renameProject(created.id, state.other.id, 'Hijacked');
  assert.equal(renameForeign.ok, false);
  assert.equal(renameForeign.reason, 'not_found');

  const otherProject = await insertProject(state.other.id, 'PG Project');
  assert.notEqual(otherProject.id, created.id, 'names are unique per developer, not globally');

  const renamed = await renameProject(created.id, state.owner.id, 'PG Project Renamed');
  assert.equal(renamed.ok, true);
  assert.equal(renamed.project.name, 'PG Project Renamed');

  const removedForeign = await deleteProject(created.id, state.other.id);
  assert.equal(removedForeign, false);
  const removed = await deleteProject(created.id, state.owner.id);
  assert.equal(removed, true);

  await deleteProject(otherProject.id, state.other.id);
});

test('backfills a Phase 2 projectName key into a Phase 3 project on migration', { skip }, async () => {
  const generated = generateApiKey('live');
  const legacy = await insertApiKey({
    userId: state.owner.id,
    projectId: null,
    projectName: 'Legacy Backfill Project',
    keyPrefix: generated.prefix,
    keyHash: hashApiKeySecret(generated.secret),
    environment: 'live',
    scopes: ['links:read'],
    expiresAt: null,
  });
  assert.equal(legacy.project_id, null);

  // Re-running the migration must be idempotent and run the backfill.
  const rerun = await runMigrations();
  assert.equal(rerun.success, true, rerun.message);

  const linked = await findApiKeyForUser(legacy.id, state.owner.id);
  assert.ok(linked.project_id, 'legacy key was not linked to a project');

  const project = await findProjectForUser(linked.project_id, state.owner.id);
  assert.ok(project);
  assert.equal(project.name, 'Legacy Backfill Project');
  assert.equal(linked.project_name, 'Legacy Backfill Project');

  // A second migration run must not create duplicates.
  await runMigrations();
  const projects = await listProjectsForUser(state.owner.id);
  assert.equal(
    projects.filter((row) => row.name === 'Legacy Backfill Project').length,
    1
  );

  await query('DELETE FROM developer_api_keys WHERE id = $1', [legacy.id]);
  await query('DELETE FROM developer_projects WHERE id = $1', [project.id]);
});

test('persists, aggregates and paginates usage events with exclusive dates', { skip }, async () => {
  const range = parseUsageRange('24h');
  assert.ok(range);

  recordApiUsage({
    userId: state.owner.id,
    apiKeyId: null,
    projectId: null,
    endpoint: '/api/v1/links/abc123',
    method: 'get',
    environment: 'live',
    statusCode: 200,
    durationMs: 12,
  });
  recordApiUsage({
    userId: state.owner.id,
    apiKeyId: null,
    projectId: null,
    endpoint: '/api/v1/links/def456',
    method: 'DELETE',
    environment: 'test',
    statusCode: 409,
    durationMs: 7,
  });
  // Analytics writes are fire-and-forget.
  await sleep(250);

  const page = await listUsageLogs(state.owner.id, { limit: 10, offset: 0 });
  assert.ok(page.total >= 2);
  assert.ok(page.logs.every((log) => log.user_id === state.owner.id));

  const normalized = page.logs.map((log) => log.endpoint);
  assert.ok(normalized.includes('/api/v1/links/:id'), 'endpoint ids must be normalized');
  assert.ok(!normalized.some((endpoint) => endpoint.includes('abc123')));

  const totals = await getUsageTotals(state.owner.id, range);
  assert.ok(totals.requests >= 2);
  assert.ok(totals.success >= 1);
  assert.ok(totals.failed >= 1);
  assert.ok(totals.averageDurationMs >= 0);

  const series = await getUsageSeries(state.owner.id, range);
  assert.equal(series.length, 24);
  assert.equal(
    series.reduce((sum, bucket) => sum + bucket.requests, 0),
    totals.requests
  );

  const byEndpoint = await getUsageByEndpoint(state.owner.id, range);
  const links = byEndpoint.find((entry) => entry.endpoint === '/api/v1/links/:id');
  assert.ok(links);
  assert.ok(links.requests >= 2);

  const failedOnly = await listUsageLogs(state.owner.id, {
    limit: 10,
    offset: 0,
    status: 'failed',
  });
  assert.ok(failedOnly.total >= 1);
  assert.ok(failedOnly.logs.every((log) => log.status_code >= 404));

  const search = await listUsageLogs(state.owner.id, {
    limit: 10,
    offset: 0,
    endpoint: 'links',
    environment: 'live',
  });
  assert.ok(search.logs.every((log) => log.environment === 'live'));

  const other = await listUsageLogs(state.other.id, { limit: 10, offset: 0 });
  assert.equal(other.total, 0, 'usage must be isolated per developer');

  const detail = await findUsageLogForUser(page.logs[0].id, state.owner.id);
  assert.ok(detail);
  assert.equal(await findUsageLogForUser(page.logs[0].id, state.other.id), null);

  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const windowed = await listUsageLogs(state.owner.id, {
    limit: 10,
    offset: 0,
    from: past,
    to: future,
  });
  assert.ok(windowed.total >= 2);

  const emptyWindow = await listUsageLogs(state.owner.id, {
    limit: 10,
    offset: 0,
    from: future,
  });
  assert.equal(emptyWindow.total, 0);
});

test('treats malformed resource ids as not found instead of 500 errors', { skip }, async () => {
  const malformed = 'not-a-uuid';

  assert.equal(await findProjectForUser(malformed, state.owner.id), null);
  const rename = await renameProject(malformed, state.owner.id, 'Nope');
  assert.equal(rename.ok, false);
  assert.equal(rename.reason, 'not_found');
  assert.equal(await deleteProject(malformed, state.owner.id), false);

  assert.equal(await findApiKeyForUser(malformed, state.owner.id), null);
  assert.equal(await revokeApiKey(malformed, state.owner.id), null);

  const rotation = await rotateApiKey(malformed, state.owner.id, {
    keyPrefix: generateApiKey('test').prefix,
    keyHash: hashApiKeySecret(generateApiKey('test').secret),
  });
  assert.equal(rotation.ok, false);
  assert.equal(rotation.reason, 'not_found');

  assert.equal(await findUsageLogForUser(malformed, state.owner.id), null);
});
