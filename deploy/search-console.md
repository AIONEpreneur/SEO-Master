# Search Console verbinden

Search Console ist die einzige Quelle, die zählt statt zu schätzen. Alle
anderen Anbieter messen Platzierungen von aussen und rechnen daraus einen
wahrscheinlichen Besuch hoch. Wie weit das auseinandergeht, zeigt ein realer
Fall: 35 geschätzte gegen 277 gezählte Besuche.

Der Anschluss läuft über ein **Dienstkonto**. Das ist ein technisches
Google-Konto, das nur lesen darf, was du ihm ausdrücklich erlaubst — kein
Zugriff auf deine E-Mail, keine Anmeldung mit deinem Passwort, kein
Zustimmungsbildschirm, der nach sieben Tagen abläuft.

Zwei Orte, ungefähr zehn Minuten.

---

## Teil 1: Das Dienstkonto anlegen

**1.** Öffne https://console.cloud.google.com/projectcreate

Projektname: `seo-master`. Auf **Erstellen** klicken, dann warten, bis oben
rechts die Meldung kommt, und das neue Projekt oben in der Leiste auswählen.

**2.** Öffne https://console.cloud.google.com/apis/library/searchconsole.googleapis.com

Auf **Aktivieren** klicken.

**3.** Öffne https://console.cloud.google.com/iam-admin/serviceaccounts/create

- Name des Dienstkontos: `seo-master`
- Auf **Erstellen und fortfahren** klicken
- Die beiden folgenden Schritte (Rollen, Nutzerzugriff) überspringen —
  auf **Fertig** klicken

**4.** In der Liste erscheint jetzt das Konto. Klicke darauf, dann auf den
Reiter **Schlüssel** › **Schlüssel hinzufügen** › **Neuen Schlüssel erstellen**
› **JSON** › **Erstellen**.

Es lädt eine Datei herunter. Die brauchst du gleich.

**5.** Kopiere die E-Mail-Adresse des Dienstkontos. Sie steht auf derselben
Seite und sieht so aus:

```
seo-master@seo-master-123456.iam.gserviceaccount.com
```

---

## Teil 2: Der Search Console Zugriff geben

**6.** Öffne https://search.google.com/search-console und wähle oben links
deine Property aus.

**7.** Links unten: **Einstellungen** › **Nutzer und Berechtigungen** ›
**Nutzer hinzufügen**

- E-Mail-Adresse: die aus Schritt 5
- Berechtigung: **Vollständig** oder **Eingeschränkt** — beides genügt
- **Hinzufügen**

> Ohne diesen Schritt bleibt das Dienstkonto gültig, sieht aber nichts. Die
> Prüfung im Tresor sagt dann genau das.

---

## Teil 3: In SEO-Master eintragen

**8.** Öffne die heruntergeladene JSON-Datei mit einem beliebigen
Texteditor (Doppelklick genügt meist) und markiere **den gesamten Inhalt** —
von der ersten geschweiften Klammer bis zur letzten.

**9.** In SEO-Master: **Datentresor** › **Google Search Console** ›
**Eintragen**. Den Inhalt in das grosse Feld einfügen und speichern.

**10.** Auf **Prüfen** klicken. Es sollte grün werden. Falls nicht, sagt die
Meldung, woran es liegt.

Danach ist bei jeder neuen Analyse der Baustein **Search Console** vorausgewählt.

---

## Was sich damit ändert

**Das Hauptkeyword wird gemessen statt geraten.** Bisher hat die Analyse aus
der Überschrift geschlossen, worum es auf der Seite geht. Jetzt nimmt sie die
Suchanfrage, über die die Seite tatsächlich am häufigsten gefunden wird.

**Die Schätzung steht nicht mehr allein.** Wo gezählte Klicks vorliegen,
stehen sie zuerst — und wenn die Hochrechnung um mehr als das Doppelte
abweicht, steht das ausdrücklich dabei.

**Drei Befunde, die es vorher nicht geben konnte:**

| Befund | Was er bedeutet |
|---|---|
| Gesehen, nicht geklickt | Die Seite steht auf Seite eins und wird trotzdem nicht angeklickt. Kein Ranking-Problem — Title und Description überzeugen nicht. Der schnellste Hebel überhaupt. |
| Knapp hinter Seite eins | Position 11 bis 20. Dort kommt kein Klick an, obwohl Google die Seite schon für passend hält. Wenige Plätze entscheiden über alles. |
| Nachfrage ohne Inhalt | Suchanfragen, für die die Seite erscheint, ohne sie zu behandeln. Nachweisliche Nachfrage, die noch niemand bedient. |

---

## Für später: Verkauf an Dritte

Ein Dienstkonto ist der richtige Weg für den eigenen Betrieb. Sobald andere
diese Anwendung nutzen, wäre OAuth passender: Dann verbindet jede Kundin ihr
eigenes Google-Konto per Klick, statt ein fremdes Dienstkonto in ihrer Search
Console freizuschalten.

Der Umbau beträfe nur die Beschaffung des Zugriffstokens
(`src/lib/connectors/search-console.ts`); alles darüber — Abfragen,
Auswertung, Befunde — bliebe unverändert.
