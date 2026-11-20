// Seeds a LOCAL database with a realistic analytics load for the admin pages:
// ~10,000 maps in invite trees (shares and thank-yous), thank-links, vouches and
// ~100,000 events, spread over 90 days. Deterministic (fixed seed). Fake first
// names only; no friend names anywhere (the server never has them). Then it
// times each admin loader.
//   DATABASE_URL=postgresql://warmmap@127.0.0.1:55433/warmmap_perf \
//   node --import ./tests/register.mjs scripts/seed-analytics.ts [maps=10000] [events=100000]
import { PrismaClient, type Prisma } from "@prisma/client";
import { loadCreators, loadCreatorsCsv, loadCreatorsPage, loadTimeline, loadVirality } from "@/lib/growth-load";
import { loadDashboard } from "@/lib/dashboard";
import { parseCreatorQuery } from "@/lib/growth";

const url = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error("seed-analytics only runs against a local DATABASE_URL");
const MAPS = Number(process.argv[2] ?? 10_000);
const EVENTS = Number(process.argv[3] ?? 100_000);
const db = new PrismaClient();
const DAY = 86_400_000;

let s = 42;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];

const NAMES = ["Ananya", "Arjun", "Meera", "Kabir", "Zoya", "Ravi", "Diya", "Ishaan", "Priya", "Rohan", "Sara", "Vikram", "Nisha", "Aditya", "Leela", "Sam", "Maya", "Dev"];
const CITIES = ["Bengaluru", "Kochi", "Mumbai", "Delhi", "Pune", "Chennai", "Hyderabad", "Kolkata", "London", "Singapore", "Dubai", "New York"];
const KINDS = ["hearth", "bridge", "voyager", "constellation", "lantern-keeper"];
const CH = ["whatsapp", "whatsapp", "whatsapp", "linkedin", "copy", "story", "native"];
const TAGS = ["wa", "wa", "wa", "li", "cp", "st"];

async function main() {
  const now = Date.now();
  const start = now - 90 * DAY;
  const t0 = Date.now();
  // Maps in creation order; ~35% are invited by an earlier map.
  const maps: Prisma.MapCreateManyInput[] = [];
  for (let i = 0; i < MAPS; i++) {
    const created = start + (i / MAPS) * 90 * DAY + Math.floor(rnd() * 3_600_000);
    const invited = i > 20 && rnd() < 0.35;
    const via = invited ? (rnd() < 0.7 ? "map" : "thanks") : rnd() < 0.05 ? "seed" : "cold";
    const n = 5 + Math.floor(rnd() * 8);
    const entries = Array.from({ length: n }, (_, q) => ({ city: pick(CITIES), questionIndex: q }));
    // Bias parents toward recent maps (spread happens soon after making a map).
    const parent = invited ? maps[Math.max(0, i - 1 - Math.floor(rnd() ** 2 * Math.min(i, 2000)))].id! : null;
    maps.push({
      id: `perf${i.toString().padStart(6, "0")}`, homeCity: pick(CITIES), ownerName: pick(NAMES), entries,
      kind: pick(KINDS), km: Math.floor(rnd() * 20_000), arrivedVia: via, invitedByMapId: parent,
      createdAt: new Date(via === "thanks" ? new Date(created).toISOString().slice(0, 10) + "T00:00:00.000Z" : created),
    });
  }
  for (let i = 0; i < maps.length; i += 2000) await db.map.createMany({ data: maps.slice(i, i + 2000) });

  const links: Prisma.ThankLinkCreateManyInput[] = [];
  const vouches: Prisma.VouchCreateManyInput[] = [];
  for (const m of maps) {
    const k = Math.floor(rnd() ** 2 * 6);
    for (let q = 0; q < k; q++) {
      const at = (m.createdAt as Date).getTime() + Math.floor(rnd() * 5 * DAY);
      const id = `${m.id}l${q}`;
      const used = rnd() < 0.45;
      links.push({ id, tokenHash: `perf-${id}`, mapId: m.id!, entryIndex: q, createdAt: new Date(at), expiresAt: new Date(at + 30 * DAY), usedAt: used ? new Date(at + 3_600_000) : null });
      if (used) vouches.push({ mapId: m.id!, entryIndex: q, thankLinkId: id, tier: "tap", createdAt: new Date(at + 3_600_000) });
    }
  }
  for (let i = 0; i < links.length; i += 5000) await db.thankLink.createMany({ data: links.slice(i, i + 5000) });
  for (let i = 0; i < vouches.length; i += 5000) await db.vouch.createMany({ data: vouches.slice(i, i + 5000) });

  const events: Prisma.AnalyticsEventCreateManyInput[] = [];
  for (let i = 0; i < EVENTS; i++) {
    const m = maps[Math.floor(rnd() * maps.length)];
    const at = new Date(start + rnd() * 90 * DAY);
    const r = rnd();
    if (r < 0.2) events.push({ event: "share", mapId: rnd() < 0.5 ? m.id : null, metadata: { channel: pick(CH) }, createdAt: at });
    else if (r < 0.5) events.push({ event: "map_view", mapId: m.id, metadata: rnd() < 0.6 ? { s: pick(TAGS) } : {}, createdAt: at });
    else if (r < 0.58) events.push({ event: "t_open", metadata: { via: "thanks", ...(rnd() < 0.5 ? { s: pick(TAGS) } : {}) }, createdAt: at });
    else if (r < 0.65) events.push({ event: "make_yours", metadata: { via: rnd() < 0.7 ? "map" : "thanks", ...(rnd() < 0.5 ? { s: pick(TAGS) } : {}) }, createdAt: at });
    else events.push({ event: pick(["page_view", "start", "lantern", "reveal", "map_saved"]), metadata: { n: Math.floor(rnd() * 12) }, createdAt: at });
  }
  for (let i = 0; i < events.length; i += 10_000) await db.analyticsEvent.createMany({ data: events.slice(i, i + 10_000) });
  await db.$executeRawUnsafe(`ANALYZE`);
  console.log(`seeded ${maps.length} maps, ${links.length} thank-links, ${vouches.length} vouches, ${events.length} events in ${Date.now() - t0} ms`);

  const time = async (label: string, f: () => Promise<unknown>) => {
    await f(); // warm-up
    const runs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const a = performance.now();
      await f();
      runs.push(performance.now() - a);
    }
    console.log(`${label.padEnd(34)} median ${Math.round(runs.sort((x, y) => x - y)[1])} ms`);
  };
  await time("overview (loadDashboard)", () => loadDashboard(db));
  await time("creators page (search + sort)", () => loadCreators(db, parseCreatorQuery(new URLSearchParams("q=ko&sort=warmth"))));
  await time("creators page 100 (default sort)", () => loadCreators(db, parseCreatorQuery(new URLSearchParams("page=100"))));
  await time("ranking (top 100)", () => loadCreatorsPage(db, { q: "", sort: "warmth", dir: "desc" }, { limit: 100, offset: 0, warmOnly: true }));
  await time("creators CSV (all rows)", () => loadCreatorsCsv(db, parseCreatorQuery(new URLSearchParams(""))));
  await time("virality (all time)", () => loadVirality(db));
  await time("virality (last 7 days)", () => loadVirality(db, "d7"));
  await time("timeline (a root map)", () => loadTimeline(db, maps[0].id!));
}

main().finally(() => db.$disconnect());
