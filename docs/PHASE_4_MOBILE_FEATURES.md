# Phase 4 — Mobile Features

This document covers the four mobile-specific features added in Phase 4, plus the
dashboard/link-screen fixes requested alongside them:

1. **Share-to-LinkFlow** — receive a link shared from another app and pre-fill the shortener.
2. **Smart Clipboard Detection** — offer to shorten a URL found in the clipboard, at deliberate moments only.
3. **Advanced QR features** — generate, download, share, save to the photo library, scan, view history, and open the encoded URL.
4. **Push Notifications** — click milestones, daily performance, and expiration reminders, delivered with Expo Push.
5. **Dashboard "Shorten a URL" section** now shows your previous short links inline, and the Links screen no longer "fluctuates" after creating a link.

> **No deep linking was added.** There are no Android App Links and no iOS Universal Links.
> The share feature is a native *share target* (Android intent filter / iOS Share Extension),
> which is a separate mechanism and does not register any domain.

---

## 1. What was built

| Feature | Where | Behaviour |
| --- | --- | --- |
| Share-to-LinkFlow | `src/hooks/useSharedUrl.ts`, `app/(protected)/_layout.tsx` | A URL shared from another app opens LinkFlow on the Create Link screen with the URL pre-filled and editable. Non-URL shared content shows an explanatory alert. Nothing is shortened automatically. |
| Smart Clipboard | `src/services/clipboard.ts`, `src/components/ClipboardSuggestion.tsx`, `app/(protected)/index.tsx` | On dashboard mount and on app foreground (never polled), the clipboard is read once. If it holds an `http(s)` URL, an inline card offers **Shorten** / **Dismiss**. Dismissed URLs are remembered locally and never suggested again. |
| QR scan | `app/(protected)/qr/scan.tsx` | Camera scanner (`expo-camera` `CameraView`, QR only) with permission states, a scan frame, and a result sheet offering **Open URL**, **Shorten URL**, or **Scan another code**. Invalid QR payloads are shown but not opened. |
| QR save to photos | `src/utils/qrExport.ts` (`saveQrImageToGallery`) | Renders the same 512 px QR PNG used by share/download and writes it to the photo library (`expo-media-library`), with permission handling. Falls back to a browser download on web. |
| QR history actions | `app/(protected)/qr/index.tsx` | Each history entry now exposes **Copy**, **Open**, **Share** (PNG), **Save** (photo library) and **Delete**. The live QR card also gained **Save to Photos** and **Open URL**. |
| Notifications | `server/notifications.ts`, routes 10–14, `app/(protected)/notifications/index.tsx` | Device tokens, per-user preferences, deduplicated milestone/performance/expiration events, Expo Push delivery, and an in-app history screen. |
| Recent short links | `app/(protected)/index.tsx` (`MobileShortenCard`) | The three newest links are listed directly under the shorten input with click counts; tapping one copies the short URL. Includes a "View all →" shortcut and a loading skeleton. |
| Stable created-link result | `app/(protected)/links/index.tsx` | The created link appears in a persistent card (copy / share / open) instead of a transient banner, so the form does not jump or collapse after submission. |

---

## 2. Dependencies added

Installed with `npx expo install` (SDK-compatible versions):

| Package | Version | Purpose |
| --- | --- | --- |
| `expo-share-intent` | `^5.1.1` | Native share target (Android intent filter + iOS Share Extension). Peer range: `expo ^54`. |
| `expo-notifications` | `~0.32.17` | Local/remote notifications, Expo push tokens, notification channels. |
| `expo-camera` | `~17.0.10` | QR scanning via `CameraView`. (`expo-barcode-scanner` is deprecated.) |
| `expo-media-library` | `~18.2.1` | Saving QR PNGs to the device gallery. |
| `expo-clipboard` | `~8.0.8` | Reading the clipboard for the suggestion card. |
| `@react-native-async-storage/async-storage` | `2.2.0` | Storing the dismissed-clipboard-URL list. |

