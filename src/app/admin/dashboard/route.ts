// /admin/dashboard: the founder's numbers. Counts, cities and timestamps only;
// never a name. Unset ADMIN_TOKEN: 404. No sign-in: 401 and a token form, no data.
// Sign-in: POST the token in a form body; the answer sets one HttpOnly cookie
// (admin only, expires in 8 hours). A Bearer header works too (curl).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, ADMIN_SESSION_MS, adminAuth, makeAdminSession, tokenMatches } from "@/lib/admin";
import { loadDashboard } from "@/lib/dashboard";
import { renderDashboard, renderLogin } from "@/lib/dashboard-html";
import { limitRequest, HOUR } from "@/lib/limits";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
};
const html = (body: string, status: number, extra: Record<string, string> = {}) =>
  new NextResponse(body, { status, headers: { ...headers, "Content-Type": "text/html; charset=utf-8", ...extra } });
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404, headers });

export async function GET(req: NextRequest) {
  const auth = adminAuth(req);
  if (auth === "disabled") return notFound();
  if (!auth) {
    if (req.nextUrl.searchParams.get("format") === "json") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { ...headers, "WWW-Authenticate": "Bearer" } });
    }
    return html(renderLogin(false), 401);
  }
  const data = await loadDashboard(prisma);
  if (req.nextUrl.searchParams.get("format") === "json") return NextResponse.json(data, { headers });
  return html(renderDashboard(data), 200);
}

export async function POST(req: NextRequest) {
  if (adminAuth(req) === "disabled") return notFound();
  const limited = await limitRequest(req, "admin_login", { device: [10, HOUR], ip: [30, HOUR] });
  if (limited) return limited;
  let form: FormData | null = null;
  try {
    form = await req.formData();
  } catch {}
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const cookie = (v: string, maxAge: number) => `${ADMIN_COOKIE}=${v}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
  if (form?.get("logout")) {
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: "/admin/dashboard", "Set-Cookie": cookie("", 0) } });
  }
  const got = form?.get("token");
  const session = typeof got === "string" && tokenMatches(got) ? makeAdminSession() : null;
  if (!session) return html(renderLogin(true), 401);
  return new NextResponse(null, {
    status: 303,
    headers: { ...headers, Location: "/admin/dashboard", "Set-Cookie": cookie(session, ADMIN_SESSION_MS / 1000) },
  });
}
