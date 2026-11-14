// Seeds a LOCAL database with a walk-through map and prints the URLs to open.
//   DATABASE_URL=postgresql://warmmap@127.0.0.1:55432/warmmap \
//   node --import ./tests/register.mjs scripts/seed-local.ts [http://localhost:3100]
import { PrismaClient } from "@prisma/client";
import { newOwnerKey, sha256Hex } from "@/lib/server-crypto";
import { makeLanternToken } from "@/lib/lantern-token";
import { mapShape } from "@/lib/map-shape";
import { generateShortSlug } from "@/lib/ids";
import type { StoredEntry } from "@/lib/entries";

const url = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error("seed-local only runs against a local DATABASE_URL");
const BASE = (process.argv[2] ?? "http://localhost:3100").replace(/\/+$/, "");
const db = new PrismaClient();
const DAY = 86_400_000;

async function main() {
  const entries: StoredEntry[] = [
    { city: "Kochi", questionIndex: 0 },
    { city: "Mysuru", questionIndex: 1 },
    { city: "Chennai", questionIndex: 2 },
    { city: "Bengaluru", questionIndex: 3 },
    { city: "Pune", questionIndex: 4 },
    { city: "Toronto", questionIndex: 11 },
  ];
  const key = newOwnerKey();
  const shape = mapShape("Bengaluru", entries, 1);
  const map = await db.map.create({
    data: {
      shortSlug: generateShortSlug(), homeCity: "Bengaluru", ownerName: "Ananya", entries,
      ownerKeyHash: sha256Hex(key), kind: shape.kind, km: shape.km, arrivedVia: "seed",
    },
  });
  // Kochi (2am) has already answered: the owner sees "Kochi answered."
  const tied = makeLanternToken();
  const link = await db.thankLink.create({
    data: { tokenHash: sha256Hex(tied), mapId: map.id, entryIndex: 0, expiresAt: new Date(Date.now() + 30 * DAY), usedAt: new Date() },
  });
  await db.vouch.create({ data: { mapId: map.id, entryIndex: 0, thankLinkId: link.id, tier: "tap" } });
  // Mysuru ("knew you before you were anyone") is waiting: a fresh friend link.
  const fresh = makeLanternToken();
  await db.thankLink.create({
    data: { tokenHash: sha256Hex(fresh), mapId: map.id, entryIndex: 1, expiresAt: new Date(Date.now() + 30 * DAY) },
  });
  const legacy = await db.map.findFirst({ where: { questionSet: 1 } });
  const slug = map.shortSlug!;
  console.log(`
Walk-through map: Ananya, home Bengaluru, ${entries.length} lanterns, kind ${shape.kind}

  Owner (keeper link, shows gold):   ${BASE}/m/${slug}#k=${key}
  Public view (open in a private window): ${BASE}/m/${slug}
  Friend link (Tie it back):         ${BASE}/t/${fresh}#Meera
  Already-answered friend link:      ${BASE}/t/${tied}
  Make a new map:                    ${BASE}/
  Live counter:                      ${BASE}/api/counter
  Admin connector score:             curl -H "Authorization: Bearer $ADMIN_TOKEN" ${BASE}/api/admin/connectors
${legacy ? `  Old (pre-v2) map, migrated:       ${BASE}/m/${legacy.shortSlug ?? legacy.publicId}\n` : ""}`);
}

main().finally(() => db.$disconnect());
