// /admin/dashboard/creators[?q=&sort=&dir=&page=&format=json|csv]: the creators list.
// Owner first name, home city, dates and counts. Admin only (same gate as the overview).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { csvCell } from "@/lib/admin";
import { ADMIN_HEADERS, adminGate, adminHtml, adminJson } from "@/lib/admin-route";
import { CREATOR_CSV_COLUMNS, CSV_ROW_CAP, parseCreatorQuery } from "@/lib/growth";
import { loadCreators, loadCreatorsCsv } from "@/lib/growth-load";
import { renderCreators } from "@/lib/growth-html";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const cq = parseCreatorQuery(sp);
  const format = sp.get("format");
  if (format === "csv") {
    // At most CSV_ROW_CAP rows (the search narrows it); a cut is said in a header and a last line.
    const { rows, truncated } = await loadCreatorsCsv(prisma, cq);
    const lines = [CREATOR_CSV_COLUMNS.map(([h]) => h).join(","), ...rows.map((r) => CREATOR_CSV_COLUMNS.map(([, f]) => csvCell(f(r))).join(","))];
    if (truncated) lines.push(`# truncated at ${CSV_ROW_CAP} rows: narrow the search`);
    return new NextResponse(lines.join("\n") + "\n", {
      headers: {
        ...ADMIN_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="warmmap-creators.csv"',
        ...(truncated ? { "X-Rows-Truncated": String(CSV_ROW_CAP) } : {}),
      },
    });
  }
  const res = await loadCreators(prisma, cq);
  if (format === "json") return adminJson({ ...res, perPage: cq.perPage, sort: cq.sort, dir: cq.dir, q: cq.q });
  return adminHtml(renderCreators(res, cq), 200);
}
