import type { LinkRecord, QrRecord } from '../../types';

/**
 * Public representations. Internal columns (`user_id`, database-only fields)
 * are never returned.
 */

export interface PublicLink {
  id: string;
  originalUrl: string;
  shortUrl: string;
  shortCode: string;
  customAlias: string | null;
  title: string | null;
  isActive: boolean;
  expiresAt: string | null;
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicQrCode {
  id: string;
  title: string;
  targetUrl: string;
  linkId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeLink(link: LinkRecord, baseUrl: string): PublicLink {
  return {
    id: link.id,
    originalUrl: link.original_url,
    shortUrl: `${baseUrl}/${link.short_code}`,
    shortCode: link.short_code,
    customAlias: link.custom_alias,
    title: link.title,
    isActive: link.is_active,
    expiresAt: link.expires_at,
    clicks: link.clicks_count,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
  };
}

export function serializeQrCode(qr: QrRecord): PublicQrCode {
  return {
    id: qr.id,
    title: qr.title,
    targetUrl: qr.target_url,
    linkId: qr.link_id,
    createdAt: qr.created_at,
    updatedAt: qr.updated_at,
  };
}
