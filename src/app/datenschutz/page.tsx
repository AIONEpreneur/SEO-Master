import type { Metadata } from 'next'
import { Rechtstext } from '../rechtstext'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung — SEO-Master',
  robots: { index: true, follow: true },
}

/**
 * Datenschutzerklärung.
 *
 * Sie ist aus zwei Gründen nötig: In Deutschland für jede öffentlich
 * erreichbare Seite, und für die Google-Verifizierung des Anmelde-Knopfes.
 * Google verlangt eine öffentlich abrufbare Adresse auf derselben Domain, die
 * ausdrücklich beschreibt, was mit den Google-Daten geschieht — ohne sie wird
 * der Antrag abgewiesen.
 *
 * Die Passagen in eckigen Klammern muss Kirsten ergänzen; sie stehen
 * bewusst sichtbar da, statt erfunden zu werden.
 */
export default function DatenschutzSeite() {
  return (
    <Rechtstext titel="Datenschutzerklärung" stand="August 2026">
      <h2>Verantwortliche Stelle</h2>
      <p>
        [VOLLSTÄNDIGER NAME ODER FIRMA]<br />
        [STRASSE UND HAUSNUMMER]<br />
        [POSTLEITZAHL UND ORT]<br />
        E-Mail: [E-MAIL-ADRESSE]
      </p>

      <h2>Was diese Anwendung tut</h2>
      <p>
        SEO-Master analysiert Websites und Social-Media-Profile auf ihre
        Auffindbarkeit in Suchmaschinen und KI-Systemen. Die Anwendung wird auf
        einem eigenen Server in Deutschland betrieben. Es findet keine
        Übermittlung von Nutzungsdaten an Analysedienste Dritter statt; es
        werden keine Cookies zu Werbe- oder Analysezwecken gesetzt.
      </p>

      <h2>Daten, die beim Besuch der Website anfallen</h2>
      <p>
        Beim Aufruf der Seiten verarbeitet der Server technisch notwendige
        Verbindungsdaten: IP-Adresse, Zeitpunkt, aufgerufene Adresse,
        übertragene Datenmenge und Browserkennung. Rechtsgrundlage ist
        Artikel 6 Absatz 1 Buchstabe f DSGVO — das berechtigte Interesse am
        sicheren und störungsfreien Betrieb. Diese Daten werden nach
        spätestens sieben Tagen gelöscht.
      </p>

      <h2>Konto und Anmeldung</h2>
      <p>
        Für die Nutzung des Arbeitsbereichs ist ein Konto erforderlich.
        Gespeichert werden Name, E-Mail-Adresse und ein Passwort, das
        ausschliesslich als nicht umkehrbarer Prüfwert abgelegt wird. Ein
        Sitzungs-Cookie hält die Anmeldung aufrecht; es dient allein diesem
        Zweck und wird nicht zur Nachverfolgung eingesetzt. Rechtsgrundlage ist
        Artikel 6 Absatz 1 Buchstabe b DSGVO.
      </p>

      <h2>Zugangsdaten im Datentresor</h2>
      <p>
        Zugangsdaten zu Diensten Dritter werden mit AES-256-GCM verschlüsselt
        gespeichert. Der Schlüssel liegt ausserhalb der Datenbank; der Klartext
        wird nach dem Speichern nicht mehr angezeigt und verlässt den Server
        nicht.
      </p>

      <h2>Verbindung mit Google Search Console</h2>
      <p>
        Wer die Verbindung zu Google Search Console herstellt, erteilt
        ausschliesslich die Berechtigung
        <code>https://www.googleapis.com/auth/webmasters.readonly</code>. Damit
        werden ausgelesen: die Liste der Properties, auf die das verbundene
        Google-Konto Zugriff hat, sowie je Property und Seite die
        Suchanfragen, Einblendungen, Klicks, Klickraten und durchschnittlichen
        Positionen.
      </p>
      <p>
        <strong>Diese Berechtigung erlaubt ausschliesslich Lesezugriff auf
        Search Console.</strong> Es besteht kein Zugriff auf E-Mails,
        Kalender, Kontakte, Dateien oder andere Google-Dienste. Es werden keine
        Daten in das Google-Konto geschrieben.
      </p>
      <p>
        Gespeichert wird ein Zugangs-Token, das in derselben verschlüsselten
        Form abgelegt wird wie die übrigen Zugangsdaten. Die abgerufenen
        Suchdaten werden als Bestandteil des jeweiligen Analyseergebnisses
        gespeichert. Eine Weitergabe an Dritte findet nicht statt; sie werden
        weder für Werbung noch zum Training von Modellen verwendet.
      </p>
      <p>
        Die Verbindung lässt sich jederzeit beenden: im Datentresor über
        „Löschen" — dabei wird der Zugriff zugleich bei Google zurückgegeben —
        oder im eigenen Google-Konto unter Sicherheit, Drittanbieter-Apps.
        Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe a DSGVO
        (Einwilligung), widerruflich für die Zukunft.
      </p>
      <p>
        Die Verwendung von Daten aus Google-APIs richtet sich nach der{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>{' '}
        einschliesslich der Anforderungen zur eingeschränkten Verwendung
        (Limited Use).
      </p>

      <h2>Weitere Dienste in der Analyse</h2>
      <p>
        Für eine Analyse werden je nach gewählten Bausteinen Anfragen an
        folgende Anbieter gestellt. Übermittelt wird dabei die zu
        analysierende Adresse beziehungsweise der Suchbegriff — keine
        personenbezogenen Daten der Nutzerin.
      </p>
      <ul>
        <li><strong>DataForSEO</strong> (Zypern) — Platzierungen, Keyword- und Backlink-Daten</li>
        <li><strong>Firecrawl</strong> (USA) — Abruf der zu analysierenden Seite</li>
        <li><strong>Anthropic</strong> (USA) — Formulierung des Berichtstextes aus den Messwerten</li>
        <li><strong>Apify</strong> (Tschechien) — öffentliche Profildaten, nur bei Social-Analysen</li>
        <li><strong>Google PageSpeed Insights</strong> (USA) — Ladegeschwindigkeit</li>
      </ul>
      <p>
        Bei Anbietern ausserhalb der Europäischen Union erfolgt die
        Übermittlung auf Grundlage der Standardvertragsklauseln der
        EU-Kommission.
      </p>

      <h2>Speicherdauer</h2>
      <p>
        Analyseergebnisse und Berichte bleiben gespeichert, bis sie im
        Arbeitsbereich gelöscht werden. Mit dem Löschen eines Kontos werden
        alle zugehörigen Daten einschliesslich der Zugangsdaten entfernt.
      </p>

      <h2>Rechte der betroffenen Personen</h2>
      <p>
        Es besteht das Recht auf Auskunft (Artikel 15 DSGVO), Berichtigung
        (Artikel 16), Löschung (Artikel 17), Einschränkung der Verarbeitung
        (Artikel 18), Datenübertragbarkeit (Artikel 20) und Widerspruch
        (Artikel 21). Eine erteilte Einwilligung kann jederzeit mit Wirkung
        für die Zukunft widerrufen werden. Für die Ausübung genügt eine
        Nachricht an die oben genannte Adresse.
      </p>
      <p>
        Ausserdem besteht ein Beschwerderecht bei einer
        Datenschutz-Aufsichtsbehörde, in der Regel der des eigenen
        Bundeslandes.
      </p>
    </Rechtstext>
  )
}
