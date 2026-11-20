// /admin/dashboard/map/[id][?format=json]: one map's timeline (internal id, short slug or public id). No names.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminGate, adminHtml, adminJson, adminNotFound } from "@/lib/admin-route";
import { loadTimeline } from "@/lib/growth-load";
import { renderTimeline } from "@/lib/growth-html";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = adminGate(req);
  if (denied) return denied;
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(id)) return adminNotFound();
  const t = await loadTimeline(prisma, id);
  if (!t) return adminNotFound();
  if (req.nextUrl.searchParams.get("format") === "json") return adminJson(t);
  return adminHtml(renderTimeline(t.id, t), 200);
}