No new dependency is required for QR *generation* — the existing
`react-native-qrcode-svg` renderer and `QrExporter` are reused.

---

## 3. Architecture

### 3.1 Client

```
app/(protected)/_layout.tsx
  ├─ useSharedUrl()          → expo-share-intent, routes /(protected)/links?url=…
  ├─ usePushNotifications()  → silent token restore/refresh (never prompts)
  └─ notification tap handler → /(protected)/notifications

app/(protected)/index.tsx    (mobile dashboard)
  ├─ checkClipboard()        → on mount + AppState background→active (throttled by lifecycle only)
  ├─ ClipboardSuggestion     → Shorten → /(protected)/links?url=…
  └─ MobileShortenCard       → recent short links inline

app/(protected)/links/index.tsx
  └─ useLocalSearchParams<{ url }>() → pre-fills only when the field is empty

app/(protected)/qr/scan.tsx  → expo-camera + result sheet

src/services/api.ts          → existing base: authenticatedFetch(), getApiBaseUrl()
src/services/notifications.ts→ 5 typed API wrappers
src/services/clipboard.ts    → readClipboardUrl / dismissClipboardUrl / isDismissedClipboardUrl
src/utils/url.ts             → isValidHttpUrl / extractUrlFromText / normalizeUrl / truncateUrl
src/utils/qrExport.ts        → share/download (existing) + saveQrImageToGallery (new)
```

**Device-aware API URLs:** all new API calls go through the existing
`authenticatedFetch()`, which uses `getApiBaseUrl()`. Physical devices talk to the
Metro host or `EXPO_PUBLIC_API_URL`; no `localhost` is hard-coded.

**Prefill contract:** every entry point (share target, clipboard, QR scanner)
navigates to `/(protected)/links` with a `url` param. The screen validates it with
`isValidHttpUrl()` and only writes it into the field when the field is empty, so
user-typed input is never overwritten.

### 3.2 Server (plain Node `http` + PostgreSQL, in-memory fallback)

`server/notifications.ts` is a standalone module — there is no NestJS in this
repository and no new framework was introduced. Every helper supports both the
PostgreSQL path and the in-memory fallback used when `DATABASE_URL` is absent.

- `upsertDeviceToken` / `removeDeviceToken` / `listDeviceTokens`
- `getNotificationPreferences` / `updateNotificationPreferences` (whitelisted boolean keys only)
- `insertNotificationHistory` / `listNotificationHistory`
- `sendExpoPush` — batches to `https://exp.host/--/api/v2/push/send`, 10 s timeout, prunes `DeviceNotRegistered` tokens
- `processClickMilestones` — dedupe forever per (link, milestone), notifies only the highest newly crossed threshold
- `incrementDailyClicks` — daily aggregate, called on every redirect
- `checkLinkPerformanceNotifications` — once per (link, day) at ≥ 100 new clicks
- `checkExpiringLinks` — once per (link, expires_at) inside a 24 h window
- `setMemoryLinksProvider` — lets the memory store resolve link records

`server/start.ts` runs the scheduled scans on an interval (default 15 min, `.unref()`ed)
plus one pass ~15 s after boot.

**Redirect latency:** `incrementClickCount` in `server/index.ts` performs the atomic
`UPDATE … RETURNING` and then fires the daily-click + milestone work with
`void …catch()`, so a push problem can never slow or fail a redirect.

### 3.3 Push flow

```
app start / sign-in
  └─ usePushNotifications(): read permission (no prompt)
       └─ granted → getExpoPushTokenAsync({ projectId })
            └─ POST /api/notifications/register  (upsert on token value)

redirect on a short link
  └─ incrementClickCount → UPDATE clicks RETURNING *
       ├─ incrementDailyClicks(link.id)         (fire-and-forget)
       └─ processClickMilestones(link)          (fire-and-forget)
            └─ deliverEvent() → prefs check → Expo Push → history row

interval (15 min)
  ├─ checkLinkPerformanceNotifications()
  └─ checkExpiringLinks()

sign-out
  └─ POST /api/notifications/unregister (token pruned)
```

