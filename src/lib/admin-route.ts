// Shared by every /admin/dashboard page: the same headers and the same gate.
// Unset ADMIN_TOKEN: 404. No sign-in: 401 (JSON / CSV callers get JSON; a browser gets the token form).
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./admin";
import { renderLogin } from "./dashboard-html";

export const ADMIN_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
};

export const adminHtml = (body: string, status: number, extra: Record<string, string> = {}) =>
  new NextResponse(body, { status, headers: { ...ADMIN_HEADERS, "Content-Type": "text/html; charset=utf-8", ...extra } });
export const adminJson = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: ADMIN_HEADERS });
export const adminNotFound = () => NextResponse.json({ error: "Not found" }, { status: 404, headers: ADMIN_HEADERS });

/** null when signed in; otherwise the response to send (404 when admin is off, 401 otherwise). */
export function adminGate(req: NextRequest): NextResponse | null {
  const auth = adminAuth(req);
  if (auth === "disabled") return adminNotFound();
  if (auth) return null;
  const format = req.nextUrl.searchParams.get("format");
  if (format === "json" || format === "csv") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { ...ADMIN_HEADERS, "WWW-Authenticate": "Bearer" } });
  }
  return adminHtml(renderLogin(false), 401);
}
