#!/usr/bin/env bash
#
# SEO-Master starten.
#
# Prüft die Voraussetzungen, richtet beim ersten Mal alles ein und öffnet die
# Anwendung im Browser. Datenbank und Warteschlange laufen wahlweise über
# Docker oder direkt auf dem Rechner – je nachdem, was vorhanden ist.
#
#   ./start.sh
#
set -uo pipefail

cd "$(dirname "$0")"

BLAU=$'\033[34m'; GRUEN=$'\033[32m'; ROT=$'\033[31m'; GELB=$'\033[33m'; GRAU=$'\033[90m'; AUS=$'\033[0m'
schritt() { printf "\n%s→ %s%s\n" "$BLAU" "$1" "$AUS"; }
ok()      { printf "  %s✓%s %s\n" "$GRUEN" "$AUS" "$1"; }
warn()    { printf "  %s!%s %s\n" "$GELB" "$AUS" "$1"; }
hinweis() { printf "  %s%s%s\n" "$GRAU" "$1" "$AUS"; }
abbruch() {
  printf "\n%s✗ %s%s\n\n" "$ROT" "$1" "$AUS"
  [ $# -gt 1 ] && printf "%s\n\n" "$2"
  exit 1
}

printf "\n%sSEO-Master%s\n" "$BLAU" "$AUS"

# --- Node -----------------------------------------------------------------

schritt "Voraussetzungen prüfen"

command -v node >/dev/null 2>&1 || abbruch "Node.js ist nicht installiert." \
"Node.js 22 oder neuer von https://nodejs.org herunterladen (Variante 'LTS'),
installieren, Terminal neu öffnen, dann erneut ./start.sh"

NODE_MAJOR="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
[ "$NODE_MAJOR" -ge 22 ] || abbruch "Node.js ist zu alt (gefunden: $(node -v), gebraucht: 22 oder neuer)." \
"Neue Version von https://nodejs.org installieren, Terminal neu öffnen, dann erneut ./start.sh"
ok "Node.js $(node -v)"

# --- Wie werden Datenbank und Warteschlange betrieben? --------------------
#
# Erreichbare Dienste haben Vorrang. Danach Docker, danach Homebrew. So läuft
# das Skript auf einem Rechner mit Docker genauso wie auf einem ohne.

lauscht() {
  # Prüft, ob auf dem Port etwas antwortet – ohne zusätzliche Werkzeuge.
  node -e "
    const net = require('net')
    const s = net.connect($1, '127.0.0.1')
    s.on('connect', () => { s.end(); process.exit(0) })
    s.on('error', () => process.exit(1))
    setTimeout(() => process.exit(1), 1500)
  " >/dev/null 2>&1
}

BETRIEB=""
if lauscht 5432; then
  BETRIEB="vorhanden"
  ok "PostgreSQL läuft bereits auf Port 5432"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  BETRIEB="docker"
  ok "Docker läuft"
elif command -v brew >/dev/null 2>&1; then
  BETRIEB="brew"
  ok "Homebrew gefunden"
else
  abbruch "Es fehlt eine Datenbank (PostgreSQL) und eine Warteschlange (Redis)." \
"Es gibt zwei Wege. Der zweite ist auf einem Mac der schnellere:

1) Docker Desktop installieren
   https://www.docker.com/products/docker-desktop
   Installieren, öffnen, warten bis das Wal-Symbol oben ruhig steht.

2) Homebrew installieren (Paketverwaltung für den Mac)
   Diesen Befehl ins Terminal kopieren:

   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"

   Danach Terminal neu öffnen.

Anschliessend erneut ./start.sh — den Rest erledigt das Skript."
fi

# --- Konfiguration --------------------------------------------------------

# Welcher Zugang zur Datenbank passt?
#
# Über Docker gehört sie dem Benutzer 'seomaster', direkt auf dem Rechner dem
# angemeldeten Benutzerkonto. Statt das zu raten, werden beide Zugänge gegen
# die Standarddatenbank 'postgres' geprüft und der genommen, der antwortet.
zugang_geht() {
  if command -v psql >/dev/null 2>&1; then
    psql "$1" -tAc 'SELECT 1' >/dev/null 2>&1
  else
    # Ohne psql übernimmt Prisma den Test – langsamer, aber immer verfügbar.
    echo 'SELECT 1;' | npx --no-install prisma db execute --url "$1" --stdin >/dev/null 2>&1
  fi
}

