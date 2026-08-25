#!/usr/bin/env bash
#
# Neuen Stand holen und übernehmen.
#
#   bash /home/seomaster/app/deploy/update.sh
#
# Muss als root laufen. Holt die Änderungen als der Benutzer, dem das
# Verzeichnis gehört – Git verweigert sonst die Arbeit in einem Verzeichnis
# fremden Besitzes ("dubious ownership").
set -uo pipefail

BLAU=$'\033[34m'; GRUEN=$'\033[32m'; ROT=$'\033[31m'; GRAU=$'\033[90m'; AUS=$'\033[0m'
ok()      { printf "  %s✓%s %s\n" "$GRUEN" "$AUS" "$1"; }
schritt() { printf "\n%s→ %s%s\n" "$BLAU" "$1" "$AUS"; }
abbruch() { printf "\n%s✗ %s%s\n\n" "$ROT" "$1" "$AUS"; [ $# -gt 1 ] && printf "%s\n\n" "$2"; exit 1; }

cd /root 2>/dev/null || cd /

ZIEL="${ZIEL:-/home/seomaster/app}"
BENUTZER="${BENUTZER:-seomaster}"

[ -d "$ZIEL/.git" ] || abbruch "Unter $ZIEL liegt keine Installation."
[ "$(id -u)" = "0" ] || abbruch "Das Skript braucht Root-Rechte." "Aufruf:  sudo bash $ZIEL/deploy/update.sh"

COMPOSE="docker-compose.prod.yml"
[ -f "$ZIEL/.env" ] && grep -q '^WEB_PORT=' "$ZIEL/.env" && COMPOSE="docker-compose.vps.yml"

VORHER="$(su - "$BENUTZER" -c "cd $ZIEL && git rev-parse --short HEAD" 2>/dev/null)"

schritt "Neuen Stand holen"
ZWEIG="$(su - "$BENUTZER" -c "cd $ZIEL && git rev-parse --abbrev-ref HEAD" 2>/dev/null)"
if ! su - "$BENUTZER" -c "cd $ZIEL && git fetch origin $ZWEIG && git reset --hard origin/$ZWEIG" >/dev/null 2>&1; then
  abbruch "Der neue Stand liess sich nicht holen." \
"Von Hand ansehen:  su - $BENUTZER -c 'cd $ZIEL && git pull'"
fi

NACHHER="$(su - "$BENUTZER" -c "cd $ZIEL && git rev-parse --short HEAD" 2>/dev/null)"
if [ "$VORHER" = "$NACHHER" ]; then
  ok "Bereits auf dem neuesten Stand ($NACHHER)"
else
  ok "$VORHER → $NACHHER"
fi

schritt "Übernehmen (einige Minuten)"
BAULOG="/tmp/seomaster-update.log"
if su - "$BENUTZER" -c "cd $ZIEL && docker compose -f $COMPOSE up -d --build" >"$BAULOG" 2>&1; then
  ok "Container neu gebaut und gestartet"
else
  printf "\n"; tail -20 "$BAULOG"
  abbruch "Das Übernehmen ist fehlgeschlagen." "Vollständige Ausgabe:  cat $BAULOG"
fi

schritt "Prüfen"
DOMAIN="$(grep -oP '^DOMAIN="?\K[^"]+' "$ZIEL/.env" 2>/dev/null | head -1)"
if [ -n "$DOMAIN" ]; then
  for i in $(seq 1 15); do
    if curl -fsS -o /dev/null --max-time 8 "https://$DOMAIN" 2>/dev/null; then
      ok "https://$DOMAIN antwortet"; break
    fi
    printf "."
    sleep 3
    [ "$i" = "15" ] && { printf "\n"; printf "  %sDie Domain antwortet noch nicht – Protokoll:%s\n" "$GRAU" "$AUS"
      printf "    cd %s && docker compose -f %s logs -f web\n" "$ZIEL" "$COMPOSE"; }
  done
fi

# Zustand der wahlfreien Anschlüsse zeigen.
#
# Ein fehlender Eintrag in der .env führt sonst zu einem Merkmal, das in der
# Anwendung schlicht nicht auftaucht – ohne Fehlermeldung, ohne Hinweis.
schritt "Zustand"
zeige() {
  if grep -q "^$1=." "$ZIEL/.env" 2>/dev/null; then
    printf "  %s✓%s %s\n" "$GRUEN" "$AUS" "$2"
  else
    printf "  %s·%s %s %s(nicht eingerichtet)%s\n" "$GRAU" "$AUS" "$2" "$GRAU" "$AUS"
  fi
}
zeige GOOGLE_OAUTH_CLIENT_ID 'Knopf "Mit Google verbinden"'
zeige GOOGLE_SERVICE_ACCOUNT_JSON 'Google-Dienstkonto über Umgebungsvariable'

printf "\n%sFertig. Seite im Browser neu laden (Strg+Umschalt+R).%s\n\n" "$GRUEN" "$AUS"
