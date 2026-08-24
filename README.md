# SEO-Master

Analyse-Plattform für Sichtbarkeit: SEO, AEO, GEO, SERP, Wettbewerb — für
Websites und Social-Media-Profile. Jeder Lauf endet in einem Bericht mit
priorisierten, konkret umsetzbaren Massnahmen.

Die Anwendung läuft vollständig in der eigenen Umgebung. Datenbank,
Warteschlange und alle Analyseergebnisse liegen auf dem eigenen Server; nach
aussen gehen ausschliesslich die Anfragen an die Datenanbieter.

---

## Was die Anwendung tut

Eingabe ist eine URL — eine Website-Seite oder ein Social-Profil. Daraus
entsteht ein Bericht mit Bewertungen von 1 bis 10 je Disziplin und einer nach
Dringlichkeit und Wirkung sortierten Massnahmenliste.

| Baustein | Frage | Grundlage |
|---|---|---|
| **SEO** | Rankt die Seite in Google? | Technik, Inhalt, Keywords, E-E-A-T, Backlinks |
| **AEO** | Erscheint sie in Antwortboxen? | Frage-Antwort-Struktur, FAQ-Schema, Snippet-Formate |
| **GEO** | Kennen ChatGPT & Co. sie? | Autorität, Zitierbarkeit, Crawlbarkeit für KI-Systeme |
| **SERP** | Wo steht sie tatsächlich? | Echte Platzierungen, SERP-Elemente, KI-Übersichten |
| **Wettbewerb** | Wie gross ist der Abstand? | Vergleichszahlen und Keyword-Lücken |
| **Social** | Trägt das Profil? | Vollständigkeit, Auffindbarkeit, Reichweite, Interaktion |

Die Bewertungsraster folgen den Gewichtungen des etablierten Analyse-Workflows
— etwa beim SEO: Technik 30 %, On-Page 40 %, E-E-A-T 20 %, Off-Page 10 %.

---

## Aufbau

```
Browser ──► Next.js (Oberfläche + Server Actions)
                │
                ├──► PostgreSQL   Projekte, Analysen, Berichte, Datentresor
                ├──► Redis        Warteschlange der Analyseaufträge
                │
                └──► Worker (eigener Prozess)
                        │
                        ├──► Firecrawl      Seiteninhalt mit JavaScript
                        ├──► DataForSEO     Rankings, Keywords, Backlinks, Wettbewerb
                        ├──► Apify          Social-Profile
                        ├──► PageSpeed      Core Web Vitals
                        └──► Anthropic      Ausformulierter Bericht
```

Ein Analyselauf dauert je nach Umfang ein bis fünf Minuten — zu lang für eine
HTTP-Antwort. Deshalb stellt die Oberfläche den Auftrag nur ein; der Worker
arbeitet ihn ab, die Oberfläche zeigt den Fortschritt.

**Ausfälle einzelner Anbieter beenden den Lauf nicht.** Der betroffene Baustein
entfällt und wird im Bericht als Lücke ausgewiesen, statt eine Bewertung auf
Basis fehlender Daten vorzutäuschen.

---

## Einrichtung (lokal)

Ein Befehl. Das Skript prüft die Voraussetzungen, richtet beim ersten Mal
alles ein und öffnet die Anwendung im Browser.

```bash
git clone <repository>
cd seo-master
./start.sh
```

