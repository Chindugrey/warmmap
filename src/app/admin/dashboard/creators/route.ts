// /admin/dashboard/creators[?q=&sort=&dir=&page=&format=json|csv]: the creators list.
// Owner first name, home city, dates and counts. Admin only (same gate as the overview).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { csvCell } from "@/lib/admin";
import { ADMIN_HEADERS, adminGate, adminHtml, adminJson } from "@/lib/admin-route";
import { CREATOR_CSV_COLUMNS, parseCreatorQuery, queryCreators } from "@/lib/growth";
import { loadCreators } from "@/lib/growth-load";
import { renderCreators } from "@/lib/growth-html";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const cq = parseCreatorQuery(sp);
  const all = await loadCreators(prisma);
  const format = sp.get("format");
  if (format === "csv") {
    const { rows } = queryCreators(all, cq, false);
    const csv = [CREATOR_CSV_COLUMNS.map(([h]) => h).join(","), ...rows.map((r) => CREATOR_CSV_COLUMNS.map(([, f]) => csvCell(f(r))).join(","))].join("\n") + "\n";
    return new NextResponse(csv, {
      headers: { ...ADMIN_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="warmmap-creators.csv"' },
    });
  }
  const res = queryCreators(all, cq);
  if (format === "json") return adminJson({ ...res, page: Math.min(cq.page, res.pages), perPage: cq.perPage, sort: cq.sort, dir: cq.dir, q: cq.q });
  return adminHtml(renderCreators(res, cq), 200);
}