DB_DOCKER="postgresql://seomaster:seomaster@localhost:5432"
DB_LOKAL="postgresql://$(whoami)@localhost:5432"

if [ "$BETRIEB" = "docker" ]; then
  DB_URL="$DB_DOCKER/seomaster"
elif zugang_geht "$DB_LOKAL/postgres"; then
  DB_URL="$DB_LOKAL/seomaster"
elif zugang_geht "$DB_DOCKER/postgres"; then
  DB_URL="$DB_DOCKER/seomaster"
else
  DB_URL="$DB_LOKAL/seomaster"
fi

if [ ! -f .env ]; then
  schritt "Konfiguration anlegen"
  cp .env.example .env

  # Der ENCRYPTION_KEY verschlüsselt später alle API-Zugangsdaten im
  # Datentresor. Er wird hier einmal erzeugt und darf nicht verloren gehen.
  #
  # Die Werte gehen über die Umgebung an Perl, nicht in den Ersetzungstext:
  # sonst würde Perl das @ in @localhost als Array lesen und verschlucken.
  SM_KEY="$(openssl rand -base64 32)" perl -pi -e 's|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY="$ENV{SM_KEY}"|' .env
  SM_SEC="$(openssl rand -base64 32)" perl -pi -e 's|^SESSION_SECRET=.*|SESSION_SECRET="$ENV{SM_SEC}"|' .env
  SM_DB="$DB_URL"                     perl -pi -e 's|^DATABASE_URL=.*|DATABASE_URL="$ENV{SM_DB}"|' .env

  ok "Datei .env angelegt, Schlüssel erzeugt"
  hinweis "Die API-Schlüssel trägst du später in der App ein, nicht in dieser Datei."
else
  ok "Konfiguration vorhanden (.env)"
fi

# --- Pakete ---------------------------------------------------------------

if [ ! -d node_modules ]; then
  schritt "Pakete installieren (ein bis zwei Minuten)"
  npm install --no-audit --no-fund || abbruch "Die Installation der Pakete ist fehlgeschlagen."
  ok "Pakete installiert"
else
  ok "Pakete vorhanden"
fi

# --- Datenbank und Warteschlange starten ----------------------------------

schritt "Datenbank und Warteschlange starten"

case "$BETRIEB" in
  docker)
    docker compose up -d >/dev/null 2>&1 || abbruch "Die Container liessen sich nicht starten." \
"Prüfen mit:  docker compose logs"
    ok "Container gestartet"
    ;;

  brew)
    if ! brew list postgresql@16 >/dev/null 2>&1; then
      hinweis "PostgreSQL wird installiert – das dauert einige Minuten."
      brew install postgresql@16 >/dev/null 2>&1 || abbruch "PostgreSQL liess sich nicht installieren." \
"Von Hand versuchen:  brew install postgresql@16"
    fi
    if ! brew list redis >/dev/null 2>&1; then
      hinweis "Redis wird installiert."
      brew install redis >/dev/null 2>&1 || abbruch "Redis liess sich nicht installieren." \
"Von Hand versuchen:  brew install redis"
    fi
    brew services start postgresql@16 >/dev/null 2>&1 || true
    brew services start redis >/dev/null 2>&1 || true
    # Die Programme von postgresql@16 liegen ausserhalb des Standardpfads.
    export PATH="$(brew --prefix)/opt/postgresql@16/bin:$PATH"
    ok "PostgreSQL und Redis gestartet"
    ;;

  vorhanden)
    ok "Datenbank läuft bereits"
    if ! lauscht 6379; then
      if command -v brew >/dev/null 2>&1; then
        brew list redis >/dev/null 2>&1 || brew install redis >/dev/null 2>&1
        brew services start redis >/dev/null 2>&1 || true
      elif command -v redis-server >/dev/null 2>&1; then
        redis-server --daemonize yes >/dev/null 2>&1 || true
      fi
    fi
    ;;
esac

printf "  warte auf die Datenbank"
BEREIT=0
for i in $(seq 1 60); do
  if lauscht 5432; then printf "\n"; ok "Datenbank erreichbar"; BEREIT=1; break; fi
  printf "."
  sleep 1
