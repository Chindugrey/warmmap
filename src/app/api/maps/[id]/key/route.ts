// POST /api/maps/[id]/key: re-issue the keeper key (the old one stops working),
// for when a keeper link has leaked.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { noStore, requireOwner } from "@/lib/owner";
import { limitRequest, HOUR } from "@/lib/limits";
import { newOwnerKey, sha256Hex } from "@/lib/server-crypto";
import { mapUrl } from "@/lib/site";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const limited = await limitRequest(req, "map_key", { device: [10, HOUR], ip: [60, HOUR] });
  if (limited) return limited;
  const { id } = await params;
  const owned = await requireOwner(req, id);
  if (owned.error) return owned.error;
  const ownerKey = newOwnerKey();
  await prisma.map.update({ where: { id: owned.map.id }, data: { ownerKeyHash: sha256Hex(ownerKey) } });
  const slug = owned.map.shortSlug ?? owned.map.publicId;
  return NextResponse.json({ ownerKey, keeperUrl: `${mapUrl(slug)}#k=${ownerKey}` }, { headers: noStore });
}
