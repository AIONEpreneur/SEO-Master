#!/bin/sh
# Ausser-Haus-Kopie der Datenbanksicherungen einrichten.
#
# Aufruf auf dem App-Server (einmalig):
#   sh /home/seomaster/app/deploy/kopie-einrichten.sh benutzer@ZIEL-IP
#
# Danach schiebt der Server jede Nacht um 3:30 Uhr – eine halbe Stunde nach
# der Sicherung – alle Sicherungsdateien auf den Zielserver. Dort bleiben sie
# 30 Tage, dann räumen sie sich selbst weg.
#
# Der ENCRYPTION_KEY steckt nicht in den Sicherungen. Er gehört in den
# Passwortmanager – NICHT auf den Zielserver. Wer nur die Kopien erbeutet,
# kann die verschlüsselten Zugangsdaten darin nicht lesen.

set -e

# Das Ziel kommt als Argument, nicht über eine Rückfrage: In Web-Terminals
# schlägt read ohne TTY fehl, ein Argument funktioniert überall.
ZIEL="$(printf '%s' "${1:-}" | tr -d '[:space:]\r')"
if [ -z "$ZIEL" ]; then
  echo "✗ Bitte das Ziel angeben, z. B.:  sh deploy/kopie-einrichten.sh root@203.0.113.10" >&2
  exit 1
fi
case "$ZIEL" in
  *@*) : ;;
  *) echo "✗ Das Ziel braucht die Form benutzer@adresse (z. B. root@203.0.113.10)." >&2; exit 1 ;;
esac

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$APP_DIR/backups"
SCHLUESSEL="$HOME/.ssh/seomaster-kopie"
ZIELPFAD="seomaster-sicherungen"

mkdir -p "$BACKUP_DIR" "$HOME/.ssh"

# Eigener Schlüssel nur für die Kopie: Er darf auf dem Zielserver liegen,
# ohne dass damit irgendetwas anderes erreichbar wird.
if [ ! -f "$SCHLUESSEL" ]; then
  ssh-keygen -t ed25519 -N '' -f "$SCHLUESSEL" -C 'seomaster-sicherungskopie' >/dev/null
  echo "✓ Schlüssel für die Übertragung erzeugt."
fi

echo "→ Schlüssel wird auf $ZIEL hinterlegt – dafür einmal das Passwort des Zielservers eingeben:"
ssh-copy-id -i "$SCHLUESSEL.pub" "$ZIEL"

ssh -i "$SCHLUESSEL" -o BatchMode=yes "$ZIEL" "mkdir -p $ZIELPFAD"
echo "✓ Verbindung steht, Zielordner $ZIELPFAD ist angelegt."

# Probelauf sofort, nicht erst um 3:30 Uhr: Ein Fehler soll jetzt auffallen.
rsync -az -e "ssh -i $SCHLUESSEL -o BatchMode=yes" "$BACKUP_DIR/" "$ZIEL:$ZIELPFAD/"
echo "✓ Probelauf: vorhandene Sicherungen sind übertragen."

KOPIE_CMD="rsync -az -e 'ssh -i $SCHLUESSEL -o BatchMode=yes' '$BACKUP_DIR/' '$ZIEL:$ZIELPFAD/' && ssh -i $SCHLUESSEL -o BatchMode=yes $ZIEL \"find $ZIELPFAD -name 'seomaster_*.sql.gz' -mtime +30 -delete\""
CRON="30 3 * * * $KOPIE_CMD >> $HOME/kopie.log 2>&1"

if crontab -l 2>/dev/null | grep -qF "seomaster-kopie"; then
  echo "✓ Der nächtliche Auftrag besteht bereits."
else
  ( crontab -l 2>/dev/null; echo "$CRON" ) | crontab -
  echo "✓ Nächtliche Übertragung um 3:30 Uhr eingerichtet."
fi

echo ""
echo "Fertig. Die Sicherungen liegen ab jetzt zusätzlich auf $ZIEL im Ordner $ZIELPFAD."
echo "Wichtig: Der ENCRYPTION_KEY gehört in den Passwortmanager, nicht auf einen der Server."
