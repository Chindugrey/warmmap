import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const maps = await prisma.map.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    maps.map((m) => ({
      id: m.id,
      publicId: m.publicId,
      shortSlug: m.shortSlug,
      homeCity: m.homeCity,
      ownerName: m.ownerName,
      createdAt: m.createdAt,
      url: `/m/${m.shortSlug}`,
    }))
  );
}
