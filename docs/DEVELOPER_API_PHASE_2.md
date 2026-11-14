# LinkFlow Developer API — Phase 2: API Key Management

Phase 2 replaces the Phase 1 single bootstrap key with persistent,
per-developer API keys: generation, HMAC-SHA256 storage, scopes, `test`/`live`
environments, rotation and revocation. The versioned public API under
`/api/v1` and its response envelope are unchanged; only authentication and
authorization were extended.

> LinkFlow's backend is a plain Node `http` server (`server/index.ts`), not
> NestJS. Phase 2 follows the Phase 1 adaptation: small modules, dependency
> injected repository ports, a reusable guard, and a single dispatched router.

---

## 1. Environment configuration

All variables are **server-only**. Never prefix them with `EXPO_PUBLIC_`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `API_KEY_HASH_SECRET` | yes | Dedicated HMAC-SHA256 key used to derive stored credential hashes. Minimum 32 characters. Missing/short → `503 API_KEY_HASH_NOT_CONFIGURED`. |
| `DATABASE_URL` | yes in production | PostgreSQL connection used by `developer_api_keys`. Missing in production → `503 DATABASE_NOT_CONFIGURED`. |
| `PUBLIC_SHORT_URL_BASE` | no | Canonical origin for `shortUrl`. Falls back to `EXPO_PUBLIC_SHORT_URL_BASE`, then the request origin. |

The old `DEVELOPER_API_KEY` and `DEVELOPER_API_CLERK_USER_ID` variables were
**removed**. There is no production bypass and no fallback credential.

Generate a hashing secret (do this once per environment and keep it secret):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> Rotating `API_KEY_HASH_SECRET` invalidates every existing API key, because
> stored hashes can no longer be reproduced. Plan rotations accordingly.

Run migrations before starting the API in production. They are idempotent and
non-destructive:

```bash
# via the server's migration helper
curl -X POST https://your-api.example.com/api/admin/migrate
```

`server/start.ts` also runs `runMigrations()` automatically when
`DATABASE_URL` is configured.

---

## 2. Key format

```
lf_<test|live>_<16-hex lookup prefix>_<43-char base64url secret>
```

Example shape (not a real credential):

```
lf_live_9f2c71a04b8de613_4tQm...43chars...
```

| Part | Size | Purpose |
| --- | --- | --- |
| `lf_` | prefix | Recognisable namespace. |
| `test` / `live` | environment | Must match the stored record. |
| lookup prefix | 16 hex chars (64 bits) | Non-secret, indexed lookup id. Cannot authenticate alone. |
| secret | 32 random bytes (256 bits), base64url | Proves possession; only its HMAC is stored. |

Generation uses `crypto.randomBytes` exclusively — never `Math.random()`.
Keys are generated server-side, only by `POST /api/developer/keys` and
`POST /api/developer/keys/:id/rotate`.

The full key is returned **exactly once**, in the creation or rotation
response. It is never stored in plaintext, never logged, and never returned by
list/get/revoke.

---

## 3. Storage and hashing

Persisted in PostgreSQL table `developer_api_keys`
(`server/schema.ts`):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `user_id` | UUID | FK → `users(id)` `ON DELETE CASCADE`. |
| `project_name` | VARCHAR(100) | Developer-facing label. |
| `key_prefix` | VARCHAR(32) | Unique lookup id (`UNIQUE INDEX`). |
| `key_hash` | VARCHAR(64) | `HMAC-SHA256(secret, API_KEY_HASH_SECRET)` hex. |
| `environment` | VARCHAR(10) | `CHECK IN ('test','live')`. |
| `scopes` | TEXT[] | Validated scope strings. |
| `status` | VARCHAR(20) | `CHECK IN ('active','revoked')`. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Server timestamps. |
| `last_used_at` | TIMESTAMPTZ | Throttled metadata update. |
| `expires_at` | TIMESTAMPTZ | Optional absolute expiry. |
| `revoked_at` | TIMESTAMPTZ | Set on revocation. |
| `rotated_from_id` | UUID | FK → `developer_api_keys(id)`, audit trail. |

Indexes:

- `idx_developer_api_keys_prefix` — unique, powers O(1) authentication lookup.
- `idx_developer_api_keys_user` — `(user_id, created_at DESC)` for listing.
- `idx_developer_api_keys_status` — `(user_id, status)` for status filters.

Verification uses `crypto.timingSafeEqual` over the derived HMAC digests.
Missing or short `API_KEY_HASH_SECRET` fails closed: no plaintext or weaker
hash fallback exists.

