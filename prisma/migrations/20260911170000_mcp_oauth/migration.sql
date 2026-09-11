-- OAuth-Anmeldung für die MCP-Anbindung: registrierte Clients und Einmal-Codes.
CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_codes_codeHash_key" ON "oauth_codes"("codeHash");
CREATE INDEX "oauth_codes_expiresAt_idx" ON "oauth_codes"("expiresAt");

ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
