-- Umfang eines Laufs: wie viele Seiten hoechstens gelesen werden.
ALTER TABLE "analyses" ADD COLUMN "pageLimit" INTEGER NOT NULL DEFAULT 1;
