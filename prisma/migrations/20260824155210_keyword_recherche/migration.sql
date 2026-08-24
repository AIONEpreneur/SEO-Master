-- CreateTable
CREATE TABLE "keyword_researches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "seed" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL DEFAULT 2276,
    "languageCode" TEXT NOT NULL DEFAULT 'de',
    "rows" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_researches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keyword_researches_organizationId_createdAt_idx" ON "keyword_researches"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "keyword_researches" ADD CONSTRAINT "keyword_researches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
