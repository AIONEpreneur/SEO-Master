# Welche Anbindungen die Anwendung braucht

Kurzfassung: **DataForSEO, Firecrawl und Apify decken den Datenbedarf ab.**
Zwei Ergänzungen sind sinnvoll, eine davon kostenlos.

---

## Übersicht

| Anbieter | Wofür | Nötig? | Kosten |
|---|---|---|---|
| **DataForSEO** | Rankings, SERP, Keywords, Backlinks, Wettbewerb, LLM-Sichtbarkeit | ja | nach Verbrauch, ca. 0,05–0,30 $ je Analyse |
| **Firecrawl** | Seiteninhalt mit ausgeführtem JavaScript | ja | ab ca. 16 $/Monat |
| **Anthropic** | ausformulierter Bericht | ja | ca. 0,03–0,08 $ je Bericht |
| **Apify** | Social-Media-Profile | nur für Social | ab ca. 39 $/Monat, nach Verbrauch |
| **PageSpeed Insights** | Core Web Vitals | empfohlen | kostenlos |

Die vorhandenen drei Zugänge reichen also für den vollen Funktionsumfang. Die
beiden Ergänzungen sind: **Anthropic** (steht ohnehin zur Verfügung) und
**PageSpeed Insights** (kostenloser Google-Schlüssel).

---

## DataForSEO — die Datenbasis

Deckt fünf Bereiche ab, die sonst fünf einzelne Anbieter erfordern würden:

- **SERP** — organische Ergebnisse, KI-Übersichten, „Nutzer fragen auch"-Boxen,
  Featured Snippets. Beantwortet: *Wo steht die Seite wirklich?*
- **Labs** — Keyword-Daten, Suchvolumen, Schwierigkeit, Suchintention,
  Wettbewerber, Keyword-Überschneidungen. Beantwortet: *Welche Themen fehlen?*
- **Backlinks** — verweisende Domains, Spam-Score. Wichtigstes Off-Page-Signal.
- **On-Page / Lighthouse** — technische Prüfung als Alternative zu PageSpeed.
- **AI Optimization** — welche Domains Sprachmodelle zu einem Thema nennen.
  Das ist die einzige direkte Messung für GEO überhaupt.

> Die AI-Optimization-Endpunkte sind nicht in jedem Tarif enthalten. Fehlen
> sie, läuft die GEO-Analyse weiter — dann ohne den Vergleich, welche Domains
> die Sprachmodelle stattdessen nennen.

**Zugang:** https://app.dataforseo.com/api-access
Login ist die E-Mail-Adresse, das Passwort der dort erzeugte API-Schlüssel —
nicht das Anmeldepasswort.

**Ohne DataForSEO** entfallen SERP- und Wettbewerbsanalyse vollständig. SEO,
AEO und GEO laufen weiter, aber ohne Ranking- und Backlink-Daten.

---

## Firecrawl — der Seiteninhalt

Lädt Seiten mit ausgeführtem JavaScript und liefert gerenderten Text und rohes
HTML getrennt zurück.

Das ist der entscheidende Punkt: Viele Seiten bauen ihren Inhalt erst im
Browser auf. Ein einfacher Crawler sieht dort fast nichts — und die meisten
KI-Crawler sind einfache Crawler. Aus der Differenz zwischen beidem berechnet
die Analyse die JavaScript-Abhängigkeit. Ist sie hoch, ist die Seite für
KI-Systeme praktisch unsichtbar, egal wie gut der Inhalt ist.

**Zugang:** https://www.firecrawl.dev/app/api-keys

**Ohne Firecrawl** greift ein direkter Abruf. Der zeigt genau das ausgelieferte
HTML — brauchbar bei serverseitig gerenderten Seiten, unzureichend bei
JavaScript-Seiten und bei Seiten mit Bot-Sperre.

---

## Anthropic — der Bericht

Formuliert aus den Messwerten den ausgearbeiteten Bericht: Kurzfazit,
Einordnung je Disziplin, priorisierte Massnahmen.

Der Modellaufruf bewertet nicht — die Bewertung steht vorher fest und stammt
aus den Messdaten. Das Modell ordnet ein und formuliert. So bleiben die
Ergebnisse zwischen zwei Läufen derselben Seite vergleichbar.

**Zugang:** https://console.anthropic.com/settings/keys

**Ohne Anthropic** entsteht der Bericht rein aus den Daten: alle Werte, alle
Befunde, alle Massnahmen — nur ohne die einordnenden Passagen.

---

## Apify — Social-Profile

DataForSEO deckt Suchmaschinen ab, aber keine Profildaten. Dafür laufen bei
Apify fertige Actors für Instagram, LinkedIn, TikTok, YouTube, Facebook und X.

Actors im Store ändern sich gelegentlich. Deshalb ist die Zuordnung
konfigurierbar: über `APIFY_ACTOR_INSTAGRAM` und die entsprechenden Variablen
lässt sich ein anderer Actor einsetzen, ohne den Code zu ändern.

**Zugang:** https://console.apify.com/settings/integrations

**Ohne Apify** ist die Analyse von Social-Profilen nicht möglich. Website-
Analysen sind davon nicht betroffen.

---

## PageSpeed Insights — empfohlene Ergänzung

Kostenlos, und liefert etwas, das sonst niemand hat: die **CrUX-Felddaten** —
Core Web Vitals, gemessen bei echten Nutzerinnen statt im Labor. Google nutzt
für das Ranking die Felddaten, nicht die Labormessung.

Funktioniert auch ohne Schlüssel, dann mit engem Kontingent. Mit kostenlosem
Schlüssel deutlich grosszügiger.

**Zugang:** https://developers.google.com/speed/docs/insights/v5/get-started

---

## Sinnvolle spätere Ergänzungen

Nicht eingebaut, aber vorgesehen:

**Google Search Console** (kostenlos, OAuth) — die einzige Quelle für die
tatsächlichen eigenen Zahlen: Impressionen, Klicks, durchschnittliche Position
je Suchanfrage. Alles andere sind Schätzungen von aussen. Für die eigene
Website der grösste einzelne Zugewinn. Im Datenmodell ist der Anbieter bereits
als `SEARCH_CONSOLE` vorgesehen.

**Stripe** — sobald die App verkauft werden soll. Die Verbrauchserfassung
läuft bereits mit: unter *Einstellungen → Verbrauch* stehen die tatsächlichen
API-Kosten je Analyse. Das ist die Grundlage, um Preise zu kalkulieren, statt
sie zu raten.

---

## Kosten je Analyse

Grobe Grössenordnung für eine vollständige Website-Analyse mit allen
Bausteinen und drei Wettbewerbern:

| Posten | Kosten |
|---|---|
| DataForSEO (SERP, Labs, Backlinks) | 0,05–0,30 $ |
| Firecrawl (1 Seite) | im Monatstarif enthalten |
| Anthropic (1 Bericht) | 0,03–0,08 $ |
| PageSpeed | 0,00 $ |
| **Summe je Analyse** | **etwa 0,10–0,40 $** |

Die tatsächlichen Zahlen erfasst die Anwendung selbst — unter *Einstellungen →
Verbrauch* stehen Kosten je Anbieter und je Analyse.
