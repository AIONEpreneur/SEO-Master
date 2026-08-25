#!/usr/bin/env bash
#
# Den Knopf "Mit Google verbinden" einrichten.
#
#   bash /home/seomaster/app/deploy/google-anmeldung.sh
#
# Fragt nach den beiden Werten aus der Google Cloud Console, trägt sie ein
# und startet die Anwendung neu. Muss als root laufen.
set -uo pipefail

BLAU=$'\033[34m'; GRUEN=$'\033[32m'; ROT=$'\033[31m'; GRAU=$'\033[90m'; AUS=$'\033[0m'
ok()      { printf "  %s✓%s %s\n" "$GRUEN" "$AUS" "$1"; }
schritt() { printf "\n%s→ %s%s\n" "$BLAU" "$1" "$AUS"; }
abbruch() { printf "\n%s✗ %s%s\n\n" "$ROT" "$1" "$AUS"; [ $# -gt 1 ] && printf "%s\n\n" "$2"; exit 1; }

cd /root 2>/dev/null || cd /

ZIEL="${ZIEL:-/home/seomaster/app}"
BENUTZER="${BENUTZER:-seomaster}"

[ -f "$ZIEL/.env" ] || abbruch "Unter $ZIEL liegt keine Installation."
[ "$(id -u)" = "0" ] || abbruch "Das Skript braucht Root-Rechte." "Aufruf:  sudo bash $ZIEL/deploy/google-anmeldung.sh"

DOMAIN="$(grep -oP '^DOMAIN="?\K[^"]+' "$ZIEL/.env" 2>/dev/null | head -1)"
[ -n "$DOMAIN" ] || DOMAIN="$(grep -oP '^APP_URL="?https?://\K[^"/]+' "$ZIEL/.env" 2>/dev/null | head -1)"

# Werte entgegennehmen – bevorzugt als Argumente.
#
# Die frühere Fassung fragte ausschliesslich interaktiv nach. Das ist überall
# dort gescheitert, wo die Standardeingabe nicht an einem Terminal hängt: in
# Web-Terminals mancher Anbieter, bei "ssh host 'bash skript'", und wenn das
# Skript über eine Pipe läuft. `read` kehrt dann sofort mit einem leeren Wert
# zurück, und das Skript brach mit "Ohne Client-ID geht es nicht" ab –
# obwohl gerade jemand die Client-ID eingetippt hatte.
CLIENT_ID="${1:-}"
CLIENT_SECRET="${2:-}"

# Leerzeichen und Wagenrücklauf abschneiden. Beim Kopieren aus dem Browser
# hängt regelmässig ein Leerzeichen hinten dran, und aus Windows-Zwischenablagen
# kommt ein \r mit – beides macht die Zugangsdaten stillschweigend ungültig.
saeubere() { printf '%s' "$1" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }
CLIENT_ID="$(saeubere "$CLIENT_ID")"
CLIENT_SECRET="$(saeubere "$CLIENT_SECRET")"

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  printf "\n%s────────────────────────────────────────────────────────%s\n" "$GRAU" "$AUS"
  printf " Google-Anmeldung einrichten\n"
  printf "%s────────────────────────────────────────────────────────%s\n\n" "$GRAU" "$AUS"

  cat <<HINWEIS
Vorher in der Google Cloud Console anlegen:

  1. https://console.cloud.google.com/apis/credentials
  2. "Anmeldedaten erstellen" > "OAuth-Client-ID"
  3. Anwendungstyp: Webanwendung
  4. Bei "Autorisierte Weiterleitungs-URIs" GENAU das eintragen:

         https://${DOMAIN:-DEINE-DOMAIN}/api/google/callback

  5. Erstellen. Es erscheinen Client-ID und Client-Schlüssel.

HINWEIS

  # Ausdrücklich vom Terminal lesen, nicht von der Standardeingabe – nur so
  # funktioniert es auch, wenn das Skript über eine Pipe gestartet wurde.
  # Schlägt das fehl, bleibt der Wert leer und der Abbruch unten nennt den
  # zuverlässigen Weg. Die Fehlermeldung der Shell selbst wird unterdrückt:
  # "No such device or address" hilft niemandem weiter.
  frage() {
    printf "%s" "$1" >&2
    { read -r ANTWORT < /dev/tty && printf '%s' "$ANTWORT"; } 2>/dev/null
  }

  [ -z "$CLIENT_ID" ] && CLIENT_ID="$(saeubere "$(frage "$(printf '%sClient-ID%s (endet auf .apps.googleusercontent.com):\n> ' "$BLAU" "$AUS")")")"
  [ -z "$CLIENT_SECRET" ] && CLIENT_SECRET="$(saeubere "$(frage "$(printf '\n%sClient-Schlüssel%s (beginnt mit GOCSPX-):\n> ' "$BLAU" "$AUS")")")"
  printf "\n"
fi

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  abbruch "Client-ID und Client-Schlüssel werden beide gebraucht." \
"Am zuverlässigsten beides direkt mitgeben – dann fragt das Skript gar nicht erst:

  bash $ZIEL/deploy/google-anmeldung.sh 'CLIENT-ID' 'CLIENT-SCHLUESSEL'

Die Anführungszeichen mit eintippen."
fi

case "$CLIENT_ID" in
  *.apps.googleusercontent.com) : ;;
  *) printf "\n  %sDie Client-ID sieht ungewöhnlich aus – normalerweise endet sie auf%s\n" "$GRAU" "$AUS"
     printf "  %s.apps.googleusercontent.com. Wird trotzdem eingetragen.%s\n" "$GRAU" "$AUS" ;;
esac

case "$CLIENT_SECRET" in
  GOCSPX-*) : ;;
  *.apps.googleusercontent.com)
     abbruch "Da stehen zwei Client-IDs." "Der zweite Wert muss der Client-Schlüssel sein – er beginnt mit GOCSPX-." ;;
  *) printf "  %sDer Schlüssel beginnt normalerweise mit GOCSPX-. Wird trotzdem eingetragen.%s\n" "$GRAU" "$AUS" ;;
