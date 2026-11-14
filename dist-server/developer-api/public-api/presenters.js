"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeLink = serializeLink;
exports.serializeQrCode = serializeQrCode;
function serializeLink(link, baseUrl) {
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
function serializeQrCode(qr) {
    return {
        id: qr.id,
        title: qr.title,
        targetUrl: qr.target_url,
        linkId: qr.link_id,
        createdAt: qr.created_at,
        updatedAt: qr.updated_at,
    };
}
