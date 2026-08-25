# Search Console verbinden

Search Console ist die einzige Quelle, die zählt statt zu schätzen. Alle
anderen Anbieter messen Platzierungen von aussen und rechnen daraus einen
wahrscheinlichen Besuch hoch. Wie weit das auseinandergeht, zeigt ein realer
Fall: 35 geschätzte gegen 277 gezählte Besuche.

---

## Erst das Wichtigste: Wessen Daten sind das eigentlich?

Search Console kennt **ausschliesslich Seiten, für die man selbst
freigeschaltet ist**. Sie ist kein öffentlicher Dienst, der über beliebige
Websites Auskunft gibt.

- **Deine eigenen Seiten** — hier gibt es gezählte Zahlen.
- **Wettbewerberseiten** — hier gibt es sie nicht, und es kann sie nicht
  geben. Niemand ausser der Betreiberin sieht diese Daten.
- **Kundenseiten** — nur, wenn die Kundin dich freischaltet.

Analysierst du eine fremde Seite, entfällt der Baustein einfach. Der Bericht
sagt das ausdrücklich und bewertet wie bisher mit Hochrechnungen. Alle anderen
Bausteine — SEO, AEO, GEO, SERP, Wettbewerb — arbeiten für jede beliebige
Adresse unverändert weiter.

---

## Zwei Wege

| | **Mit Google verbinden** | **Dienstkonto** |
|---|---|---|
| Wer es benutzt | du und deine Kundinnen | du allein |
| Was zu tun ist | Knopf drücken, im Google-Fenster bestätigen | JSON-Datei einfügen, dann E-Mail-Adresse in der Search Console eintragen |
| Aufwand für die Kundin | drei Klicks | zu viel |
| Voraussetzung | einmalige Einrichtung auf dem Server (unten) | keine |

**Für alles, was mit Kundinnen zu tun hat, ist der Anmelde-Knopf der Weg.**
Das Dienstkonto bleibt als technische Ausweichmöglichkeit bestehen.

---

## Weg 1: Mit Google verbinden

### Einmalig auf dem Server einrichten

**1.** Öffne https://console.cloud.google.com/apis/credentials

Falls noch kein Projekt existiert: oben links eines anlegen (`seo-master`).

**2.** Falls noch nicht geschehen — die Schnittstelle freischalten:
https://console.cloud.google.com/apis/library/searchconsole.googleapis.com →
**Aktivieren**

**3.** Zurück bei den Anmeldedaten: **Anmeldedaten erstellen** →
**OAuth-Client-ID**

Beim ersten Mal fragt Google nach dem Zustimmungsbildschirm. Ausfüllen:

- Nutzertyp: **Extern**
- App-Name: `SEO-Master`
- Support-E-Mail und Kontakt-E-Mail: deine Adresse
- Bereiche (Scopes): `.../auth/webmasters.readonly` hinzufügen
- Speichern

**4.** Jetzt die Client-ID anlegen:

- Anwendungstyp: **Webanwendung**
- Name: `SEO-Master`
- Autorisierte Weiterleitungs-URIs → **URI hinzufügen** → genau das eintragen:

  ```
  https://seo-master.aionepreneur.com/api/google/callback
  ```

- **Erstellen**

Es erscheinen **Client-ID** und **Client-Schlüssel**. Beide bereithalten.

**5.** Auf dem Server — beide Werte direkt mitgeben:

```
bash /home/seomaster/app/deploy/google-anmeldung.sh 'CLIENT-ID' 'CLIENT-SCHLUESSEL'
```

Die Anführungszeichen mit eintippen, die beiden Platzhalter durch die echten
Werte ersetzen. Ohne Argumente fragt das Skript nach — das klappt aber nicht in
jedem Terminal, deshalb ist die Form oben die verlässliche.

### Danach: verbinden

**6.** In SEO-Master: **Datentresor** → bei *Google Search Console* auf
**Mit Google verbinden**. Google-Konto wählen, bestätigen, fertig.

Darunter erscheint die Liste der verbundenen Properties. Genau für diese
Seiten gibt es künftig gezählte Zahlen.

