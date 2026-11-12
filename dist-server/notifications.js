"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationMemoryStore = exports.EXPIRATION_WINDOW_HOURS = exports.PERFORMANCE_DAILY_THRESHOLD = exports.CLICK_MILESTONES = void 0;
exports.isValidExpoPushToken = isValidExpoPushToken;
exports.isValidPlatform = isValidPlatform;
exports.sendExpoPush = sendExpoPush;
exports.upsertDeviceToken = upsertDeviceToken;
exports.removeDeviceToken = removeDeviceToken;
exports.listDeviceTokens = listDeviceTokens;
exports.getNotificationPreferences = getNotificationPreferences;
exports.updateNotificationPreferences = updateNotificationPreferences;
exports.insertNotificationHistory = insertNotificationHistory;
exports.listNotificationHistory = listNotificationHistory;
exports.processClickMilestones = processClickMilestones;
exports.incrementDailyClicks = incrementDailyClicks;
exports.checkLinkPerformanceNotifications = checkLinkPerformanceNotifications;
exports.checkExpiringLinks = checkExpiringLinks;
exports.setMemoryLinksProvider = setMemoryLinksProvider;
const db_1 = require("./db");
/**
 * LinkFlow push-notification infrastructure (Phase 4).
 *
 * Mirrors the dual-mode persistence used by the rest of the backend:
 * PostgreSQL when DATABASE_URL is configured, otherwise an in-memory
 * fallback with the same shapes so the API stays fully functional in dev.
 *
 * Push delivery goes through Expo's push service (https://exp.host/~api/v2/push/send),
 * which fans out to FCM (Android) and APNs (iOS). No provider credentials are
 * needed server-side: Expo push tokens are opaque and scoped to the project
 * that issued them. QR activity notifications are intentionally NOT
 * implemented: the existing analytics only track URL clicks (links.clicks_count),
 * and qr_codes has no scan counter, so scan counts cannot be derived honestly.
 */