esac

schritt "Eintragen"

# Bestehende Zeilen entfernen, damit ein erneuter Aufruf sauber überschreibt
# statt doppelte Einträge zu hinterlassen.
sed -i '/^GOOGLE_OAUTH_CLIENT_ID=/d;/^GOOGLE_OAUTH_CLIENT_SECRET=/d' "$ZIEL/.env"

# Sicherstellen, dass die Datei mit einem Zeilenumbruch endet. Sonst klebt die
# erste neue Zeile an die letzte bestehende, und beide Werte sind hinüber –
# ohne dass man es der Datei ansieht.
[ -s "$ZIEL/.env" ] && [ "$(tail -c 1 "$ZIEL/.env" | wc -l)" -eq 0 ] && printf '\n' >> "$ZIEL/.env"

{
  printf 'GOOGLE_OAUTH_CLIENT_ID=%s\n' "$CLIENT_ID"
  printf 'GOOGLE_OAUTH_CLIENT_SECRET=%s\n' "$CLIENT_SECRET"
} >> "$ZIEL/.env"
chown "$BENUTZER:$BENUTZER" "$ZIEL/.env"
chmod 600 "$ZIEL/.env"
ok "In .env eingetragen"

schritt "Neu starten"
COMPOSE="docker-compose.prod.yml"
grep -q '^WEB_PORT=' "$ZIEL/.env" && COMPOSE="docker-compose.vps.yml"

if su - "$BENUTZER" -c "cd $ZIEL && docker compose -f $COMPOSE up -d" >/tmp/seomaster-google.log 2>&1; then
  ok "Anwendung neu gestartet"
else
  printf "\n"; tail -15 /tmp/seomaster-google.log
  abbruch "Der Neustart ist fehlgeschlagen." "Vollständige Ausgabe:  cat /tmp/seomaster-google.log"
fi

printf "\n%sFertig.%s Im Datentresor steht jetzt bei Google Search Console\n" "$GRUEN" "$AUS"
printf "der Knopf %s\"Mit Google verbinden\"%s.\n\n" "$BLAU" "$AUS"
