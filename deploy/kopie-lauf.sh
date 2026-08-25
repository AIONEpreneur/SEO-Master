#!/bin/sh
# Naechtliche Uebertragung der Sicherungen auf das Ablage-Ziel.
# Wird von kopie-einrichten.sh eingerichtet und per Cron aufgerufen;
# die Verbindungsdaten stehen in ~/.seomaster-kopie.conf.

set -e

KONF="$HOME/.seomaster-kopie.conf"
if [ ! -f "$KONF" ]; then
  echo "✗ Keine Konfiguration unter $KONF – zuerst kopie-einrichten.sh ausführen." >&2
  exit 1
fi
# shellcheck disable=SC1090
. "$KONF"

# Erwartete Variablen: ZIEL, PORT, MODUS (rsync|sftp), SCHLUESSEL, BACKUP_DIR, ZIELPFAD
SSH_OPT="-i $SCHLUESSEL -p $PORT -o BatchMode=yes -o StrictHostKeyChecking=accept-new"

if [ "$MODUS" = "rsync" ]; then
  rsync -az -e "ssh $SSH_OPT" "$BACKUP_DIR/" "$ZIEL:$ZIELPFAD/"
  # shellcheck disable=SC2029
  ssh $SSH_OPT "$ZIEL" "find $ZIELPFAD -name 'seomaster_*.sql.gz' -mtime +30 -delete"
  echo "✓ Kopie per rsync übertragen, Altbestand aufgeräumt."
  exit 0
fi

# SFTP-Modus: braucht auf dem Ziel nur den Dateizugang, keine Werkzeuge.
# Das führende Minus lässt einzelne Befehle scheitern, ohne den Lauf zu
# beenden – der Ordner existiert ab dem zweiten Mal bereits.
{
  echo "-mkdir $ZIELPFAD"
  for DATEI in "$BACKUP_DIR"/seomaster_*.sql.gz; do
    [ -f "$DATEI" ] && echo "put $DATEI $ZIELPFAD/"
  done
} | sftp -i "$SCHLUESSEL" -P "$PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -b - "$ZIEL"

# Aufräumen über den Dateinamen: Er trägt das Datum (seomaster_JJJJ-MM-TT_...).
# Auf einem reinen Dateizugang gibt es kein find – der Name ersetzt es.
GRENZE="$(date -d '30 days ago' +%Y-%m-%d)"
LOESCHE="$(
  echo "ls -1 $ZIELPFAD" \
    | sftp -i "$SCHLUESSEL" -P "$PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -b - "$ZIEL" 2>/dev/null \
    | grep -o 'seomaster_[0-9][0-9-]*_[0-9]*\.sql\.gz' \
    | while read -r NAME; do
        DATUM="$(printf '%s' "$NAME" | sed 's/^seomaster_\([0-9-]*\)_.*/\1/')"
        [ "$DATUM" \< "$GRENZE" ] && echo "-rm $ZIELPFAD/$NAME"
      done
)"
if [ -n "$LOESCHE" ]; then
  printf '%s\n' "$LOESCHE" | sftp -i "$SCHLUESSEL" -P "$PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -b - "$ZIEL" >/dev/null
fi
echo "✓ Kopie per SFTP übertragen, Altbestand aufgeräumt."
