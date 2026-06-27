
import { Hono } from "hono";
import { generateToken } from "../lib/jwt";
import { authMiddleware } from "../middleware/auth";
import type { Env, UserRow } from "../types";

const auth = new Hono<Env>();

// ─── POST /signup ──────────────────────────────────────────────────────────────

auth.post("/signup", async (c) => {
  // 1. Parse request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }


  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    !("password" in body) ||
    typeof (body as Record<string, unknown>).email !== "string" ||
    typeof (body as Record<string, unknown>).password !== "string"
  ) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const { email, password } = body as { email: string; password: string };

  // 3. Business-rule validation
  if (!email.includes("@")) {
    return c.json({ error: "Invalid email address" }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first();

  if (existing) {
    return c.json({ error: "Email already in use" }, 409);
  }

  const passwordHash = await hashPassword(password);

  // 6. Persist the user
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
    .bind(id, email.toLowerCase(), passwordHash)
    .run();

  return c.json({ message: "Account created. Please log in." }, 201);
});

// ─── POST /login ───────────────────────────────────────────────────────────────

auth.post("/login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    !("password" in body) ||
    typeof (body as Record<string, unknown>).email !== "string" ||
    typeof (body as Record<string, unknown>).password !== "string"
  ) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const { email, password } = body as { email: string; password: string };

  // Look up user by email
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first<UserRow>();


  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Issue a JWT
  const token = await generateToken({ sub: user.id, email: user.email }, c.env.JWT_SECRET);

  return c.json({ token });
});

// ─── GET /me ───────────────────────────────────────────────────────────────────
// Protected by authMiddleware — the token is already verified before this runs.

auth.get("/me", authMiddleware, (c) => {
  return c.json({
    id: c.get("userId"),
    email: c.get("userEmail"),
  });
});

// ─── Password helpers ──────────────────────────────────────────────────────────
//
// We keep these in this file rather than lib/ because they're only used here.
// If more routes needed password logic, we'd move them.

/**
 * Hashes a plaintext password using PBKDF2-SHA256.
 * Returns a colon-separated string: "<hex salt>:<hex hash>"
 * This self-contained format means we never need to store salt separately.
 */
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256 // output length in bits
  );

  const saltHex = bufToHex(salt);
  const hashHex = bufToHex(new Uint8Array(hashBuffer));
  return `${saltHex}:${hashHex}`;
}

/**
 * Verifies a plaintext password against a stored PBKDF2 hash string.
 * Re-derives the hash using the stored salt and compares with timingSafeEqual.
 *
 * WHY timingSafeEqual?
 * A naive string comparison (`===`) short-circuits on the first differing byte.
 * An attacker can measure the response time to guess how many bytes of the hash
 * matched. timingSafeEqual always compares the full buffer, eliminating the
 * timing side-channel.
 */
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, expectedHashHex] = stored.split(":");
  if (!saltHex || !expectedHashHex) return false;

  const salt = hexToBuf(saltHex);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const actualHashHex = bufToHex(new Uint8Array(hashBuffer));

  // Constant-time comparison
  return timingSafeEqual(actualHashHex, expectedHashHex);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    // XOR will be non-zero for any differing character
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): Uint8Array {
  const pairs = hex.match(/.{2}/g) ?? [];
  return new Uint8Array(pairs.map((byte) => Number.parseInt(byte, 16)));
}

export default auth;
