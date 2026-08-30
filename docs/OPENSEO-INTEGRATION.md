# OpenSEO als Datenanbieter in SEO-Master

Arbeitsauftrag und Umsetzungsstand.

---

## Ziel

OpenSEO (Fork: `AIONEpreneur/open-seo`, Original: `every-app/open-seo`, MIT) wird
als **eigenständiger Docker-Dienst neben SEO-Master** betrieben und über seinen
MCP-Server als zusätzlicher Datenanbieter angebunden.

**Der Bericht von SEO-Master bleibt unverändert.** Bewertungsraster, Gewichtungen,
Aufbau und Formulierung bleiben, wie sie sind. Was sich ändert, ist ausschließlich
die Datenbasis darunter.

---

## Wichtigste Randbedingung

**Es wird kein Code aus OpenSEO in dieses Repository kopiert.**

Sobald OpenSEO-Dateien hier landen, entsteht ein Fork, der von Hand nachgepflegt
werden muss. Der gesamte Zweck dieser Bauform ist, dass Aktualisierungen über
`docker compose pull` kommen. Das Image ist die Abhängigkeit, nicht der Quellcode.

Wenn eine Aufgabe nur durch Kopieren von OpenSEO-Code lösbar scheint: **abbrechen
und nachfragen**, nicht kopieren.

---

## Ausgangslage

**SEO-Master** — Next.js, PostgreSQL, Redis, eigener Worker-Prozess, Docker auf
Hostinger-VPS. Bausteine: SEO, AEO, GEO, SERP, Wettbewerb, Social. Anbieter heute:
DataForSEO, Firecrawl, Apify, PageSpeed, Anthropic.

**OpenSEO** — TypeScript/TanStack auf Cloudflare Workers, im Selbstbetrieb als
Docker-Image. Hat **keine allgemeine REST-API**: unter `src/routes/api` liegen nur
Auth, Billing, GA4, GSC und ein Health-Check. Die einzige Schnittstelle nach außen
ist der **MCP-Server über HTTP**.

---

## Betriebsmodus

OpenSEO kennt drei Auth-Modi:

| Modus | Bedeutung |
|---|---|
| `local_noauth` | Keine Anmeldung, ein Admin-Nutzer (`admin@localhost`), keine Mandantentrennung |
| `hosted` | Better Auth mit E-Mail/Passwort und Organisationsmodus — echte Mandantentrennung |
| `cloudflare_access` | Zugriffsschutz über Cloudflare Access (Standard, wenn nichts gesetzt ist) |

**Für diesen Auftrag: `local_noauth`.** Der Wechsel auf `hosted` ist später eine
Env-Änderung, kein Umbau — er wird nötig, sobald SEO-Master mehrmandantenfähig
verkauft wird.

---

## Phase 1 — Container danebenstellen

Dienst in die bestehende Compose-Datei ergänzen. Fertiges Image, kein Build.
Umgesetzt in `docker-compose.prod.yml` und `docker-compose.vps.yml`; für die
lokale Entwicklung zusätzlich in `docker-compose.yml` (dort mit Port-Bindung an
`127.0.0.1`, weil der Worker in der Entwicklung auf dem Host läuft).

### Vier Punkte, die leicht übersehen werden

1. **Kein `ports:`-Eintrag.** Im Modus `local_noauth` gibt es keine Anmeldung. Wer
   die Adresse kennt, hat vollen Zugriff auf die hinterlegte DataForSEO-Abrechnung.
   Der Dienst ist ausschließlich im internen Docker-Netz erreichbar. Der Worker muss
   im selben Netz liegen.
2. **`DATAFORSEO_API_KEY` ist base64.** Nicht der rohe Schlüssel, sondern
   `base64("email:api-passwort")`. Anderes Format als in der bestehenden `.env` von
   SEO-Master — deshalb eigener Variablenname `OPENSEO_DATAFORSEO_API_KEY`, um
   Verwechslung zu vermeiden. Erzeugen mit:
   `echo -n "email:api-passwort" | base64`
