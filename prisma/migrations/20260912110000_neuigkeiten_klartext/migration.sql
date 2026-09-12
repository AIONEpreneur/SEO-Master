-- Neuigkeiten in Kundensprache.
--
-- Die ersten Einträge waren aus der Sicht der Werkstatt geschrieben: Schema,
-- Alt-Texte, Canonical, Läufe. Wer die App benutzt, ist Unternehmerin und
-- kein Technikerin — sie will wissen, was eine Änderung für ihre Website
-- bedeutet, nicht wie sie gebaut ist. Deshalb derselbe Inhalt, neu erzählt:
-- ein Satz zur Lage, ein Satz zur Folge, fertig.
--
-- Als UPDATE statt als neuer Eintrag: Sonst stünde dieselbe Änderung zweimal
-- in der Historie, einmal unverständlich.

UPDATE "neuigkeiten" SET
  "titel" = 'Ein Projekt für mehrere Länder',
  "text" = 'Du arbeitest nicht nur in Deutschland? Dann trag bei deinem Projekt einfach mehrere Länder ein — für Deutschland, Österreich und die Schweiz genügt ein Klick. Du bekommst für jedes Land ein eigenes Ergebnis, denn Google sortiert in jedem Land anders. Wie viele Analysen das kostet, steht im Formular, bevor du auf Start klickst.',
  "updatedAt" = NOW()
WHERE "id" = 'seed_neuigkeit_maerkte';

UPDATE "neuigkeiten" SET
  "titel" = 'Wir prüfen jetzt, ob dein Datum stimmt',
  "text" = 'Auf vielen Websites sieht Google ein anderes Veröffentlichungsdatum, als deine Leserinnen auf der Seite lesen. Das merkt man von aussen nicht — und dein frisch überarbeiteter Text gilt bei Google trotzdem als alt. Wenn das bei dir so ist, steht es ab jetzt in deinem Bericht.',
  "updatedAt" = NOW()
WHERE "id" = 'seed_neuigkeit_datum';

UPDATE "neuigkeiten" SET
  "titel" = 'Du wirst zuverlässiger als Autorin erkannt',
  "text" = 'Google möchte wissen, wer hinter einem Text steht — das ist einer der Punkte, die wir für dich prüfen. Bisher meldeten wir manchmal „keine Autorenangabe“, obwohl du dich auf der Seite ausführlich vorstellst. Dieser Fehlalarm ist weg.',
  "updatedAt" = NOW()
WHERE "id" = 'seed_neuigkeit_eeat';

UPDATE "neuigkeiten" SET
  "titel" = 'Dein Konto: Foto, Passwort und Abo an einer Stelle',
  "text" = 'Unter „Mein Konto“ änderst du deine Kontaktdaten, setzt ein neues Passwort, lädst ein Profilfoto hoch und siehst deinen Tarif. Und wenn du dein Passwort vergessen hast, schickst du dir den Link selbst per E-Mail — er gilt eine Stunde.',
  "updatedAt" = NOW()
WHERE "id" = 'seed_neuigkeit_konto';

UPDATE "neuigkeiten" SET
  "titel" = 'Dein Bericht zeigt deutlicher, was eilt',
  "text" = 'Im Bericht klingen manche Hinweise gleich dramatisch, sind es aber nicht. Wenn deine Seite ihre Google-Platzierung an eine fremde Website abgibt, ist das dringend. Wenn sie nur intern auf eine deiner eigenen Seiten verweist, hat es Zeit. Der Bericht unterscheidet das jetzt — du siehst schneller, was du zuerst anpacken solltest.',
  "updatedAt" = NOW()
WHERE "id" = 'seed_neuigkeit_canonical';