---

## 4. Database schema

Added to `server/schema.ts` (idempotent `CREATE TABLE IF NOT EXISTS`) and applied by
`POST /api/admin/migrate` or automatically on boot:

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `device_tokens` | One row per registered Expo push token | `UNIQUE(expo_push_token)`, `user_id → users ON DELETE CASCADE` |
| `notification_preferences` | Per-user switches | `PRIMARY KEY(user_id)` |
| `notification_history` | In-app history of dispatched alerts | index `(user_id, created_at DESC)` |
| `link_milestones` | Milestone dedupe | `PRIMARY KEY(link_id, milestone)` |
| `link_performance_notifications` | Performance dedupe | `PRIMARY KEY(link_id, day)` |
| `link_expiration_notifications` | Expiration dedupe | `PRIMARY KEY(link_id, expires_at)` |
| `link_daily_clicks` | Daily click aggregates | `PRIMARY KEY(link_id, day)` |

`link_daily_clicks` is real data: it is incremented from actual redirects, not
generated. It exists because the existing `links.clicks_count` is a lifetime total
and cannot answer "how many clicks today?".

**Why no QR-activity notifications?** The existing `qr_codes` table has no scan
counter and no scan event log, so there is no data to notify about. Rather than
invent a number, the QR switch is stored (and documented) but never fires.

---

## 5. API endpoints

All endpoints require `Authorization: Bearer <clerk-token>`. Ownership is resolved
through the Clerk user ID → internal `users.id`. Registration auto-creates the user
row if `/api/users/sync` has not run yet.

### `POST /api/notifications/register`

```json
{ "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "platform": "android", "deviceName": "Pixel 8" }
```

- `200` → `{ "success": true, "device": { ... } }`
- `400` → invalid `expoPushToken` (must match `ExponentPushToken[...]`) or `platform` not in `android | ios | web`
- `401` → missing/invalid bearer token

Re-registering the same token updates its platform/name instead of creating a duplicate.

### `POST /api/notifications/unregister`

```json
{ "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```

- `200` → `{ "success": true, "removed": true }` (`removed: false` when it was already gone)

### `GET /api/notifications/preferences`

- `200` → `{ "preferences": { "master_enabled": true, "milestones": true, "performance": true, "expiration": true, "qr_activity": true } }`

### `PUT /api/notifications/preferences`

Accepts any subset of the boolean switches; unknown keys and non-boolean values are
ignored, missing row is created with defaults.

```json
{ "performance": false }
```

- `200` → `{ "success": true, "preferences": { ... } }`

### `GET /api/notifications/history?limit=50`

`limit` is clamped to `1…100` (default 50), newest first.

- `200` → `{ "notifications": [ { "id": "...", "type": "milestone", "title": "...", "body": "...", "data": {...}, "created_at": "..." } ], "total": 1 }`

History is written when an event is dispatched to at least one registered device,
so it survives a phone being offline at delivery time.

---

## 6. Environment variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | no | — | Existing. Absent → in-memory store (development only). |
| `EXPO_PUBLIC_API_URL` | production yes | dev-server host | Existing. New calls use it through `authenticatedFetch`. |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | no | — | Optional override for the EAS project ID used by `getExpoPushTokenAsync`. Normal source is `extra.eas.projectId` written by `eas init`. |
| `NOTIFICATION_CHECK_INTERVAL_MS` | no | `900000` (15 min) | Interval for the performance/expiration scans. |

No FCM/APNs secrets are stored in the repository or in the app bundle. Push
credentials live in EAS credentials.

---

## 7. Configuration (required external setup)

### 7.1 `app.json` plugins (already configured)

