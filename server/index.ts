import http from 'http';
import { query, getDatabasePool } from './db';
import { verifyClerkToken } from './auth';
import { runMigrations } from './schema';
import {
  generateShortCode,
  isValidBase62,
  MAX_RETRIES,
} from './short-code';
import {
  setMemoryLinksProvider,
  incrementDailyClicks,
  processClickMilestones,
  upsertDeviceToken,
  removeDeviceToken,
  getNotificationPreferences,
  updateNotificationPreferences,
  listNotificationHistory,
  isValidExpoPushToken,
  isValidPlatform,
} from './notifications';

export interface UserRecord {
  id: string;
  clerk_user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkRecord {
  id: string;
  user_id: string;
  original_url: string;
  short_code: string;
  custom_alias: string | null;
  title: string | null;
  is_active: boolean;
  expires_at: string | null;
  clicks_count: number;
  created_at: string;
  updated_at: string;
}

export interface QrRecord {
  id: string;
  user_id: string;
  link_id: string | null;
  title: string;
  target_url: string;
  created_at: string;
  updated_at: string;
}

// In-memory fallback repository when PostgreSQL DATABASE_URL is not connected yet
class MockMemoryStore {
  users: Map<string, UserRecord> = new Map();
  links: Map<string, LinkRecord> = new Map();
  qrCodes: Map<string, QrRecord> = new Map();

