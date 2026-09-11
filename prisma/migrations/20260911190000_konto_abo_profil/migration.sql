-- Profilbild und Merker für die Einstiegstour.
ALTER TABLE "users" ADD COLUMN "avatarDatei" TEXT;
ALTER TABLE "users" ADD COLUMN "tourGesehenAm" TIMESTAMP(3);

-- Einmal-Links zum Zurücksetzen des Passworts.
CREATE TABLE "passwort_hilfen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passwort_hilfen_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "passwort_hilfen_tokenHash_key" ON "passwort_hilfen"("tokenHash");
CREATE INDEX "passwort_hilfen_userId_idx" ON "passwort_hilfen"("userId");
CREATE INDEX "passwort_hilfen_expiresAt_idx" ON "passwort_hilfen"("expiresAt");

ALTER TABLE "passwort_hilfen" ADD CONSTRAINT "passwort_hilfen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Abschrift des Abo-Zustands von Stripe. Keine Kartendaten.
ALTER TABLE "organizations" ADD COLUMN "stripeKundeId" TEXT;
ALTER TABLE "organizations" ADD COLUMN "stripeAboId" TEXT;
ALTER TABLE "organizations" ADD COLUMN "aboStatus" TEXT;
ALTER TABLE "organizations" ADD COLUMN "aboLaeuftBis" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "aboEndetMitPeriode" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "organizations_stripeKundeId_key" ON "organizations"("stripeKundeId");
