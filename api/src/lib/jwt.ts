// src/lib/jwt.ts
//
// WHY JOSE?
// The Node.js `jsonwebtoken` package uses Node crypto APIs unavailable in the
// Cloudflare Workers runtime. `jose` is written against the Web Crypto API
// (SubtleCrypto), which Workers fully support. It's well-maintained and has
// zero dependencies.
//
// WHY HS256?
// Symmetric signing (HMAC-SHA256) is sufficient for this use case. Both signing
// and verification happen inside our own Workers — we never need to share the
// secret with a third party. Asymmetric keys (RS256/ES256) would add key-pair
// management complexity without benefit here.

import { SignJWT, jwtVerify } from "jose";

const ALGORITHM = "HS256";
const EXPIRY = "7d";

// Encode the raw string secret into a CryptoKey that jose expects.
// This is done once per call but is cheap — SubtleCrypto importKey is fast.
function secretToKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export type JwtPayload = {
  sub: string; // user id  (standard JWT "subject" claim)
  email: string; // user email (custom claim)
};

/**
 * Signs a new JWT for the given user.
 * Returns the compact serialized token string (three base64url parts joined by dots).
 */
export async function generateToken(payload: JwtPayload, secret: string): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.sub) // `sub` is the standard claim for the user's ID
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secretToKey(secret));
}

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws if the token is invalid, expired, or tampered with.
 * The caller (middleware) is responsible for catching the error.
 */
export async function verifyToken(token: string, secret: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secretToKey(secret), {
    algorithms: [ALGORITHM],
  });

  // `jwtVerify` validates structure and expiry, but we still need to assert
  // that our custom claims are present and of the right type.
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Invalid token payload");
  }

  return { sub: payload.sub, email: payload.email };
}