/**
 * Expo push service endpoint. The current (non-legacy) host uses the `--`
 * path segment; the older `~api` form returns 404.
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Click milestones tracked per link (deduped forever per link + milestone). */
exports.CLICK_MILESTONES = [10, 50, 100, 500, 1000, 10000];
/** A link must receive at least this many new clicks in one day to notify. */
exports.PERFORMANCE_DAILY_THRESHOLD = 100;
/** Expiration reminder window: notify once when a link expires within 24h. */
exports.EXPIRATION_WINDOW_HOURS = 24;
const DEFAULT_PREFERENCES = {
    master_enabled: true,
    milestones: true,
    performance: true,
    expiration: true,
    qr_activity: true,
};
/** Expo push tokens always look like Expo[nent]PushToken[xxxxxxxx]. */
function isValidExpoPushToken(token) {
    return typeof token === 'string' && /^Expo(nent)?PushToken\[[^\s]+\]$/.test(token.trim());
}
function isValidPlatform(platform) {
    return typeof platform === 'string' && ['android', 'ios', 'web'].includes(platform);
}
function todayKey() {
    return new Date().toISOString().slice(0, 10);
}
// ---------------------------------------------------------------------------
// In-memory fallback repository (mirrors MockMemoryStore in server/index.ts)
// ---------------------------------------------------------------------------
class NotificationMemoryStore {
    deviceTokens = new Map();
    preferences = new Map();
    history = [];
    milestones = new Set(); // `${linkId}:${milestone}`
    performance = new Set(); // `${linkId}:${day}`
    expirations = new Set(); // `${linkId}:${expiresAtIso}`
    dailyClicks = new Map(); // `${linkId}:${day}`
    upsertDeviceToken(userId, token, platform, deviceName) {
        const now = new Date().toISOString();
        const existing = Array.from(this.deviceTokens.values()).find((t) => t.expo_push_token === token);
        if (existing) {
            existing.user_id = userId;
            existing.platform = platform;
            existing.device_name = deviceName || existing.device_name;
            existing.updated_at = now;
            return existing;
        }
        const record = {
            id: `tok_${Math.random().toString(36).substring(2, 10)}`,
            user_id: userId,
            expo_push_token: token,
            platform,
            device_name: deviceName || null,
            created_at: now,
            updated_at: now,
        };
        this.deviceTokens.set(record.id, record);
        return record;
    }
    removeDeviceToken(userId, token) {
        const existing = Array.from(this.deviceTokens.values()).find((t) => t.expo_push_token === token && t.user_id === userId);
        if (!existing)
            return false;
        return this.deviceTokens.delete(existing.id);
    }
    removeDeviceTokenGlobally(token) {
        for (const [id, record] of this.deviceTokens) {
            if (record.expo_push_token === token) {
                this.deviceTokens.delete(id);
            }
        }
    }
    listDeviceTokens(userId) {
        return Array.from(this.deviceTokens.values()).filter((t) => t.user_id === userId);
    }
    getPreferences(userId) {
        const existing = this.preferences.get(userId);
        if (existing)
            return existing;
        const record = {
            user_id: userId,
            ...DEFAULT_PREFERENCES,
            updated_at: new Date().toISOString(),
        };
        this.preferences.set(userId, record);
        return record;
    }
    updatePreferences(userId, patch) {
        const current = this.getPreferences(userId);
        const updated = {
            ...current,
            ...patch,
            user_id: userId,
            updated_at: new Date().toISOString(),
        };
        this.preferences.set(userId, updated);
        return updated;
    }
    insertHistory(userId, type, title, body, data) {
        const record = {
            id: `ntf_${Math.random().toString(36).substring(2, 10)}`,
            user_id: userId,
            type,
            title,
            body,
            data: data || null,
            created_at: new Date().toISOString(),
        };
        this.history.unshift(record);
        if (this.history.length > 500)
            this.history.length = 500;
        return record;
    }
    listHistory(userId, limit = 50) {
        return this.history.filter((h) => h.user_id === userId).slice(0, limit);
    }
    hasMilestone(linkId, milestone) {
        return this.milestones.has(`${linkId}:${milestone}`);
    }
    recordMilestone(linkId, milestone) {
        this.milestones.add(`${linkId}:${milestone}`);
    }
    hasPerformance(linkId, day) {
        return this.performance.has(`${linkId}:${day}`);
    }
    recordPerformance(linkId, day) {
        this.performance.add(`${linkId}:${day}`);
    }
    hasExpiration(linkId, expiresAt) {
        return this.expirations.has(`${linkId}:${expiresAt}`);
    }
    recordExpiration(linkId, expiresAt) {
        this.expirations.add(`${linkId}:${expiresAt}`);
    }
    incrementDailyClicks(linkId) {
        const key = `${linkId}:${todayKey()}`;
        this.dailyClicks.set(key, (this.dailyClicks.get(key) || 0) + 1);
    }
    getDailyClicks(linkId, day) {
        return this.dailyClicks.get(`${linkId}:${day}`) || 0;
    }
    listPerformanceCandidates(threshold, day, links) {
        const candidates = [];
        if (!links)
            return candidates;
        for (const [key, clicks] of this.dailyClicks) {
            const [linkId, linkDay] = key.split(':');
            if (linkDay !== day || clicks < threshold || this.hasPerformance(linkId, day))
                continue;
            const link = links.get(linkId);
            if (!link || !link.is_active)
                continue;
            candidates.push({
                id: linkId,
                user_id: link.user_id,
                short_code: link.short_code,
                title: link.title ?? null,
                clicks,
            });
        }
        return candidates;
    }
}
exports.notificationMemoryStore = new NotificationMemoryStore();
/**
 * Sends push messages through Expo's push service. Returns the list of tokens
 * that the service reports as invalid (e.g. app uninstalled) so callers can
 * prune them. Network failures never throw: notifications are best-effort and
 * must never break redirects or API responses.
 */