  upsertUser(clerkUserId: string, email: string, fullName?: string | null): UserRecord {
    let existing = Array.from(this.users.values()).find((u) => u.clerk_user_id === clerkUserId);
    const now = new Date().toISOString();
    if (existing) {
      existing.email = email || existing.email;
      if (fullName !== undefined) existing.full_name = fullName;
      existing.updated_at = now;
      return existing;
    }
    const newUser: UserRecord = {
      id: `usr_${Math.random().toString(36).substring(2, 10)}`,
      clerk_user_id: clerkUserId,
      email: email || '',
      full_name: fullName || null,
      created_at: now,
      updated_at: now,
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  getUser(clerkUserId: string): UserRecord | null {
    return Array.from(this.users.values()).find((u) => u.clerk_user_id === clerkUserId) || null;
  }

  getLinks(userId: string): LinkRecord[] {
    return Array.from(this.links.values())
      .filter((l) => l.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  createLink(userId: string, originalUrl: string, title?: string, customAlias?: string): LinkRecord {
    const shortCode = customAlias || generateShortCode();
    if (customAlias && !isValidBase62(customAlias)) {
      throw new Error('Custom alias must contain only Base62 characters (A-Z, a-z, 0-9).');
    }
    const now = new Date().toISOString();
    const link: LinkRecord = {
      id: `lnk_${generateShortCode(10)}`,
      user_id: userId,
      original_url: originalUrl,
      short_code: shortCode,
      custom_alias: customAlias || null,
      title: title || originalUrl.replace(/^https?:\/\//, '').split('/')[0],
      is_active: true,
      expires_at: null,
      clicks_count: 0,
      created_at: now,
      updated_at: now,
    };
    this.links.set(link.id, link);
    return link;
  }

  deleteLink(linkId: string, userId: string): boolean {
    const link = this.links.get(linkId);
    if (!link || link.user_id !== userId) {
      return false;
    }
    return this.links.delete(linkId);
  }

  getLinkByShortCode(shortCode: string): LinkRecord | undefined {
    return Array.from(this.links.values()).find((l) => l.short_code === shortCode);
  }

  getQrCodes(userId: string): QrRecord[] {
    return Array.from(this.qrCodes.values())
      .filter((q) => q.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  createQrCode(
    userId: string,
    targetUrl: string,
    title?: string,
    linkId?: string
  ): QrRecord {
    const now = new Date().toISOString();
    const normalizedTitle = title || 'QR Code';
    // Collapse accidental double-submits of the same QR within a short window.
    const recentDuplicate = Array.from(this.qrCodes.values()).find(
      (q) =>
        q.user_id === userId &&
        q.target_url === targetUrl &&
        q.title === normalizedTitle &&
        Date.now() - new Date(q.created_at).getTime() < 5000
    );
    if (recentDuplicate) {
      return recentDuplicate;
    }
    const qr: QrRecord = {
      id: `qr_${generateShortCode(10)}`,
      user_id: userId,
      link_id: linkId || null,
      title: normalizedTitle,
      target_url: targetUrl,
      created_at: now,
      updated_at: now,
    };
    this.qrCodes.set(qr.id, qr);
    return qr;
  }

  getQrCode(id: string, userId: string): QrRecord | undefined {
    const qr = this.qrCodes.get(id);
    if (!qr || qr.user_id !== userId) {
      return undefined;
    }
    return qr;
  }

  deleteQrCode(id: string, userId: string): boolean {
    const qr = this.qrCodes.get(id);
    if (!qr || qr.user_id !== userId) {
      return false;
    }
    return this.qrCodes.delete(id);
  }
}

export const memoryStore = new MockMemoryStore();

// Let the notification module read the in-memory links map (for the expiry /
// performance scans) without creating a circular import.
setMemoryLinksProvider(() => memoryStore.links);

export async function syncUserInDb(
  clerkUserId: string,
  email: string,
  fullName?: string | null
): Promise<UserRecord> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const sql = `
        INSERT INTO users (clerk_user_id, email, full_name, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (clerk_user_id) 
        DO UPDATE SET
          email = EXCLUDED.email,
          full_name = COALESCE(EXCLUDED.full_name, users.full_name),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const rows = await query<UserRecord>(sql, [clerkUserId, email, fullName || null]);
      return rows[0];
    } catch (err: any) {
      console.warn('[PostgreSQL Sync fallback to memory]:', err.message);
    }
  }

  return memoryStore.upsertUser(clerkUserId, email, fullName);
}

export async function getUserFromDb(clerkUserId: string): Promise<UserRecord | null> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query<UserRecord>('SELECT * FROM users WHERE clerk_user_id = $1 LIMIT 1', [clerkUserId]);
      if (rows.length > 0) return rows[0];
    } catch (err: any) {
      console.warn('[PostgreSQL getUser fallback to memory]:', err.message);
    }
  }

  return memoryStore.getUser(clerkUserId);
}

export async function getUserLinks(userId: string): Promise<LinkRecord[]> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query<LinkRecord>(
        'SELECT * FROM links WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return rows;
    } catch (err: any) {
      console.warn('[PostgreSQL getLinks fallback to memory]:', err.message);
    }
  }

  return memoryStore.getLinks(userId);
}

/**
 * Validates that a URL uses an allowed scheme (http or https).
 */
function isValidUrlScheme(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Generates a unique short code with bounded retry on collision.
 * Falls back to memory store if PostgreSQL is unavailable.
 */
export async function createUserLink(
  userId: string,
  originalUrl: string,
  title?: string,
  customAlias?: string
): Promise<LinkRecord> {
  if (customAlias && !isValidBase62(customAlias)) {
    throw new Error('Custom alias must contain only Base62 characters (A-Z, a-z, 0-9).');
  }

  const hasPg = !!getDatabasePool();
  if (hasPg) {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const shortCode = customAlias || generateShortCode();
      try {
        const rows = await query<LinkRecord>(
          `INSERT INTO links (user_id, original_url, short_code, custom_alias, title)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *;`,
          [userId, originalUrl, shortCode, customAlias || null, title || null]
        );
        return rows[0];
      } catch (err: any) {
        // Retry only on short_code uniqueness violation (PostgreSQL code 23505)
        if (err.code === '23505' && err.message?.includes('short_code')) {
          lastError = err;
          continue; // generate a fresh code and retry
        }
        // Non-uniqueness error: don't retry, fall through to memory
        console.warn('[PostgreSQL createLink fallback to memory]:', err.message);
        break;
      }
    }

    if (lastError) {
      throw new Error(
        `Unable to generate a unique short code after ${MAX_RETRIES} attempts.`
      );
    }
  }

  return memoryStore.createLink(userId, originalUrl, title, customAlias);
}

export async function getLinkByShortCode(shortCode: string): Promise<LinkRecord | null> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query<LinkRecord>(
        'SELECT * FROM links WHERE short_code = $1 LIMIT 1',
        [shortCode]
      );
      if (rows.length > 0) return rows[0];
    } catch (err: any) {
      console.warn('[PostgreSQL getLinkByShortCode fallback to memory]:', err.message);
    }
  }

  const link = memoryStore.getLinkByShortCode(shortCode);
  return link || null;
}

export async function incrementClickCount(shortCode: string): Promise<void> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query<{
        id: string;
        user_id: string;
        short_code: string;
        title: string | null;
        clicks_count: number;
      }>(
        `UPDATE links SET clicks_count = clicks_count + 1
         WHERE short_code = $1
         RETURNING id, user_id, short_code, title, clicks_count`,
        [shortCode]
      );
      if (rows.length > 0) {
        const updated = rows[0];
        // Daily aggregate + milestone detection are fire-and-forget so the
        // public redirect latency stays minimal. Both swallow their own errors.
        void incrementDailyClicks(updated.id);
        void processClickMilestones({
          id: updated.id,
          user_id: updated.user_id,
          short_code: updated.short_code,
          title: updated.title,
          clicks_count: updated.clicks_count,
        });
        return;
      }
      return;
    } catch (err: any) {
      console.warn('[PostgreSQL incrementClickCount fallback to memory]:', err.message);
    }
  }

  const link = memoryStore.getLinkByShortCode(shortCode);
  if (link) {
    link.clicks_count += 1;
    memoryStore.links.set(link.id, link);
    void incrementDailyClicks(link.id);
    void processClickMilestones({
      id: link.id,
      user_id: link.user_id,
      short_code: link.short_code,
      title: link.title,
      clicks_count: link.clicks_count,
    });
  }
}

export async function deleteUserLink(linkId: string, userId: string): Promise<boolean> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const result = await query(
        'DELETE FROM links WHERE id = $1 AND user_id = $2 RETURNING id',
        [linkId, userId]
      );
      return result.length > 0;
    } catch (err: any) {
      console.warn('[PostgreSQL deleteUserLink fallback to memory]:', err.message);
    }
  }

  return memoryStore.deleteLink(linkId, userId);
}

export async function getQrCodesFromDb(userId: string): Promise<QrRecord[]> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query<QrRecord>(
        'SELECT * FROM qr_codes WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return rows;
    } catch (err: any) {
      console.warn('[PostgreSQL getQrCodes fallback to memory]:', err.message);
    }
  }
  return memoryStore.getQrCodes(userId);
}

/**
 * Looks up a short link only if it belongs to the supplied user.
 * Used to prevent attaching a QR code to another user's link.
 */
export async function getUserLinkById(
  userId: string,
  linkId: string
): Promise<LinkRecord | null> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query<LinkRecord>(
        'SELECT * FROM links WHERE id = $1 AND user_id = $2 LIMIT 1',
        [linkId, userId]
      );
      if (rows.length > 0) return rows[0];
    } catch (err: any) {
      console.warn('[PostgreSQL getUserLinkById fallback to memory]:', err.message);
    }
  }
  const link = memoryStore.links.get(linkId);
  return link && link.user_id === userId ? link : null;
}

export async function createQrCodeInDb(
  userId: string,
  targetUrl: string,
  title?: string,
  linkId?: string
): Promise<QrRecord> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const normalizedTitle = title || 'QR Code';
      // Collapse accidental repeated submissions (same user, target and label).
      const existing = await query<QrRecord>(
        `SELECT * FROM qr_codes
         WHERE user_id = $1 AND target_url = $2 AND title = $3
           AND created_at > NOW() - INTERVAL '5 seconds'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, targetUrl, normalizedTitle]
      );
      if (existing.length > 0) {
        return existing[0];
      }

      const rows = await query<QrRecord>(
        `INSERT INTO qr_codes (user_id, link_id, title, target_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *;`,
        [userId, linkId || null, normalizedTitle, targetUrl]
      );
      return rows[0];
    } catch (err: any) {
      console.warn('[PostgreSQL createQrCode fallback to memory]:', err.message);
    }
  }
  return memoryStore.createQrCode(userId, targetUrl, title, linkId);
}

export async function getQrCodeFromDb(id: string, userId: string): Promise<QrRecord | null> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const rows = await query<QrRecord>(
        'SELECT * FROM qr_codes WHERE id = $1 AND user_id = $2 LIMIT 1',
        [id, userId]
      );
      if (rows.length > 0) return rows[0];
    } catch (err: any) {
      console.warn('[PostgreSQL getQrCode fallback to memory]:', err.message);
    }
  }
  const qr = memoryStore.getQrCode(id, userId);
  return qr || null;
}

