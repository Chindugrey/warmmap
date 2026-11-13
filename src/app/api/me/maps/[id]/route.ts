import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const map = await prisma.map.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
  });

  if (!map) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.map.update({
    where: { id: map.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
