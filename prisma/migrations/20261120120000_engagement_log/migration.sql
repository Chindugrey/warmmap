-- Phase 3 (analytics): the manual engagement log. ADDITIVE ONLY: one new table, its
-- indexes and one foreign key to "Map". No existing table or column is changed.
-- CreateTable
CREATE TABLE "EngagementLog" (
    "id" TEXT NOT NULL,
    "mapId" TEXT,
    "platform" TEXT NOT NULL,
    "campaign" TEXT,
    "postUrl" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "reshares" INTEGER NOT NULL DEFAULT 0,
    "occurredOn" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EngagementLog_mapId_idx" ON "EngagementLog"("mapId");

-- CreateIndex
CREATE INDEX "EngagementLog_platform_occurredOn_idx" ON "EngagementLog"("platform", "occurredOn");

-- CreateIndex
CREATE INDEX "EngagementLog_campaign_idx" ON "EngagementLog"("campaign");

-- AddForeignKey
ALTER TABLE "EngagementLog" ADD CONSTRAINT "EngagementLog_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;