export async function deleteQrCodeFromDb(id: string, userId: string): Promise<boolean> {
  const hasPg = !!getDatabasePool();
  if (hasPg) {
    try {
      const result = await query(
        'DELETE FROM qr_codes WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );
      return result.length > 0;
    } catch (err: any) {
      console.warn('[PostgreSQL deleteQrCode fallback to memory]:', err.message);
    }
  }
  return memoryStore.deleteQrCode(id, userId);
}

/**
 * Creates the lightweight LinkFlow API HTTP server
 */
export function createServer() {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const requestStartedAt = Date.now();

    // Development-friendly request log (method, route, status, duration).
    // Never logs tokens, request bodies, or query strings.
    if (req.method !== 'OPTIONS') {
      res.on('finish', () => {
        console.log(
          `[API] ${req.method} ${pathname} ${res.statusCode} ${Date.now() - requestStartedAt}ms`
        );
      });
    }

    const sendJson = (status: number, data: any) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    // Health check (optionally probes PostgreSQL with ?db=1)
    if (pathname === '/api/health' && req.method === 'GET') {
      const pool = getDatabasePool();
      let database = pool ? 'PostgreSQL' : 'In-Memory (Awaiting DATABASE_URL)';
      let databaseOk = true;
      let databaseLatencyMs: number | null = null;

      if (pool && parsedUrl.searchParams.get('db') === '1') {
        const startedAt = Date.now();
        try {
          await query('SELECT 1');
          databaseLatencyMs = Date.now() - startedAt;
        } catch (err: any) {
          databaseOk = false;
          database = 'PostgreSQL (unreachable)';
          console.warn('[Health] Database probe failed:', err.message);
        }
      }

      return sendJson(databaseOk ? 200 : 503, {
        status: databaseOk ? 'ok' : 'degraded',
        service: 'LinkFlow URL Backend',
        database,
        databaseLatencyMs,
        timestamp: new Date().toISOString(),
      });
    }

    // Run database migrations on demand
    if (pathname === '/api/admin/migrate' && req.method === 'POST') {
      const result = await runMigrations();
      return sendJson(result.success ? 200 : 500, result);
    }

    // Extract Bearer Token for protected endpoints
    const authHeader = req.headers.authorization;
    let authContext: { clerkUserId: string; email?: string } | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const verified = await verifyClerkToken(token);
        authContext = {
          clerkUserId: verified.clerkUserId,
          email: verified.email,
        };
      } catch (err: any) {
        // Keep verification details in server logs; never leak token/claim
        // diagnostics to the client.
        console.warn('[Auth] Token rejected:', err.message);
        return sendJson(401, {
          error: 'Unauthorized',
          message: 'Invalid or expired authentication token.',
        });
      }
    }

    // Read JSON Body helper
    const readBody = async (): Promise<any> => {
      return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            reject(new Error('Invalid JSON'));
          }
        });
        req.on('error', reject);
      });
    };

    try {
      // 1. Sync User endpoint (Protected)
      if (pathname === '/api/users/sync' && req.method === 'POST') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const body = await readBody();
        const email = body.email || authContext.email || '';
        const fullName = body.fullName || null;

        const user = await syncUserInDb(authContext.clerkUserId, email, fullName);
        return sendJson(200, {
          success: true,
          user,
        });
      }

      // 2. Get Current User Profile (Protected)
      if (pathname === '/api/users/me' && req.method === 'GET') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const user = await getUserFromDb(authContext.clerkUserId);
        if (!user) {
          return sendJson(404, { error: 'User not synced yet' });
        }
        return sendJson(200, { user });
      }

      // 3. User Links (Protected)
      if (pathname === '/api/links' && req.method === 'GET') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const user = await getUserFromDb(authContext.clerkUserId);
        if (!user) {
          return sendJson(200, { links: [], total: 0, active: 0 });
        }
        const links = await getUserLinks(user.id);
        const activeCount = links.filter((l) => l.is_active).length;
        return sendJson(200, {
          links,
          total: links.length,
          active: activeCount,
        });
      }

      // 4. Create Short Link (Protected)
      if (pathname === '/api/links' && req.method === 'POST') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const body = await readBody();
        if (!body.originalUrl) {
          return sendJson(400, { error: 'originalUrl is required' });
        }

        // Validate URL scheme
        if (!isValidUrlScheme(body.originalUrl)) {
          return sendJson(400, { error: 'originalUrl must be a valid http or https URL' });
        }

        // Validate custom alias if provided
        if (body.customAlias && !isValidBase62(body.customAlias)) {
          return sendJson(400, {
            error: 'customAlias must contain only Base62 characters (A-Z, a-z, 0-9)',
          });
        }

        let user = await getUserFromDb(authContext.clerkUserId);
        if (!user) {
          user = await syncUserInDb(authContext.clerkUserId, authContext.email || '');
        }

        const link = await createUserLink(user.id, body.originalUrl, body.title, body.customAlias);
        return sendJson(201, { success: true, link });
      }

      // 5. Delete Short Link (Protected)
      if (req.method === 'DELETE') {
        const linkIdMatch = pathname.match(/^\/api\/links\/([^\/]+)$/);
        if (linkIdMatch) {
          if (!authContext) {
            return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
          }
          const linkId = linkIdMatch[1];
          const user = await getUserFromDb(authContext.clerkUserId);
          if (!user) {
            return sendJson(404, { error: 'User not found' });
          }
          const deleted = await deleteUserLink(linkId, user.id);
          if (!deleted) {
            return sendJson(404, { error: 'Link not found or access denied' });
          }
          return sendJson(200, { success: true, message: 'Link deleted' });
        }
      }

      // 6. Save QR Code (Protected)
      if (pathname === '/api/qr' && req.method === 'POST') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const body = await readBody();
        if (!body.targetUrl) {
          return sendJson(400, { error: 'targetUrl is required' });
        }
        if (!isValidUrlScheme(body.targetUrl)) {
          return sendJson(400, { error: 'targetUrl must be a valid http or https URL' });
        }

        // Auto-heal accounts that have not been synced yet (e.g. a user who
        // navigates straight to the QR screen after signing in).
        let user = await getUserFromDb(authContext.clerkUserId);
        if (!user) {
          user = await syncUserInDb(authContext.clerkUserId, authContext.email || '');
        }

        // A QR may only be associated with a link owned by the same user.
        if (body.linkId) {
          const ownedLink = await getUserLinkById(user.id, body.linkId);
          if (!ownedLink) {
            return sendJson(400, { error: 'linkId does not belong to this user' });
          }
        }

        const qr = await createQrCodeInDb(
          user.id,
          body.targetUrl,
          body.title || null,
          body.linkId || null
        );
        return sendJson(201, { success: true, qr });
      }

      // 7. Get QR Codes (Protected)
      if (pathname === '/api/qr' && req.method === 'GET') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const user = await getUserFromDb(authContext.clerkUserId);
        if (!user) {
          return sendJson(200, { qrs: [], total: 0 });
        }
        const qrs = await getQrCodesFromDb(user.id);
        return sendJson(200, { qrs, total: qrs.length });
      }

      // 8. Get QR Code by ID (Protected)
      if (pathname.match(/^\/api\/qr\/([^\/]+)$/) && req.method === 'GET') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const qrIdMatch = pathname.match(/^\/api\/qr\/([^\/]+)$/);
        if (qrIdMatch) {
          const user = await getUserFromDb(authContext.clerkUserId);
          if (!user) {
            return sendJson(404, { error: 'User not found' });
          }
          const qr = await getQrCodeFromDb(qrIdMatch[1], user.id);
          if (!qr) {
            return sendJson(404, { error: 'QR code not found' });
          }
          return sendJson(200, { qr });
        }
      }

      // 9. Delete QR Code (Protected)
      if (pathname.match(/^\/api\/qr\/([^\/]+)$/) && req.method === 'DELETE') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const qrIdMatch = pathname.match(/^\/api\/qr\/([^\/]+)$/);
        if (qrIdMatch) {
          const user = await getUserFromDb(authContext.clerkUserId);
          if (!user) {
            return sendJson(404, { error: 'User not found' });
          }
          const deleted = await deleteQrCodeFromDb(qrIdMatch[1], user.id);
          if (!deleted) {
            return sendJson(404, { error: 'QR code not found or access denied' });
          }
          return sendJson(200, { success: true, message: 'QR code deleted' });
        }
      }

      // 10. Register Device Push Token (Protected)
      if (pathname === '/api/notifications/register' && req.method === 'POST') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const body = await readBody();
        if (!isValidExpoPushToken(body.expoPushToken)) {
          return sendJson(400, {
            error: 'expoPushToken must be a valid Expo push token (ExpoPushToken[...])',
          });
        }
        if (!isValidPlatform(body.platform)) {
          return sendJson(400, { error: 'platform must be one of: android, ios, web' });
        }

        // Auto-heal accounts that have not been synced yet (push registration
        // happens right after sign-in, potentially before /api/users/sync).
        let user = await getUserFromDb(authContext.clerkUserId);
        if (!user) {
          user = await syncUserInDb(authContext.clerkUserId, authContext.email || '');
        }

        const token = await upsertDeviceToken(
          user.id,
          body.expoPushToken.trim(),
          body.platform,
          typeof body.deviceName === 'string' ? body.deviceName.slice(0, 255) : null
        );
        return sendJson(200, { success: true, device: token });
      }

      // 11. Unregister Device Push Token (Protected, used on logout)
      if (pathname === '/api/notifications/unregister' && req.method === 'POST') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const body = await readBody();
        if (!isValidExpoPushToken(body.expoPushToken)) {
          return sendJson(400, { error: 'expoPushToken must be a valid Expo push token' });
        }
        const user = await getUserFromDb(authContext.clerkUserId);
        if (!user) {
          return sendJson(200, { success: true, message: 'Nothing to remove' });
        }
        const removed = await removeDeviceToken(user.id, body.expoPushToken.trim());
        return sendJson(200, { success: true, removed });
      }

      // 12. Get Notification Preferences (Protected)
      if (pathname === '/api/notifications/preferences' && req.method === 'GET') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        let user = await getUserFromDb(authContext.clerkUserId);
        if (!user) {
          user = await syncUserInDb(authContext.clerkUserId, authContext.email || '');
        }
        const preferences = await getNotificationPreferences(user.id);
        return sendJson(200, { preferences });
      }

      // 13. Update Notification Preferences (Protected)
      if (pathname === '/api/notifications/preferences' && req.method === 'PUT') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const body = await readBody();
        let user = await getUserFromDb(authContext.clerkUserId);
        if (!user) {
          user = await syncUserInDb(authContext.clerkUserId, authContext.email || '');
        }
        // Unknown or non-boolean keys are dropped inside updateNotificationPreferences.
        const preferences = await updateNotificationPreferences(user.id, body);
        return sendJson(200, { success: true, preferences });
      }

      // 14. Notification History (Protected)
      if (pathname === '/api/notifications/history' && req.method === 'GET') {
        if (!authContext) {
          return sendJson(401, { error: 'Unauthorized', message: 'Bearer token required' });
        }
        const user = await getUserFromDb(authContext.clerkUserId);
        if (!user) {
          return sendJson(200, { notifications: [], total: 0 });
        }
        const limitParam = Number(parsedUrl.searchParams.get('limit') || '50');
        const limit = Number.isFinite(limitParam)
          ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
          : 50;
        const notifications = await listNotificationHistory(user.id, limit);
        return sendJson(200, { notifications, total: notifications.length });
      }

      // 6. Public Short-URL Redirect (no authentication required)
      if (req.method === 'GET' && !pathname.startsWith('/api/')) {
        const shortCode = pathname.slice(1); // remove leading '/'
        if (shortCode && shortCode.length > 0) {
          const link = await getLinkByShortCode(shortCode);
          if (!link) {
            return sendJson(404, { error: 'Short link not found' });
          }

          if (!link.is_active) {
            return sendJson(410, {
              error: 'This short link has been disabled.',
            });
          }

          if (link.expires_at && new Date(link.expires_at) < new Date()) {
            return sendJson(410, {
              error: 'This short link has expired.',
            });
          }

          // Validate destination URL scheme before redirecting
          if (!isValidUrlScheme(link.original_url)) {
            return sendJson(410, {
              error: 'This short link destination is invalid.',
            });
          }

          // Atomically increment click count
          await incrementClickCount(shortCode);

          // HTTP 302 redirect to original URL
          res.writeHead(302, { Location: link.original_url });
          res.end();
          return;
        }
      }

      // 404 Route handler
      sendJson(404, { error: 'Endpoint not found' });
    } catch (err: any) {
      console.error('[API Server Error]:', err);

      // Malformed bodies are a client error, not a server failure.
      if (err?.message === 'Invalid JSON') {
        return sendJson(400, { error: 'Invalid JSON body' });
      }

      const exposeDetail = process.env.NODE_ENV !== 'production';
      return sendJson(500, {
        error: 'Internal Server Error',
        ...(exposeDetail ? { message: err.message } : {}),
      });
    }
  });

  return server;
}

