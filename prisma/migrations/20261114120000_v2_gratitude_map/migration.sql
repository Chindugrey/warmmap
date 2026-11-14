-- Warm Map v2 (launch spec, 14 Nov 2026): keeper-key owners, thank-you links,
-- one-tap vouches, per-device limits. Removes e-mail verification.
-- Data steps are written by hand; DDL is from `prisma migrate diff`.

-- 1. Soft-deleted maps were meant to be gone: delete them for real, with their events.
DELETE FROM "AnalyticsEvent" WHERE "mapId" IN (SELECT "id" FROM "Map" WHERE "deletedAt" IS NOT NULL);
DELETE FROM "Map" WHERE "deletedAt" IS NOT NULL; -- vouches cascade

-- 2. Legacy entries saved as a JSON string become a JSON array.
UPDATE "Map" SET "entries" = ("entries" #>> '{}')::jsonb WHERE jsonb_typeof("entries") = 'string';
UPDATE "Map" SET "entries" = '[]'::jsonb WHERE jsonb_typeof("entries") <> 'array';

-- 3. Vouches: only e-mail-verified ones were ever real. Keep the earliest per
--    lantern (they show as gold), drop unconfirmed, out-of-range and duplicates.
DELETE FROM "Vouch" WHERE "status" <> 'verified';
DELETE FROM "Vouch" v USING "Map" m
  WHERE v."mapId" = m."id" AND (v."entryIndex" < 0 OR v."entryIndex" >= jsonb_array_length(m."entries"));
DELETE FROM "Vouch" v USING "Vouch" w
  WHERE v."mapId" = w."mapId" AND v."entryIndex" = w."entryIndex"
    AND (v."createdAt", v."id") > (w."createdAt", w."id");

-- DropForeignKey
ALTER TABLE "AnalyticsEvent" DROP CONSTRAINT "AnalyticsEvent_mapId_fkey";
ALTER TABLE "Vouch" DROP CONSTRAINT "Vouch_userId_fkey";

-- DropIndex
DROP INDEX "Map_publicId_idx";
DROP INDEX "Map_shortSlug_idx";
DROP INDEX "Vouch_mapId_status_idx";

-- AlterTable: existing maps are question set 1 (old wording); new ones default to 2.
ALTER TABLE "Map" DROP COLUMN "consent",
DROP COLUMN "deletedAt",
DROP COLUMN "ownerEmail",
DROP COLUMN "shareImageUrl",
ADD COLUMN     "arrivedVia" TEXT NOT NULL DEFAULT 'cold',
ADD COLUMN     "invitedByMapId" TEXT,
ADD COLUMN     "kind" TEXT,
ADD COLUMN     "km" INTEGER,
ADD COLUMN     "ownerKeyHash" TEXT,
ADD COLUMN     "questionSet" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Map" ALTER COLUMN "questionSet" SET DEFAULT 2;

-- AlterTable: names, notes and e-mail hashes on old vouches are dropped.
ALTER TABLE "Vouch" DROP COLUMN "note",
DROP COLUMN "status",
DROP COLUMN "userId",
DROP COLUMN "verifiedAt",
DROP COLUMN "voucherEmailHash",
DROP COLUMN "voucherName",
ADD COLUMN     "deviceHash" TEXT,
ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "seenByOwnerAt" TIMESTAMP(3),
ADD COLUMN     "thankLinkId" TEXT,
ADD COLUMN     "tier" TEXT NOT NULL DEFAULT 'tap';

-- DropTable: plain e-mails and codes are not kept.
DROP TABLE "EmailVerification";

-- CreateTable
CREATE TABLE "ThankLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "entryIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "ThankLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key","windowStart")
);

CREATE UNIQUE INDEX "ThankLink_tokenHash_key" ON "ThankLink"("tokenHash");
CREATE INDEX "ThankLink_mapId_createdAt_idx" ON "ThankLink"("mapId", "createdAt");
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");
CREATE INDEX "AnalyticsEvent_event_createdAt_idx" ON "AnalyticsEvent"("event", "createdAt");
CREATE INDEX "Map_invitedByMapId_idx" ON "Map"("invitedByMapId");
CREATE UNIQUE INDEX "Vouch_thankLinkId_key" ON "Vouch"("thankLinkId");
CREATE UNIQUE INDEX "Vouch_mapId_entryIndex_key" ON "Vouch"("mapId", "entryIndex");

ALTER TABLE "Map" ADD CONSTRAINT "Map_invitedByMapId_fkey" FOREIGN KEY ("invitedByMapId") REFERENCES "Map"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThankLink" ADD CONSTRAINT "ThankLink_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vouch" ADD CONSTRAINT "Vouch_thankLinkId_fkey" FOREIGN KEY ("thankLinkId") REFERENCES "ThankLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;
