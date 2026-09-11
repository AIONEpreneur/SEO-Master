-- Neuigkeiten und Wünsche.

CREATE TYPE "NeuigkeitArt" AS ENUM ('NEU', 'VERBESSERT', 'BEHOBEN');
CREATE TYPE "WunschStatus" AS ENUM ('OFFEN', 'GEPLANT', 'UMGESETZT', 'ABGELEHNT');

-- Bis wann die Neuigkeiten gelesen wurden. Leer heisst "noch nie hingesehen";
-- dann gilt die Anmeldung als Stichtag, damit niemand beim ersten Login von
-- der ganzen Änderungshistorie erschlagen wird.
ALTER TABLE "users" ADD COLUMN "neuigkeitenGesehenAm" TIMESTAMP(3);

CREATE TABLE "neuigkeiten" (
    "id" TEXT NOT NULL,
    "art" "NeuigkeitArt" NOT NULL DEFAULT 'NEU',
    "titel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "veroeffentlichtAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verfasstVonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "neuigkeiten_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "neuigkeiten_veroeffentlichtAm_idx" ON "neuigkeiten"("veroeffentlichtAm");

ALTER TABLE "neuigkeiten" ADD CONSTRAINT "neuigkeiten_verfasstVonId_fkey"
  FOREIGN KEY ("verfasstVonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "wuensche" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "titel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "WunschStatus" NOT NULL DEFAULT 'OFFEN',
    "antwort" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wuensche_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wuensche_organizationId_idx" ON "wuensche"("organizationId");
CREATE INDEX "wuensche_status_idx" ON "wuensche"("status");

ALTER TABLE "wuensche" ADD CONSTRAINT "wuensche_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wuensche" ADD CONSTRAINT "wuensche_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Die Historie beginnt nicht leer.
--
-- Eine Änderungshistorie, die mit "noch keine Einträge" startet, wirkt wie
-- ein Versprechen, das niemand einlöst. Diese Einträge stehen für das, was
-- in den letzten Tagen tatsächlich dazugekommen ist — nachlesbar in den
-- Commits, nicht erfunden.
INSERT INTO "neuigkeiten" ("id", "art", "titel", "text", "veroeffentlichtAm", "createdAt", "updatedAt") VALUES
  ('seed_neuigkeit_maerkte', 'NEU',
   'Projekte können mehrere Märkte tragen',
   'Ein Projekt nimmt jetzt mehrere Länder auf — für den DACH-Raum genügt ein Klick. Gemessen wird je Land einzeln, weil beim Datenanbieter das Land die grösste Einheit ist. Drei Länder heissen deshalb drei Läufe; was das kostet, steht im Formular, bevor du klickst.',
   NOW() - INTERVAL '1 minute', NOW(), NOW()),

  ('seed_neuigkeit_datum', 'NEU',
   'Neue Prüfung: Datum im Quelltext gegen Datum auf der Seite',
   'Steht im Schema der 1. September und sichtbar auf der Seite der 24. August, liest Google das eine und deine Leserin das andere. Beide Angaben sehen für sich plausibel aus — nur der Vergleich zeigt den Widerspruch. Der Bericht nennt ihn jetzt.',
   NOW() - INTERVAL '2 minutes', NOW(), NOW()),

  ('seed_neuigkeit_eeat', 'VERBESSERT',
   'Autorenerkennung findet auch ausführliche Vorstellungen',
   'Bisher wurde nur nach dem Feld "author" gesucht. Wer sich auf der Seite ausführlich vorstellt, trägt die Person aber oft als eigenen Schema-Eintrag. Jetzt wird dieser Name im Text und in den Bild-Alt-Texten gesucht — und kein Fehlen mehr gemeldet, wo etwas steht.',
   NOW() - INTERVAL '3 minutes', NOW(), NOW()),

  ('seed_neuigkeit_konto', 'NEU',
   'Eigenes Konto: Profilbild, Passwort, Abo',
   'Unter "Mein Konto" änderst du Kontaktdaten und Passwort, lädst ein Profilbild hoch und verwaltest dein Abo. Passwort vergessen funktioniert jetzt ohne Nachfrage — der Link kommt per Mail und gilt eine Stunde.',
   NOW() - INTERVAL '4 minutes', NOW(), NOW()),

  ('seed_neuigkeit_canonical', 'BEHOBEN',
   'Canonical-Befunde wiegen jetzt unterschiedlich schwer',
   'Ein Canonical, das auf eine andere eigene Seite zeigt, stand bisher auf derselben Stufe wie eines, das die Rankings an eine fremde Domain abgibt. Die Einstufung folgt jetzt der Wirkung — damit erkennbar bleibt, was zuerst zu tun ist.',
   NOW() - INTERVAL '5 minutes', NOW(), NOW());
