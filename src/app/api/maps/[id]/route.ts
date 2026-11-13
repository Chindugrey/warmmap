import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const map = await prisma.map.findFirst({
    where: {
      deletedAt: null,
      OR: [{ shortSlug: id }, { publicId: id }],
    },
    include: {
      _count: { select: { vouches: { where: { status: "verified" } } } },
    },
  });

  if (!map) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  await trackEvent("play", map.id, { source: "public_page" });

  return NextResponse.json({
    id: map.id,
    publicId: map.publicId,
    shortSlug: map.shortSlug,
    homeCity: map.homeCity,
    ownerName: map.ownerName,
    entries: map.entries as any,
    vouchCount: map._count.vouches,
    createdAt: map.createdAt,
  });
}
