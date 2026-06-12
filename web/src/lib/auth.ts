// src/lib/auth.ts
//
// WHY localStorage FOR THE TOKEN?
// The spec asked for localStorage. The tradeoff vs httpOnly cookies:
//   - localStorage is readable by JS, so it's vulnerable to XSS.
//   - httpOnly cookies are not readable by JS, protecting against XSS,
//     but require more server-side coordination (Set-Cookie header, CSRF).
// For a take-home assignment localStorage is fine and simpler to explain.
// In a production product, httpOnly cookies would be the better choice.
//
// WHY THESE FOUR HELPERS?
// Centralizing token access means every part of the app reads/writes through
// the same functions. If we ever change storage (e.g. to sessionStorage or
// cookies), we only update this file.

const TOKEN_KEY = "auth_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Returns true if a token is present.
 * NOTE: This is a cheap "is there a token?" check — it does NOT verify the
 * token's signature or expiry. Actual verification happens on the server when
 * the token is sent to /api/auth/me. This is intentional: we avoid parsing
 * JWTs on the client because it can give a false sense of security.
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}
