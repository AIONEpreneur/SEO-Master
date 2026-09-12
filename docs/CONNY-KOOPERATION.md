# Cornelias 47-€-Produkt und der Zugang zur App

**Offen. Nächster Termin mit Kirsten: 13.09.2026.**
Das Original-Briefing von Cornelia Scherer liegt daneben in
`CONNY-BRIEFING-ORIGINAL.md` (Stand 12.09.2026) — dort steht, was sie
verkauft (Teil A), welche Wege sie vorschlägt (Teil B), was in jeder
Lösung gelten muss (Teil C) und was sie zurückbraucht (Teil D).

Diese Datei hält fest, was am 12.09. geprüft und empfohlen wurde, damit
das Gespräch morgen nicht bei null anfängt.

## Worum es geht

Cornelia verkauft ab Herbst 2026 „Die Sichtbarkeits-Prüfung" für 47 € —
Prüfbogen, zehn Videos, Auswertungsbogen. **Und Zugang zu SEO-Master.**
Die App löst dort die Schwachstelle „erstes Erfolgserlebnis kommt zu
spät": in zwei Minuten sieht die Käuferin ihr eigenes Ranking.

Zielgruppe: Selbstständige mit eigener Website, DACH, nicht technisch.
Standort Germany, Sprache Deutsch.

## Geprüft am 12.09.: Die App kann, was Cornelia verspricht

Alle fünf Zeilen ihrer Tabelle sind heute da, ohne neuen Code — und sie
entstehen in **einem** Analyse-Lauf, nicht in fünf:

| Cornelias Zeile | Stand |
|---|---|
| Rankings mit Position und Suchvolumen | da |
| Positionsabfrage, bis 5 Begriffe | da — `run.ts` begrenzt wörtlich auf `.slice(0, 5)` |
| Verweisende Domains | da — `dfs.backlinksSummary()` |
| Tempo-Messung | da — PageSpeed, mobil |
| Titel und Beschreibung | da |

## Die Kostenfrage ist beantwortbar, nicht zu schätzen

DataForSEO liefert je Antwort ein `cost`-Feld. Die App **summiert das
bereits** (`dfs.totalCost`) und schreibt es je Analyse als UsageRecord
weg. Eine Testanalyse auf einer mittelgrossen Website beantwortet die
Frage endgültig — nachzusehen unter Betrieb → Nutzung.

Was sich aus dem Code ableiten lässt:

- Eine Analyse **reserviert** 40 Credits (`KOSTEN_ANALYSE`), verbraucht
  real aber meist weniger: Grundgebühr 8 Cent mit Bericht, 1 Cent je
  Unterseite, dazu die echten DataForSEO-Kosten.
- 1 Credit = 1 US-Cent.
- Ein voller Starter-Monat sind 1.200 Credits = **höchstens rund 11 €**
  Anbieterkosten. Das liegt genau an Cornelias Obergrenze von 12 € je
  eingelöstem Code — im schlimmsten Fall.
