import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCode, hashEmail } from "@/lib/ids";
import { sendVouchCode } from "@/lib/email";
import { trackEvent } from "@/lib/analytics";
import { z } from "zod";

const requestSchema = z.object({
  mapId: z.string().min(1),
  entryIndex: z.number().int().min(0),
  email: z.string().email().max(200),
});

const confirmSchema = z.object({
  mapId: z.string().min(1),
  entryIndex: z.number().int().min(0),
  email: z.string().email().max(200),
  code: z.string().length(6),
  name: z.string().max(24).optional(),
  note: z.string().max(280).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "request") {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { mapId, entryIndex, email } = parsed.data;

    const map = await prisma.map.findFirst({
      where: { OR: [{ shortSlug: mapId }, { publicId: mapId }], deletedAt: null },
    });
    if (!map) {
      return NextResponse.json({ error: "Map not found" }, { status: 404 });
    }

    let entries: { city: string; questionIndex: number }[] = [];
    if (Array.isArray(map.entries)) {
      entries = map.entries as { city: string; questionIndex: number }[];
    } else if (typeof map.entries === "string") {
      try {
        entries = JSON.parse(map.entries || "[]");
      } catch {
        return NextResponse.json({ error: "Invalid map data" }, { status: 500 });
      }
    }
    if (!entries[entryIndex]) {
      return NextResponse.json({ error: "Invalid entry" }, { status: 400 });
    }

    // Rate limit: max 3 codes per email per hour.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCodes = await prisma.emailVerification.count({
      where: {
        email,
        purpose: "vouch",
        createdAt: { gt: oneHourAgo },
      },
    });
    if (recentCodes >= 3) {
      return NextResponse.json(
        { error: "Too many codes sent. Try again in an hour." },
        { status: 429 }
      );
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.emailVerification.create({
      data: {
        email,
        code,
        purpose: "vouch",
        mapId: map.id,
        expiresAt,
      },
    });

    const mapUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://warmmap.world"}/m/${map.shortSlug}`;
    await sendVouchCode(email, code, mapUrl);

    return NextResponse.json({ ok: true });
  }

  if (action === "confirm") {
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { mapId, entryIndex, email, code, name, note } = parsed.data;

    const map = await prisma.map.findFirst({
      where: { OR: [{ shortSlug: mapId }, { publicId: mapId }], deletedAt: null },
    });
    if (!map) {
      return NextResponse.json({ error: "Map not found" }, { status: 404 });
    }

    // Find the most recent unused code for this email/map.
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email,
        purpose: "vouch",
        mapId: map.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verification || verification.code !== code) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 400 }
      );
    }

    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });

    // Upsert vouch: one verified vouch per email per map entry.
    const existing = await prisma.vouch.findFirst({
      where: {
        mapId: map.id,
        entryIndex,
        voucherEmailHash: hashEmail(email),
        status: "verified",
      },
    });

    if (!existing) {
      await prisma.vouch.create({
        data: {
          mapId: map.id,
          entryIndex,
          voucherEmailHash: hashEmail(email),
          voucherName: name || null,
          note: note || null,
          status: "verified",
          verifiedAt: new Date(),
        },
      });
    }

    await trackEvent("vouch", map.id, { entryIndex });

    return NextResponse.json({ ok: true, mapId: map.shortSlug });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
