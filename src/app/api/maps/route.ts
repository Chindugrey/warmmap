// POST /api/maps: "Show me". Saves the map and returns the keeper key once.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortSlug } from "@/lib/ids";
import { trackEvent } from "@/lib/analytics";
import { parseSaveInput } from "@/lib/map-input";
import { mapShape, pinCarried } from "@/lib/map-shape";
import { limitRequest, HOUR } from "@/lib/limits";
import { findMap, noStore } from "@/lib/owner";
import { newOwnerKey, sha256Hex } from "@/lib/server-crypto";
import { mapUrl } from "@/lib/site";
import { CURRENT_SET } from "@/lib/questions";

export async function POST(req: NextRequest) {
  const limited = await limitRequest(req, "map_create", { device: [5, HOUR], ip: [40, HOUR] });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseSaveInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.value;

  const inviter = input.invitedBy ? await findMap(input.invitedBy) : null;
  const entries = pinCarried(input.entries, inviter?.homeCity ?? null);
  const shape = mapShape(input.homeCity, entries, input.repeatMax);

  let shortSlug = generateShortSlug();
  for (let i = 0; i < 5 && (await prisma.map.findUnique({ where: { shortSlug } })); i++) {
    shortSlug = generateShortSlug();
  }

  // A map started from a thank-you keeps only the date, not the time, so it
  // cannot be lined up with the moment a lantern was tied.
  const now = new Date();
  const stamp = input.via === "thanks" ? new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z") : now;

  const ownerKey = newOwnerKey();
  const map = await prisma.map.create({
    data: {
      shortSlug,
      homeCity: input.homeCity,
      ownerName: input.ownerName,
      entries,
      questionSet: CURRENT_SET,
      ownerKeyHash: sha256Hex(ownerKey),
      kind: shape.kind,
      km: shape.km,
      invitedByMapId: inviter?.id ?? null,
      arrivedVia: input.via,
      createdAt: stamp,
      updatedAt: stamp,
    },
  });

  await trackEvent("map_saved", null, { via: input.via, n: entries.length });

  return NextResponse.json(
    {
      id: map.shortSlug,
      url: mapUrl(map.shortSlug!),
      ownerKey,
      keeperUrl: `${mapUrl(map.shortSlug!)}#k=${ownerKey}`,
      kind: shape.kind,
      because: shape.because,
      km: shape.km,
    },
    { status: 201, headers: noStore }
  );
}
