"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyClerkToken = verifyClerkToken;
const jose_1 = require("jose");
let jwks = null;
function getJwks() {
    if (!jwks) {
        const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY;
        let issuer = 'https://clerk.linkflow.app';
        // Clerk publishable keys encode the frontend API host:
        //   pk_test_<base64(frontend-api$)>
        //   pk_live_<base64(frontend-api$)>
        const keyMatch = publishableKey && publishableKey.match(/^pk_(?:test|live)_(.+)$/);
        if (keyMatch) {
            try {
                const decoded = Buffer.from(keyMatch[1], 'base64').toString('utf8');
                const frontendApi = decoded.replace(/\$$/, '').trim();
                if (frontendApi) {
                    issuer = `https://${frontendApi}`;
                }
            }
            catch {
                // Fallback to default
            }
        }
        const jwksUrl = new URL(`${issuer}/.well-known/jwks.json`);
        jwks = (0, jose_1.createRemoteJWKSet)(jwksUrl);
    }
    return jwks;
}
/**
 * Verifies a Clerk JWT token sent in the Authorization header.
 * The token signature MUST be verified against the Clerk instance JWKS.
 * Unsigned/forged tokens are always rejected so a client can never
 * impersonate another user.
 */
async function verifyClerkToken(token) {
    if (!token) {
        throw new Error('Authorization token is missing.');
    }
    try {
        const keySet = getJwks();
        const { payload } = await (0, jose_1.jwtVerify)(token, keySet);
        const clerkUserId = payload.sub;
        if (!clerkUserId) {
            throw new Error('Missing sub (clerkUserId) in token claims.');
        }
        return {
            clerkUserId,
            email: payload.email || payload.email_address,
            claims: payload,
        };
    }
    catch (err) {
        throw new Error(`Token verification failed: ${err.message}`);
    }
}
