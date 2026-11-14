import type {
  DeveloperApiKeyEnvironment,
  DeveloperApiScope,
  LinkRecord,
  QrRecord,
  UserRecord,
} from '../../types';

/**
 * Authenticated developer identity attached to a public API request.
 *
 * Phase 2 resolves this from a persisted API key record. The key id,
 * environment and scopes are included so route handlers can enforce
 * capabilities without re-reading the database.
 */
export interface ApiDeveloper {
  /** LinkFlow user id that owns every resource reachable through this key. */
  userId: string;
  clerkUserId: string;
  email: string;
  fullName: string | null;
  /** Persisted API key that authenticated the request. */
  apiKeyId: string;
  /** Project that owns the key, when one is associated. */
  projectId: string | null;
  environment: DeveloperApiKeyEnvironment;
  scopes: DeveloperApiScope[];
}

export interface CreateLinkInput {
  originalUrl: string;
  title?: string;
  customAlias?: string;
}

export interface CreateQrInput {
  targetUrl: string;
  title?: string;
  linkId?: string;
}

/**
 * Repository ports consumed by the public controllers.
 *
 * They map 1:1 onto the existing data-access functions in `server/index.ts`
 * (which already enforce `user_id` ownership predicates) so the API never
 * re-implements persistence, short-code generation or QR creation.
 */
export interface DeveloperApiDependencies {
  getUserByClerkId(clerkUserId: string): Promise<UserRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;

  listLinks(userId: string): Promise<LinkRecord[]>;
  getLink(userId: string, linkId: string): Promise<LinkRecord | null>;
  findLinkByShortCode(shortCode: string): Promise<LinkRecord | null>;
  createLink(userId: string, input: CreateLinkInput): Promise<LinkRecord>;
  deleteLink(linkId: string, userId: string): Promise<boolean>;

  listQrCodes(userId: string): Promise<QrRecord[]>;
  getQrCode(qrId: string, userId: string): Promise<QrRecord | null>;
  createQrCode(userId: string, input: CreateQrInput): Promise<QrRecord>;
  deleteQrCode(qrId: string, userId: string): Promise<boolean>;
}

export interface DailyClickPoint {
  /** Calendar day in `YYYY-MM-DD` form. */
  date: string;
  clicks: number;
}
