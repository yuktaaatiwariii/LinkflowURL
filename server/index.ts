import http from 'http';
import { query, getDatabasePool } from './db';
import { verifyClerkToken } from './auth';
import { runMigrations } from './schema';
import {
  generateShortCode,
  isValidBase62,
  MAX_RETRIES,
} from './short-code';

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

// In-memory fallback repository when PostgreSQL DATABASE_URL is not connected yet
class MockMemoryStore {
  users: Map<string, UserRecord> = new Map();
  links: Map<string, LinkRecord> = new Map();

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
}

export const memoryStore = new MockMemoryStore();

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
      await query(
        'UPDATE links SET clicks_count = clicks_count + 1 WHERE short_code = $1',
        [shortCode]
      );
      return;
    } catch (err: any) {
      console.warn('[PostgreSQL incrementClickCount fallback to memory]:', err.message);
    }
  }

  const link = memoryStore.getLinkByShortCode(shortCode);
  if (link) {
    link.clicks_count += 1;
    memoryStore.links.set(link.id, link);
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

/**
 * Creates the lightweight LinkFlow API HTTP server
 */
export function createServer() {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    const sendJson = (status: number, data: any) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    // Health check
    if (pathname === '/api/health' && req.method === 'GET') {
      const hasDb = !!getDatabasePool();
      return sendJson(200, {
        status: 'ok',
        service: 'LinkFlow URL Backend',
        database: hasDb ? 'PostgreSQL' : 'In-Memory (Awaiting DATABASE_URL)',
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
        return sendJson(401, { error: 'Unauthorized', message: err.message });
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
      sendJson(500, { error: 'Internal Server Error', message: err.message });
    }
  });

  return server;
}