The in-memory repository is available only outside production for local
development and tests. When `NODE_ENV=production` and `DATABASE_URL` is absent,
persistence throws `PersistenceUnavailableError` and the API returns `503`
`DATABASE_NOT_CONFIGURED`.

---

## 4. Authentication flow

`server/developer-api/guards/api-key.guard.ts`:

1. Read `X-API-Key` → `401 MISSING_API_KEY` if absent.
2. Confirm `API_KEY_HASH_SECRET` is usable → `503 API_KEY_HASH_NOT_CONFIGURED`.
3. Parse `lf_<env>_<prefix>_<secret>` → `401 INVALID_API_KEY` if malformed.
4. Look up `key_prefix` → `401 INVALID_API_KEY` if unknown.
5. Require the presented environment to match the record → `401 INVALID_API_KEY`.
6. Verify `HMAC-SHA256` with constant-time comparison → `401 INVALID_API_KEY`.
7. Require `status = 'active'` → `401 API_KEY_REVOKED`.
8. Require `expires_at` in the future → `401 API_KEY_EXPIRED`.
9. Resolve the owner from `user_id` → `403 DEVELOPER_NOT_PROVISIONED`.
10. Attach `{ userId, apiKeyId, environment, scopes, … }` to the request.
11. Update `last_used_at` at most once per 60 seconds per key per process
    (fire-and-forget; never fails the request).

Backward-compatible security note: revoked/expired codes are only revealed
**after** the submitted secret verifies against the stored hash. An attacker
without the secret cannot distinguish a revoked prefix from an unknown one, so
key enumeration is not possible. Malformed and unknown credentials share the
same `INVALID_API_KEY` response.

`/api/v1/*` remains independent from Clerk JWT: an API key cannot call
`/api/links`, `/api/qr`, etc., and a JWT cannot call `/api/v1/*`.

---

## 5. Scopes

| Scope | Grants |
| --- | --- |
| `links:read` | `GET /api/v1/links`, `GET /api/v1/links/:id` |
| `links:write` | `POST /api/v1/links` |
| `links:delete` | `DELETE /api/v1/links/:id` |
| `qr:read` | `GET /api/v1/qr`, `GET /api/v1/qr/:id` |
| `qr:write` | `POST /api/v1/qr` |
| `qr:delete` | `DELETE /api/v1/qr/:id` |
| `analytics:read` | `GET /api/v1/analytics/overview`, `/links/:id/analytics`, `/qr/:id/analytics` |

Enforcement is centralized in
`server/developer-api/guards/scope.guard.ts` and applied per route in
`public-api.module.ts`. A missing scope returns:

```json
{
  "success": false,
  "message": "This API key lacks the required scope: qr:write.",
  "error": { "code": "INSUFFICIENT_SCOPE" }
}
```

Scopes are read only from the persisted key record. Request bodies cannot
supply or escalate scopes or user ids.

---

## 6. Management endpoints (JWT only)

Management uses the existing Clerk Bearer JWT. API keys are rejected here.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/developer/keys` | Create a key. |
| `GET` | `/api/developer/keys` | List the caller's keys (metadata only). |
| `GET` | `/api/developer/keys/:id` | Retrieve one key (metadata only). |
| `DELETE` | `/api/developer/keys/:id` | Revoke a key. |
| `POST` | `/api/developer/keys/:id/rotate` | Rotate: revoke old, return new secret. |

All responses use the Phase 1 envelope:
`{ success, message, data }` or `{ success: false, message, error: { code } }`.

Ownership is enforced in every query (`WHERE id = $1 AND user_id = $2`).
Another user's key is reported as `404 API_KEY_NOT_FOUND`, never `403`, so the
existence of other accounts' keys is not disclosed.

### Create

```http
POST /api/developer/keys
Authorization: Bearer <clerk-jwt>
Content-Type: application/json

