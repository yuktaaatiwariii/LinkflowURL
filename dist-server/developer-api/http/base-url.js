"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePublicBaseUrl = resolvePublicBaseUrl;
function readForwardedValue(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'string')
        return null;
    const first = raw.split(',')[0].trim();
    return first.length > 0 ? first : null;
}
function isSafeHost(host) {
    return /^[A-Za-z0-9.\-:[\]]{1,255}$/.test(host);
}
/**
 * Resolves the public origin used to build short URLs.
 *
 * Order:
 *   1. `PUBLIC_SHORT_URL_BASE` (server-only canonical origin)
 *   2. `EXPO_PUBLIC_SHORT_URL_BASE` (already used by the app, so API and app
 *      agree on the displayed domain)
 *   3. The request origin (`X-Forwarded-*` when present, otherwise `Host`)
 *
 * Only the returned string is affected; no authorization decision depends on
 * these headers.
 */
function resolvePublicBaseUrl(req) {
    const configured = (process.env.PUBLIC_SHORT_URL_BASE ||
        process.env.EXPO_PUBLIC_SHORT_URL_BASE ||
        '').trim();
    if (configured) {
        return configured.replace(/\/+$/, '');
    }
    const forwardedProto = readForwardedValue(req.headers['x-forwarded-proto']);
    const protocol = forwardedProto === 'https' || forwardedProto === 'http' ? forwardedProto : 'http';
    const forwardedHost = readForwardedValue(req.headers['x-forwarded-host']);
    const host = forwardedHost || readForwardedValue(req.headers.host) || 'localhost';
    return `${protocol}://${isSafeHost(host) ? host : 'localhost'}`;
}
