// /admin/dashboard/launch[?from=ISO&to=ISO&format=json]: the launch targets over one window. No names.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminGate, adminHtml, adminJson } from "@/lib/admin-route";
import { parseLaunchWindow } from "@/lib/launch";
import { loadLaunch } from "@/lib/launch-load";
import { renderLaunch } from "@/lib/launch-html";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const now = new Date();
  const s = await loadLaunch(prisma, parseLaunchWindow(req.nextUrl.searchParams, now), now);
  if (req.nextUrl.searchParams.get("format") === "json") return adminJson(s);
  return adminHtml(renderLaunch(s), 200);
}
