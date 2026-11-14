// GET /api/maps/[id]/owner: the owner's view (keeper key). Answers with
// questions, and which lanterns are gold. Only here is gold ever returned.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { noStore, requireOwner } from "@/lib/owner";
import { limitRequest, HOUR } from "@/lib/limits";
import { parseEntries } from "@/lib/entries";
import { questionFor } from "@/lib/questions";
import { toPublicMap } from "@/lib/public-map";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const limited = await limitRequest(req, "map_owner", { device: [120, HOUR], ip: [600, HOUR] });
  if (limited) return limited;
  const { id } = await params;
  const owned = await requireOwner(req, id);
  if (owned.error) return owned.error;
  const map = owned.map;
  const entries = parseEntries(map.entries);
  const vouches = await prisma.vouch.findMany({
    where: { mapId: map.id },
    select: { entryIndex: true, seenByOwnerAt: true },
    orderBy: { createdAt: "asc" },
  });
  // Set 2: a lantern's index is its question. Set 1 (legacy): array position.
  const cityFor = (i: number) =>
    map.questionSet === 1
      ? entries[i]?.city
      : entries.find((e) => "questionIndex" in e && e.questionIndex === i)?.city;
  const gold = vouches
    .map((v) => ({ entryIndex: v.entryIndex, city: cityFor(v.entryIndex) ?? null, isNew: !v.seenByOwnerAt }))
    .filter((g) => g.city);
  return NextResponse.json(
    {
      ...toPublicMap(map),
      questionSet: map.questionSet,
      answers: entries.map((e) =>
        "questionIndex" in e
          ? { city: e.city, questionIndex: e.questionIndex, question: questionFor(map.questionSet, e.questionIndex) }
          : { city: e.city, carried: true }
      ),
      gold,
    },
    { headers: noStore }
  );
}
