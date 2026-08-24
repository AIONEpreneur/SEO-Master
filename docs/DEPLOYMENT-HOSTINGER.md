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

## Schritt 1: DNS

Im Hostinger-Panel unter **Domains → DNS-Zone** einen A-Record anlegen:

| Typ | Name | Wert | TTL |
|---|---|---|---|
| A | `seo` | *IP-Adresse des VPS* | 3600 |

Die IP steht im VPS-Panel. Bis die Änderung greift, können bis zu 30 Minuten
vergehen. Prüfen mit `dig seo.ihre-domain.de +short`.

---

## Schritt 2: Einrichten

Per SSH auf den VPS (Zugangsdaten im Hostinger-VPS-Panel):

```bash
ssh root@IP-DES-VPS
```

Dann ein Befehl — die eigene Domain einsetzen:

```bash
git clone https://github.com/AIONEpreneur/SEO-Master.git /tmp/seo-master
bash /tmp/seo-master/deploy/setup-vps.sh seo.ihre-domain.de
```

Das Skript erledigt alles: System aktualisieren, Docker installieren,
Firewall einrichten (nur SSH, HTTP, HTTPS), ein eigenes Benutzerkonto für die
Anwendung anlegen, das Repository klonen, Konfiguration und Schlüssel
erzeugen, Container bauen und starten, TLS-Zertifikat abholen und die
tägliche Sicherung einrichten.

Der erste Durchlauf dauert etwa zehn Minuten. Das Skript lässt sich gefahrlos
erneut ausführen; eine vorhandene `.env` wird nie überschrieben.

> Am Ende gibt das Skript den **`ENCRYPTION_KEY`** aus. Er verschlüsselt alle
> API-Zugangsdaten im Datentresor. Diesen Schlüssel sofort in den
> Passwortmanager übertragen — geht er verloren, müssen alle Zugangsdaten neu
> eingetragen werden. Er gehört **nicht** neben die Datenbanksicherungen,
> sonst schützt die Verschlüsselung nichts mehr.

Zeigt der A-Record noch nicht auf den Server, sagt das Skript das und läuft
weiter — das Zertifikat kommt dann nach, sobald der Eintrag greift.

## Schritt 3: Erstes Konto und Zugangsdaten

`https://seo.ihre-domain.de` aufrufen. Beim ersten Aufruf führt die Seite
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
`dig seo.ihre-domain.de +short`. Sind Port 80 und 443 offen? `ufw status`.
Let's Encrypt braucht Port 80 erreichbar. Protokoll: `docker compose -f
docker-compose.prod.yml logs caddy`.

**Analysen bleiben in der Warteschlange.** Läuft der Worker?
`docker compose -f docker-compose.prod.yml ps worker`. Sein Protokoll zeigt
den Grund: `logs worker`.

**„Die Seite antwortete mit HTTP 403".** Die Zielseite sperrt den Abruf. Mit
hinterlegten Firecrawl-Zugangsdaten gelingt er meist trotzdem.

**Anbieter meldet 401.** Zugangsdaten prüfen: Datentresor → *Prüfen*. Bei
DataForSEO ist das Passwort der API-Schlüssel, nicht das Anmeldepasswort.
