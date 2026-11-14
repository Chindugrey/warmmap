// Seeds a LOCAL database with the two walk-through maps Aadarsh asked to test
// with, and prints the URLs to open:
//   - Ananya: 5 lanterns, India only (Kochi has just answered: "Kochi answered.")
//   - Arjun: 12 lanterns across three countries (one gold, already seen)
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

async function seedMap(opts: { owner: string; home: string; cities: string[]; tied: { q: number; seen: boolean }[]; friend: { q: number; name: string } }) {
  const entries: StoredEntry[] = opts.cities.map((city, q) => ({ city, questionIndex: q }));
  const key = newOwnerKey();
  const shape = mapShape(opts.home, entries, 1);
  const map = await db.map.create({
    data: { shortSlug: generateShortSlug(), homeCity: opts.home, ownerName: opts.owner, entries, ownerKeyHash: sha256Hex(key), kind: shape.kind, km: shape.km, arrivedVia: "seed" },
  });
  let usedToken = "";
  for (const t of opts.tied) {
    usedToken = makeLanternToken();
    const link = await db.thankLink.create({
      data: { tokenHash: sha256Hex(usedToken), mapId: map.id, entryIndex: t.q, expiresAt: new Date(Date.now() + 30 * DAY), usedAt: new Date() },
    });
    await db.vouch.create({ data: { mapId: map.id, entryIndex: t.q, thankLinkId: link.id, tier: "tap", seenByOwnerAt: t.seen ? new Date() : null } });
  }
  const fresh = makeLanternToken();
  await db.thankLink.create({ data: { tokenHash: sha256Hex(fresh), mapId: map.id, entryIndex: opts.friend.q, expiresAt: new Date(Date.now() + 30 * DAY) } });
  const slug = map.shortSlug!;
  return { slug, key, kind: shape.kind, fresh, usedToken, friend: opts.friend, n: entries.length };
}

async function main() {
  const five = await seedMap({
    owner: "Ananya",
    home: "Bengaluru",
    cities: ["Kochi", "Bengaluru", "Chennai", "Hyderabad", "Mysuru"],
    tied: [{ q: 0, seen: false }],
    friend: { q: 4, name: "Rohan" },
  });
  const twelve = await seedMap({
    owner: "Arjun",
    home: "Bengaluru",
    cities: ["Kochi", "Bengaluru", "Pune", "Bengaluru", "Delhi", "Delhi", "Hyderabad", "Kolkata", "Bengaluru", "Delhi", "London", "Singapore"],
    tied: [{ q: 4, seen: true }],
    friend: { q: 10, name: "Sam" },
  });
  const legacy = await db.map.findFirst({ where: { questionSet: 1 } });
  for (const [label, m] of [["5 lanterns, India only", five], ["12 lanterns, three countries", twelve]] as const) {
    console.log(`
${label}: kind ${m.kind}
  Owner (keeper link):      ${BASE}/m/${m.slug}#k=${m.key}
  Public view (private window): ${BASE}/m/${m.slug}
  Friend link (Tie it back): ${BASE}/t/${m.fresh}#${m.friend.name}
  Already-answered link:     ${BASE}/t/${m.usedToken}`);
  }
  console.log(`
  Make a new map:            ${BASE}/
  Live counter:              ${BASE}/api/counter
  Admin connector score:     curl -H "Authorization: Bearer $ADMIN_TOKEN" ${BASE}/api/admin/connectors
${legacy ? `  Old (pre-v2) map:          ${BASE}/m/${legacy.shortSlug ?? legacy.publicId}\n` : ""}`);
}

main().finally(() => db.$disconnect());
