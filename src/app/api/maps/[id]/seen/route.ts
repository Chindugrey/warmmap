// POST /api/maps/[id]/seen: the owner has seen the gold ("Kochi answered.").
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { noStore, requireOwner } from "@/lib/owner";
import { trackEvent } from "@/lib/analytics";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const owned = await requireOwner(req, id);
  if (owned.error) return owned.error;
  const r = await prisma.vouch.updateMany({
    where: { mapId: owned.map.id, seenByOwnerAt: null },
    data: { seenByOwnerAt: new Date() },
  });
  if (r.count > 0) await trackEvent("gold_seen", owned.map.id, { n: r.count });
  return NextResponse.json({ ok: true, seen: r.count }, { headers: noStore });
}
