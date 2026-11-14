// GET /api/counter: the live lantern count (landing page and after the reveal).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { counterPayload } from "@/lib/counter";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.$queryRaw<{ total: bigint | null }[]>`
    SELECT COALESCE(SUM(jsonb_array_length("entries")), 0)::bigint AS total
    FROM "Map" WHERE jsonb_typeof("entries") = 'array'`;
  return NextResponse.json(counterPayload(Number(rows[0]?.total ?? 0)), {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
