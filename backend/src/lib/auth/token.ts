import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthRole } from "@vaani/shared";

// A signed session token: base64url(payload) + "." + base64url(HMAC-SHA256).
// Nothing is stored server side, so any Lambda can check it with just the secret.
export interface TokenPayload {
  sub: string;
  role: AuthRole;
  name: string;
  // Expiry, seconds since the epoch.
  exp: number;
}

const MIN_SECRET_LENGTH = 32;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(`AUTH_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters`);
  }
  return value;
}

function sign(body: string): Buffer {
  return createHmac("sha256", secret()).update(body).digest();
}

export function signToken(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body).toString("base64url")}`;
}

// Returns the payload, or null for anything wrong with the token: malformed,
// tampered with, or expired. Callers treat null as "not signed in".
export function verifyToken(token: string, now: number = Date.now()): TokenPayload | null {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = sign(body);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    if (payload.role !== "tester" && payload.role !== "judge") return null;
    return payload.exp * 1000 > now ? payload : null;
  } catch {
    return null;
  }
}