- Realistisch braucht ihr Produkt zwei Analysen („messen, reparieren,
  noch mal messen"): deutlich unter 1 €.

## Empfehlung vom 12.09.

**Weg 1 in der Form, Weg 2 in der Substanz.**

Nach aussen Cornelias Satz: „Ein Monat Prüf-App, voller Umfang." Voller
Funktionsumfang stimmt und kostet nichts extra — Extension, Exporte und
KI-Anbindung sind Schalter, keine API-Aufrufe. Nur das **Budget**
dahinter ist kleiner als beim echten Starter (Vorschlag: etwa die
Hälfte). Die Käuferin sieht die Zahl nie (Kundinnen sehen ohnehin keine
Credits, nur „Analysen frei"), Cornelia muss nichts einschränken, und
das Risiko je Code halbiert sich auf gut 5 €.

Damit **kein neuer Tarif-Typ und keine zweite Deckelungslogik**.

### Unbedingt bauen

1. **Herkunft am Konto** (Cornelias Teil C.1, der wichtigste Punkt):
   drei Felder am Arbeitsbereich, gesetzt beim Einlösen, nie wieder
   angefasst — `referred_by`, `referred_at`, `referral_source`.
   Dauerhaft, nicht 30 Tage. Dazu eine Zeile in der Betriebsübersicht
   („Aus Cornelias Codes: n Konten, davon m im Abo"). Ohne diese Zahl
   lässt sich über eine Beteiligung gar nicht reden.
2. **Codes**: Stapel-Erzeugung als CSV, Format `CS-XXXX-XXXX` ohne
   0/O und 1/I/l, einmalig, nicht stapelbar, sperrbar, Verfall nach
   12 Monaten.
3. **Der Code ist die Eintrittskarte.** Löst nebenbei das Problem, dass
   die Registrierung geschlossen bleiben soll: Wer einen gültigen Code
   hat, kommt herein — die Tür muss für niemanden sonst aufgehen.

### Nicht machen

- **Nur die Chrome-Extension statt der App.** Sie kann nur Rankings und
  Keyword-Recherche; Tempo, Titel und verweisende Domains kann sie
  nicht — drei von Cornelias fünf Zeilen. Sie braucht trotzdem ein
  Konto in der App für den Zugangsschlüssel, spart also nichts. Und sie
  ist nicht im Chrome Web Store: Ordner entpacken und Entwicklermodus
  sind für ein 47-€-Produkt eine Abbruchquote, keine Funktion.
- **Weg 3** (Zeitfenster plus Tiefenbegrenzung): bräuchte eine zweite
  Zähldimension neben dem Guthaben, Nutzen gegenüber „kleineres Budget,
  unsichtbar" gleich null.
- **Weg 4** (Stückkontingent): hat Cornelia selbst verworfen.
- **Keine Zahlungsdaten beim Einlösen** — dem ist ohne Einschränkung
  zuzustimmen, und es ist ausserdem der einfachere Weg.

## Der eigentliche Engpass

**Stripe ist nicht eingerichtet** — keine Preise, kein Webhook, die
Abo-Knöpfe führen ins Leere. Das Einlösen selbst ginge auch ohne (ein
Code setzt Tarif, Budget, Ablaufdatum), aber das ganze Geschäft für
beide Seiten steht darauf, dass am Ende des Monats jemand ein Abo
abschliessen **kann**. Sonst verschenkt Kirsten Zugänge und Cornelias
Beteiligung ist immer null.

Daran hängt Cornelias Teil-D-Punkt 3: Ein Preis je eingelöstem Code ist
keine Frage, solange der Listenpreis ein Platzhalter ist (29/79 € stehen
in `src/lib/billing/tarife.ts` mit genau diesem Kommentar).

**Vorgeschlagene Reihenfolge:** Preise festlegen → Stripe einrichten →
Codes und Herkunft bauen → Testcode an Cornelia. Alles davor ist Bauen
auf Sand. Cornelias Teil D Punkt 6 bestimmt den Zeitplan: ohne Testcode
kein Video, ohne Video kein Produkt.

## Die Nebenwirkung, die Geld kostet

Teil C, letzter Absatz: *keine stillen Änderungen an Oberfläche oder
Umfang*. Cornelias zehn Videos zeigen die App und laufen, solange sie
verkauft. Ab ihrem Drehtermin sind die gefilmten Bildschirme
(Analyse-Formular, Bericht, Extension-Popup) nicht mehr frei umbaubar.

Der Kanal dafür ist schon gebaut: die Rubrik **Neuigkeiten**. Cornelia
einen Zugang geben und vereinbaren, dass Änderungen dort vorher
angekündigt werden.

## Für Cornelias Datenschutztexte — steht schon fest

Aus `src/app/datenschutz/page.tsx`:

- Verarbeitet: E-Mail, eingegebene Domain, Suchbegriffe, Auswertungen.
  Keine personenbezogenen Daten Dritter.
- Weitergabe: DataForSEO (Zypern), Firecrawl (USA), Anthropic (USA),
  Google PageSpeed (USA), Apify (Tschechien, nur bei Social-Analysen).
  Ausserhalb der EU auf Grundlage der EU-Standardvertragsklauseln.
- Speicherdauer: Auswertungen bleiben, bis sie gelöscht werden; mit dem
  Konto verschwindet alles. Deckt Cornelias Wunsch „alte Auswertungen
  bleiben abrufbar" bereits ab.

## Offen — kann nur Kirsten beantworten

1. **Läuft die App unter der VELVET DOTS LIMITED?** Davon hängt ab, ob
   Cornelia einen Absatz in ihrer Datenschutzerklärung braucht. Ein
   Impressum ist im Code bisher nicht vorhanden.
2. **Wo steht der Server?** Land und Anbieter des VPS, für Cornelias
   Datenschutzerklärung.
3. Welcher Weg, welches Budget je Code, welche Beteiligung
   (Cornelias Vorschlag: 25 % wiederkehrend, solange das Abo läuft).

Wenn das entschieden ist: Rückmeldung an Cornelia schreiben, Teil D
Punkt für Punkt.
