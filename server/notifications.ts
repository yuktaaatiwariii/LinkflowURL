import { query, getDatabasePool } from './db';

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
export const CLICK_MILESTONES = [10, 50, 100, 500, 1000, 10000] as const;

/** A link must receive at least this many new clicks in one day to notify. */
export const PERFORMANCE_DAILY_THRESHOLD = 100;

/** Expiration reminder window: notify once when a link expires within 24h. */
export const EXPIRATION_WINDOW_HOURS = 24;

export type NotificationType = 'milestone' | 'performance' | 'expiration' | 'qr_activity';

export interface DeviceTokenRecord {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: string; // 'android' | 'ios' | 'web'
  device_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferencesRecord {
  user_id: string;
  master_enabled: boolean;
  milestones: boolean;
  performance: boolean;
  expiration: boolean;
  qr_activity: boolean;
  updated_at: string;
}

export interface NotificationHistoryRecord {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  channelId?: string;
}

const DEFAULT_PREFERENCES: Omit<NotificationPreferencesRecord, 'user_id' | 'updated_at'> = {
  master_enabled: true,
  milestones: true,
  performance: true,
  expiration: true,
  qr_activity: true,
};

/** Expo push tokens always look like Expo[nent]PushToken[xxxxxxxx]. */
export function isValidExpoPushToken(token: unknown): token is string {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[[^\s]+\]$/.test(token.trim());
}

export function isValidPlatform(platform: unknown): platform is string {
  return typeof platform === 'string' && ['android', 'ios', 'web'].includes(platform);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// In-memory fallback repository (mirrors MockMemoryStore in server/index.ts)
// ---------------------------------------------------------------------------

class NotificationMemoryStore {
  deviceTokens: Map<string, DeviceTokenRecord> = new Map();
  preferences: Map<string, NotificationPreferencesRecord> = new Map();
  history: NotificationHistoryRecord[] = [];
  milestones: Set<string> = new Set(); // `${linkId}:${milestone}`
  performance: Set<string> = new Set(); // `${linkId}:${day}`
  expirations: Set<string> = new Set(); // `${linkId}:${expiresAtIso}`
  dailyClicks: Map<string, number> = new Map(); // `${linkId}:${day}`

  upsertDeviceToken(
    userId: string,
    token: string,
    platform: string,
    deviceName?: string | null
  ): DeviceTokenRecord {
    const now = new Date().toISOString();
    const existing = Array.from(this.deviceTokens.values()).find(
      (t) => t.expo_push_token === token
    );
    if (existing) {
      existing.user_id = userId;
      existing.platform = platform;
      existing.device_name = deviceName || existing.device_name;
      existing.updated_at = now;
      return existing;
    }
    const record: DeviceTokenRecord = {
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

  removeDeviceToken(userId: string, token: string): boolean {
    const existing = Array.from(this.deviceTokens.values()).find(
      (t) => t.expo_push_token === token && t.user_id === userId
    );
    if (!existing) return false;
    return this.deviceTokens.delete(existing.id);
  }

  removeDeviceTokenGlobally(token: string): void {
    for (const [id, record] of this.deviceTokens) {
      if (record.expo_push_token === token) {
        this.deviceTokens.delete(id);
      }
    }
  }

  listDeviceTokens(userId: string): DeviceTokenRecord[] {
    return Array.from(this.deviceTokens.values()).filter((t) => t.user_id === userId);
  }

  getPreferences(userId: string): NotificationPreferencesRecord {
    const existing = this.preferences.get(userId);
    if (existing) return existing;
    const record: NotificationPreferencesRecord = {
      user_id: userId,
      ...DEFAULT_PREFERENCES,
      updated_at: new Date().toISOString(),
    };
    this.preferences.set(userId, record);
    return record;
  }

  updatePreferences(
    userId: string,
    patch: Partial<Omit<NotificationPreferencesRecord, 'user_id' | 'updated_at'>>
  ): NotificationPreferencesRecord {
    const current = this.getPreferences(userId);
    const updated: NotificationPreferencesRecord = {
      ...current,
      ...patch,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    this.preferences.set(userId, updated);
    return updated;
  }

  insertHistory(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown> | null
  ): NotificationHistoryRecord {
    const record: NotificationHistoryRecord = {
      id: `ntf_${Math.random().toString(36).substring(2, 10)}`,
      user_id: userId,
      type,
      title,
      body,
      data: data || null,
      created_at: new Date().toISOString(),
    };
    this.history.unshift(record);
    if (this.history.length > 500) this.history.length = 500;
    return record;
  }

  listHistory(userId: string, limit = 50): NotificationHistoryRecord[] {
    return this.history.filter((h) => h.user_id === userId).slice(0, limit);
  }

  hasMilestone(linkId: string, milestone: number): boolean {
    return this.milestones.has(`${linkId}:${milestone}`);
  }

  recordMilestone(linkId: string, milestone: number): void {
    this.milestones.add(`${linkId}:${milestone}`);
  }

  hasPerformance(linkId: string, day: string): boolean {
    return this.performance.has(`${linkId}:${day}`);
  }

  recordPerformance(linkId: string, day: string): void {
    this.performance.add(`${linkId}:${day}`);
  }

  hasExpiration(linkId: string, expiresAt: string): boolean {
    return this.expirations.has(`${linkId}:${expiresAt}`);
  }

  recordExpiration(linkId: string, expiresAt: string): void {
    this.expirations.add(`${linkId}:${expiresAt}`);
  }

  incrementDailyClicks(linkId: string): void {
    const key = `${linkId}:${todayKey()}`;
    this.dailyClicks.set(key, (this.dailyClicks.get(key) || 0) + 1);
  }

  getDailyClicks(linkId: string, day: string): number {
    return this.dailyClicks.get(`${linkId}:${day}`) || 0;
  }

  listPerformanceCandidates(
    threshold: number,
    day: string,
    links: Map<string, any> | undefined
  ): PerformanceCandidate[] {
    const candidates: PerformanceCandidate[] = [];
    if (!links) return candidates;
    for (const [key, clicks] of this.dailyClicks) {
      const [linkId, linkDay] = key.split(':');
      if (linkDay !== day || clicks < threshold || this.hasPerformance(linkId, day)) continue;
      const link = links.get(linkId);
      if (!link || !link.is_active) continue;
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

export const notificationMemoryStore = new NotificationMemoryStore();

// ---------------------------------------------------------------------------
// Push delivery (Expo push service)
// ---------------------------------------------------------------------------

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Sends push messages through Expo's push service. Returns the list of tokens
 * that the service reports as invalid (e.g. app uninstalled) so callers can
 * prune them. Network failures never throw: notifications are best-effort and
 * must never break redirects or API responses.
 */
export async function sendExpoPush(
  messages: ExpoPushMessage[]
): Promise<{ delivered: number; invalidTokens: string[] }> {
  if (messages.length === 0) {
    return { delivered: 0, invalidTokens: [] };
  }

  const invalidTokens: string[] = [];
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
      const payload = (await response.json()) as { data?: ExpoPushTicket[] | ExpoPushTicket };
      const tickets = Array.isArray(payload.data)
        ? payload.data
        : payload.data
          ? [payload.data]
          : [];
      tickets.forEach((ticket, index) => {
        const token = chunk[index]?.to;
        if (ticket.status === 'ok') {
          delivered += 1;
        } else if (token) {
          console.warn('[Notifications] Push ticket error:', ticket.message);
          if (ticket.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(token);
          }
        }
      });
    } catch (err: any) {
      console.warn('[Notifications] Expo push request failed:', err?.message);
    }
  }

  return { delivered, invalidTokens };
}

// ---------------------------------------------------------------------------
// Device tokens
// ---------------------------------------------------------------------------

export async function upsertDeviceToken(
  userId: string,
  token: string,
  platform: string,
  deviceName?: string | null
): Promise<DeviceTokenRecord> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query<DeviceTokenRecord>(
        `INSERT INTO device_tokens (user_id, expo_push_token, platform, device_name, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (expo_push_token) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           platform = EXCLUDED.platform,
           device_name = EXCLUDED.device_name,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *;`,
        [userId, token, platform, deviceName || null]
      );
      return rows[0];
    } catch (err: any) {
      console.warn('[PostgreSQL upsertDeviceToken fallback to memory]:', err.message);
    }
  }
  return notificationMemoryStore.upsertDeviceToken(userId, token, platform, deviceName);
}

export async function removeDeviceToken(userId: string, token: string): Promise<boolean> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query(
        'DELETE FROM device_tokens WHERE user_id = $1 AND expo_push_token = $2 RETURNING id',
        [userId, token]
      );
      return rows.length > 0;
    } catch (err: any) {
      console.warn('[PostgreSQL removeDeviceToken fallback to memory]:', err.message);
    }
  }
  return notificationMemoryStore.removeDeviceToken(userId, token);
}

