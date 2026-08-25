-- Einladungen und gesperrte Konten.
--
-- Voraussetzung dafür, dass andere Personen die Anwendung nutzen können,
-- ohne dass jemand in der Datenbank Mitgliedschaften umhängen muss.

-- Gesperrte Konten: leer bedeutet aktiv.
ALTER TABLE "users" ADD COLUMN "suspendedAt" TIMESTAMP(3);

CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "organizationId" TEXT,
    "newOrganizationName" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invitations_codeHash_key" ON "invitations"("codeHash");
CREATE INDEX "invitations_email_idx" ON "invitations"("email");
CREATE INDEX "invitations_organizationId_idx" ON "invitations"("organizationId");

ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
