import type { NextRequest } from "next/server";
import { hmacHex, safeEqualHex, sha256Hex } from "./server-crypto";

/** Admin is a bearer token from ADMIN_TOKEN (24+ chars). Unset means the admin API does not exist. */
export function adminAllowed(req: NextRequest): boolean | "disabled" {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.length < 16) return "disabled";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return !!got && safeEqualHex(sha256Hex(got), sha256Hex(token));
}

export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // no spreadsheet formulas
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Browser sign-in for /admin/dashboard: the token is posted once in a form body
// (never a URL), and exchanged for a signed, expiring, HttpOnly cookie that
// holds no secret: "<expiry ms>.<HMAC keyed by ADMIN_TOKEN>". Admin only, strictly necessary.
export const ADMIN_COOKIE = "wm_admin";
export const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

export function adminTokenSet(): string | null {
  const t = process.env.ADMIN_TOKEN;
  return t && t.length >= 16 ? t : null;
}

export function tokenMatches(got: string): boolean {
  const t = adminTokenSet();
  return !!t && !!got && safeEqualHex(sha256Hex(got), sha256Hex(t));
}

export function makeAdminSession(now = Date.now()): string | null {
  const t = adminTokenSet();
  if (!t) return null;
  const exp = String(now + ADMIN_SESSION_MS);
  return `${exp}.${hmacHex(t, `wm-admin-session:${exp}`)}`;
}

export function sessionValid(cookie: string | undefined, now = Date.now()): boolean {
  const t = adminTokenSet();
  const m = /^(\d{10,15})\.([0-9a-f]{64})$/.exec(cookie ?? "");
  if (!t || !m || Number(m[1]) <= now) return false;
  return safeEqualHex(m[2], hmacHex(t, `wm-admin-session:${m[1]}`));
}

/** Bearer header or a valid session cookie. "disabled" when ADMIN_TOKEN is unset. */
export function adminAuth(req: NextRequest): boolean | "disabled" {
  if (!adminTokenSet()) return "disabled";
  return adminAllowed(req) === true || sessionValid(req.cookies.get(ADMIN_COOKIE)?.value);
}