async function removeInvalidTokens(invalidTokens: string[]): Promise<void> {
  if (invalidTokens.length === 0) return;
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      await query('DELETE FROM device_tokens WHERE expo_push_token = ANY($1)', [invalidTokens]);
      return;
    } catch (err: any) {
      console.warn('[PostgreSQL removeInvalidTokens fallback to memory]:', err.message);
    }
  }
  for (const token of invalidTokens) {
    notificationMemoryStore.removeDeviceTokenGlobally(token);
  }
}

export async function listDeviceTokens(userId: string): Promise<DeviceTokenRecord[]> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query<DeviceTokenRecord>(
        'SELECT * FROM device_tokens WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return rows;
    } catch (err: any) {
      console.warn('[PostgreSQL listDeviceTokens fallback to memory]:', err.message);
    }
  }
  return notificationMemoryStore.listDeviceTokens(userId);
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferencesRecord> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query<NotificationPreferencesRecord>(
        `INSERT INTO notification_preferences (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *;`,
        [userId]
      );
      if (rows.length > 0) return rows[0];
      const existing = await query<NotificationPreferencesRecord>(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [userId]
      );
      if (existing.length > 0) return existing[0];
    } catch (err: any) {
      console.warn('[PostgreSQL getPreferences fallback to memory]:', err.message);
    }
  }
  return notificationMemoryStore.getPreferences(userId);
}

