// Server-side lookup for /t/[token]. The token arrives in the path; only its
// hash is compared and stored.
import { prisma } from "./prisma";
import { isWellFormedToken, sha256Hex } from "./server-crypto";
import { parseEntries } from "./entries";
import { questionFor } from "./questions";

export type LinkState = "ok" | "used" | "expired" | "missing";

export async function lookupThankLink(token: string) {
  if (!isWellFormedToken(token)) return { state: "missing" as const };
  const link = await prisma.thankLink.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { map: true, vouch: { select: { id: true } } },
  });
  if (!link) return { state: "missing" as const };
  const map = link.map;
  const entry = parseEntries(map.entries).find((e) => "questionIndex" in e && e.questionIndex === link.entryIndex);
  const view = {
    mapSlug: map.shortSlug ?? map.publicId,
    ownerName: map.ownerName ?? "Someone",
    ownerHome: map.homeCity,
    city: entry?.city ?? null,
    question: questionFor(map.questionSet, link.entryIndex),
  };
  const tiedElsewhere = await prisma.vouch.findUnique({
    where: { mapId_entryIndex: { mapId: map.id, entryIndex: link.entryIndex } },
    select: { id: true },
  });
  let state: LinkState = "ok";
  if (link.usedAt || link.vouch || tiedElsewhere) state = "used";
  else if (link.expiresAt.getTime() <= Date.now()) state = "expired";
  else if (!entry || !view.question) state = "missing";
  return { state, link, map, view };
}
