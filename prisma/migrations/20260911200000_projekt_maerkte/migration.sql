-- Mehrere Märkte je Projekt.
--
-- Der führende Markt bleibt in "locationCode": Jede einzelne Analyse misst
-- genau einen Länderindex, und Bestandsprojekte sollen sich nicht ändern.
-- Eine leere Liste heisst deshalb "nur der führende Markt".
ALTER TABLE "projects" ADD COLUMN "locationCodes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
