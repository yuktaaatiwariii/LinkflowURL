import type { IncomingMessage } from 'http';
import type { UserRecord } from '../../types';

/**
 * Authentication seam for `/api/developer/keys*`.
 *
 * Production uses the existing Clerk Bearer JWT flow. Tests inject an
 * in-process resolver through `createServer({ resolveManagementUser })`; the
 * seam is constructor-only and is never controlled by an environment variable,
 * so it cannot become a production bypass.
 */

export type ManagementUserResolver = (req: IncomingMessage) => Promise<UserRecord | null>;

export interface ManagementAuthDependencies {
  verifyToken(token: string): Promise<{ clerkUserId: string; email?: string }>;
  getUserByClerkId(clerkUserId: string): Promise<UserRecord | null>;
  syncUser(clerkUserId: string, email: string): Promise<UserRecord>;
}

export interface ManagementApiDependencies extends ManagementAuthDependencies {
  resolveManagementUser?: ManagementUserResolver;
}

export function readBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string' || !value.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Default resolver: verify the Clerk JWT, then map it to a persisted user.
 *
 * Accounts that have not called `/api/users/sync` yet are provisioned on first
 * use, matching the auto-heal behaviour of the existing user routes. A key row
 * has a foreign key to `users`, so an unprovisioned account cannot own a key.
 */
export function createDefaultManagementUserResolver(
  deps: ManagementAuthDependencies
): ManagementUserResolver {
  return async (req) => {
    const token = readBearerToken(req);
    if (!token) return null;
    try {
      const verified = await deps.verifyToken(token);
      const existing = await deps.getUserByClerkId(verified.clerkUserId);
      if (existing) return existing;
      return await deps.syncUser(verified.clerkUserId, verified.email || '');
    } catch {
      // Never surface JWT verification details to the client.
      return null;
    }
  };
}
