# Einrichtung auf dem Hostinger-VPS

Ziel: Die Anwendung läuft unter einer eigenen Subdomain, wird per Push auf
GitHub aktualisiert, und alle Daten bleiben auf dem eigenen Server.

Aufwand beim ersten Mal: etwa 45 Minuten.

---

## Was wo läuft

Der VPS betreibt fünf Container:

| Container | Aufgabe | Von aussen erreichbar |
|---|---|---|
| `caddy` | TLS und Weiterleitung | ja (Port 80/443) |
| `web` | Weboberfläche | nein |
| `worker` | führt die Analysen aus | nein |
| `postgres` | Datenbank | nein |
| `redis` | Warteschlange | nein |

Datenbank und Redis hängen in einem abgeschotteten Docker-Netz ohne Verbindung
nach aussen. Erreichbar ist ausschliesslich Caddy.

Die bestehende Website bei Hostinger bleibt unberührt — die Anwendung läuft
unter einer eigenen Subdomain, etwa `seo.ihre-domain.de`.

---

## Schritt 1: DNS

Im Hostinger-Panel unter **Domains → DNS-Zone** einen A-Record anlegen:

| Typ | Name | Wert | TTL |
|---|---|---|---|
| A | `seo` | *IP-Adresse des VPS* | 3600 |

Die IP steht im VPS-Panel. Bis die Änderung greift, können bis zu 30 Minuten
vergehen. Prüfen mit `dig seo.ihre-domain.de +short`.

---

## Schritt 2: Server vorbereiten

Per SSH auf den VPS (Zugangsdaten im Hostinger-VPS-Panel):

```bash
ssh root@IP-DES-VPS
```

Docker installieren, falls noch nicht vorhanden:

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
docker --version
```

Einen eigenen Benutzer für die Anwendung anlegen — der Betrieb als `root` ist
unnötig riskant:

```bash
adduser --disabled-password --gecos "" seomaster
usermod -aG docker seomaster
mkdir -p /home/seomaster/.ssh
cp ~/.ssh/authorized_keys /home/seomaster/.ssh/
chown -R seomaster:seomaster /home/seomaster/.ssh
chmod 700 /home/seomaster/.ssh
```

Firewall: nur SSH, HTTP und HTTPS zulassen.

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable
ufw status
```

---

## Schritt 3: Anwendung ablegen

Als Benutzer `seomaster`:

```bash
su - seomaster
git clone https://github.com/AIONEpreneur/SEO-Master.git app
cd app
```

Bei einem privaten Repository wird ein Deploy Key benötigt:

```bash
ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# Ausgabe in GitHub eintragen unter:
# Repository → Settings → Deploy keys → Add deploy key (Schreibrechte nicht nötig)
```

---

## Schritt 4: Konfiguration

```bash
cp .env.example .env
nano .env
```

Auszufüllen:

```bash
DOMAIN="seo.ihre-domain.de"
APP_URL="https://seo.ihre-domain.de"

# Erzeugen mit den Befehlen unten
POSTGRES_PASSWORD="…"
ENCRYPTION_KEY="…"
SESSION_SECRET="…"

# Solange die App nur intern genutzt wird
ALLOWED_SIGNUP_EMAILS="ihre@email.de"
```

Die drei Geheimnisse erzeugen:

```bash
echo "POSTGRES_PASSWORD=\"$(openssl rand -base64 24)\""
echo "ENCRYPTION_KEY=\"$(openssl rand -base64 32)\""
echo "SESSION_SECRET=\"$(openssl rand -base64 32)\""
```

> **Den `ENCRYPTION_KEY` jetzt in den Passwortmanager übertragen.** Er
> verschlüsselt alle API-Zugangsdaten im Tresor. Geht er verloren, müssen alle
> Schlüssel neu eingetragen werden. Er darf nicht neben den Datenbanksicherungen
> liegen — sonst schützt die Verschlüsselung nichts.

Die API-Schlüssel der Anbieter müssen **nicht** in die `.env`. Sie werden
später über die Oberfläche im Datentresor hinterlegt, verschlüsselt.

---

## Schritt 5: Starten

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Der erste Durchlauf dauert einige Minuten. Danach:

```bash
docker compose -f docker-compose.prod.yml ps        # alle Container "running"?
docker compose -f docker-compose.prod.yml logs -f web
```

Caddy holt das TLS-Zertifikat selbstständig. Nach etwa einer Minute ist
`https://seo.ihre-domain.de` erreichbar.

Beim ersten Aufruf führt die Seite direkt zur Einrichtung. Das erste Konto
erhält die Verwaltungsrechte.

---

## Schritt 6: Zugangsdaten hinterlegen

In der Anwendung: **Einstellungen → Datentresor**. Je Anbieter eintragen und
anschliessend auf *Prüfen* klicken — so fällt ein Tippfehler sofort auf und
nicht erst mitten im ersten Analyselauf.

Reihenfolge nach Wichtigkeit: DataForSEO, Firecrawl, Anthropic, dann Apify und
PageSpeed.

---

## Schritt 7: Automatisches Ausrollen über GitHub

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
