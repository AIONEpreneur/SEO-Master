#!/usr/bin/env bash
#
# Erstinstallation auf einem frischen VPS.
#
# Richtet Docker, Firewall, Benutzerkonto und die Anwendung ein und startet
# sie hinter einem TLS-Zertifikat. Danach ist die Anwendung unter der
# angegebenen Domain erreichbar.
#
# Aufruf als root:
#   bash deploy/setup-vps.sh seo.meine-domain.de
#
# Das Skript kann gefahrlos erneut ausgeführt werden – vorhandene Schritte
# werden übersprungen, die .env wird nie überschrieben.
#
set -uo pipefail

BLAU=$'\033[34m'; GRUEN=$'\033[32m'; ROT=$'\033[31m'; GELB=$'\033[33m'; GRAU=$'\033[90m'; AUS=$'\033[0m'
schritt() { printf "\n%s→ %s%s\n" "$BLAU" "$1" "$AUS"; }
ok()      { printf "  %s✓%s %s\n" "$GRUEN" "$AUS" "$1"; }
warn()    { printf "  %s!%s %s\n" "$GELB" "$AUS" "$1"; }
hinweis() { printf "  %s%s%s\n" "$GRAU" "$1" "$AUS"; }
abbruch() { printf "\n%s✗ %s%s\n\n" "$ROT" "$1" "$AUS"; [ $# -gt 1 ] && printf "%s\n\n" "$2"; exit 1; }

DOMAIN="${1:-}"
BENUTZER="seomaster"
ZIEL="/home/$BENUTZER/app"
REPO="${REPO_URL:-https://github.com/AIONEpreneur/SEO-Master.git}"

# Standard ist der Zweig, aus dem dieses Skript stammt. Das vermeidet den
# häufigsten Fehlgriff: von 'main' zu holen, während die Arbeit auf einem
# Entwicklungszweig liegt und 'main' noch leer ist.
EIGENER_ZWEIG="$(git -C "$(dirname "$0")/.." rev-parse --abbrev-ref HEAD 2>/dev/null)"
BRANCH="${REPO_BRANCH:-${EIGENER_ZWEIG:-main}}"

[ -n "$DOMAIN" ] || abbruch "Es fehlt die Domain." \
"Aufruf:  bash deploy/setup-vps.sh seo.meine-domain.de

Die Domain muss bereits per A-Record auf die IP dieses Servers zeigen."

[ "$(id -u)" = "0" ] || abbruch "Das Skript braucht Root-Rechte." "Aufruf:  sudo bash deploy/setup-vps.sh $DOMAIN"

printf "\n%sSEO-Master – Einrichtung auf dem Server%s\n" "$BLAU" "$AUS"
printf "%sDomain: %s%s\n" "$GRAU" "$DOMAIN" "$AUS"

# --- DNS prüfen -----------------------------------------------------------
#
# Ohne passenden A-Record scheitert später die Zertifikatsausstellung. Besser
# jetzt warnen als nach zehn Minuten Einrichtung.

schritt "DNS prüfen"
SERVER_IP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
SERVER_IP6="$(curl -fsS --max-time 10 https://api6.ipify.org 2>/dev/null || true)"

# getent liefert A- und AAAA-Einträge gemischt; sie werden getrennt bewertet.
ALLE="$(getent ahosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u)"
IPV4="$(printf '%s\n' "$ALLE" | grep -E '^[0-9]+\.' || true)"
IPV6="$(printf '%s\n' "$ALLE" | grep ':' || true)"

if [ -z "$ALLE" ]; then
  warn "$DOMAIN löst noch nicht auf."
  hinweis "Der A-Record fehlt oder ist noch nicht verteilt. Die Einrichtung läuft weiter,"
  hinweis "das TLS-Zertifikat kommt aber erst, wenn der Eintrag greift."
else
  if printf '%s\n' "$IPV4" | grep -qx "$SERVER_IP"; then
    ok "$DOMAIN zeigt per IPv4 auf diesen Server ($SERVER_IP)"
  else
    warn "$DOMAIN zeigt auf $(printf '%s' "$IPV4" | tr '\n' ' '), dieser Server hat $SERVER_IP."
    hinweis "A-Record im DNS-Panel auf $SERVER_IP ändern, sonst kommt kein Zertifikat zustande."
  fi

  # Ein IPv6-Eintrag, den dieser Server nicht bedient, führt Browser an ihm
  # vorbei: sie versuchen IPv6 zuerst und landen beim alten Ziel.
  if [ -n "$IPV6" ] && ! printf '%s\n' "$IPV6" | grep -qx "${SERVER_IP6:-KEINE}"; then
    warn "Es bestehen AAAA-Einträge (IPv6), die nicht auf diesen Server zeigen:"
    hinweis "$(printf '%s' "$IPV6" | tr '\n' ' ')"
    hinweis "Browser bevorzugen IPv6 und landen damit am alten Ziel."
    hinweis "Diese AAAA-Einträge im DNS-Panel löschen${SERVER_IP6:+ oder auf $SERVER_IP6 ändern}."
  fi
fi

# --- System ---------------------------------------------------------------

schritt "System aktualisieren"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null 2>&1
apt-get upgrade -y -qq >/dev/null 2>&1
apt-get install -y -qq curl git ufw >/dev/null 2>&1
ok "Pakete aktuell"

schritt "Docker einrichten"
if command -v docker >/dev/null 2>&1; then
  ok "Docker bereits installiert ($(docker --version | cut -d, -f1))"
else
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || abbruch "Docker liess sich nicht installieren."
  ok "Docker installiert"
fi
systemctl enable --now docker >/dev/null 2>&1
docker info >/dev/null 2>&1 || abbruch "Docker läuft nicht." "Prüfen mit:  systemctl status docker"

# --- Betriebsart bestimmen -------------------------------------------------
#
# Läuft auf dem Server bereits ein Webserver, sind Port 80 und 443 belegt.
# Ein zweiter kann sie nicht ebenfalls belegen. Dann bringt SEO-Master keinen
# eigenen mit, sondern lauscht auf 127.0.0.1 und wird vom vorhandenen
# Webserver weitergereicht.

schritt "Belegte Ports prüfen"

port_belegt() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :$1" 2>/dev/null | grep -q LISTEN
  else
    netstat -ltn 2>/dev/null | grep -qE "[:.]$1 +.*LISTEN"
  fi
}

VORHANDENER_SERVER=""
for dienst in nginx caddy apache2 httpd; do
  if systemctl is-active --quiet "$dienst" 2>/dev/null; then
    VORHANDENER_SERVER="$dienst"
    break
  fi
done

if port_belegt 80 || port_belegt 443; then
  COMPOSE="docker-compose.vps.yml"
  warn "Port 80/443 sind bereits belegt${VORHANDENER_SERVER:+ (durch $VORHANDENER_SERVER)}."
  hinweis "SEO-Master startet deshalb ohne eigenen Webserver und lauscht auf"
  hinweis "127.0.0.1:${WEB_PORT:-3000}. Die Weiterleitung wird am Ende erklärt."
else
  COMPOSE="docker-compose.prod.yml"
  ok "Port 80 und 443 sind frei – eigener Webserver mit automatischem Zertifikat"
fi

schritt "Firewall einrichten"
ufw allow 22/tcp >/dev/null 2>&1
ufw allow 80/tcp >/dev/null 2>&1
ufw allow 443/tcp >/dev/null 2>&1
ufw --force enable >/dev/null 2>&1
ok "Offen: SSH (22), HTTP (80), HTTPS (443) – sonst nichts"
hinweis "Datenbank und Warteschlange sind von aussen nicht erreichbar."

# --- Benutzerkonto --------------------------------------------------------

schritt "Benutzerkonto anlegen"
if id "$BENUTZER" >/dev/null 2>&1; then
  ok "Benutzer '$BENUTZER' vorhanden"
else
  adduser --disabled-password --gecos "" "$BENUTZER" >/dev/null 2>&1
  ok "Benutzer '$BENUTZER' angelegt"
fi
usermod -aG docker "$BENUTZER"

# SSH-Zugang des Root-Kontos übernehmen, damit der Zugriff erhalten bleibt.
if [ -f /root/.ssh/authorized_keys ]; then
  mkdir -p "/home/$BENUTZER/.ssh"
  cp /root/.ssh/authorized_keys "/home/$BENUTZER/.ssh/"
  chown -R "$BENUTZER:$BENUTZER" "/home/$BENUTZER/.ssh"
  chmod 700 "/home/$BENUTZER/.ssh"
  chmod 600 "/home/$BENUTZER/.ssh/authorized_keys"
  ok "SSH-Schlüssel übernommen"
fi

# --- Anwendung ------------------------------------------------------------

schritt "Anwendung holen"
if [ -d "$ZIEL/.git" ]; then
  su - "$BENUTZER" -c "cd $ZIEL && git fetch origin $BRANCH && git reset --hard origin/$BRANCH" >/dev/null 2>&1
  ok "Auf aktuellen Stand gebracht"
else
  su - "$BENUTZER" -c "git clone -b $BRANCH $REPO $ZIEL" >/dev/null 2>&1 \
    || abbruch "Das Repository liess sich nicht klonen." \
"Bei einem privaten Repository wird ein Deploy Key gebraucht. Anlegen mit:

  su - $BENUTZER
  ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ''
  cat ~/.ssh/id_ed25519.pub

Den ausgegebenen Schlüssel auf GitHub eintragen unter:
  Repository → Settings → Deploy keys → Add deploy key"
  ok "Repository geklont nach $ZIEL"
fi

# --- Konfiguration --------------------------------------------------------

schritt "Konfiguration"
ENV_DATEI="$ZIEL/.env"

if [ -f "$ENV_DATEI" ]; then
  ok "Vorhandene .env bleibt unverändert"
  NEU_ANGELEGT=0
else
  cp "$ZIEL/.env.example" "$ENV_DATEI"

  # Werte über die Umgebung an Perl übergeben: sonst liest Perl das @ in
  # einer Verbindungszeichenfolge als Array und verschluckt es.
  SM_ENC="$(openssl rand -base64 32)" perl -pi -e 's|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY="$ENV{SM_ENC}"|' "$ENV_DATEI"
  SM_SES="$(openssl rand -base64 32)" perl -pi -e 's|^SESSION_SECRET=.*|SESSION_SECRET="$ENV{SM_SES}"|' "$ENV_DATEI"
  SM_PWD="$(openssl rand -base64 24 | tr -d '/+=')" perl -pi -e 's|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD="$ENV{SM_PWD}"|' "$ENV_DATEI"
  SM_DOM="$DOMAIN"          perl -pi -e 's|^DOMAIN=.*|DOMAIN="$ENV{SM_DOM}"|' "$ENV_DATEI"
  SM_URL="https://$DOMAIN"  perl -pi -e 's|^APP_URL=.*|APP_URL="$ENV{SM_URL}"|' "$ENV_DATEI"

  chown "$BENUTZER:$BENUTZER" "$ENV_DATEI"
  chmod 600 "$ENV_DATEI"
  ok ".env angelegt, Schlüssel erzeugt"
  NEU_ANGELEGT=1
fi

# --- Starten --------------------------------------------------------------

schritt "Container bauen und starten (einige Minuten)"
su - "$BENUTZER" -c "cd $ZIEL && docker compose -f $COMPOSE up -d --build" 2>&1 | tail -3
ok "Container gestartet"

schritt "Auf die Anwendung warten"
BEREIT=0
for i in $(seq 1 90); do
  if su - "$BENUTZER" -c "cd $ZIEL && docker compose -f $COMPOSE ps --status running" 2>/dev/null | grep -q "web"; then
    BEREIT=1; break
  fi
  printf "."
  sleep 2
done
printf "\n"
[ "$BEREIT" = "1" ] && ok "Anwendung läuft" || warn "Die Anwendung ist noch nicht bereit – Protokoll prüfen (siehe unten)."

if [ "$COMPOSE" = "docker-compose.prod.yml" ]; then
schritt "TLS-Zertifikat"
hinweis "Caddy holt das Zertifikat selbstständig; das dauert bis zu zwei Minuten."
for i in $(seq 1 45); do
  if curl -fsS -o /dev/null --max-time 5 "https://$DOMAIN" 2>/dev/null; then
    ok "https://$DOMAIN antwortet"; break
  fi
  printf "."
  sleep 4
  [ "$i" = "45" ] && { printf "\n"; warn "Noch kein Zertifikat. Meist fehlt der A-Record."
    hinweis "Prüfen mit:  docker compose -f $COMPOSE logs caddy"; }
done
else
  schritt "Weiterleitung einrichten"
  if curl -fsS -o /dev/null --max-time 10 "http://127.0.0.1:${WEB_PORT:-3000}/login" 2>/dev/null; then
    ok "Anwendung antwortet auf 127.0.0.1:${WEB_PORT:-3000}"
  else
    warn "Anwendung antwortet noch nicht auf 127.0.0.1:${WEB_PORT:-3000}"
  fi
  hinweis "Noch fehlt die Weiterleitung vom vorhandenen Webserver."
  hinweis "Vorlagen und Anleitung: $ZIEL/deploy/reverse-proxy/LIESMICH.md"
fi

# --- Sicherungen ----------------------------------------------------------

schritt "Tägliche Sicherung einrichten"
CRON="0 3 * * * $ZIEL/deploy/backup.sh >> /home/$BENUTZER/backup.log 2>&1"
if su - "$BENUTZER" -c "crontab -l 2>/dev/null" | grep -qF "backup.sh"; then
  ok "Sicherung bereits eingerichtet"
else
  (su - "$BENUTZER" -c "crontab -l 2>/dev/null"; echo "$CRON") | su - "$BENUTZER" -c "crontab -" >/dev/null 2>&1
  ok "Täglich um 3 Uhr, 14 Tage Aufbewahrung"
fi

# --- Abschluss ------------------------------------------------------------

printf "\n%s────────────────────────────────────────────────────%s\n" "$GRUEN" "$AUS"
printf "  %sEinrichtung abgeschlossen%s\n\n" "$GRUEN" "$AUS"
printf "  Adresse:  https://%s\n" "$DOMAIN"
printf "  Ordner:   %s\n" "$ZIEL"
printf "%s────────────────────────────────────────────────────%s\n" "$GRUEN" "$AUS"

if [ "$NEU_ANGELEGT" = "1" ]; then
  printf "\n%s  WICHTIG – jetzt sichern%s\n\n" "$GELB" "$AUS"
  printf "  Der folgende Schlüssel verschlüsselt alle API-Zugangsdaten im\n"
  printf "  Datentresor. Geht er verloren, müssen sie alle neu eingetragen werden.\n"
  printf "  Er gehört in den Passwortmanager – nicht neben die Sicherungen.\n\n"
  grep '^ENCRYPTION_KEY=' "$ENV_DATEI" | sed 's/^/    /'
  printf "\n"
fi

printf "\n%sNächste Schritte%s\n\n" "$BLAU" "$AUS"

if [ "$COMPOSE" = "docker-compose.vps.yml" ]; then
  printf "  %s0. Weiterleitung einrichten – ohne sie ist die Domain nicht erreichbar.%s\n\n" "$GELB" "$AUS"
  case "$VORHANDENER_SERVER" in
    nginx)
      printf "     cp %s/deploy/reverse-proxy/nginx.conf /etc/nginx/sites-available/seo-master\n" "$ZIEL"
      printf "     ln -s /etc/nginx/sites-available/seo-master /etc/nginx/sites-enabled/\n"
      printf "     nginx -t && systemctl reload nginx\n"
      printf "     certbot --nginx -d %s\n\n" "$DOMAIN"
      ;;
    caddy)
      printf "     cat %s/deploy/reverse-proxy/Caddyfile-block >> /etc/caddy/Caddyfile\n" "$ZIEL"
      printf "     systemctl reload caddy\n\n"
      ;;
    *)
      printf "     Anleitung: %s/deploy/reverse-proxy/LIESMICH.md\n\n" "$ZIEL"
      ;;
  esac
fi

printf "  1. https://%s aufrufen und das erste Konto anlegen.\n" "$DOMAIN"
printf "     Es erhält die Verwaltungsrechte.\n\n"
printf "  2. Unter Einstellungen → Datentresor die API-Schlüssel eintragen\n"
printf "     und je Anbieter auf 'Prüfen' klicken.\n\n"
printf "  Protokolle ansehen:\n"
printf "    cd %s && docker compose -f %s logs -f web\n\n" "$ZIEL" "$COMPOSE"