async function sendExpoPush(messages) {
    if (messages.length === 0) {
        return { delivered: 0, invalidTokens: [] };
    }
    const invalidTokens = [];
    let delivered = 0;
    // Expo accepts batches of up to 100 messages; LinkFlow sends small batches
    // (a handful of devices per user), but chunk defensively anyway.
    for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Optional per-project credential; never required for dev builds.
                    ...(process.env.EXPO_ACCESS_TOKEN
                        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
                        : {}),
                },
                body: JSON.stringify(chunk),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!response.ok) {
                console.warn('[Notifications] Expo push HTTP error:', response.status);
                continue;
            }
            const payload = (await response.json());
            const tickets = Array.isArray(payload.data)
                ? payload.data
                : payload.data
                    ? [payload.data]
                    : [];
            tickets.forEach((ticket, index) => {
                const token = chunk[index]?.to;
                if (ticket.status === 'ok') {
                    delivered += 1;
                }
                else if (token) {
                    console.warn('[Notifications] Push ticket error:', ticket.message);
                    if (ticket.details?.error === 'DeviceNotRegistered') {
                        invalidTokens.push(token);
                    }
                }
            });
        }
        catch (err) {
            console.warn('[Notifications] Expo push request failed:', err?.message);
        }
    }
    return { delivered, invalidTokens };
}
// ---------------------------------------------------------------------------
// Device tokens
// ---------------------------------------------------------------------------
async function upsertDeviceToken(userId, token, platform, deviceName) {
    const hasPg = !!(0, db_1.getDatabasePool)();
    if (hasPg) {
        try {
            const rows = await (0, db_1.query)(`INSERT INTO device_tokens (user_id, expo_push_token, platform, device_name, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (expo_push_token) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           platform = EXCLUDED.platform,
           device_name = EXCLUDED.device_name,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *;`, [userId, token, platform, deviceName || null]);
            return rows[0];
        }
        catch (err) {
            console.warn('[PostgreSQL upsertDeviceToken fallback to memory]:', err.message);
        }
    }
    return exports.notificationMemoryStore.upsertDeviceToken(userId, token, platform, deviceName);
}
async function removeDeviceToken(userId, token) {
    const hasPg = !!(0, db_1.getDatabasePool)();
    if (hasPg) {
        try {
            const rows = await (0, db_1.query)('DELETE FROM device_tokens WHERE user_id = $1 AND expo_push_token = $2 RETURNING id', [userId, token]);
            return rows.length > 0;
        }
        catch (err) {
            console.warn('[PostgreSQL removeDeviceToken fallback to memory]:', err.message);
        }
    }
    return exports.notificationMemoryStore.removeDeviceToken(userId, token);
}
async function removeInvalidTokens(invalidTokens) {
    if (invalidTokens.length === 0)
        return;
    const hasPg = !!(0, db_1.getDatabasePool)();
    if (hasPg) {
        try {
            await (0, db_1.query)('DELETE FROM device_tokens WHERE expo_push_token = ANY($1)', [invalidTokens]);
            return;
        }
        catch (err) {
            console.warn('[PostgreSQL removeInvalidTokens fallback to memory]:', err.message);
        }
    }
    for (const token of invalidTokens) {
        exports.notificationMemoryStore.removeDeviceTokenGlobally(token);
    }
}
async function listDeviceTokens(userId) {
    const hasPg = !!(0, db_1.getDatabasePool)();
    if (hasPg) {
        try {
            const rows = await (0, db_1.query)('SELECT * FROM device_tokens WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
            return rows;
        }
        catch (err) {
            console.warn('[PostgreSQL listDeviceTokens fallback to memory]:', err.message);
        }
    }
    return exports.notificationMemoryStore.listDeviceTokens(userId);
}
// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------
async function getNotificationPreferences(userId) {
    const hasPg = !!(0, db_1.getDatabasePool)();
    if (hasPg) {
        try {
            const rows = await (0, db_1.query)(`INSERT INTO notification_preferences (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *;`, [userId]);
            if (rows.length > 0)
                return rows[0];
            const existing = await (0, db_1.query)('SELECT * FROM notification_preferences WHERE user_id = $1', [userId]);
            if (existing.length > 0)
                return existing[0];
        }
        catch (err) {
            console.warn('[PostgreSQL getPreferences fallback to memory]:', err.message);
        }
    }
    return exports.notificationMemoryStore.getPreferences(userId);
}
const PREFERENCE_KEYS = ['master_enabled', 'milestones', 'performance', 'expiration', 'qr_activity'];
async function updateNotificationPreferences(userId, patch) {
    // Only known boolean keys survive validation; invalid input is dropped.
    const clean = {};
    for (const key of PREFERENCE_KEYS) {
        if (typeof patch[key] === 'boolean') {
            clean[key] = patch[key];
        }
    }
    const hasPg = !!(0, db_1.getDatabasePool)();
    if (hasPg) {
        try {
            // Ensure the row exists, then apply the patch.
            await (0, db_1.query)('INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
            const rows = await (0, db_1.query)(`UPDATE notification_preferences SET
           master_enabled = COALESCE($2, master_enabled),
           milestones = COALESCE($3, milestones),
           performance = COALESCE($4, performance),
           expiration = COALESCE($5, expiration),
           qr_activity = COALESCE($6, qr_activity),
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
         RETURNING *;`, [
                userId,
                clean.master_enabled ?? null,
                clean.milestones ?? null,
                clean.performance ?? null,
                clean.expiration ?? null,
                clean.qr_activity ?? null,
            ]);
            if (rows.length > 0)
                return rows[0];
        }
        catch (err) {
            console.warn('[PostgreSQL updatePreferences fallback to memory]:', err.message);
        }
    }
    return exports.notificationMemoryStore.updatePreferences(userId, clean);
}
// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
async function insertNotificationHistory(userId, type, title, body, data) {
    const hasPg = !!(0, db_1.getDatabasePool)();
    if (hasPg) {
        try {
            await (0, db_1.query)('INSERT INTO notification_history (user_id, type, title, body, data) VALUES ($1, $2, $3, $4, $5)', [userId, type, title, body, data ? JSON.stringify(data) : null]);
            return;
        }
        catch (err) {
            console.warn('[PostgreSQL insertHistory fallback to memory]:', err.message);
        }
    }
    exports.notificationMemoryStore.insertHistory(userId, type, title, body, data);
}
async function listNotificationHistory(userId, limit = 50) {
    const hasPg = !!(0, db_1.getDatabasePool)();
    if (hasPg) {
        try {
            const rows = await (0, db_1.query)('SELECT * FROM notification_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
            return rows;
        }
        catch (err) {
            console.warn('[PostgreSQL listHistory fallback to memory]:', err.message);
        }
    }
    return exports.notificationMemoryStore.listHistory(userId, limit);
}
/**
 * Sends a push for a qualified event if the user's preferences allow it and at
 * least one device is registered. The history entry is written as soon as the
 * event is dispatched to a device, so the user can always see the alerts
 * LinkFlow produced for them (even when the phone was offline).
 * Never throws.
 */
async function deliverEvent(event) {
    try {
        const prefs = await getNotificationPreferences(event.userId);
        const typeEnabled = event.type === 'milestone'
            ? prefs.milestones
            : event.type === 'performance'
                ? prefs.performance
                : event.type === 'expiration'
                    ? prefs.expiration
                    : prefs.qr_activity;
        if (!prefs.master_enabled || !typeEnabled)
            return;
        const tokens = await listDeviceTokens(event.userId);
        if (tokens.length === 0)
            return;
        const messages = tokens.map((t) => ({
            to: t.expo_push_token,
            title: event.title,
            body: event.body,
            data: event.data,
            sound: 'default',
            channelId: 'linkflow-alerts',
        }));
        const { delivered, invalidTokens } = await sendExpoPush(messages);
        if (invalidTokens.length > 0) {
            await removeInvalidTokens(invalidTokens);
        }
        await insertNotificationHistory(event.userId, event.type, event.title, event.body, event.data);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Notifications] ${event.type} dispatched to ${delivered}/${tokens.length} device(s) for user ${event.userId}`);
        }
    }
    catch (err) {
        console.warn('[Notifications] deliverEvent failed:', err?.message);
    }
}
/**
 * Detects click milestones for a freshly-incremented link. Records every
 * newly-crossed threshold (dedupe forever per link + milestone) and pushes a
 * notification for the highest one only, so a sudden jump does not spam the
 * user. Called fire-and-forget after incrementClickCount.
 */
async function processClickMilestones(link) {
    try {
        const hasPg = !!(0, db_1.getDatabasePool)();
        let unrecorded = [];
        if (hasPg) {
            try {
                const rows = await (0, db_1.query)(`SELECT t.milestone FROM unnest($1::int[]) AS t(milestone)
           LEFT JOIN link_milestones m
             ON m.link_id = $2 AND m.milestone = t.milestone
           WHERE m.link_id IS NULL
             AND t.milestone <= $3;`, [[...exports.CLICK_MILESTONES], link.id, link.clicks_count]);
                unrecorded = rows.map((r) => Number(r.milestone)).filter((m) => Number.isFinite(m));
            }
            catch (err) {
                console.warn('[PostgreSQL milestone lookup fallback to memory]:', err.message);
                unrecorded = exports.CLICK_MILESTONES.filter((m) => m <= link.clicks_count && !exports.notificationMemoryStore.hasMilestone(link.id, m));
            }
        }
        else {
            unrecorded = exports.CLICK_MILESTONES.filter((m) => m <= link.clicks_count && !exports.notificationMemoryStore.hasMilestone(link.id, m));
        }
        if (unrecorded.length === 0)
            return;
        for (const milestone of unrecorded) {
            if (hasPg) {
                try {
                    await (0, db_1.query)('INSERT INTO link_milestones (link_id, milestone) VALUES ($1, $2) ON CONFLICT DO NOTHING', [link.id, milestone]);
                }
                catch (err) {
                    console.warn('[PostgreSQL recordMilestone fallback to memory]:', err.message);
                    exports.notificationMemoryStore.recordMilestone(link.id, milestone);
                }
            }
            else {
                exports.notificationMemoryStore.recordMilestone(link.id, milestone);
            }
        }
        const highest = Math.max(...unrecorded);
        const label = link.title || `https://linkflow.app/${link.short_code}`;
        await deliverEvent({
            userId: link.user_id,
            type: 'milestone',
            title: `🎉 ${highest.toLocaleString('en-US')}-click milestone!`,
            body: `Your link "${label}" just reached ${highest.toLocaleString('en-US')} clicks.`,
            data: {
                type: 'milestone',
                linkId: link.id,
                shortCode: link.short_code,
                milestone: highest,
            },
        });
    }
    catch (err) {
        console.warn('[Notifications] processClickMilestones failed:', err?.message);
    }
}
/**
 * Records one redirect against today's daily aggregate for the link.
 * Called from incrementClickCount: must never break the redirect.
 */
async function incrementDailyClicks(linkId) {
    const hasPg = !!(0, db_1.getDatabasePool)();
    if (hasPg) {
        try {
            await (0, db_1.query)(`INSERT INTO link_daily_clicks (link_id, day, clicks)
         VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (link_id, day) DO UPDATE SET clicks = link_daily_clicks.clicks + 1;`, [linkId]);
            return;
        }
        catch (err) {
            console.warn('[PostgreSQL incrementDailyClicks fallback to memory]:', err.message);
        }
    }
    exports.notificationMemoryStore.incrementDailyClicks(linkId);
}
/**
 * Scans today's daily click aggregates and notifies users whose links crossed
 * the performance threshold. Deduped once per link per day. Runs on a schedule
 * from server/start.ts (not per redirect, to keep redirect latency minimal).
 */
async function checkLinkPerformanceNotifications() {
    try {
        const day = todayKey();
        const hasPg = !!(0, db_1.getDatabasePool)();
        let candidates = [];
        if (hasPg) {
            try {
                candidates = await (0, db_1.query)(`SELECT l.id, l.user_id, l.short_code, l.title, d.clicks
           FROM link_daily_clicks d
           JOIN links l ON l.id = d.link_id
           WHERE d.day = CURRENT_DATE
             AND d.clicks >= $1
             AND l.is_active = TRUE
             AND NOT EXISTS (
               SELECT 1 FROM link_performance_notifications p
               WHERE p.link_id = l.id AND p.day = CURRENT_DATE
             );`, [exports.PERFORMANCE_DAILY_THRESHOLD]);
            }
            catch (err) {
                console.warn('[PostgreSQL performance scan fallback to memory]:', err.message);
            }
        }
        if (!hasPg || candidates.length === 0) {
            candidates = exports.notificationMemoryStore.listPerformanceCandidates(exports.PERFORMANCE_DAILY_THRESHOLD, day, memoryLinksProvider?.());
        }
        for (const link of candidates) {
            if (hasPg) {
                try {
                    await (0, db_1.query)('INSERT INTO link_performance_notifications (link_id, day) VALUES ($1, CURRENT_DATE) ON CONFLICT DO NOTHING', [link.id]);
                }
                catch (err) {
                    console.warn('[PostgreSQL recordPerformance fallback to memory]:', err.message);
                    exports.notificationMemoryStore.recordPerformance(link.id, day);
                }
            }
            else {
                exports.notificationMemoryStore.recordPerformance(link.id, day);
            }
            const label = link.title || `https://linkflow.app/${link.short_code}`;
            await deliverEvent({
                userId: link.user_id,
                type: 'performance',
                title: `📈 Your link is getting attention`,
                body: `"${label}" received ${link.clicks.toLocaleString('en-US')} new clicks today.`,
                data: {
                    type: 'performance',
                    linkId: link.id,
                    shortCode: link.short_code,
                    clicksToday: link.clicks,
                },
            });
        }
    }
    catch (err) {
        console.warn('[Notifications] checkLinkPerformanceNotifications failed:', err?.message);
    }
}
/**
 * Finds active links expiring within the next 24h and notifies their owners
 * once per (link, expires_at). Runs on a schedule from server/start.ts.
 */
async function checkExpiringLinks() {
    try {
        const hasPg = !!(0, db_1.getDatabasePool)();
        let rows = [];
        if (hasPg) {
            try {
                rows = await (0, db_1.query)(`SELECT l.id, l.user_id, l.short_code, l.title, l.expires_at
           FROM links l
           WHERE l.is_active = TRUE
             AND l.expires_at IS NOT NULL
             AND l.expires_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
             AND NOT EXISTS (
               SELECT 1 FROM link_expiration_notifications e
               WHERE e.link_id = l.id AND e.expires_at = l.expires_at
             );`);
            }
            catch (err) {
                console.warn('[PostgreSQL expiration scan fallback to memory]:', err.message);
                rows = scanMemoryExpiringLinks();
            }
        }
        else {
            rows = scanMemoryExpiringLinks();
        }
        for (const link of rows) {
            if (hasPg) {
                try {
                    await (0, db_1.query)('INSERT INTO link_expiration_notifications (link_id, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING', [link.id, link.expires_at]);
                }
                catch (err) {
                    console.warn('[PostgreSQL recordExpiration fallback to memory]:', err.message);
                    exports.notificationMemoryStore.recordExpiration(link.id, link.expires_at);
                }
            }
            else {
                exports.notificationMemoryStore.recordExpiration(link.id, link.expires_at);
            }
            const label = link.title || `https://linkflow.app/${link.short_code}`;
            const expiry = new Date(link.expires_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });
            await deliverEvent({
                userId: link.user_id,
                type: 'expiration',
                title: `⏳ Link expiring soon`,
                body: `Your link "${label}" will expire on ${expiry}.`,
                data: {
                    type: 'expiration',
                    linkId: link.id,
                    shortCode: link.short_code,
                    expiresAt: link.expires_at,
                },
            });
        }
    }
    catch (err) {
        console.warn('[Notifications] checkExpiringLinks failed:', err?.message);
    }
}
let memoryLinksProvider = null;
function setMemoryLinksProvider(provider) {
    memoryLinksProvider = provider;
}
function scanMemoryExpiringLinks() {
    const links = memoryLinksProvider?.();
    if (!links)
        return [];
    const now = Date.now();
    const horizon = now + exports.EXPIRATION_WINDOW_HOURS * 3600 * 1000;
    const result = [];
    for (const link of links.values()) {
        if (!link.is_active || !link.expires_at)
            continue;
        const expiresAt = new Date(link.expires_at).getTime();
        if (expiresAt < now || expiresAt > horizon)
            continue;
        if (exports.notificationMemoryStore.hasExpiration(link.id, link.expires_at))
            continue;
        result.push({
            id: link.id,
            user_id: link.user_id,
            short_code: link.short_code,
            title: link.title,
            expires_at: link.expires_at,
        });
    }
    return result;
}
