#!/usr/bin/env bash
#
# Wer kommt gerade in die App?
#
#   sudo bash /home/seomaster/app/deploy/zugaenge.sh
#
# Liest nur. Ändert nichts, startet nichts neu, legt nichts an.
#
# Es gibt genau drei Wege hinein, und die Frage "kommt ausser mir jemand
# rein?" lässt sich nur beantworten, wenn man alle drei ansieht:
#
#   1. Registrierung  — offen für alle (ALLOW_PUBLIC_SIGNUP) oder für eine
#                       Liste von Adressen (ALLOWED_SIGNUP_EMAILS).
#   2. Einladungen    — ein offener Einladungslink führt in einen bestehenden
#                       Arbeitsbereich. Das ist der einzige Weg, auf dem
#                       jemand in fremden Daten landet.
#   3. Bestehende Konten — wer Adresse und Passwort hat, kommt herein.
#
# Der dritte Weg ist Absicht. Die ersten beiden sind es nur, solange man
# von ihnen weiss.
set -uo pipefail

GRUEN=$'\033[32m'; ROT=$'\033[31m'; GELB=$'\033[33m'; GRAU=$'\033[90m'; FETT=$'\033[1m'; AUS=$'\033[0m'

ZIEL="${ZIEL:-/home/seomaster/app}"
[ -f "$ZIEL/.env" ] || { printf "%sUnter %s liegt keine .env.%s\n" "$ROT" "$ZIEL" "$AUS"; exit 1; }

COMPOSE="docker-compose.prod.yml"
grep -q '^WEB_PORT=' "$ZIEL/.env" && COMPOSE="docker-compose.vps.yml"

wert() { grep -oP "^$1=\"?\K[^\"]*" "$ZIEL/.env" 2>/dev/null | head -1; }

printf "\n%sWer kommt gerade in die App?%s\n\n" "$FETT" "$AUS"

# --- 1. Registrierung -------------------------------------------------------
OEFFENTLICH="$(wert ALLOW_PUBLIC_SIGNUP)"
LISTE="$(wert ALLOWED_SIGNUP_EMAILS)"

printf "%s1. Registrierung%s\n" "$FETT" "$AUS"
if [ -n "$LISTE" ]; then
  # Die Liste hat Vorrang: Ist sie gesetzt, zählt ALLOW_PUBLIC_SIGNUP nicht.
  printf "   %s● Nur diese Adressen:%s %s\n" "$GELB" "$AUS" "$LISTE"
  [ "$OEFFENTLICH" = "true" ] && printf "   %s(ALLOW_PUBLIC_SIGNUP=true steht zwar da, die Liste hat aber Vorrang.)%s\n" "$GRAU" "$AUS"
elif [ "$OEFFENTLICH" = "true" ]; then
  printf "   %s● OFFEN — jede beliebige Adresse kann sich anmelden.%s\n" "$ROT" "$AUS"
  printf "     Zumachen:  sudo sed -i 's/^ALLOW_PUBLIC_SIGNUP=.*/ALLOW_PUBLIC_SIGNUP=false/' %s/.env\n" "$ZIEL"
  printf "     Danach:    sudo bash %s/deploy/update.sh\n" "$ZIEL"
else
  printf "   %s● Geschlossen.%s Niemand kann sich selbst ein Konto anlegen.\n" "$GRUEN" "$AUS"
fi

# --- 2. Einladungen ---------------------------------------------------------
printf "\n%s2. Offene Einladungen%s\n" "$FETT" "$AUS"
SQL="SELECT COALESCE(o.name, '(eigener Bereich)') || '  →  ' || i.email || '   gültig bis ' || to_char(i.\"expiresAt\", 'DD.MM.YYYY')
     FROM invitations i LEFT JOIN organizations o ON o.id = i.\"organizationId\"
     WHERE i.\"acceptedAt\" IS NULL AND i.\"revokedAt\" IS NULL AND i.\"expiresAt\" > NOW();"

OFFEN="$(cd "$ZIEL" && docker compose -f "$COMPOSE" exec -T postgres \
  psql -U "${POSTGRES_USER:-seomaster}" -d "${POSTGRES_DB:-seomaster}" -tAc "$SQL" 2>/dev/null)"

if [ -z "$OFFEN" ]; then
  printf "   %s● Keine.%s Es liegt kein Einladungslink herum.\n" "$GRUEN" "$AUS"
else
  printf "   %s● Diese Links funktionieren noch:%s\n" "$GELB" "$AUS"
  printf "%s\n" "$OFFEN" | sed 's/^/     /'
  printf "   %sZurückziehen geht in der App unter Einstellungen → Team.%s\n" "$GRAU" "$AUS"
fi

# --- 3. Bestehende Konten ---------------------------------------------------
printf "\n%s3. Bestehende Konten%s\n" "$FETT" "$AUS"
KONTEN="$(cd "$ZIEL" && docker compose -f "$COMPOSE" exec -T postgres \
  psql -U "${POSTGRES_USER:-seomaster}" -d "${POSTGRES_DB:-seomaster}" -tAc \
  "SELECT email || CASE WHEN \"isSuperAdmin\" THEN '   (Betrieb)' ELSE '' END
     || CASE WHEN \"suspendedAt\" IS NOT NULL THEN '   [gesperrt]' ELSE '' END
   FROM users ORDER BY \"createdAt\";" 2>/dev/null)"

if [ -z "$KONTEN" ]; then
  printf "   %sKonnte die Datenbank nicht lesen — läuft der Stapel?%s\n" "$ROT" "$AUS"
  printf "   %scd %s && docker compose -f %s ps%s\n" "$GRAU" "$ZIEL" "$COMPOSE" "$AUS"
else
  printf "%s\n" "$KONTEN" | sed 's/^/     /'
fi

printf "\n%sAlles ausser diesen drei Wegen führt zur Anmeldung.%s\n\n" "$GRAU" "$AUS"