done
[ "$BEREIT" = "1" ] || { printf "\n"; abbruch "Die Datenbank ist nicht gestartet." \
"Bei Docker prüfen mit:   docker compose logs postgres
Bei Homebrew prüfen mit:  brew services list"; }

if lauscht 6379; then
  ok "Warteschlange erreichbar"
else
  warn "Redis läuft nicht – die Oberfläche funktioniert, aber Analysen bleiben in der Warteschlange."
fi

# --- Datenbank anlegen ----------------------------------------------------

# Auf dem Direktweg existiert die Datenbank beim ersten Start noch nicht.
if [ "$BETRIEB" != "docker" ] && command -v createdb >/dev/null 2>&1; then
  createdb seomaster >/dev/null 2>&1 && ok "Datenbank 'seomaster' angelegt" || true
fi

schritt "Datenbankstruktur einspielen"
if ! npx prisma migrate deploy >/dev/null 2>&1; then
  npx prisma migrate dev --name init --skip-seed >/dev/null 2>&1 \
    || abbruch "Die Datenbankstruktur liess sich nicht einspielen." \
"Ausführlich sehen, was fehlt:  npx prisma migrate deploy"
fi
npx prisma generate >/dev/null 2>&1
ok "Struktur aktuell"

# --- Erstes Konto und Beispieldaten ---------------------------------------

KONTEN="$(npx tsx --env-file-if-exists=.env -e "
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
db.user.count().then(n => { console.log(n); return db.\$disconnect() }).catch(() => console.log('0'))
" 2>/dev/null | tail -1)"

ZUGANG=0
if [ "${KONTEN:-0}" = "0" ]; then
  schritt "Beispieldaten anlegen"
  export SEED_EMAIL="${SEED_EMAIL:-demo@seo-master.local}"
  export SEED_PASSWORD="${SEED_PASSWORD:-demo-passwort-123}"
  export SEED_ORG="${SEED_ORG:-Mein Arbeitsbereich}"
  npx tsx --env-file-if-exists=.env prisma/seed.ts >/dev/null 2>&1
  npx tsx --env-file-if-exists=.env scripts/demo-daten.ts >/dev/null 2>&1 || true
  ok "Konto, Beispielprojekt und drei Analysen angelegt"
  ZUGANG=1
else
  ok "Konto vorhanden"
fi

# --- Starten --------------------------------------------------------------

schritt "Anwendung starten"

npm run worker >/tmp/seomaster-worker.log 2>&1 &
WORKER_PID=$!
npm run dev >/tmp/seomaster-web.log 2>&1 &
WEB_PID=$!

aufraeumen() {
  printf "\n%sBeenden…%s\n" "$GRAU" "$AUS"
  kill "$WEB_PID" "$WORKER_PID" 2>/dev/null || true
  exit 0
}
trap aufraeumen INT TERM

printf "  warte auf die Oberfläche"
BEREIT=0
for i in $(seq 1 90); do
  if curl -sf -o /dev/null "http://localhost:3000/login" 2>/dev/null; then
    printf "\n"; ok "Oberfläche bereit"; BEREIT=1; break
  fi
  printf "."
  sleep 1
done

if [ "$BEREIT" != "1" ]; then
  printf "\n"
  printf "%s\n" "$(tail -20 /tmp/seomaster-web.log)"
  abbruch "Die Oberfläche ist nicht gestartet." "Vollständige Meldungen:  cat /tmp/seomaster-web.log"
fi

printf "\n%s──────────────────────────────────────────────%s\n" "$GRUEN" "$AUS"
printf "  %sSEO-Master läuft%s\n\n" "$GRUEN" "$AUS"
printf "  Adresse:   http://localhost:3000\n"
if [ "$ZUGANG" = "1" ]; then
  printf "  E-Mail:    %s\n" "${SEED_EMAIL}"
  printf "  Passwort:  %s\n" "${SEED_PASSWORD}"
fi
printf "\n  %sZum Beenden: Strg+C%s\n" "$GRAU" "$AUS"
printf "%s──────────────────────────────────────────────%s\n\n" "$GRUEN" "$AUS"

if command -v open >/dev/null 2>&1; then
  open "http://localhost:3000" 2>/dev/null || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:3000" 2>/dev/null || true
else
  hinweis "Bitte http://localhost:3000 im Browser öffnen."
fi

wait "$WEB_PID"
