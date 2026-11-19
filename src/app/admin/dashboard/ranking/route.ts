// /admin/dashboard/ranking[?format=json]: creators ranked by warmth (see WARMTH_FORMULA).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminGate, adminHtml, adminJson } from "@/lib/admin-route";
import { WARMTH_FORMULA, WARMTH_WEIGHTS } from "@/lib/growth";
import { loadCreatorsPage } from "@/lib/growth-load";
import { renderRanking } from "@/lib/growth-html";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const { rows } = await loadCreatorsPage(prisma, { q: "", sort: "warmth", dir: "desc" }, { limit: 100, offset: 0, warmOnly: true });
  if (req.nextUrl.searchParams.get("format") === "json") return adminJson({ formula: WARMTH_FORMULA, weights: WARMTH_WEIGHTS, rows });
  return adminHtml(renderRanking(rows), 200);
}
