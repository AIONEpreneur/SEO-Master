-- Ranking-Abfragen aus der Browser-Extension (SEO4U) bleiben gespeichert.
CREATE TABLE "ranking_lookups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "target" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'domain',
    "locationCode" INTEGER NOT NULL DEFAULT 2276,
    "languageCode" TEXT NOT NULL DEFAULT 'de',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranking_lookups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ranking_lookups_organizationId_createdAt_idx" ON "ranking_lookups"("organizationId", "createdAt");

ALTER TABLE "ranking_lookups" ADD CONSTRAINT "ranking_lookups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
