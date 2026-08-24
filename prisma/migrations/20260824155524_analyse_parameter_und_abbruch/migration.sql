-- AlterTable
ALTER TABLE "analyses" ADD COLUMN     "competitorDomains" TEXT[],
ADD COLUMN     "languageCode" TEXT NOT NULL DEFAULT 'de',
ADD COLUMN     "locationCode" INTEGER NOT NULL DEFAULT 2276,
ADD COLUMN     "seedKeywords" TEXT[];
