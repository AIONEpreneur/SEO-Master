# Einrichtung auf dem Hostinger-VPS

Ziel: Die Anwendung läuft unter einer eigenen Subdomain, wird per Push auf
GitHub aktualisiert, und alle Daten bleiben auf dem eigenen Server.

Aufwand: ein Befehl auf dem Server, danach etwa zehn Minuten Wartezeit.

---

## Wo die Daten liegen

Alles bleibt auf dem eigenen Server. Fünf Container, davon ist genau einer von
aussen erreichbar:

| Container | Aufgabe | Von aussen erreichbar |
|---|---|---|
| `caddy` | TLS und Weiterleitung | ja (Port 80/443) |
| `web` | Weboberfläche | nein |
| `worker` | führt die Analysen aus | nein |
| `postgres` | Datenbank | nein |
| `redis` | Warteschlange | nein |

Datenbank und Warteschlange hängen in einem Docker-Netz, das als `internal`
markiert ist — es hat keine Verbindung nach draussen, in keine Richtung. Auch
ein Port-Scan des Servers findet dort nichts: Nach aussen sind nur 22, 80 und
443 offen.

Die Daten selbst liegen in Docker-Volumes auf der Festplatte des VPS:

- `postgres_data` — Projekte, Analysen, Berichte, verschlüsselte Zugangsdaten
- `redis_data` — die Warteschlange der Analyseaufträge
- `caddy_data` — TLS-Zertifikate

Nach aussen gehen ausschliesslich die Anfragen an die Datenanbieter
(DataForSEO, Firecrawl, Apify, PageSpeed, Anthropic) und der Abruf der
analysierten Seiten. Analyseergebnisse verlassen den Server nie.

Die bestehende Website bei Hostinger bleibt davon unberührt — die Anwendung
läuft unter einer eigenen Subdomain.

Läuft auf dem VPS bereits eine andere Anwendung, entfällt der `caddy`-Container:
SEO-Master lauscht dann auf `127.0.0.1:3000` und wird vom vorhandenen
Webserver weitergereicht. An der Abschottung von Datenbank und Warteschlange
ändert das nichts.

## Schritt 1: DNS umstellen

Zeigt die Subdomain bereits woanders hin, wird der bestehende Eintrag ersetzt
— nicht ein zweiter danebengestellt.

Bei einer Subdomain, die im Hostinger-Panel als Website angelegt wurde, steht
dort typischerweise ein **ALIAS**-Eintrag auf Hostingers CDN:

```
ALIAS   seo-master   →   seo-master.aionepreneur.com.cdn.hstgr.net
```

Ein ALIAS und ein A-Record für denselben Namen schliessen sich aus. Also im
Panel unter **Domains → DNS-Zone**:

1. Den **ALIAS**-Eintrag für `seo-master` löschen (Papierkorb-Symbol).
2. Einen neuen Eintrag anlegen:

| Typ | Name | Wert | TTL |
|---|---|---|---|
| A | `seo-master` | *IPv4 des VPS* | 300 |

Die kurze TTL von 300 Sekunden macht spätere Korrekturen schnell wirksam.
Läuft alles, kann sie auf 3600 erhöht werden.

Drei Dinge, an denen es sonst scheitert:

- **Genau ein A-Record.** Mehrere Einträge verteilen den Zugriff auf mehrere
  Ziele; ein Teil der Aufrufe landet dann am falschen Ort.
- **Keine AAAA-Einträge**, sofern der VPS nicht selbst unter IPv6 erreichbar
  ist. Browser versuchen IPv6 zuerst — ein übrig gebliebener AAAA-Eintrag
  führt am VPS vorbei, obwohl der A-Record stimmt.
- **Website im Panel entkoppeln.** Ist die Subdomain dort als Website
  eingerichtet, gehört sie entfernt, sonst setzt Hostinger den DNS-Eintrag
  zurück.

Die IPv4 des VPS steht im Hostinger-Panel unter **VPS → Übersicht**. Läuft
dort bereits etwas, verrät es auch ein Blick auf eine bestehende Domain:

```bash
getent ahosts meine-andere-domain.de | head -1
```

Prüfen, ob die Änderung angekommen ist:

```bash
bash deploy/dns-check.sh seo-master.aionepreneur.com IPV4-DES-VPS
```

Das Skript meldet mehrfache A-Records und übrig gebliebene AAAA-Einträge. Bis
eine Änderung überall angekommen ist, vergehen meist 5 bis 30 Minuten.

## Schritt 2: Einrichten

Per SSH auf den VPS (Zugangsdaten im Hostinger-VPS-Panel):

```bash
ssh root@IP-DES-VPS
```

Dann ein Befehl — die eigene Domain einsetzen:

```bash
git clone -b claude/seo-analysis-app-backend-hbufiw \
  https://github.com/AIONEpreneur/SEO-Master.git /tmp/seo-master

bash /tmp/seo-master/deploy/setup-vps.sh seo-master.aionepreneur.com
```

Der Zweig muss beim Klonen angegeben werden, solange die Arbeit nicht auf
`main` liegt — sonst wird ein leeres Verzeichnis geholt. Das Skript übernimmt
denselben Zweig danach automatisch für die Anwendung.

Das Skript erledigt alles: System aktualisieren, Docker installieren,
Firewall einrichten (nur SSH, HTTP, HTTPS), ein eigenes Benutzerkonto für die
Anwendung anlegen, das Repository klonen, Konfiguration und Schlüssel
erzeugen, Container bauen und starten, TLS-Zertifikat abholen und die
tägliche Sicherung einrichten.

Der erste Durchlauf dauert etwa zehn Minuten. Das Skript lässt sich gefahrlos
erneut ausführen; eine vorhandene `.env` wird nie überschrieben.

