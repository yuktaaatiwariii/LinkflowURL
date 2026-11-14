# LinkFlow Developer API — Phase 1

> **Superseded by Phase 2 for authentication and environment configuration.**
> See [`DEVELOPER_API_PHASE_2.md`](./DEVELOPER_API_PHASE_2.md). The single
> bootstrap key (`DEVELOPER_API_KEY` / `DEVELOPER_API_CLERK_USER_ID`) has been
> removed; `/api/v1/*` now authenticates persistent, scoped, per-developer keys.
> The endpoint, envelope, pagination, ownership and analytics sections below are
> still accurate.

Versioned public REST API for URL shortening, QR generation and link analytics.

Base path: `/api/v1`

> **Architecture note.** LinkFlow's backend is a plain Node `http` server
> (`server/index.ts`), not NestJS. The developer API keeps the requested
> separation (public controllers, DTOs, guard, developer decorator, interfaces)
> but adapts it to this runtime: dependency-injected repository ports instead of
> providers, a `WeakMap` request decorator instead of an execution context, and a
> single guarded router instead of Nest guards/decorators.

---

## 1. Environment configuration

> **Superseded in Phase 2.** The bootstrap variables no longer exist. Configure
> `API_KEY_HASH_SECRET` and `DATABASE_URL` instead; see
> [`DEVELOPER_API_PHASE_2.md`](./DEVELOPER_API_PHASE_2.md).

