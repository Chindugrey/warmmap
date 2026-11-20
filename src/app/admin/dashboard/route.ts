// /admin/dashboard: the founder's numbers. Counts, cities and timestamps only;
// never a name. Unset ADMIN_TOKEN: 404. No sign-in: 401 and a token form, no data.
// Sign-in: POST the token in a form body; the answer sets one HttpOnly cookie
// (admin only, expires in 8 hours). A Bearer header works too (curl).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, ADMIN_SESSION_MS, adminAuth, makeAdminSession, tokenMatches } from "@/lib/admin";
import { loadDashboard } from "@/lib/dashboard";
import { renderDashboard, renderLogin } from "@/lib/dashboard-html";
import { ADMIN_HEADERS, adminGate, adminHtml, adminNotFound } from "@/lib/admin-route";
import { limitRequest, HOUR } from "@/lib/limits";

export const dynamic = "force-dynamic";

const headers = ADMIN_HEADERS;
const html = adminHtml;
const notFound = adminNotFound;

export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
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