> **Der Warnhinweis am Anfang.** Solange Google die App nicht geprüft hat,
> zeigt es „Diese App wurde nicht von Google überprüft". Über **Erweitert** →
> **Weiter zu SEO-Master** kommt man durch. Für dich selbst ist das kein
> Problem. Bevor du das Kundinnen zumutest, lohnt sich das Prüfverfahren:
> in der Cloud Console unter *OAuth-Zustimmungsbildschirm* → **Zur
> Überprüfung einreichen**. Gebraucht werden eine Datenschutzerklärung auf
> deiner Domain, ein kurzes Video, das den Ablauf zeigt, und der Nachweis,
> dass dir die Domain gehört. Das dauert einige Tage bis Wochen — einmal.

### Was deine Kundin tut

Drei Klicks: Knopf drücken, Google-Konto wählen, bestätigen. Kein Google
Cloud, keine Datei, keine Einstellungen. Sie kann den Zugriff jederzeit
zurücknehmen — hier im Tresor oder in ihrem Google-Konto unter
*Sicherheit → Drittanbieter-Apps*.

Gelesen wird ausschliesslich die Search Console, nichts anderes. Das steht so
im Zustimmungsfenster.

---

## Weg 2: Dienstkonto (nur für dich)

Braucht keine Server-Einrichtung und kein Prüfverfahren, ist dafür beim
Freischalten umständlicher.

**1.** https://console.cloud.google.com/iam-admin/serviceaccounts/create

- Name: `seo-master`
- **Erstellen und fortfahren**, die beiden folgenden Schritte überspringen,
  **Fertig**

**2.** Auf das Konto klicken → **Schlüssel** → **Schlüssel hinzufügen** →
**Neuen Schlüssel erstellen** → **JSON** → **Erstellen**. Es lädt eine Datei
herunter.

**3.** Die E-Mail-Adresse des Dienstkontos kopieren. Sie sieht so aus:

```
seo-master@seo-master-123456.iam.gserviceaccount.com
```

**4.** Für **jede eigene Property**: https://search.google.com/search-console
→ Property wählen → **Einstellungen** → **Nutzer und Berechtigungen** →
**Nutzer hinzufügen** → die Adresse aus Schritt 3 → **Vollständig** oder
**Eingeschränkt** → **Hinzufügen**

**5.** In SEO-Master: **Datentresor** → *Google Search Console* →
**Dienstkonto** → den vollständigen Inhalt der JSON-Datei einfügen →
speichern → **Prüfen**.

---

## Was sich damit ändert

**Das Hauptkeyword wird gemessen statt geraten.** Bisher hat die Analyse aus
der Überschrift geschlossen, worum es auf der Seite geht. Jetzt nimmt sie die
Suchanfrage, über die die Seite tatsächlich am häufigsten gefunden wird.

**Die Schätzung steht nicht mehr allein.** Wo gezählte Klicks vorliegen,
stehen sie zuerst — und weicht die Hochrechnung um mehr als das Doppelte ab,
steht das ausdrücklich dabei.

**Drei Befunde, die es vorher nicht geben konnte:**

| Befund | Was er bedeutet |
|---|---|
| Gesehen, nicht geklickt | Die Seite steht auf Seite eins und wird trotzdem nicht angeklickt. Kein Ranking-Problem — Title und Description überzeugen nicht. Der schnellste Hebel überhaupt. |
| Knapp hinter Seite eins | Position 11 bis 20. Dort kommt kein Klick an, obwohl Google die Seite schon für passend hält. Wenige Plätze entscheiden über alles. |
| Nachfrage ohne Inhalt | Suchanfragen, für die die Seite erscheint, ohne sie zu behandeln. Nachweisliche Nachfrage, die noch niemand bedient. |

---

## Der eigentliche Engpass

Weder der eine noch der andere Weg hilft, wenn eine Kundin **gar keine Search
Console eingerichtet** hat. Dann gibt es die Daten nicht, egal wie man sich
verbindet.

Das ist keine technische Frage, sondern eine für dein Onboarding — und
womöglich eine Gelegenheit: „Ich richte dir das ein" ist ein guter erster
Kontaktpunkt, und danach hast du für alle weiteren Analysen echte Zahlen.
