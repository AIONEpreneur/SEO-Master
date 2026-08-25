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

## Teil 2: Deinen Properties Zugriff geben

> **Wichtig vorweg — die Frage, die sich hier zuerst stellt:**
>
> Search Console kennt **ausschliesslich deine eigenen Seiten**. Sie ist kein
> öffentlicher Dienst, der über jede Website Auskunft gibt — sie zeigt nur,
> was Google über Seiten weiss, für die du selbst freigeschaltet bist.
>
> Für eine Wettbewerberseite gibt es diese Zahlen nicht, und es kann sie nicht
> geben. Das ist keine Einschränkung dieser Anwendung, sondern die Natur der
> Sache: Niemand ausser der Betreiberin sieht diese Daten.
>
> Analysierst du eine fremde Seite, entfällt der Baustein einfach. Der Bericht
> sagt das ausdrücklich und bewertet wie bisher mit Hochrechnungen.

**Was du also freischaltest:** jede Property, die dir gehört und für die du
gezählte Zahlen willst. Das sind heute vielleicht zwei oder drei — deine
Hauptseite, ein Projekt, ein Blog. Jede einmal, danach nie wieder.

Für jede dieser Properties:

**6.** Öffne https://search.google.com/search-console und wähle oben links
die Property aus.

**7.** Links unten: **Einstellungen** › **Nutzer und Berechtigungen** ›
**Nutzer hinzufügen**

- E-Mail-Adresse: die aus Schritt 5 (für alle Properties dieselbe)
- Berechtigung: **Vollständig** oder **Eingeschränkt** — beides genügt
- **Hinzufügen**

**8.** Nächste Property auswählen, Schritt 7 wiederholen. Fertig.

> Ohne diesen Schritt bleibt das Dienstkonto gültig, sieht aber nichts. Die
> Prüfung im Tresor sagt dann genau das.

### Und wenn du für Kundinnen arbeitest?

Dann bittest du die Kundin, dieselbe E-Mail-Adresse in **ihrer** Search
Console als Nutzerin hinzuzufügen — Schritt 7, einmal, bei ihr. Danach liefert
die Analyse auch für ihre Seite gezählte Zahlen. Sie kann den Zugriff jederzeit
wieder entziehen.

---

## Teil 3: In SEO-Master eintragen

**9.** Öffne die heruntergeladene JSON-Datei mit einem beliebigen
Texteditor (Doppelklick genügt meist) und markiere **den gesamten Inhalt** —
von der ersten geschweiften Klammer bis zur letzten.

**10.** In SEO-Master: **Datentresor** › **Google Search Console** ›
**Eintragen**. Den Inhalt in das grosse Feld einfügen und speichern.

**11.** Auf **Prüfen** klicken. Es sollte grün werden — und darunter erscheint
die Liste der verbundenen Properties. Genau für diese Seiten gibt es künftig
gezählte Zahlen, für alle anderen nicht.

Danach ist bei jeder neuen Analyse der Baustein **Search Console** vorausgewählt.

---

## Was sich damit ändert

**Das Hauptkeyword wird gemessen statt geraten.** Bisher hat die Analyse aus
der Überschrift geschlossen, worum es auf der Seite geht. Jetzt nimmt sie die
Suchanfrage, über die die Seite tatsächlich am häufigsten gefunden wird.

**Die Schätzung steht nicht mehr allein.** Wo gezählte Klicks vorliegen,
stehen sie zuerst — und wenn die Hochrechnung um mehr als das Doppelte
abweicht, steht das ausdrücklich dabei.

**Nur für deine eigenen Seiten.** Analysierst du eine fremde Seite, entfällt
der Baustein und der Bericht weist das aus. Die übrigen Bausteine — SEO, AEO,
GEO, SERP, Wettbewerb — arbeiten unverändert weiter und funktionieren für jede
beliebige Adresse.

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
