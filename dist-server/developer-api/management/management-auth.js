"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readBearerToken = readBearerToken;
exports.createDefaultManagementUserResolver = createDefaultManagementUserResolver;
function readBearerToken(req) {
    const header = req.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (typeof value !== 'string' || !value.startsWith('Bearer '))
        return null;
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
function createDefaultManagementUserResolver(deps) {
    return async (req) => {
        const token = readBearerToken(req);
        if (!token)
            return null;
        try {
            const verified = await deps.verifyToken(token);
            const existing = await deps.getUserByClerkId(verified.clerkUserId);
            if (existing)
                return existing;
            return await deps.syncUser(verified.clerkUserId, verified.email || '');
        }
        catch {
            // Never surface JWT verification details to the client.
            return null;
        }
    };
}
