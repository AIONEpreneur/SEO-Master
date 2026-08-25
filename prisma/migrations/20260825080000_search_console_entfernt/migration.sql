-- Search Console wurde aus der Anwendung entfernt.
--
-- Die zugehörigen Zugangsdaten müssen mit: Ein verschlüsselter Google-Token,
-- den kein Code mehr verwendet, ist reines Risiko ohne Gegenwert. Er liesse
-- sich über die Oberfläche auch nicht mehr löschen, weil es die Karte nicht
-- mehr gibt.
--
-- Der Enum-Wert SEARCH_CONSOLE bleibt bestehen. Ihn zu entfernen wäre eine
-- Änderung am Datentyp, die bei jedem verbliebenen Verweis fehlschlägt – für
-- einen ungenutzten Wert ein unnötiges Risiko beim Einspielen.
DELETE FROM "credentials" WHERE "provider" = 'SEARCH_CONSOLE';

-- Verbrauchseinträge bleiben erhalten: Sie sind Buchhaltung über tatsächlich
-- entstandene Kosten und dürfen nicht rückwirkend verschwinden.
