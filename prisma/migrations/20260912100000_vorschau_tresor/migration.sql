-- Der Vorschau-Bereich (Kundensicht) borgt sich die Anbieter-Zugaenge des
-- eigenen Arbeitsbereichs, statt eine zweite Kopie der Schluessel zu halten.
-- Bei echten Kundinnen bleibt die Spalte leer.
ALTER TABLE "organizations" ADD COLUMN "tresorVon" TEXT;