Gebraucht wird **Node.js 22 oder neuer** ([nodejs.org](https://nodejs.org),
Variante „LTS"). Datenbank und Warteschlange richtet das Skript selbst ein —
über Docker, wenn Docker läuft, sonst über Homebrew. Fehlt beides, sagt das
Skript, was zu tun ist.

Beim ersten Start entstehen ein Konto und ein Beispielprojekt mit drei
Analysen; die Zugangsdaten stehen am Ende der Ausgabe. Beenden mit `Strg+C`.

Das Erscheinungsbild lässt sich unten im Seitenmenü umschalten — hell, dunkel
oder der Systemeinstellung folgend. Die Wahl gilt pro Gerät und bleibt
erhalten.

> Das Projekt braucht ein eigenes Verzeichnis. Liegt es innerhalb eines
> anderen Git-Repositorys, greift Next.js auf dessen Dateien zu und meldet
> Warnungen.

**Von Hand**, wenn das Skript nicht passt:

```bash
npm install
cp .env.example .env
# ENCRYPTION_KEY und SESSION_SECRET erzeugen:
echo "ENCRYPTION_KEY=\"$(openssl rand -base64 32)\"" >> .env
echo "SESSION_SECRET=\"$(openssl rand -base64 32)\"" >> .env

docker compose up -d          # PostgreSQL und Redis
npx prisma migrate dev        # Datenbankschema anlegen

npm run dev                   # Oberfläche auf http://localhost:3000
npm run worker                # in einem zweiten Terminal
```

`npm run dev` startet nur den Server — es öffnet sich kein Fenster von selbst.
Die Adresse `http://localhost:3000` muss im Browser aufgerufen werden.

Das erste angelegte Konto erhält die Verwaltungsrechte der Instanz. Die
API-Zugangsdaten werden anschliessend unter **Einstellungen → Datentresor**
hinterlegt, nicht in der `.env`.

## Datentresor

API-Zugangsdaten liegen AES-256-GCM-verschlüsselt in der Datenbank. Der
Schlüssel steckt in `ENCRYPTION_KEY` und damit nie in der Datenbank selbst —
ein erbeuteter Datenbank-Abzug enthält keine verwertbaren Zugangsdaten.

Der Klartext wird nach dem Speichern nie wieder ausgegeben, auch nicht an die
Person, die ihn eingetragen hat. Die Oberfläche zeigt ausschliesslich einen
Hinweis wie `sk-a••••mnop`.

> **`ENCRYPTION_KEY` getrennt sichern.** Geht er verloren, sind alle
> hinterlegten Zugangsdaten unlesbar und müssen neu eingetragen werden. Er
> gehört in einen Passwortmanager — nicht neben die Datenbanksicherungen.

Zwei Wege, Zugangsdaten bereitzustellen:

1. **Datentresor** (empfohlen) — je Organisation eigene Schlüssel. Notwendig,
   sobald die App von mehreren Parteien genutzt wird.
2. **Umgebungsvariablen** — greifen, wenn im Tresor nichts hinterlegt ist.
   Praktisch für den Einzelbetrieb.

---

## Befehle

| Befehl | Zweck |
|---|---|
| `./start.sh` | Alles einrichten und starten |
| `npm run dev` | Oberfläche im Entwicklungsmodus |
| `npm run worker` | Worker-Prozess (verarbeitet die Aufträge) |
| `npm run build` | Produktions-Build |
| `npm run smoke` | Funktionstest der Analyse-Kette gegen Beispielseiten |
| `npm run smoke -- https://…` | zusätzlich gegen eine echte Seite |
| `npm run typecheck` | Typen prüfen |
| `npx prisma migrate dev` | Schemaänderung einspielen |
| `npx prisma studio` | Datenbank im Browser ansehen |

---

## Weiterführend

- [`docs/API-ANBINDUNGEN.md`](docs/API-ANBINDUNGEN.md) — welcher Anbieter wofür
  gebraucht wird, was er kostet, was ohne ihn entfällt
- [`docs/DEPLOYMENT-HOSTINGER.md`](docs/DEPLOYMENT-HOSTINGER.md) — Einrichtung
  auf dem eigenen VPS. Ein Befehl richtet Server, Domain und Sicherungen ein:
  `bash deploy/setup-vps.sh seo.ihre-domain.de`
- [`docs/ARCHITEKTUR.md`](docs/ARCHITEKTUR.md) — wie die Teile zusammenspielen
  und warum sie so geschnitten sind
