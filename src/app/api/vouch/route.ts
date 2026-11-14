// POST /api/vouch { token }: "Tie it back". One tap, no e-mail, no code.
// It is a POST from a tap, so link scanners and previews cannot vouch.
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import { limitRequest, HOUR, deviceHashFor, ipHash } from "@/lib/limits";
import { keyMatches, noStore } from "@/lib/owner";
import { lookupThankLink } from "@/lib/thank-link";
import { mapUrl } from "@/lib/site";

const MESSAGES = {
  missing: [404, "We couldn't find this lantern."],
  expired: [410, "This link has gone quiet."],
  used: [409, "This lantern has already been answered."],
  own: [409, "This is your own lantern. It's waiting for someone else."],
} as const;

const refuse = (k: keyof typeof MESSAGES) =>
  NextResponse.json({ error: MESSAGES[k][1], state: k }, { status: MESSAGES[k][0], headers: noStore });

export async function POST(req: NextRequest) {
  const limited = await limitRequest(req, "vouch", { device: [20, HOUR], ip: [120, HOUR] });
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = (body as { token?: unknown })?.token;
  if (typeof token !== "string") return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const found = await lookupThankLink(token);
  if (found.state !== "ok") return refuse(found.state);
  const { link, map, view } = found;
  if (keyMatches(map, req.headers.get("x-owner-key"))) return refuse("own");

  try {
    await prisma.$transaction(async (tx) => {
      const spent = await tx.thankLink.updateMany({
        where: { id: link.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (spent.count !== 1) throw new Error("used");
      await tx.vouch.create({
        data: {
          mapId: map.id,
          entryIndex: link.entryIndex,
          thankLinkId: link.id,
          tier: "tap",
          deviceHash: deviceHashFor(map.id, req),
          ipHash: ipHash(req),
        },
      });
    });
  } catch (e) {
    const unique = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
    if (unique || (e as Error).message === "used") return refuse("used");
    throw e;
  }

  await trackEvent("vouch_tap");
  return NextResponse.json(
    {
      ok: true,
      ownerName: view.ownerName,
      ownerHome: view.ownerHome,
      city: view.city,
      mapUrl: mapUrl(view.mapSlug),
      makeYoursUrl: `/?invitedBy=${view.mapSlug}&via=thanks`,
    },
    { headers: noStore }
  );
}
