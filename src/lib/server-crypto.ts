import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Lantern tokens are made on the phone: 12 base62 characters. Links made before
// 17 Nov 2026 carry 24 random bytes as base64url (32 chars); they keep working.
const TOKEN_RE = /^(?:[A-Za-z0-9]{12}|[A-Za-z0-9_-]{32})$/;

export function isWellFormedToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

// The owner key: shown once at "Show me", travels only in the keeper link's #.
export function newOwnerKey(): string {
  return randomBytes(32).toString("base64url");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export function dayStamp(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function serverSecret(): string {
  const s = process.env.WM_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("WM_SECRET (32+ chars) must be set in production");
  }
  return "dev-only-warmmap-secret-do-not-use-in-prod";
}
