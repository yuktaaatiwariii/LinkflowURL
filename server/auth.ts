import { jwtVerify, createRemoteJWKSet } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

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
      } catch {
        // Fallback to default
      }
    }

    const jwksUrl = new URL(`${issuer}/.well-known/jwks.json`);
    jwks = createRemoteJWKSet(jwksUrl);
  }
  return jwks;
}

export interface VerifiedClerkAuth {
  clerkUserId: string;
  email?: string;
  claims: any;
}

/**
 * Verifies a Clerk JWT token sent in the Authorization header.
 * The token signature MUST be verified against the Clerk instance JWKS.
 * Unsigned/forged tokens are always rejected so a client can never
 * impersonate another user.
 */
export async function verifyClerkToken(token: string): Promise<VerifiedClerkAuth> {
  if (!token) {
    throw new Error('Authorization token is missing.');
  }

  try {
    const keySet = getJwks();
    const { payload } = await jwtVerify(token, keySet);
    const clerkUserId = payload.sub as string;
    if (!clerkUserId) {
      throw new Error('Missing sub (clerkUserId) in token claims.');
    }
    return {
      clerkUserId,
      email: (payload.email as string) || (payload as any).email_address,
      claims: payload,
    };
  } catch (err: any) {
    throw new Error(`Token verification failed: ${err.message}`);
  }
}