3. **Volume `/app/.wrangler` gehört in die Sicherung.** Dort liegen Projekte,
   gespeicherte Keywords, Rank-Tracker und das Forschungs-Log. Ohne Sicherung sind
   die bei einem Neuaufsetzen weg — und werden neu gekauft.
4. **Telemetrie ist standardmäßig aktiv.** `OPENSEO_TELEMETRY_DISABLED=1` setzen.

### Fünfter Punkt, im Quellcode gefunden

**`ALLOWED_HOST=open-seo` ist Pflicht.** Das Self-Host-Image liefert die Anwendung
über `vite preview` aus, und Vite blockiert Anfragen mit fremdem Host-Header
(„Blocked request"). Standardmäßig ist nur `localhost` erlaubt. Der Worker ruft den
Dienst aber unter `http://open-seo:3001` auf — Host-Header `open-seo:3001`. Ohne
`ALLOWED_HOST=open-seo` scheitert jeder Aufruf aus dem Docker-Netz, obwohl der
Health-Check (der über `127.0.0.1` im Container läuft) „gesund" meldet.
Beleg: `vite.config.ts` (`allowedHosts`) und `src/lib/selfhost-preflight.ts` im
OpenSEO-Repository.

### Abnahme Phase 1 (auf dem VPS durchführen)

```bash
# 1. Schlüssel in die .env eintragen (Format beachten, Punkt 2 oben):
#    OPENSEO_DATAFORSEO_API_KEY=<base64>

# 2. Dienst starten. Erster Start dauert mehrere Minuten: das Image baut die
#    Anwendung beim ersten Start (Healthcheck-Startfrist im Image: 300 s).
docker compose -f docker-compose.prod.yml pull open-seo
docker compose -f docker-compose.prod.yml up -d open-seo

# 3. Gesund?
docker compose -f docker-compose.prod.yml ps open-seo   # → healthy

# 4. Aus dem internen Netz erreichbar? (aus dem Worker-Container heraus)
docker compose -f docker-compose.prod.yml exec worker \
  node -e "fetch('http://open-seo:3001/api/health').then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,2)))"
# → {"status":"ok", ...} mit Konfigurations-Checks (u. a. DATAFORSEO_API_KEY ok)

# 5. Von außen NICHT erreichbar?
curl -m 5 http://<vps-ip>:3001/api/health   # → muss scheitern (kein ports:-Eintrag)
```

Für den Blick in die Oberfläche (Projekt anlegen): den Dienst **vorübergehend**
über eine `docker-compose.override.yml` an die Loopback-Adresse binden —

```yaml
services:
  open-seo:
    ports:
      - '127.0.0.1:3001:3001'
```

— dann `ssh -L 3001:127.0.0.1:3001 <vps>` und im Browser `http://localhost:3001`
öffnen. Nach dem Prüfen die Override-Datei wieder entfernen und `up -d` erneut
ausführen. So bleibt die eingecheckte Konfiguration ohne offenen Port.

---

## Phase 2 — Vergleichslauf (keine Programmieraufgabe)

Bevor irgendetwas angebunden wird: dieselbe Kundendomain einmal durch SEO-Master
und einmal durch die OpenSEO-Oberfläche schicken, Ergebnisse nebeneinanderlegen.

Drei Fragen: Was liefert OpenSEO, das im Bericht heute fehlt? Wo liefern beide
dasselbe, und wessen Zahlen sind besser? Was ist für die Zielgruppe irrelevant?

**Das Ergebnis entscheidet, welche Werkzeuge in Phase 4 angebunden werden.** Diese
Phase gehört Kirsten, nicht dem Agenten.

---

## Phase 3 — Anbindung im Worker

Neuer Anbieter im Worker, analog zu den bestehenden (DataForSEO, Firecrawl, Apify).
Umgesetzt in `src/lib/connectors/openseo.ts`.

```
Endpunkt:  http://open-seo:3001/mcp   (konfigurierbar über OPENSEO_MCP_URL)
Transport: HTTP (MCP, Streamable HTTP)
Auth:      keine (local_noauth im internen Netz)
           im hosted-Modus später: OPENSEO_API_KEY=oseo_... setzen
           → wird als Authorization: Bearer mitgesendet
```

### Wie der Anbieter aufgebaut ist

- **`OpenSeoClient`** spricht das MCP-Protokoll direkt über HTTP (JSON-RPC:
  `initialize` → `notifications/initialized` → `tools/call`), ohne zusätzliche
  Abhängigkeit. Antworten kommen wahlweise als JSON oder als SSE-Strom; beides
  wird gelesen.
- **Zeitlimit und Wiederholversuche** wie bei den bestehenden Anbietern:
  60 s je Verwaltungsaufruf, 120 s je Datenaufruf (OpenSEO reicht an DataForSEO
  durch), zwei Wiederholungen mit exponentiellem Abstand — aber nur bei
  Transportfehlern (Netz, 429, 5xx). Ein Fehler, den das Werkzeug selbst meldet,
  wird nicht wiederholt: erneutes Senden verbrennt nur Guthaben.
- **Projektzuordnung:** Jedes OpenSEO-Werkzeug verlangt eine `projectId`. Der
  Client löst sie selbst auf: `list_projects` (kostenlos), passendes Projekt per
  Domain suchen, sonst `create_project` (kostenlos) mit Domain und Markt. So
  landen alle Abrufe derselben Domain im selben Projekt — und damit im
  Forschungs-Log, das Wiederholabrufe innerhalb von 30 Tagen kostenlos macht
  (Grundlage von Phase 5).
- **Ausfallverhalten** unverändert wie bei den bestehenden Anbietern: Ist OpenSEO
  nicht erreichbar oder `OPENSEO_MCP_URL` nicht gesetzt, entfällt der Abruf, der
  Lauf läuft weiter, und der Bericht weist die Lücke unter „Übersprungen" aus.
  Es wird keine Bewertung aus fehlenden Daten erzeugt.

### Erster Schritt (umgesetzt) — und dann Stopp

Ein einziger Aufruf: **`get_domain_overview`** (liefert organischen Traffic,
Keyword-Anzahl, Backlinks, verweisende Domains; ~100–300 OpenSEO-Credits,
12 h Cache je Domain).

Einbau in den Lauf (`src/lib/analysis/run.ts`):

- Der Abruf läuft als eigener, parallel abgesicherter Collector in Phase 2
  („Daten erheben") — wie PageSpeed, Backlinks und Domain-Kennzahlen.
- Das Ergebnis steht im Rohdatensatz der Analyse (`raw.openSeoOverview`) und
  im SEO-Baustein unter `data.openSeo`.
- Fällt der direkte DataForSEO-Backlink-Abruf aus, dient die OpenSEO-Übersicht
  als Rückfallebene für das bestehende Kriterium „Backlink-Profil" — mit
  denselben Schwellwerten und ohne Spam-Score-Logik (OpenSEO liefert keinen
  Spam-Score; ein Urteil ohne Datenlage wird nicht erfunden). Das Raster,
  die Gewichtung und die Formulierungen bleiben unverändert.

**Weitere Werkzeuge folgen erst nach Freigabe** (Ergebnis von Phase 2).

### Abnahme Phase 3 (auf dem VPS, nach Abnahme Phase 1)

```bash
# In der .env des VPS:
#   OPENSEO_MCP_URL=http://open-seo:3001/mcp
docker compose -f docker-compose.prod.yml up -d --build worker web

# Dann eine Analyse über die Oberfläche starten und prüfen:
#  - Bericht → Meta → verwendete Anbieter enthält "OpenSEO"
#  - Rohdaten der Analyse enthalten "openSeoOverview"
#  - OpenSEO-Oberfläche: das Projekt zur Domain wurde angelegt,
#    das Forschungs-Log enthält den Abruf
# Gegenprobe Ausfallverhalten: open-seo stoppen, Analyse erneut starten →
# Lauf geht durch, "OpenSEO-Domainübersicht" steht unter Übersprungen.
```

---

## Phase 4 — Zuordnung Werkzeug zu Berichtsbaustein

Zielbild nach Freigabe. Was davon tatsächlich gebaut wird, entscheidet Phase 2.

| Baustein | Künftige Quelle | Status |
|---|---|---|
| **SEO** | `get_ranked_keywords`, `get_domain_overview`, `get_backlinks_overview`, Site-Audit, Lighthouse; `get_search_console_performance` für echte Klicks und Positionen statt Schätzungen | bessere Basis |
| **AEO** | `get_serp_results` — liefert SERP-Elemente: „Nutzer fragen auch", Featured Snippets, KI-Übersichten | bessere Basis |
| **GEO** | Bleibt bestehend: DataForSEO AI-Optimization plus JS-Abhängigkeitsmessung über Firecrawl. OpenSEO hat dazu nichts. | unverändert |
| **SERP** | `get_serp_results` plus laufende Rangverfolgung — aus Momentaufnahmen wird eine Zeitreihe | neu |
| **Wettbewerb** | `find_serp_competitors` (prüft, ob ein genannter Wettbewerber echter Suchwettbewerb ist), dann Ranked-Keywords-Vergleich, Head-to-Head-SERPs, Backlink-Profile, Keyword-Lücken | größter Gewinn |
| **Social** | Bleibt Apify. OpenSEO hat dazu nichts. | unverändert |
| **Local** *(neu)* | Maps-Rasterranking um einen Standort, Google-Business-Profil-Audit, Bewertungen, Kategorien, Q&A | neuer Baustein |

**Local ist ein neuer Berichtsbaustein**, kein Zusatz zu einem bestehenden. Für
regionale Kundinnen oft relevanter als jedes nationale Ranking.

**Regel für diese Phase: ein Werkzeug, ein Baustein, ein echter Lauf, dann das
nächste.** Nicht alles auf einmal anbinden.

---

## Phase 5 — DataForSEO zusammenführen

Nach Phase 4 kaufen beide Anwendungen teilweise dieselben Daten. Die
überschneidenden Abrufe künftig nur noch über OpenSEO laufen lassen.

Grund: OpenSEO führt je Projekt ein **Forschungs-Log**. Lief dieselbe Recherche in
den letzten 30 Tagen bereits, wird das gespeicherte Ergebnis wiederverwendet statt
neu gekauft. Diese Ersparnis greift nur für Abrufe, die durch OpenSEO gehen.

Danach die tatsächlichen Kosten je Analyse neu messen — *Einstellungen → Verbrauch*
in SEO-Master — und gegen die DataForSEO-Abrechnung prüfen.

Hinweis zur Verbrauchserfassung: OpenSEO meldet je MCP-Aufruf keine Kosten in
Dollar zurück (nur eigene Credits im Meta-Feld). Der erste Schritt schreibt deshalb
noch keinen `usageRecord`; das gehört zu Phase 5, wenn die überschneidenden Abrufe
verlagert und die Kosten neu vermessen werden. Dann braucht es auch einen eigenen
`Provider`-Enum-Wert `OPENSEO` (Migration) — für den ersten Schritt bewusst noch
nicht, um das Datenmodell nicht vor der Freigabe anzufassen.

---

## Kostenlage zum Abgleich

Aus `docs/API-ANBINDUNGEN.md`, Stand vor der Integration:

| Posten | Kosten |
|---|---|
| DataForSEO je Analyse | 0,05–0,30 $ |
| Anthropic je Bericht | 0,03–0,08 $ |
| **Summe je Analyse** | **0,10–0,40 $** |
| Firecrawl | ab 16 $/Monat, fest |
| Apify (nur Social) | ab 39 $/Monat, fest |

Treiber der Spanne ist die **Anzahl der Wettbewerber je Lauf**, nicht die Anzahl
der Analysen. Beim Ausbau der Wettbewerbsanalyse in Phase 4 im Blick behalten.
