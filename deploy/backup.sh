#!/bin/sh
# Tägliche Datenbanksicherung. Per Cron auf dem VPS einrichten:
#   0 3 * * * /pfad/zur/app/deploy/backup.sh >> /var/log/seomaster-backup.log 2>&1
#
# Wichtig: Der ENCRYPTION_KEY steckt NICHT im Datenbank-Abzug. Ohne ihn sind
# die gesicherten Zugangsdaten nicht wiederherstellbar – ihn getrennt und
# sicher aufbewahren (Passwortmanager), nicht neben den Sicherungen.

set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$APP_DIR/backups"
KEEP_DAYS=14
STAMP="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

# shellcheck disable=SC1091
. ./.env

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-seomaster}" "${POSTGRES_DB:-seomaster}" \
  | gzip > "$BACKUP_DIR/seomaster_$STAMP.sql.gz"

echo "Sicherung erstellt: seomaster_$STAMP.sql.gz"

find "$BACKUP_DIR" -name 'seomaster_*.sql.gz' -mtime "+$KEEP_DAYS" -delete
echo "Sicherungen älter als $KEEP_DAYS Tage entfernt."
