# Betrieb neben einer bestehenden Website

Läuft auf dem VPS bereits ein Webserver — etwa für eine andere Anwendung —
sind Port 80 und 443 belegt. Ein zweiter Webserver kann sie nicht ebenfalls
belegen; er würde beim Start scheitern.

Lösung: SEO-Master bringt in diesem Fall keinen eigenen Webserver mit. Die
Anwendung lauscht nur auf `127.0.0.1:3000` — erreichbar ausschliesslich vom
Server selbst. Der bereits vorhandene Webserver nimmt die Anfragen von aussen
entgegen und reicht sie weiter.

## Starten

```bash
docker compose -f docker-compose.vps.yml up -d --build
```

Prüfen, ob die Anwendung antwortet:

```bash
curl -I http://127.0.0.1:3000/login
```

## Weiterleitung einrichten

Je nachdem, was auf dem Server läuft:

| Webserver | Vorlage | Danach |
|---|---|---|
| nginx | `nginx.conf` | `nginx -t && systemctl reload nginx` |
| Caddy | `Caddyfile-block` | `systemctl reload caddy` |

Welcher es ist, verrät:

```bash
systemctl status nginx caddy apache2 2>/dev/null | grep -E 'nginx|caddy|apache'
```

## Worauf zu achten ist

**Zeitlimits.** Ein Analyselauf dauert mehrere Minuten. Bleiben die
Standardwerte (meist 60 Sekunden), bricht der Webserver die Anfrage mit einem
Fehler ab, obwohl im Hintergrund alles weiterläuft. Beide Vorlagen setzen
deshalb 300 Sekunden.

**Ein anderer Port.** Ist 3000 auf dem Server schon belegt, lässt sich das in
der `.env` ändern:

```bash
WEB_PORT=3100
```

Dann in der Weiterleitung ebenfalls `127.0.0.1:3100` eintragen.

**Die bestehende Website bleibt unberührt.** SEO-Master bekommt einen eigenen
Server-Block für die eigene Subdomain; an der vorhandenen Konfiguration ändert
sich nichts.
