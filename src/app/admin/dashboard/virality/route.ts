// /admin/dashboard/virality[?w=all|d30|d7&format=json]: viral factor, cohorts, generations, trees, channel funnel. No names.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminGate, adminHtml, adminJson } from "@/lib/admin-route";
import { loadVirality, parseWindow } from "@/lib/growth-load";
import { renderVirality } from "@/lib/growth-html";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const v = await loadVirality(prisma, parseWindow(req.nextUrl.searchParams.get("w")));
  if (req.nextUrl.searchParams.get("format") === "json") return adminJson(v);
  return adminHtml(renderVirality(v), 200);
}
