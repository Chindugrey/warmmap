// POST /api/thanks: the owner's phone registers a thank-you link it just made.
// Body { mapId, entryIndex, tokenHash }. We never see the token or the name.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import { noStore, requireOwner } from "@/lib/owner";
import { limitRequest, HOUR } from "@/lib/limits";
import { parseEntries } from "@/lib/entries";
import { numberWord, questionCountFor } from "@/lib/questions";

const THANK_LINK_DAYS = 30;
const DAY = 24 * HOUR;

export async function POST(req: NextRequest) {
  const limited = await limitRequest(req, "thanks", { device: [30, HOUR], ip: [120, HOUR] });
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  if (
    !b || typeof b !== "object" ||
    Object.keys(b).sort().join(",") !== "entryIndex,mapId,tokenHash" ||
    typeof b.mapId !== "string" ||
    typeof b.entryIndex !== "number" || !Number.isInteger(b.entryIndex) ||
    typeof b.tokenHash !== "string" || !/^[0-9a-f]{64}$/.test(b.tokenHash)
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const owned = await requireOwner(req, b.mapId);
  if (owned.error) return owned.error;
  const map = owned.map;
  if (map.questionSet < 2) {
    return NextResponse.json({ error: "Older maps can't send thank-yous. Make a new one." }, { status: 409 });
  }
  const answered = parseEntries(map.entries).some((e) => "questionIndex" in e && e.questionIndex === b.entryIndex);
  if (!answered) return NextResponse.json({ error: "No lantern for that question" }, { status: 400 });

  const already = await prisma.vouch.findUnique({ where: { mapId_entryIndex: { mapId: map.id, entryIndex: b.entryIndex } } });
  if (already) return NextResponse.json({ error: "That lantern has already answered back." }, { status: 409 });

  // The same link posted again (a reload, a second device that kept the link): if it is this map + lantern and still
  // unopened and unexpired, it is the link already counted. Nothing new is made and the cap is not touched. Any other
  // hash match (another lantern or map, opened, expired) falls through to the same 409 as before.
  const known = await prisma.thankLink.findUnique({ where: { tokenHash: b.tokenHash } });
  if (known && known.mapId === map.id && known.entryIndex === b.entryIndex && !known.usedAt && known.expiresAt.getTime() > Date.now()) {
    return NextResponse.json({ ok: true, reused: true, expiresAt: known.expiresAt }, { headers: noStore });
  }

  const recent = await prisma.thankLink.count({
    where: { mapId: map.id, createdAt: { gt: new Date(Date.now() - 30 * DAY) } },
  });
  const perMonth = questionCountFor(map.questionSet); // one per question (Aadarsh, 14 Nov)
  if (recent >= perMonth) {
    return NextResponse.json({ error: `That's ${numberWord(perMonth)} thank-yous this month. More next month.` }, { status: 429 });
  }

  const expiresAt = new Date(Date.now() + THANK_LINK_DAYS * DAY);
  try {
    await prisma.thankLink.create({ data: { tokenHash: b.tokenHash, mapId: map.id, entryIndex: b.entryIndex, expiresAt } });
  } catch {
    return NextResponse.json({ error: "Make a fresh link and try again." }, { status: 409 });
  }
  await trackEvent("thank_link_created");
  return NextResponse.json({ ok: true, expiresAt }, { status: 201, headers: noStore });
}
