import type { NextRequest } from "next/server";
import { safeEqualHex, sha256Hex } from "./server-crypto";

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
