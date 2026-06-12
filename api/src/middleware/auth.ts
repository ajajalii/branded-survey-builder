// src/middleware/auth.ts
//
// WHY MIDDLEWARE VS INLINE VERIFICATION?
// Extracting JWT verification into middleware means protected routes don't
// repeat the same token-reading logic. Middleware also makes it trivial to add
// more protected routes later — just apply `authMiddleware` to any route group.
//
// HOW HONO MIDDLEWARE WORKS:
// Middleware receives the same `c` (Context) object as route handlers.
// Calling `await next()` hands control to the next handler in the chain.
// We attach the verified user data to `c.set(...)` so downstream handlers
// can read it with `c.get(...)` without re-parsing the token.

import type { MiddlewareHandler } from "hono";
import { verifyToken } from "../lib/jwt";
import type { Env } from "../types";

export const authMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Strip the "Bearer " prefix to get the raw token.
  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);

    // Attach to context so protected route handlers can access user identity
    // without touching the token again.
    c.set("userId", payload.sub);
    c.set("userEmail", payload.email);
  } catch {
    // verifyToken throws for expired tokens, bad signatures, malformed JWTs, etc.
    // We map all of these to 401 — we don't leak which check failed.
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};