const PREFERENCE_KEYS = ['master_enabled', 'milestones', 'performance', 'expiration', 'qr_activity'] as const;

export async function updateNotificationPreferences(
  userId: string,
  patch: Record<string, unknown>
): Promise<NotificationPreferencesRecord> {
  // Only known boolean keys survive validation; invalid input is dropped.
  const clean: Partial<Record<(typeof PREFERENCE_KEYS)[number], boolean>> = {};
  for (const key of PREFERENCE_KEYS) {
    if (typeof patch[key] === 'boolean') {
      clean[key] = patch[key] as boolean;
    }
  }

  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      // Ensure the row exists, then apply the patch.
      await query('INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
      const rows = await query<NotificationPreferencesRecord>(
        `UPDATE notification_preferences SET
           master_enabled = COALESCE($2, master_enabled),
           milestones = COALESCE($3, milestones),
           performance = COALESCE($4, performance),
           expiration = COALESCE($5, expiration),
           qr_activity = COALESCE($6, qr_activity),
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
         RETURNING *;`,
        [
          userId,
          clean.master_enabled ?? null,
          clean.milestones ?? null,
          clean.performance ?? null,
          clean.expiration ?? null,
          clean.qr_activity ?? null,
        ]
      );
      if (rows.length > 0) return rows[0];
    } catch (err: any) {
      console.warn('[PostgreSQL updatePreferences fallback to memory]:', err.message);
    }
  }
  return notificationMemoryStore.updatePreferences(userId, clean);
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export async function insertNotificationHistory(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown> | null
): Promise<void> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      await query(
        'INSERT INTO notification_history (user_id, type, title, body, data) VALUES ($1, $2, $3, $4, $5)',
        [userId, type, title, body, data ? JSON.stringify(data) : null]
      );
      return;
    } catch (err: any) {
      console.warn('[PostgreSQL insertHistory fallback to memory]:', err.message);
    }
  }
  notificationMemoryStore.insertHistory(userId, type, title, body, data);
}

export async function listNotificationHistory(
  userId: string,
  limit = 50
): Promise<NotificationHistoryRecord[]> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query<NotificationHistoryRecord>(
        'SELECT * FROM notification_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
      return rows;
    } catch (err: any) {
      console.warn('[PostgreSQL listHistory fallback to memory]:', err.message);
    }
  }
  return notificationMemoryStore.listHistory(userId, limit);
}

// ---------------------------------------------------------------------------
// Notification pipeline
// ---------------------------------------------------------------------------

