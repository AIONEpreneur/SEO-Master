#!/bin/sh
# Ausser-Haus-Kopie der Datenbanksicherungen einrichten.
#
# Ziel kann ein zweiter Server sein oder ein Hosting-Konto mit SFTP-Zugang
# (bei Hostinger: SSH-Zugriff im hPanel aktivieren; Port meist 65002).
#
# Aufruf auf dem App-Server (einmalig):
#   sh /home/seomaster/app/deploy/kopie-einrichten.sh BENUTZER@HOST PORT
# Beispiele:
#   sh deploy/kopie-einrichten.sh root@203.0.113.10          # zweiter Server
#   sh deploy/kopie-einrichten.sh u123456@145.14.0.10 65002  # Hostinger-Hosting
#
# Danach schiebt der Server jede Nacht um 3:30 Uhr – eine halbe Stunde nach
# der Sicherung – die Sicherungsdateien auf das Ziel. Dort bleiben sie
# 30 Tage.
#
# Der ENCRYPTION_KEY steckt nicht in den Sicherungen. Er gehört in den
# Passwortmanager – NICHT auf das Ziel. Wer nur die Kopien erbeutet, kann
# die verschlüsselten Zugangsdaten darin nicht lesen.

set -e

# Ziel und Port kommen als Argumente, nicht über eine Rückfrage: In
# Web-Terminals schlägt read ohne TTY fehl, Argumente funktionieren überall.
ZIEL="$(printf '%s' "${1:-}" | tr -d '[:space:]\r')"
PORT="$(printf '%s' "${2:-22}" | tr -d '[:space:]\r')"
if [ -z "$ZIEL" ]; then
  echo "✗ Bitte das Ziel angeben, z. B.:  sh deploy/kopie-einrichten.sh u123456@145.14.0.10 65002" >&2
  exit 1
fi
case "$ZIEL" in
  *@*) : ;;
  *) echo "✗ Das Ziel braucht die Form benutzer@adresse." >&2; exit 1 ;;
esac
case "$PORT" in
  ''|*[!0-9]*) echo "✗ Der Port muss eine Zahl sein (bei Hostinger-Hosting: 65002)." >&2; exit 1 ;;
esac

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$APP_DIR/backups"
SCHLUESSEL="$HOME/.ssh/seomaster-kopie"
ZIELPFAD="seomaster-sicherungen"

mkdir -p "$BACKUP_DIR" "$HOME/.ssh"

# Eigener Schlüssel nur für die Kopie: Er darf auf dem Ziel liegen, ohne dass
# damit irgendetwas anderes erreichbar wird.
if [ ! -f "$SCHLUESSEL" ]; then
  ssh-keygen -t ed25519 -N '' -f "$SCHLUESSEL" -C 'seomaster-sicherungskopie' >/dev/null
  echo "✓ Schlüssel für die Übertragung erzeugt."
fi

echo "→ Schlüssel wird auf $ZIEL hinterlegt – dafür einmal das Passwort des Ziels eingeben:"
ssh-copy-id -i "$SCHLUESSEL.pub" -p "$PORT" "$ZIEL"

# Was kann das Ziel? Ein Server hat rsync; ein Hosting-Konto oft nur den
# Dateizugang. Beides funktioniert – der Lauf wählt den passenden Weg.
if ssh -i "$SCHLUESSEL" -p "$PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$ZIEL" 'command -v rsync' >/dev/null 2>&1; then
  MODUS="rsync"
  ssh -i "$SCHLUESSEL" -p "$PORT" -o BatchMode=yes "$ZIEL" "mkdir -p $ZIELPFAD"
else
  MODUS="sftp"
fi
echo "✓ Verbindung steht (Übertragung per $MODUS)."

KONF="$HOME/.seomaster-kopie.conf"
cat > "$KONF" <<KONFENDE
ZIEL='$ZIEL'
PORT='$PORT'
MODUS='$MODUS'
SCHLUESSEL='$SCHLUESSEL'
BACKUP_DIR='$BACKUP_DIR'
ZIELPFAD='$ZIELPFAD'
KONFENDE
chmod 600 "$KONF"

# Probelauf sofort, nicht erst um 3:30 Uhr: Ein Fehler soll jetzt auffallen.
sh "$APP_DIR/deploy/kopie-lauf.sh"

if crontab -l 2>/dev/null | grep -qF "kopie-lauf.sh"; then
  echo "✓ Der nächtliche Auftrag besteht bereits."
else
  ( crontab -l 2>/dev/null; echo "30 3 * * * sh $APP_DIR/deploy/kopie-lauf.sh >> $HOME/kopie.log 2>&1" ) | crontab -
  echo "✓ Nächtliche Übertragung um 3:30 Uhr eingerichtet."
fi

echo ""
echo "Fertig. Die Sicherungen liegen ab jetzt zusätzlich auf $ZIEL im Ordner $ZIELPFAD."
echo "Wichtig: Der ENCRYPTION_KEY gehört in den Passwortmanager, nicht auf einen der Server."
