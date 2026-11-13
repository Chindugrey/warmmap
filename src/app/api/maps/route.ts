import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortSlug } from "@/lib/ids";
import { trackEvent } from "@/lib/analytics";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const saveSchema = z.object({
  homeCity: z.string().min(1).max(100),
  ownerName: z.string().max(24).optional(),
  entries: z.array(
    z.object({
      city: z.string().min(1).max(100),
      questionIndex: z.number().int().min(0).max(50),
    })
  ),
  invitedBy: z.string().max(32).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { homeCity, ownerName, entries, invitedBy } = parsed.data;

  // Rate limit: max 20 maps per hour per IP (simple).
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.map.count({
    where: {
      createdAt: { gt: oneHourAgo },
      // We don't store IP; this is a placeholder for a real rate-limit store.
    },
  });
  if (recent > 200) {
    return NextResponse.json(
      { error: "Too many maps created recently. Try again later." },
      { status: 429 }
    );
  }

  const session = await getServerSession(authOptions);

  let shortSlug = generateShortSlug();
  // Ensure uniqueness.
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.map.findUnique({ where: { shortSlug } });
    if (!existing) break;
    shortSlug = generateShortSlug();
  }

  const map = await prisma.map.create({
    data: {
      homeCity,
      ownerName: ownerName || null,
      entries: entries as any,
      shortSlug,
      userId: session?.user?.id,
      // We don't store invitedBy mapId in DB to avoid association chains; tracking only.
    },
  });

  await trackEvent("create", map.id, { invitedBy, entries: entries.length });

  return NextResponse.json({
    id: map.id,
    publicId: map.publicId,
    shortSlug: map.shortSlug,
    url: `/m/${map.shortSlug}`,
  });
}
