# Architektur

Warum die Teile so geschnitten sind, wie sie geschnitten sind.

---

## Zwei Prozesse statt einem

Weboberfläche und Worker laufen getrennt.

Ein Analyselauf ruft mehrere Anbieter auf und dauert ein bis fünf Minuten. In
einer HTTP-Antwort ist das nicht unterzubringen: der Browser läuft in ein
Zeitlimit, ein Neuladen startet den Lauf erneut, und ein Neustart der
Oberfläche würde laufende Analysen abbrechen.

Deshalb: Die Oberfläche legt den Auftrag an und stellt ihn in die Warteschlange.
Der Worker arbeitet ihn ab und schreibt den Fortschritt in die Datenbank. Die
Oberfläche fragt diesen Fortschritt ab. Das Fenster kann zwischendurch
geschlossen werden.

---

## Der Analyselauf

Vier Phasen, in dieser Reihenfolge:

**1. Seite laden.** Bevorzugt über Firecrawl mit ausgeführtem JavaScript, sonst
per direktem Abruf. Beides wird behalten: gerenderter Text und rohes HTML. Die
Differenz ergibt die JavaScript-Abhängigkeit — ein zentraler Wert für GEO, weil
die meisten KI-Crawler kein JavaScript ausführen.

Antwortet die Seite mit einem Fehlerstatus oder liefert praktisch keinen
Inhalt, bricht der Lauf hier ab. Eine 403-Seite zu bewerten würde eine Aussage
über die Zielseite vortäuschen, die nicht getroffen wurde.

**2. Daten erheben.** Die Abrufe bei den Anbietern sind voneinander unabhängig
und laufen parallel. Jeder ist einzeln abgesichert: fällt einer aus, wird das
vermerkt und der Rest läuft weiter.

Ausnahme sind die SERP-Abfragen — die laufen nacheinander, um das Anfragelimit
von DataForSEO nicht zu reissen.

**3. Bewerten.** Je Baustein ein Raster aus gewichteten Kriterien. Kriterien
ohne Datenlage bekommen den Status `unknown` und fallen aus der Gewichtung
heraus — sie werden nicht als Null gewertet. Sonst würde eine fehlende
Backlink-Abfrage die SEO-Note drücken, ohne dass die Seite etwas dafür kann.

**4. Bericht.** Aus den Messwerten entsteht der Bericht. Mit Anthropic-Schlüssel
formuliert Claude ihn aus; ohne entsteht er deterministisch aus denselben
Daten. In beiden Fällen sind die Bewertungen dieselben — das Modell bewertet
nicht, es ordnet ein und formuliert.

---

## Warum die Bewertung nicht vom Modell kommt

Die Bewertungen entstehen aus messbaren Kriterien im Code, nicht aus einer
Modellantwort. Der Grund ist Vergleichbarkeit: Zwei Läufe über dieselbe Seite
müssen dieselbe Note ergeben, sonst lässt sich eine Verbesserung nicht von
Rauschen unterscheiden. Ein Bericht, dessen Note zwischen zwei Läufen um einen
Punkt schwankt, ist als Fortschrittsmessung wertlos.

Das Modell macht das, was es gut kann: aus Zahlen verständliche Sprache formen
und Zusammenhänge benennen.

---

## Bewertungsraster

Skala durchgängig 1–10, Gewichtungen aus dem etablierten Analyse-Workflow:

| Baustein | Kriterien und Gewichtung |
|---|---|
| SEO | Technik 30 % · On-Page 40 % · E-E-A-T 20 % · Off-Page 10 % |
| AEO | Frage-Antwort 30 % · Snippet-Format 25 % · FAQ-Schema 25 % · Vollständigkeit 20 % |
| GEO | Autorität 25 % · Tiefe 30 % · Zitierbarkeit 25 % · Crawlbarkeit 20 % |
| SERP | Platzierungen 40 % · SERP-Elemente 25 % · Gesamtsichtbarkeit 35 % |
| Wettbewerb | Position 40 % · Keyword-Lücken 35 % · Autoritätsabstand 25 % |
| Social | Vollständigkeit 30 % · Auffindbarkeit 25 % · Reichweite 20 % · Interaktion 25 % |

Der Massstab ist bewusst streng: Eine durchschnittliche Seite landet bei 4–6.
Werte ab 9 sind für wirklich herausragende Seiten reserviert. Ein Raster, das
alles gut findet, hilft niemandem weiter.

---

## Befunde statt Notenlisten

Jeder Befund trägt vier Angaben:

- **Dringlichkeit** — kritisch, schneller Hebel, langfristig
- **Begründung** — warum das zählt, in einem Satz
- **Massnahme** — konkret genug zum Loslegen, nicht „sollte verbessert werden"
- **Aufwand und Wirkung** — für die Reihenfolge

Sortiert wird nach Dringlichkeit, dann Wirkung, dann Aufwand. Was oben steht,
ist das, was zuerst angefasst gehört.

---

## Mandantenfähigkeit

Jede Organisation ist ein abgeschotteter Datenraum: eigene Projekte, eigene
Analysen, eigener Datentresor. Jede Abfrage filtert über die
`organizationId` — auch dann, wenn bereits über die ID gefiltert wird. Eine
erratene Analyse-ID reicht so nicht aus, um fremde Daten zu sehen.

Das war von Anfang an so angelegt, obwohl die App zunächst intern läuft.
Mandantenfähigkeit nachträglich einzuziehen bedeutet, jede Abfrage der
Anwendung anzufassen — der Aufwand jetzt ist deutlich geringer.

Vier Rollen: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`. Der Datentresor ist ab
`ADMIN` zugänglich, Analysen starten ab `MEMBER`.

---

## Verbrauchserfassung

Jeder Anbieteraufruf mit Kosten wird mit Betrag festgehalten. Unter
*Einstellungen → Verbrauch* stehen die tatsächlichen Kosten je Analyse.

Das ist die Grundlage für die spätere Preisgestaltung: Wer weiss, dass eine
Analyse 0,18 $ kostet, kann einen Preis kalkulieren, statt ihn zu raten. Das
Guthaben-Feld je Organisation begrenzt zugleich, wie viel fremde API-Kosten
eine zahlende Kundin verursachen kann.

---

## Bekannte Grenzen

- **Einladungen per E-Mail** fehlen. Weitere Personen registrieren sich selbst;
  die Mitgliedschaft wird anschliessend in der Datenbank umgehängt.
- **Zahlungsabwicklung** ist nicht eingebaut. Datenmodell und
  Verbrauchserfassung sind darauf vorbereitet.
- **PDF-Ausgabe** fehlt; Berichte gibt es als Markdown und im Browser.
- **Search Console** ist im Datenmodell vorgesehen, aber nicht angebunden.
  Das wäre der grösste einzelne Zugewinn für die Analyse der eigenen Seite,
  weil es die einzige Quelle echter eigener Zahlen ist.
- **Zeitverlauf**: Analysen werden gespeichert und sind vergleichbar, aber es
  gibt noch keine Ansicht, die die Entwicklung über die Zeit zeigt.
