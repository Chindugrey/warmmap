// Fixed-window counters in Postgres (no new infrastructure). Keys are HMACs,
// never raw IPs or device marks.
import { prisma } from "./prisma";
import { windowStart } from "./rate-limit-window";

export const HOUR = 60 * 60 * 1000;

/** Counts one hit; returns true while the key is within its limit. */
export async function hit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const ws = windowStart(Date.now(), windowMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${ws}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"`;
  if (Math.random() < 0.02) {
    // Old windows are useless; dropping them also drops the device hashes they hold.
    prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 24 * HOUR) } } }).catch(() => {});
  }
  return Number(rows[0]?.count ?? 0) <= limit;
}
