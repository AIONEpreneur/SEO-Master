#!/usr/bin/env bash
#
# Prüft, ob eine Domain auf den gewünschten Server zeigt.
#
#   bash deploy/dns-check.sh seo-master.aionepreneur.com 31.97.182.22
#
# Die eigentliche Prüfung liegt in dns-check.mjs: nur über Node lassen sich
# die autoritativen Nameserver gezielt befragen, statt den – nach einer
# Änderung veralteten – Resolver des eigenen Rechners zu fragen.
set -euo pipefail
exec node "$(dirname "$0")/dns-check.mjs" "$@"