interface QualifiedEvent {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/**
 * Sends a push for a qualified event if the user's preferences allow it and at
 * least one device is registered. The history entry is written as soon as the
 * event is dispatched to a device, so the user can always see the alerts
 * LinkFlow produced for them (even when the phone was offline).
 * Never throws.
 */
async function deliverEvent(event: QualifiedEvent): Promise<void> {
  try {
    const prefs = await getNotificationPreferences(event.userId);
    const typeEnabled =
      event.type === 'milestone'
        ? prefs.milestones
        : event.type === 'performance'
          ? prefs.performance
          : event.type === 'expiration'
            ? prefs.expiration
            : prefs.qr_activity;

    if (!prefs.master_enabled || !typeEnabled) return;

    const tokens = await listDeviceTokens(event.userId);
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
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

    await insertNotificationHistory(
      event.userId,
      event.type,
      event.title,
      event.body,
      event.data
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[Notifications] ${event.type} dispatched to ${delivered}/${tokens.length} device(s) for user ${event.userId}`
      );
    }
  } catch (err: any) {
    console.warn('[Notifications] deliverEvent failed:', err?.message);
  }
}

export interface MilestoneLinkInfo {
  id: string;
  user_id: string;
  short_code: string;
  title: string | null;
  clicks_count: number;
}

/**
 * Detects click milestones for a freshly-incremented link. Records every
 * newly-crossed threshold (dedupe forever per link + milestone) and pushes a
 * notification for the highest one only, so a sudden jump does not spam the
 * user. Called fire-and-forget after incrementClickCount.
 */
export async function processClickMilestones(link: MilestoneLinkInfo): Promise<void> {
  try {
    const hasPg = !!getDatabasePool();
    let unrecorded: number[] = [];

    if (hasPg) {
      try {
        const rows = await query<{ milestone: number }>(
          `SELECT t.milestone FROM unnest($1::int[]) AS t(milestone)
           LEFT JOIN link_milestones m
             ON m.link_id = $2 AND m.milestone = t.milestone
           WHERE m.link_id IS NULL
             AND t.milestone <= $3;`,
          [[...CLICK_MILESTONES], link.id, link.clicks_count]
        );
        unrecorded = rows.map((r) => Number(r.milestone)).filter((m) => Number.isFinite(m));
      } catch (err: any) {
        console.warn('[PostgreSQL milestone lookup fallback to memory]:', err.message);
        unrecorded = CLICK_MILESTONES.filter(
          (m) => m <= link.clicks_count && !notificationMemoryStore.hasMilestone(link.id, m)
        ) as number[];
      }
    } else {
      unrecorded = CLICK_MILESTONES.filter(
        (m) => m <= link.clicks_count && !notificationMemoryStore.hasMilestone(link.id, m)
      ) as number[];
    }

    if (unrecorded.length === 0) return;

    for (const milestone of unrecorded) {
      if (hasPg) {
        try {
          await query(
            'INSERT INTO link_milestones (link_id, milestone) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [link.id, milestone]
          );
        } catch (err: any) {
          console.warn('[PostgreSQL recordMilestone fallback to memory]:', err.message);
          notificationMemoryStore.recordMilestone(link.id, milestone);
        }
      } else {
        notificationMemoryStore.recordMilestone(link.id, milestone);
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
  } catch (err: any) {
    console.warn('[Notifications] processClickMilestones failed:', err?.message);
  }
}

/**
 * Records one redirect against today's daily aggregate for the link.
 * Called from incrementClickCount: must never break the redirect.
 */
export async function incrementDailyClicks(linkId: string): Promise<void> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      await query(
        `INSERT INTO link_daily_clicks (link_id, day, clicks)
         VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (link_id, day) DO UPDATE SET clicks = link_daily_clicks.clicks + 1;`,
        [linkId]
      );
      return;
    } catch (err: any) {
      console.warn('[PostgreSQL incrementDailyClicks fallback to memory]:', err.message);
    }
  }
  notificationMemoryStore.incrementDailyClicks(linkId);
}

/**
 * Scans today's daily click aggregates and notifies users whose links crossed
 * the performance threshold. Deduped once per link per day. Runs on a schedule
 * from server/start.ts (not per redirect, to keep redirect latency minimal).
 */
export async function checkLinkPerformanceNotifications(): Promise<void> {
  try {
    const day = todayKey();
    const hasPg = !!getDatabasePool();
    let candidates: PerformanceCandidate[] = [];

    if (hasPg) {
      try {
        candidates = await query(
          `SELECT l.id, l.user_id, l.short_code, l.title, d.clicks
           FROM link_daily_clicks d
           JOIN links l ON l.id = d.link_id
           WHERE d.day = CURRENT_DATE
             AND d.clicks >= $1
             AND l.is_active = TRUE
             AND NOT EXISTS (
               SELECT 1 FROM link_performance_notifications p
               WHERE p.link_id = l.id AND p.day = CURRENT_DATE
             );`,
          [PERFORMANCE_DAILY_THRESHOLD]
        );
      } catch (err: any) {
        console.warn('[PostgreSQL performance scan fallback to memory]:', err.message);
      }
    }

    if (!hasPg || candidates.length === 0) {
      candidates = notificationMemoryStore.listPerformanceCandidates(
        PERFORMANCE_DAILY_THRESHOLD,
        day,
        memoryLinksProvider?.()
      );
    }

    for (const link of candidates) {
      if (hasPg) {
        try {
          await query(
            'INSERT INTO link_performance_notifications (link_id, day) VALUES ($1, CURRENT_DATE) ON CONFLICT DO NOTHING',
            [link.id]
          );
        } catch (err: any) {
          console.warn('[PostgreSQL recordPerformance fallback to memory]:', err.message);
          notificationMemoryStore.recordPerformance(link.id, day);
        }
      } else {
        notificationMemoryStore.recordPerformance(link.id, day);
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
  } catch (err: any) {
    console.warn('[Notifications] checkLinkPerformanceNotifications failed:', err?.message);
  }
}

export interface ExpiringLinkInfo {
  id: string;
  user_id: string;
  short_code: string;
  title: string | null;
  expires_at: string;
}

/** A link that crossed the daily performance threshold today. */
export interface PerformanceCandidate {
  id: string;
  user_id: string;
  short_code: string;
  title: string | null;
  clicks: number;
}

/**
 * Finds active links expiring within the next 24h and notifies their owners
 * once per (link, expires_at). Runs on a schedule from server/start.ts.
 */
export async function checkExpiringLinks(): Promise<void> {
  try {
    const hasPg = !!getDatabasePool();
    let rows: ExpiringLinkInfo[] = [];

    if (hasPg) {
      try {
        rows = await query<ExpiringLinkInfo>(
          `SELECT l.id, l.user_id, l.short_code, l.title, l.expires_at
           FROM links l
           WHERE l.is_active = TRUE
             AND l.expires_at IS NOT NULL
             AND l.expires_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
             AND NOT EXISTS (
               SELECT 1 FROM link_expiration_notifications e
               WHERE e.link_id = l.id AND e.expires_at = l.expires_at
             );`
        );
      } catch (err: any) {
        console.warn('[PostgreSQL expiration scan fallback to memory]:', err.message);
        rows = scanMemoryExpiringLinks();
      }
    } else {
      rows = scanMemoryExpiringLinks();
    }

    for (const link of rows) {
      if (hasPg) {
        try {
          await query(
            'INSERT INTO link_expiration_notifications (link_id, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [link.id, link.expires_at]
          );
        } catch (err: any) {
          console.warn('[PostgreSQL recordExpiration fallback to memory]:', err.message);
          notificationMemoryStore.recordExpiration(link.id, link.expires_at);
        }
      } else {
        notificationMemoryStore.recordExpiration(link.id, link.expires_at);
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
  } catch (err: any) {
    console.warn('[Notifications] checkExpiringLinks failed:', err?.message);
  }
}

/**
 * In-memory expiry scan mirrors the SQL: active links with expires_at inside
 * the next 24h that have not been notified yet. The links map is injected by
 * server/index.ts (setMemoryLinksProvider) to avoid a circular import.
 */
type MemoryLinksProvider = () => Map<string, any> | undefined;
let memoryLinksProvider: MemoryLinksProvider | null = null;

export function setMemoryLinksProvider(provider: MemoryLinksProvider): void {
  memoryLinksProvider = provider;
}

function scanMemoryExpiringLinks(): ExpiringLinkInfo[] {
  const links = memoryLinksProvider?.();
  if (!links) return [];
  const now = Date.now();
  const horizon = now + EXPIRATION_WINDOW_HOURS * 3600 * 1000;
  const result: ExpiringLinkInfo[] = [];
  for (const link of links.values()) {
    if (!link.is_active || !link.expires_at) continue;
    const expiresAt = new Date(link.expires_at).getTime();
    if (expiresAt < now || expiresAt > horizon) continue;
    if (notificationMemoryStore.hasExpiration(link.id, link.expires_at)) continue;
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
