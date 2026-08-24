#!/usr/bin/env bash
#
# Prüft, ob eine Domain auf den gewünschten Server zeigt.
#
# Nach einer DNS-Änderung dauert es, bis sie überall ankommt. Dieses Skript
# sagt, ob es schon soweit ist – und was einem Zertifikat noch im Weg steht.
#
#   bash deploy/dns-check.sh seo-master.aionepreneur.com 203.0.113.10
#
set -uo pipefail

GRUEN=$'\033[32m'; ROT=$'\033[31m'; GELB=$'\033[33m'; GRAU=$'\033[90m'; AUS=$'\033[0m'

DOMAIN="${1:-}"
ZIEL_IP="${2:-}"

if [ -z "$DOMAIN" ]; then
  printf "\nAufruf:  bash deploy/dns-check.sh <domain> [erwartete-ip]\n\n"
  exit 1
fi

printf "\n%s%s%s\n\n" "$GRAU" "$DOMAIN" "$AUS"

ALLE="$(getent ahosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u)"
IPV4="$(printf '%s\n' "$ALLE" | grep -E '^[0-9]+\.' || true)"
IPV6="$(printf '%s\n' "$ALLE" | grep ':' || true)"

if [ -z "$ALLE" ]; then
  printf "  %s✗%s Die Domain löst nicht auf.\n" "$ROT" "$AUS"
  printf "  %sEntweder fehlt der Eintrag noch, oder er ist noch nicht verteilt.%s\n\n" "$GRAU" "$AUS"
  exit 1
fi

printf "  A    (IPv4): %s\n" "$(printf '%s' "$IPV4" | tr '\n' ' ')"
printf "  AAAA (IPv6): %s\n\n" "${IPV6:+$(printf '%s' "$IPV6" | tr '\n' ' ')}${IPV6:-—}"

FEHLER=0

if [ -n "$ZIEL_IP" ]; then
  if printf '%s\n' "$IPV4" | grep -qx "$ZIEL_IP"; then
    printf "  %s✓%s Zeigt auf %s\n" "$GRUEN" "$AUS" "$ZIEL_IP"
  else
    printf "  %s✗%s Zeigt nicht auf %s\n" "$ROT" "$AUS" "$ZIEL_IP"
    printf "  %sA-Record im DNS-Panel auf %s ändern.%s\n" "$GRAU" "$ZIEL_IP" "$AUS"
    FEHLER=1
  fi

  if [ "$(printf '%s\n' "$IPV4" | grep -c .)" -gt 1 ]; then
    printf "  %s!%s Mehrere A-Records. Für einen VPS gehört dort genau einer hin.\n" "$GELB" "$AUS"
    FEHLER=1
  fi
fi

if [ -n "$IPV6" ]; then
  printf "  %s!%s AAAA-Einträge vorhanden.\n" "$GELB" "$AUS"
  printf "  %sBrowser versuchen IPv6 zuerst. Zeigen diese Einträge woanders hin,%s\n" "$GRAU" "$AUS"
  printf "  %slandet der Zugriff dort – trotz korrektem A-Record. Löschen,%s\n" "$GRAU" "$AUS"
  printf "  %ssofern der VPS nicht selbst unter diesen Adressen erreichbar ist.%s\n" "$GRAU" "$AUS"
  FEHLER=1
fi

printf "\n"
if [ "$FEHLER" = "0" ] && [ -n "$ZIEL_IP" ]; then
  printf "  %sAlles bereit für die Einrichtung.%s\n\n" "$GRUEN" "$AUS"
else
  printf "  %sNach einer Änderung dauert es meist 5–30 Minuten. Danach erneut prüfen.%s\n\n" "$GRAU" "$AUS"
fi