### Läuft auf dem Server schon eine andere Website?

Dann sind Port 80 und 443 belegt, und ein zweiter Webserver kann sie nicht
ebenfalls belegen. Das Skript erkennt das und wählt automatisch die Variante
ohne eigenen Webserver: SEO-Master lauscht dann nur auf `127.0.0.1:3000`, und
der bereits vorhandene Webserver reicht die Anfragen weiter.

Diese Weiterleitung ist der einzige Schritt, der dann von Hand kommt — das
Skript gibt am Ende die passenden Befehle für nginx oder Caddy aus. Vorlagen
und Erklärung liegen in
[`deploy/reverse-proxy/`](../deploy/reverse-proxy/LIESMICH.md).

Die bestehende Website bleibt dabei unberührt; SEO-Master bekommt einen
eigenen Server-Block für die eigene Subdomain.

> Am Ende gibt das Skript den **`ENCRYPTION_KEY`** aus. Er verschlüsselt alle
> API-Zugangsdaten im Datentresor. Diesen Schlüssel sofort in den
> Passwortmanager übertragen — geht er verloren, müssen alle Zugangsdaten neu
> eingetragen werden. Er gehört **nicht** neben die Datenbanksicherungen,
> sonst schützt die Verschlüsselung nichts mehr.

Zeigt der A-Record noch nicht auf den Server, sagt das Skript das und läuft
weiter — das Zertifikat kommt dann nach, sobald der Eintrag greift.

## Schritt 3: Erstes Konto und Zugangsdaten

`https://seo-master.aionepreneur.com` aufrufen. Beim ersten Aufruf führt die Seite
direkt zur Einrichtung; das erste Konto erhält die Verwaltungsrechte.

Danach **Einstellungen → Datentresor**: je Anbieter die Zugangsdaten eintragen
und auf *Prüfen* klicken — so fällt ein Tippfehler sofort auf und nicht erst
mitten im ersten Analyselauf. Reihenfolge nach Wichtigkeit: DataForSEO,
Firecrawl, Anthropic, dann Apify und PageSpeed.

Die Schlüssel gehören **nicht** in die `.env` auf dem Server. Über den
Datentresor liegen sie verschlüsselt in der Datenbank.

## Schritt 4: Automatisches Ausrollen über GitHub

Im Repository unter **Settings → Secrets and variables → Actions** anlegen:

| Secret | Wert |
|---|---|
| `VPS_HOST` | IP-Adresse des VPS |
| `VPS_USER` | `seomaster` |
| `VPS_SSH_KEY` | privater SSH-Schlüssel (siehe unten) |
| `VPS_PATH` | `/home/seomaster/app` |

Schlüsselpaar für die Ausrollung erzeugen — auf dem eigenen Rechner, nicht auf
dem VPS:

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
cat deploy_key.pub    # auf dem VPS in /home/seomaster/.ssh/authorized_keys eintragen
cat deploy_key        # vollständigen Inhalt als VPS_SSH_KEY hinterlegen
```

Ab jetzt löst jeder Push auf `main` einen Build aus. Der Ablauf prüft erst
Typen und Build und rollt nur dann aus — ein Fehler im Code erreicht den Server
nicht.

---

## Sicherungen

Skript einrichten:

```bash
crontab -e
# Zeile ergänzen:
0 3 * * * /home/seomaster/app/deploy/backup.sh >> /home/seomaster/backup.log 2>&1
```

Sichert täglich um 3 Uhr die Datenbank nach `backups/` und hält 14 Tage vor.

Wiederherstellung:

```bash
gunzip -c backups/seomaster_2026-08-24_0300.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U seomaster seomaster
```

> Die Sicherung enthält die verschlüsselten Zugangsdaten, aber nicht den
> Schlüssel. Zur vollständigen Wiederherstellung werden **beide** gebraucht:
> die Sicherung und der `ENCRYPTION_KEY` aus dem Passwortmanager.

---

## Betrieb

```bash
cd /home/seomaster/app

# Zustand
docker compose -f docker-compose.prod.yml ps

# Protokolle
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f web

# Nach Änderungen von Hand aktualisieren
git pull && docker compose -f docker-compose.prod.yml up -d --build

# Neustart eines Dienstes
docker compose -f docker-compose.prod.yml restart worker

# Speicherplatz aufräumen
docker system prune -af
```

**Mehr Analysen gleichzeitig:** `WORKER_CONCURRENCY` in der `.env` erhöhen,
dann `docker compose -f docker-compose.prod.yml up -d worker`. Für einen VPS
mit 2 GB RAM ist 2 ein sinnvoller Wert; jeder gleichzeitige Lauf braucht
Arbeitsspeicher und Anbieter-Kontingent.

---

## Wenn etwas nicht läuft

**Kein TLS-Zertifikat.** Zeigt der A-Record schon auf den VPS?
`dig seo-master.aionepreneur.com +short`. Sind Port 80 und 443 offen? `ufw status`.
Let's Encrypt braucht Port 80 erreichbar. Protokoll: `docker compose -f
docker-compose.prod.yml logs caddy`.

**Analysen bleiben in der Warteschlange.** Läuft der Worker?
`docker compose -f docker-compose.prod.yml ps worker`. Sein Protokoll zeigt
den Grund: `logs worker`.

**„Die Seite antwortete mit HTTP 403".** Die Zielseite sperrt den Abruf. Mit
hinterlegten Firecrawl-Zugangsdaten gelingt er meist trotzdem.

**Anbieter meldet 401.** Zugangsdaten prüfen: Datentresor → *Prüfen*. Bei
DataForSEO ist das Passwort der API-Schlüssel, nicht das Anmeldepasswort.