{
  "projectName": "My Ecommerce App",
  "environment": "live",
  "scopes": ["links:read", "links:write"],
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

`expiresAt` is optional and must be in the future. Response `201`:

```json
{
  "success": true,
  "message": "API key created successfully",
  "data": {
    "id": "1f0b…",
    "projectName": "My Ecommerce App",
    "keyPrefix": "9f2c71a04b8de613",
    "environment": "live",
    "apiKey": "lf_live_9f2c71a04b8de613_<43 chars>",
    "scopes": ["links:read", "links:write"],
    "status": "active",
    "createdAt": "2026-11-13T10:00:00.000Z",
    "updatedAt": "2026-11-13T10:00:00.000Z",
    "lastUsedAt": null,
    "expiresAt": "2027-01-01T00:00:00.000Z",
    "revokedAt": null,
    "rotatedFromId": null
  }
}
```

### List / get

`data.keys` and the single-key response contain metadata only — never `apiKey`
and never `keyHash`.

### Revoke

`DELETE` is idempotent: revoking an already-revoked key returns its metadata
with `status: "revoked"` and the original `revokedAt`. The key stops
authenticating immediately and can never become active again.

### Rotate

`POST /api/developer/keys/:id/rotate` requires no body. It:

1. Locks the row (`SELECT … FOR UPDATE`) inside a transaction.
2. Verifies the key is still active and unexpired.
3. Revokes the old row (`status`, `revoked_at`, `updated_at`).
4. Inserts a replacement with the same project, environment, scopes and expiry,
   with `rotated_from_id` pointing at the old row.
5. Returns the new full secret once, plus `rotatedFromId`.

The old row is retained as the audit trail. Rotating a revoked key returns
`409 API_KEY_REVOKED`; rotating an expired key returns `409 API_KEY_EXPIRED`.

---

## 7. Error reference

| Status | Code | Meaning |
| --- | --- | --- |
| `401` | `MISSING_API_KEY` | No `X-API-Key` header. |
| `401` | `INVALID_API_KEY` | Malformed, unknown, wrong-environment or wrong-secret key. |
| `401` | `API_KEY_REVOKED` | Correct secret, key revoked. |
| `401` | `API_KEY_EXPIRED` | Correct secret, key expired. |
| `401` | `UNAUTHORIZED` | Management call without a valid Bearer JWT. |
| `403` | `INSUFFICIENT_SCOPE` | Key lacks the route's scope. |
| `403` | `DEVELOPER_NOT_PROVISIONED` | Key owner no longer exists. |
| `400` | `VALIDATION_ERROR` | Invalid project name, environment, scope, expiry or id. |
| `404` | `API_KEY_NOT_FOUND` | Unknown id or another user's key. |
| `405` | `METHOD_NOT_ALLOWED` | Unsupported method (includes `Allow`). |
| `409` | `API_KEY_REVOKED` / `API_KEY_EXPIRED` | Rotation of an unusable key. |
| `503` | `API_KEY_HASH_NOT_CONFIGURED` | `API_KEY_HASH_SECRET` missing/short. |
| `503` | `DATABASE_NOT_CONFIGURED` | Production without `DATABASE_URL`. |

No credential, hash or stack trace is included in error responses.

---

## 8. Test / live environments

Both environments use the same guard, hashing, scope enforcement and
persistence. The environment segment is part of the credential and must match
the stored record:

- A `test` key authenticates as its owner exactly like a `live` key.
- Presenting a `live` credential with the `lf_test_` prefix fails as
  `INVALID_API_KEY`.
- There is no implicit production resource access and no authentication bypass
  for either environment.

---

## 9. Tests

```bash
npm run test:server       # build + in-memory suite (PostgreSQL tests skipped)
npm run test:server:pg    # PostgreSQL suite, requires TEST_DATABASE_URL
```

`tests/developer-api.test.js` covers Phase 1 behaviour plus Phase 2 creation,
storage, authentication, scopes, management, rotation, revocation, cross-user
isolation, production fail-closed behaviour and `lastUsedAt` tracking.

`tests/api-keys.pg.test.js` is opt-in. It validates the migration, columns,
unique prefix index, foreign keys, constraint enforcement, hash-only storage,
owner isolation and the rotation transaction against a disposable PostgreSQL
database:

```bash
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/linkflow_test \
  npm run test:server:pg
```

The in-memory suite cannot prove PostgreSQL behaviour; do not treat a skipped
run as PostgreSQL coverage.

---

## 10. Known limitations

- No developer dashboard/UI (Phase 3).
- No billing, quotas, rate limiting, SDKs or webhooks.
- QR scan analytics remain unsupported for standalone QR codes; linked QR
  analytics report the linked link's clicks.
- `lastUsedAt` is throttled per process, so it may lag by up to a minute and
  concurrent instances each write independently.
- Rotating `API_KEY_HASH_SECRET` invalidates all keys by design; there is no
  dual-secret grace period yet.
- Expired/revoked rows are retained indefinitely as the audit trail; no pruning
  job exists.
- Pagination for key listing is not exposed yet; lists are ordered by
  `created_at DESC` and returned in full.
