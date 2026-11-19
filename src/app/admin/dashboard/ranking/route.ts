// /admin/dashboard/ranking[?format=json]: creators ranked by warmth (see WARMTH_FORMULA).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminGate, adminHtml, adminJson } from "@/lib/admin-route";
import { WARMTH_FORMULA, WARMTH_WEIGHTS, queryCreators } from "@/lib/growth";
import { loadCreators } from "@/lib/growth-load";
import { renderRanking } from "@/lib/growth-html";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const all = (await loadCreators(prisma)).filter((r) => r.warmth > 0);
  const { rows } = queryCreators(all, { q: "", sort: "warmth", dir: "desc", page: 1, perPage: 100 });
  if (req.nextUrl.searchParams.get("format") === "json") return adminJson({ formula: WARMTH_FORMULA, weights: WARMTH_WEIGHTS, rows });
  return adminHtml(renderRanking(rows), 200);
}
