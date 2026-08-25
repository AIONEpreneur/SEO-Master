# Den Warnhinweis loswerden

„Diese App wurde nicht von Google überprüft."

Dieser Bildschirm kommt von Google, nicht aus der Anwendung. Er lässt sich
nicht abschalten, nicht überspringen und nicht umgestalten. Der einzige Weg,
ihn zu entfernen, ist Googles Prüfverfahren.

**Das dauert Tage bis Wochen.** Wer heute etwas verspricht, das morgen fertig
ist, hat das Verfahren nicht gelesen.

---

## Sofort erledigen: den Zustimmungsbildschirm veröffentlichen

Das ist wichtiger als der Warnhinweis, und es dauert zwei Minuten.

Solange die App im Zustand **Testing** steht, gilt:

- **Zugangs-Token verfallen nach sieben Tagen.** Die Verbindung stirbt jede
  Woche, ohne erkennbaren Grund. Das ist der eigentliche Defekt.
- Nur ausdrücklich eingetragene Testnutzerinnen kommen überhaupt durch.
  Alle anderen sehen „Zugriff blockiert" — nicht einmal mit Warnhinweis.

**So umstellen:**

1. https://console.cloud.google.com/auth/audience
2. Bei *Zielgruppe* auf **App veröffentlichen** → bestätigen

Danach kommt jede durch (mit Warnhinweis), und die Verbindung hält dauerhaft.

---

## Was für die Prüfung gebraucht wird

Google prüft drei Dinge: dass die Domain dir gehört, dass die Anwendung
erklärt, was sie mit den Daten tut, und dass der angeforderte Zugriff dafür
nötig ist.

### 1. Startseite und Datenschutzerklärung

Beide müssen öffentlich erreichbar sein, auf derselben Domain wie die
Weiterleitungs-URL:

- `https://seo-master.aionepreneur.com/` — vorhanden
- `https://seo-master.aionepreneur.com/datenschutz` — vorhanden

> **Vorher ausfüllen:** In `/datenschutz` und `/impressum` stehen Passagen in
> eckigen Klammern — Name, Anschrift, E-Mail, Umsatzsteuer-Angabe. Google
> weist Anträge mit Platzhaltern ab, und in Deutschland sind beide Seiten
> ohnehin Pflicht.

Die Datenschutzerklärung nennt bereits ausdrücklich, was Google sehen will:
welche Berechtigung angefordert wird, welche Daten damit gelesen werden, dass
kein Zugriff auf andere Google-Dienste besteht, wie sich die Verbindung lösen
lässt, und einen Verweis auf die *Google API Services User Data Policy*
einschliesslich *Limited Use*.

### 2. Nachweis, dass dir die Domain gehört

1. https://search.google.com/search-console — Property
   `seo-master.aionepreneur.com` anlegen und bestätigen
2. In der Cloud Console unter *OAuth-Zustimmungsbildschirm* → *Branding* die
   Domain als autorisiert eintragen

Dasselbe Google-Konto muss beides besitzen.

### 3. Ein kurzes Video

Ungelistetes YouTube-Video, zwei bis drei Minuten, ohne Schnitt. Zeigen:

1. Die Adresszeile mit `seo-master.aionepreneur.com` — sichtbar
2. Anmeldung im Arbeitsbereich
3. Datentresor → **Mit Google verbinden**
4. Den Zustimmungsbildschirm mit der angeforderten Berechtigung — sichtbar
5. Zurück in der Anwendung: die verbundenen Properties
6. Eine Analyse, in der die Search-Console-Zahlen auftauchen
7. Datentresor → **Löschen** — die Verbindung wird beendet

Punkt 4 und 7 sind die entscheidenden: Google will sehen, dass die
Berechtigung tatsächlich für das angezeigte Merkmal gebraucht wird und dass
sie sich zurücknehmen lässt.

### 4. Begründung der Berechtigung

Im Antrag wird gefragt, wozu `webmasters.readonly` nötig ist. Ein
verwendbarer Text:

> Die Anwendung erstellt Sichtbarkeitsanalysen für Websites. Über die Search
> Console API werden ausschliesslich lesend die Suchanfragen, Einblendungen,
> Klicks und durchschnittlichen Positionen der Properties abgerufen, für die
> die Nutzerin selbst freigeschaltet ist. Diese gezählten Werte ersetzen die
> Hochrechnungen anderer Datenanbieter und sind die Grundlage dreier Befunde
> im Analysebericht: Suchanfragen mit auffällig niedriger Klickrate,
> Suchanfragen knapp hinter der ersten Ergebnisseite, und Nachfrage ohne
> passenden Inhalt. Es werden keine Daten in das Google-Konto geschrieben und
> keine weiteren Google-Dienste angesprochen. Ein schreibender oder
> weitergehender Zugriff ist für den Zweck nicht erforderlich, deshalb wird
> ausschliesslich der Lesezugriff angefordert.

### 5. Einreichen

https://console.cloud.google.com/auth/verification → **Zur Überprüfung
einreichen**

Rückfragen kommen per E-Mail an die hinterlegte Kontaktadresse. Sie werden
gelegentlich als Werbung einsortiert — den Spam-Ordner mitlesen.

---

## Bis die Prüfung durch ist

**Für dich selbst:** Der Warnhinweis ist eine Formalie. Über *Erweitert* →
*Weiter zu SEO-Master* kommst du durch, und nach dem Veröffentlichen des
Zustimmungsbildschirms hält die Verbindung dauerhaft.

**Für Kundinnen:** Zeig ihnen den Knopf noch nicht. Ein Warnbildschirm mit
rotem Dreieck ist bei jemandem, der ohnehin unsicher ist, das Ende des
Gesprächs — und zwar zu Recht: Genau so sehen echte Betrugsversuche aus, und
es ist gut, dass sie darauf reagieren.

Solange gilt für Kundenprojekte:

- **Ohne Search Console analysieren.** Läuft vollständig, mit Hochrechnungen
  statt gezählten Zahlen. Keine Verbindung nötig, kein Warnhinweis, nichts zu
  erklären.
- **Oder du richtest es für sie ein**, mit deinem Zugang, in einem Termin —
  und lässt dir dafür die Search Console freigeben.

Sobald die Prüfung durch ist, verschwindet der Bildschirm für alle, und der
Knopf ist genau das, was er sein soll: drei Klicks.
