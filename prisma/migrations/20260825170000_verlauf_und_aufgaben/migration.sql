-- Automatische Prüfung je Projekt und abhakbare Befunde.

ALTER TABLE "projects" ADD COLUMN "autoPruefung" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN "autoZuletzt" TIMESTAMP(3);

CREATE TABLE "erledigte_befunde" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "erledigtVonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erledigte_befunde_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "erledigte_befunde_organizationId_targetUrl_findingId_key"
    ON "erledigte_befunde"("organizationId", "targetUrl", "findingId");
CREATE INDEX "erledigte_befunde_organizationId_targetUrl_idx"
    ON "erledigte_befunde"("organizationId", "targetUrl");

ALTER TABLE "erledigte_befunde" ADD CONSTRAINT "erledigte_befunde_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