All variables are **server-only**. Never prefix them with `EXPO_PUBLIC_`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DEVELOPER_API_KEY` | yes (for `/api/v1` in development) | Bootstrap API key compared against `X-API-Key`. |
| `DEVELOPER_API_CLERK_USER_ID` | yes | `clerk_user_id` of the LinkFlow account the key acts as. |
| `PUBLIC_SHORT_URL_BASE` | no | Canonical origin for `shortUrl`. Falls back to `EXPO_PUBLIC_SHORT_URL_BASE`, then the request origin. |

If `DEVELOPER_API_KEY` or `DEVELOPER_API_CLERK_USER_ID` is missing, the API
fails closed with `503` — there is no built-in or default credential.
The bootstrap credential is **local development only**: when
`NODE_ENV=production`, every `/api/v1/*` request returns `503`
`API_KEY_NOT_CONFIGURED` even if the variables are set. Persistent production
keys arrive in Phase 2.

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 2. Authentication

> **Superseded in Phase 2.** The bootstrap key flow below has been removed.
> `/api/v1/*` now uses persistent keys created through `POST /api/developer/keys`,
> with HMAC-SHA256 storage and per-key scopes. See
> [`DEVELOPER_API_PHASE_2.md`](./DEVELOPER_API_PHASE_2.md).

Every `/api/v1/*` request must send:

```
X-API-Key: <DEVELOPER_API_KEY>
```

Flow (`server/developer-api/guards/api-key.guard.ts`):

1. Bootstrap auth is enabled (`NODE_ENV !== production`) → otherwise `503`
   `API_KEY_NOT_CONFIGURED`.
2. Configuration exists → otherwise `503` `API_KEY_NOT_CONFIGURED` /
   `DEVELOPER_IDENTITY_NOT_CONFIGURED`.
3. `X-API-Key` is present → otherwise `401 MISSING_API_KEY`.
4. SHA-256 of the presented key is compared with SHA-256 of the configured key
   using `crypto.timingSafeEqual` → otherwise `401 INVALID_API_KEY`.
5. The configured `DEVELOPER_API_CLERK_USER_ID` is resolved to an existing
   LinkFlow user → otherwise `403 DEVELOPER_NOT_PROVISIONED`.
6. The resolved `userId` is attached to the request and used for **every**
   ownership check.

API-key auth is completely independent from the app's Clerk JWT flow:

- `/api/v1/*` is dispatched **before** the Bearer token block in
  `server/index.ts`.
- An API key never authenticates `/api/links`, `/api/qr`, etc.
- A Clerk JWT never authenticates `/api/v1/*`.
- Keys are never logged, returned, or exposed to the mobile bundle.

---

## 3. Response envelope

Success:

```json
{
  "success": true,
  "message": "Short link created successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Invalid API credentials.",
  "error": { "code": "INVALID_API_KEY" }
}
```

### Error codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid body/query/id. |
| 400 | `INVALID_JSON` | Body is not valid JSON. |
| 401 | `MISSING_API_KEY` | No `X-API-Key` header. |
| 401 | `INVALID_API_KEY` | Key does not match. |
| 403 | `DEVELOPER_NOT_PROVISIONED` | Configured identity has no LinkFlow account. |
| 404 | `NOT_FOUND` | Resource missing **or owned by someone else**. |
| 405 | `METHOD_NOT_ALLOWED` | Method not supported (includes `Allow` header). |
| 409 | `ALIAS_TAKEN` | `customAlias` already exists. |
| 413 | `PAYLOAD_TOO_LARGE` | Body exceeds 64 KiB. |
| 500 | `INTERNAL_ERROR` | Unexpected server failure (no stack trace). |
| 503 | `API_KEY_NOT_CONFIGURED` / `DEVELOPER_IDENTITY_NOT_CONFIGURED` | Server-side auth not configured, or bootstrap auth disabled in production. |

---

## 4. Links

### `POST /api/v1/links`

Create a short link. Reuses the existing `createUserLink` path (Base62 short
codes, collision retries, PostgreSQL/in-memory fallback).

Body:

| Field | Type | Rules |
| --- | --- | --- |
| `originalUrl` | string | Required, absolute `http`/`https`, ≤ 2048 chars. |
| `title` | string | Optional, ≤ 255 chars. |
| `customAlias` | string | Optional, 1–50 Base62 chars (`A-Z a-z 0-9`). |

`userId` / `user_id` in the body are ignored: ownership comes from the key.

```bash
curl -X POST "$LINKFLOW_API_BASE/api/v1/links" \
  -H "X-API-Key: $LINKFLOW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"originalUrl":"https://example.com/very/long/path","title":"Docs","customAlias":"docs2026"}'
```

`201 Created`

```json
{
  "success": true,
  "message": "Short link created successfully",
  "data": {
    "id": "lnk_8Qm2Kd91xP",
    "originalUrl": "https://example.com/very/long/path",
    "shortUrl": "https://short.example.com/docs2026",
    "shortCode": "docs2026",
    "customAlias": "docs2026",
    "title": "Docs",
    "isActive": true,
    "expiresAt": null,
    "clicks": 0,
    "createdAt": "2026-11-13T09:00:00.000Z",
    "updatedAt": "2026-11-13T09:00:00.000Z"
  }
}
```

### `GET /api/v1/links`

Query: `limit` (1–100, default 20), `offset` (0–100000, default 0).

```bash
curl "$LINKFLOW_API_BASE/api/v1/links?limit=20&offset=0" \
  -H "X-API-Key: $LINKFLOW_API_KEY"
```

`data`: `{ links: PublicLink[], total, limit, offset }`.

### `GET /api/v1/links/:id`

Returns one link. Missing and other-owner ids both return `404 NOT_FOUND`.

### `DELETE /api/v1/links/:id`

Deletes only if `id` and `user_id` match. Returns `{ id }` on success.

### `GET /api/v1/links/:id/analytics`

Query: `days` (1–90, default 7).

```bash
curl "$LINKFLOW_API_BASE/api/v1/links/lnk_8Qm2Kd91xP/analytics?days=7" \
  -H "X-API-Key: $LINKFLOW_API_KEY"
```

```json
{
  "success": true,
  "message": "Link analytics retrieved successfully",
  "data": {
    "link": { "id": "lnk_8Qm2Kd91xP", "clicks": 12, "...": "..." },
    "totalClicks": 12,
    "range": { "days": 7, "since": "2026-11-07", "until": "2026-11-13" },
    "daily": [
      { "date": "2026-11-07", "clicks": 0 },
      { "date": "2026-11-08", "clicks": 3 }
    ]
  }
}
```

Data comes from the existing `links.clicks_count` and `link_daily_clicks`
tables (in-memory equivalent when PostgreSQL is absent).

---

## 5. QR codes

### `POST /api/v1/qr`

Body:

| Field | Type | Rules |
| --- | --- | --- |
| `targetUrl` | string | Required unless `linkId` is supplied. |
| `linkId` | string | Optional owned link id. When `targetUrl` is omitted, the QR encodes that link's short URL. |
| `title` | string | Optional, ≤ 255 chars. |
| `image.size` | integer | Optional 128–1024, default 512. |
| `image.margin` | integer | Optional 0–16, default 2. |
| `image.errorCorrectionLevel` | string | Optional `L` / `M` / `Q` / `H`, default `M`. |
| `image.dark` | string | Optional hex colour, default `#000000`. |
| `image.light` | string | Optional hex colour, default `#FFFFFF`. |

```bash
curl -X POST "$LINKFLOW_API_BASE/api/v1/qr" \
  -H "X-API-Key: $LINKFLOW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"linkId":"lnk_8Qm2Kd91xP","title":"Launch QR","image":{"size":512,"dark":"#000000","light":"#FFFFFF"}}'
```

`201 Created`

```json
{
  "success": true,
  "message": "QR code created successfully",
  "data": {
    "qr": {
      "id": "qr_4tR8pLm2Qa",
      "title": "Launch QR",
      "targetUrl": "https://short.example.com/docs2026",
      "linkId": "lnk_8Qm2Kd91xP",
      "createdAt": "2026-11-13T09:05:00.000Z",
      "updatedAt": "2026-11-13T09:05:00.000Z"
    },
    "image": {
      "mimeType": "image/png",
      "encoding": "data-uri",
      "dataUrl": "data:image/png;base64,iVBORw0KGgo...",
      "width": 512,
      "margin": 2,
      "errorCorrectionLevel": "M",
      "dark": "#000000",
      "light": "#FFFFFF"
    }
  }
}
```

The PNG data URI is the actual scannable image (the project does not store QR
image files server-side). Rendering uses `qrcode@1.5.4`, the same library the
app's QR component depends on.

### `GET /api/v1/qr`

Query: `limit`, `offset`. `data`: `{ qrs, total, limit, offset }`.

### `GET /api/v1/qr/:id`

Returns QR metadata plus a freshly rendered image using the canonical defaults
(512 px, black/white, ECC M). Per-request image customization is not persisted
because the existing schema stores QR metadata only.

### `DELETE /api/v1/qr/:id`

Owner-scoped delete, returns `{ id }`.

### `GET /api/v1/qr/:id/analytics`

Query: `days` (1–90, default 7).

Standalone QR (no linked short link) — honest unsupported response:

```json
{
  "success": true,
  "message": "QR code analytics retrieved successfully",
  "data": {
    "qr": { "id": "qr_4tR8pLm2Qa", "linkId": null, "...": "..." },
    "supported": false,
    "reason": "QR scans are not tracked. Create the QR from a short link to see its click analytics."
  }
}
```

QR created from a link — inherits that link's click analytics:

```json
{
  "success": true,
  "message": "QR code analytics retrieved successfully",
  "data": {
    "qr": { "id": "qr_4tR8pLm2Qa", "linkId": "lnk_8Qm2Kd91xP", "...": "..." },
    "supported": true,
    "tracking": "linked-link-clicks",
    "link": { "id": "lnk_8Qm2Kd91xP", "...": "..." },
    "totalClicks": 12,
    "range": { "days": 7, "since": "2026-11-07", "until": "2026-11-13" },
    "daily": [{ "date": "2026-11-07", "clicks": 0 }]
  }
}
```

QR **scans** are not tracked by the current product, so the API never invents
scan metrics.

---

## 6. Aggregate analytics

### `GET /api/v1/analytics/overview`

Query: `days` (1–90, default 7). Aggregates only the developer's own records.

```json
{
  "success": true,
  "message": "Analytics overview retrieved successfully",
  "data": {
    "totals": {
      "links": 8,
      "activeLinks": 7,
      "clicks": 42,
      "qrCodes": 3,
      "linkedQrCodes": 2
    },
    "range": { "days": 7, "since": "2026-11-07", "until": "2026-11-13" },
    "daily": [{ "date": "2026-11-07", "clicks": 5 }],
    "mostClickedLink": { "id": "lnk_8Qm2Kd91xP", "...": "..." },
    "recentQrCodes": []
  }
}
```

---

## 7. Security and data isolation

- **Every** read/write/delete goes through owner-scoped queries:
  `WHERE id = $1 AND user_id = $2` (or `user_id = $1` for lists). The
  developer identity is resolved server-side from the key; body-supplied
  `userId`/`user_id` is ignored.
- Cross-developer access always returns `404 NOT_FOUND` — the API does not
  reveal whether another tenant's resource exists.
- QR `linkId` must belong to the same developer or creation is rejected (`400`).
- All params are validated: ids (`[A-Za-z0-9_-]{1,128}`), URLs (`http`/`https`
  only), titles/aliases sizes, pagination, day ranges, QR options, 64 KiB body
  cap, JSON parse errors.
- No stack traces, SQL, secrets or internal user ids are returned. The router
  catches unexpected errors and responds `500 INTERNAL_ERROR`.
- API keys are never logged; request logging records only method, path, status
  and duration.
- CORS explicitly allows `X-API-Key`; preflight is handled before auth.
- Existing JWT routes, redirects and dashboard behaviour are unchanged.

---

## 8. Tests

```bash
npm run test:server      # build + node --test
npx tsc --noEmit         # app + server typecheck
npx expo lint
```

The suite (`tests/developer-api.test.js`) runs the real HTTP server against the
in-memory repository and covers:

- missing / invalid / unconfigured keys, unprovisioned identities;
- link create/list/get/delete, validation, alias conflicts, pagination;
- QR create/list/get/delete, image data URIs, size/colour/ECC options;
- link and QR analytics, unsupported QR scans;
- aggregate overview;
- cross-developer isolation for read, delete, analytics and QR linking;
- 400/401/403/404/405/409/413 envelopes, invalid JSON, unknown routes;
- CORS preflight and JWT-route independence;
- existing short-link redirect + click analytics.

Latest run: **44 tests, 44 passing, 0 failing.**

---

## 9. Known limitations (Phase 1 scope)

1. **Single bootstrap key, development only.** No per-key creation, rotation,
   revocation, scopes or rate limiting, and the env credential is rejected when
   `NODE_ENV=production`. Those belong to Phase 2, together with production key
   storage.
2. **QR scan analytics do not exist.** Linked QRs expose the short link's click
   analytics; standalone QRs return `supported: false`.
3. **QR customization is not persisted.** The schema stores QR metadata only;
   created images honour customization, later reads render defaults.
4. **QR images are data URIs**, not hosted URLs, because no QR image storage
   exists server-side.
5. **Offset pagination** only (no cursor pagination).
6. **In-memory fallback is per-process** and not durable; production requires
   `DATABASE_URL`.
7. Analytics day buckets use the database/server date (UTC in the in-memory
   fallback).

---

## 10. Files

Created:

```
server/types.ts
server/types/qrcode.d.ts
server/developer-api/interfaces/api-developer.interface.ts
server/developer-api/guards/api-key.guard.ts
server/developer-api/decorators/api-developer.decorator.ts
server/developer-api/dto/validation.ts
server/developer-api/dto/create-link.dto.ts
server/developer-api/dto/create-qr.dto.ts
server/developer-api/http/envelope.ts
server/developer-api/http/body.ts
server/developer-api/http/base-url.ts
server/developer-api/analytics.ts
server/developer-api/qr-image.ts
server/developer-api/public-api/public-api.context.ts
server/developer-api/public-api/public-links.controller.ts
server/developer-api/public-api/public-qr.controller.ts
server/developer-api/public-api/public-analytics.controller.ts
server/developer-api/public-api/presenters.ts
server/developer-api/public-api/public-api.module.ts
tests/developer-api.test.js
docs/DEVELOPER_API_PHASE_1.md
```

Modified:

```
server/index.ts        # type re-export, deps adapter, /api/v1 dispatch, CORS header
package.json           # qrcode dependency, test:server script
package-lock.json
.env.example           # developer API configuration docs
```

No database schema changes. No existing route renamed or removed. No frontend
changes.
