// GET /api/admin/connectors[?format=csv]: the founder's list, sorted by
// connector score = distinct vouchers + maps brought in + cities.
// No e-mail exists in launch, so this is maps, not people.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAllowed, csvCell } from "@/lib/admin";
import { connectorScore } from "@/lib/connector";
import { parseEntries } from "@/lib/entries";
import { mapStats } from "@/lib/geo";
import { computeKind } from "@/lib/kinds";
import { noStore } from "@/lib/owner";
import { DISPLAYABLE_VOUCH } from "@/lib/vouches";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const allowed = adminAllowed(req);
  if (allowed === "disabled") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });

  const maps = await prisma.map.findMany({
    select: {
      id: true, shortSlug: true, publicId: true, ownerName: true, homeCity: true, entries: true,
      questionSet: true, kind: true, km: true, arrivedVia: true, createdAt: true,
      _count: { select: { thankLinks: true, invited: true } },
      vouches: { where: DISPLAYABLE_VOUCH, select: { id: true, deviceHash: true } },
    },
  });

  const rows = maps.map((m) => {
    const entries = parseEntries(m.entries);
    const s = mapStats(entries.map((e) => ({ city: e.city })), m.homeCity);
    // Distinct people: device hashes are per map, so they compare within a map.
    // Vouches with no device mark count once each.
    const distinctVouchers = new Set(m.vouches.map((v) => v.deviceHash ?? v.id)).size;
    const kind = m.kind ?? computeKind({ homeCity: m.homeCity, lanterns: entries }).kind;
    return {
      map: m.shortSlug ?? m.publicId,
      ownerName: m.ownerName,
      homeCity: m.homeCity,
      arrivedVia: m.arrivedVia,
      created: m.createdAt.toISOString().slice(0, 10),
      questionSet: m.questionSet,
      lanterns: entries.length,
      cities: s.cities,
      countries: s.countries,
      km: m.km ?? s.km,
      kind,
      thankYousSent: m._count.thankLinks,
      vouchesReceived: m.vouches.length,
      distinctVouchers,
      mapsBroughtIn: m._count.invited,
      score: connectorScore({ distinctVouchers, mapsBroughtIn: m._count.invited, cities: s.cities }),
    };
  });
  rows.sort((a, b) => b.score - a.score || b.vouchesReceived - a.vouchesReceived || a.map.localeCompare(b.map));

  if (req.nextUrl.searchParams.get("format") === "csv") {
    const cols = Object.keys(rows[0] ?? { map: "" }) as (keyof (typeof rows)[number])[];
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";
    return new NextResponse(csv, {
      headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="warmmap-connectors.csv"' },
    });
  }
  return NextResponse.json({ count: rows.length, rows }, { headers: noStore });
}