```json
[
  ["expo-camera", { "cameraPermission": "Allow LinkFlowURL to use the camera to scan QR codes.", "microphonePermission": false, "barcodeScannerEnabled": true }],
  ["expo-media-library", { "photosPermission": "…", "savePhotosPermission": "…", "isAccessMediaLocationEnabled": false }],
  ["expo-notifications", { "color": "#792CF0", "mode": "development" }],
  ["expo-share-intent", {
    "iosActivationRules": {
      "NSExtensionActivationSupportsWebURLWithMaxCount": 1,
      "NSExtensionActivationSupportsWebPageWithMaxCount": 1,
      "NSExtensionActivationSupportsTextWithMaxCount": 1
    },
    "androidIntentFilters": ["text/*"]
  }]
]
```

`scheme: "linkflowurl"` already exists and is required by the share extension.

### 7.2 EAS project ID (required for push)

```bash
npx eas-cli init
```

This writes `expo.extra.eas.projectId`. The hook reads it defensively; without it the
Notifications screen shows an actionable message instead of failing silently.

### 7.3 FCM (Android) and APNs (iOS)

Expo Push fans out to FCM/APNs. Credentials are uploaded to EAS, never committed:

```bash
# Android: Firebase project → add app com.linkflowurl.app → FCM V1 service account key
npx eas-cli credentials   # Android → Push Notifications → upload FCM V1 key

# iOS: APNs auth key (.p8) from Apple Developer
npx eas-cli credentials   # iOS → Push Notifications → upload APNs key
```

### 7.4 Development builds are mandatory

- Push on Android does not work in Expo Go as of SDK 53.
- `expo-share-intent` ships native code (intent filter / Share Extension).
- `expo-camera` and `expo-media-library` permission strings are native config.

```bash
npx expo run:android          # local dev build
npx expo run:ios              # macOS only
# or cloud:
npx eas-cli build --profile development --platform android
```

Rebuild after changing any plugin configuration. OTA updates cannot add native code.

---

## 8. Commands

```bash
# dependencies (SDK-compatible)
npx expo install expo-camera expo-media-library expo-notifications expo-clipboard \
  expo-share-intent @react-native-async-storage/async-storage

# typecheck / lint
npx tsc --noEmit
npx expo lint

# backend
npm run build:server      # tsc -p tsconfig.server.json
npm run server            # dist-server/start.js on 0.0.0.0:3000

# app
npx expo start            # dev server
npx expo run:android      # dev build (required for push + share target)
npx expo export --platform web
```

Apply migrations: `POST /api/admin/migrate` (also runs on server boot).

---

## 9. Test results

Everything below was executed locally in this environment.

| Check | Command | Result |
| --- | --- | --- |
| TypeScript (app + server) | `npx tsc --noEmit` | **0 errors** |
| Lint | `npx expo lint` | **0 errors, 0 warnings** |
| Backend build | `npm run build:server` | **exit 0** |
| Web export | `npx expo export --platform web` | **exit 0**, 22 static routes incl. `/qr/scan`, `/notifications` |
| Expo config resolution | `npx expo config --type public` | plugins resolve, config valid |
| Backend logic (in-memory) | scripted suite | **24/24 checks passed** |
| HTTP layer | scripted suite | **13/13 checks passed** |
| Migrations vs. real PostgreSQL | scripted suite | **all 10 expected tables present**, indexes/columns verified |
| Backend logic (PostgreSQL) | scripted suite | **17/17 checks passed** |
| Web runtime smoke | headless Chrome on `/welcome` | renders, no exceptions |

What the backend suites actually assert:

- token upsert does not duplicate; invalid tokens/platforms are rejected
- `DeviceNotRegistered` tokens are pruned after a failed delivery
- preferences default to enabled; unknown/non-boolean keys are ignored
- milestone fires once per threshold; a 10 → 60 jump notifies once (highest only)
- every crossed threshold is recorded (10, 50, 100) in `link_milestones`
- performance notification fires once at ≥ 100 daily clicks and is deduped per day
- expiration reminder fires only inside the 24 h window and is deduped per expiry
- disabled category and master switch both suppress delivery
- unauthenticated access to all five endpoints returns `401`
- the public redirect still returns `302`, increments the click count, and updates the daily aggregate
- deleting a user cascades all child rows; sign-out removal deletes the token row

Two real bugs were found and fixed by these suites:

1. `sendExpoPush` used the legacy `~api` push path, which returns `404`. Switched to
   `https://exp.host/--/api/v2/push/send` (verified `200` against the live service).
2. The milestone dedupe query selected `m.milestone` (NULL on the anti-join) instead
   of `t.milestone`, so thresholds were never recorded on PostgreSQL.

### Not tested here (requires hardware)

No physical device or emulator was available in this environment, so the following
were **implemented and statically verified but not executed**: actual push delivery
to a phone, the share sheet entry, camera scanning, gallery write, and permission
prompts. Do not consider these "verified on device" until the checklist in §10 passes.

---

## 10. Manual device test procedures

### 10.1 Push notifications

1. `eas init`, upload FCM/APNs credentials, build a development client, install it.
2. Sign in → Profile → **Notifications** → **Enable notifications** → allow.
3. Confirm the row appears in `device_tokens` (server log or SQL).
4. Create a link, then generate 10 redirects (`curl` the short URL 10×); expect one
   "🎉 10-click milestone!" push on the device and one history entry.
5. Repeat the 10 redirects — no second push (dedupe).
6. Toggle **Link click milestones** off, generate 50 more clicks — no push.
7. Set a link's `expires_at` to ~6 hours from now and wait for the 15 min scan
   (or shorten `NOTIFICATION_CHECK_INTERVAL_MS`) — expect one reminder, then none.
8. Tap the notification from a cold start — the app opens the Notifications screen.
9. Put the app in the background, repeat a milestone — banner appears in the tray.
10. Sign out — the token row is deleted; another device's token remains.

### 10.2 Share-to-LinkFlow

1. Open a browser or chat app, share a URL, pick **LinkFlowURL** from the share sheet.
2. The app opens the Create Link screen with the URL pre-filled and editable.
3. Share plain text ("hello") — an alert explains there is no link; nothing is pre-filled.
4. Share an image — same friendly rejection, no crash.
5. Confirm the pre-filled text never replaces something already typed.

### 10.3 Clipboard suggestion

1. Copy a URL in another app, open LinkFlow → dashboard shows the suggestion card.
2. Tap **Dismiss** → card disappears; background/foreground the app → it stays gone.
3. Copy a *different* URL, background/foreground → new card appears.
4. Tap **Shorten** → Links screen opens with the URL pre-filled.
5. Copy non-URL text → no card.

### 10.4 QR generation / scan / gallery

1. Generate a QR for a long URL, then check **Copy / Open / Share / Save to Photos /
   Download**. Sharing must attach a PNG, not just text.
2. Decline the photo-library permission on iOS → a readable error appears; granting
   it then saving writes the image to the gallery.
3. Tap **Scan a QR code**, allow camera → scan a QR from another screen.
4. Result sheet: **Open URL** launches the browser; **Shorten URL** pre-fills the
   shortener; **Scan another code** resumes scanning.
5. Scan a non-URL QR (e.g. plain text) → "Not a link" state, no navigation.
6. Deny camera permission, then try again → "Open settings" button appears.

### 10.5 Recent links + stable result card

1. Dashboard: the shorten card lists your three newest links with click counts;
   tapping one copies the short URL; **View all →** opens the Links screen.
2. Create a link → the page does not jump; a card appears with the short URL and
   Copy / Share / Open actions, and remains until the next creation.

---

## 11. Limitations and known gaps

- **Push delivery is unverified on hardware.** SDK/API correctness, credential
  requirements, and backend logic are verified; the final hop needs a device build.
- **Expo Go cannot test push (Android) or the share target.** A development build is required.
- **No web push.** `expo-notifications` Expo push tokens are native-only; the web
  build skips registration and the Notifications screen explains the state. The
  library's own module-scope listener prints a harmless web warning.
- **QR activity notifications are intentionally not implemented.** No scan analytics
  exist (`qr_codes` has no scan counter). The preference is stored and labelled
  "Soon" so it can be turned on once scan tracking exists.
- **Clipboard is checked only on mount and foreground.** Never on a timer, never in
  the background, never uploaded. Only dismissed URLs are persisted (max 25).
- **Performance threshold** means "≥ 100 new clicks in one UTC day", evaluated by the
  scheduled scan (up to ~15 min delay), not per click.
- **Expiration reminder** targets links expiring within 24 h and fires at most once
  per expiry timestamp; if a link is edited to a new expiry, it can notify again.
- **Notification history is not paginated** beyond the newest 100 entries.
- **Share target pre-fills only.** It never shortens automatically; the user always
  confirms. iOS shares a *page* may pass the URL through `webUrl` or `text`; both
  are handled.
- **One notification per event type.** Tapping a notification opens the Notifications
  screen rather than a per-link detail view (no link-detail route exists).
- **Preview/emulator caveat:** camera scanning requires a real camera; simulators
  cannot scan.

---

## 12. Privacy and security notes

- Clipboard contents are read only at user-visible lifecycle moments and are never
  transmitted to the server; only the dismissed-URL list is stored locally.
- Scanned QR content is never auto-opened; the user chooses an action.
- Push tokens are opaque device identifiers, scoped per user; they are removed on
  sign-out and pruned automatically when the provider reports `DeviceNotRegistered`.
- All notification endpoints require a valid Clerk bearer token; ownership is always
  derived server-side (a client cannot register a token for another user).
- Exported QR PNGs keep the existing high-contrast palette (`#3B0764` on `#FFFFFF`),
  512 px, error correction level `M`, quiet zone 20 — unchanged so codes stay scannable.

---

## 13. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| "Push notifications need an EAS project id" | Run `eas init`, then rebuild (config is baked into the binary). |
| "Push notifications require a development build" | Running in Expo Go; use `npx expo run:android` or an EAS dev build. |
| Token registers but no notification arrives | Missing/invalid FCM (Android) or APNs (iOS) credentials in EAS; check `eas credentials`. |
| Notification appears in history but not on the phone | Device token was pruned as `DeviceNotRegistered`, or OS notifications are disabled for the app. |
| Share sheet does not list LinkFlowURL | Native config changed but the app was not rebuilt; use a dev build and reinstall. |
| Camera screen stays black | Permission denied or a simulator without a camera; test on hardware. |
| "Could not save the QR code…" on iOS | Photo-library add permission denied; enable it in Settings → LinkFlowURL. |
| Clipboard card never appears on iOS | iOS may require the paste prompt; if the user dismisses it, detection silently reports "no URL". |

---

## 14. File index

**New**

- `server/notifications.ts`
- `src/services/notifications.ts`
- `src/services/clipboard.ts`
- `src/hooks/usePushNotifications.ts`
- `src/hooks/useSharedUrl.ts`
- `src/utils/url.ts`
- `src/components/ClipboardSuggestion.tsx`
- `app/(protected)/qr/scan.tsx`
- `app/(protected)/notifications/index.tsx`
- `docs/PHASE_4_MOBILE_FEATURES.md`

**Modified**

- `server/index.ts` — routes 10–14, milestone/daily-click hooks in `incrementClickCount`, memory-links provider
- `server/schema.ts` — seven new tables and indexes
- `server/start.ts` — scheduled notification scans
- `app.json` — camera / media-library / notifications / share-intent plugins
- `app/(protected)/_layout.tsx` — share intent routing, push bootstrap, notification taps
- `app/(protected)/index.tsx` — clipboard suggestion, recent links in the shorten card
- `app/(protected)/links/index.tsx` — `url` param prefill, persistent created-link card, share action
- `app/(protected)/qr/index.tsx` — scanner entry, save-to-photos, open URL, extended history actions
- `app/(protected)/profile/index.tsx` — Notifications entry, token removal on sign-out
- `src/components/AppIcon.tsx` — `bell` icon
- `src/components/index.ts` — export `ClipboardSuggestion`
- `src/utils/qrExport.ts` — `saveQrImageToGallery`
- `package.json` / `package-lock.json` — six new dependencies
