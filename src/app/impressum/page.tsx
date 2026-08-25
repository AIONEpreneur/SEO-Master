import type { Metadata } from 'next'
import { Rechtstext } from '../rechtstext'

export const metadata: Metadata = {
  title: 'Impressum — SEO-Master',
  robots: { index: true, follow: true },
}

export default function ImpressumSeite() {
  return (
    <Rechtstext titel="Impressum" stand="August 2026">
      <h2>Angaben gemäss § 5 DDG</h2>
      <p>
        [VOLLSTÄNDIGER NAME ODER FIRMA]<br />
        [STRASSE UND HAUSNUMMER]<br />
        [POSTLEITZAHL UND ORT]<br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: [E-MAIL-ADRESSE]<br />
        Telefon: [TELEFONNUMMER]
      </p>

      <h2>Umsatzsteuer-Identifikationsnummer</h2>
      <p>
        Umsatzsteuer-Identifikationsnummer gemäss § 27 a Umsatzsteuergesetz:<br />
        [USt-IdNr. ODER: nicht vorhanden, Kleinunternehmerregelung nach § 19 UStG]
      </p>

      <h2>Verantwortlich für den Inhalt</h2>
      <p>
        [VOLLSTÄNDIGER NAME]<br />
        Anschrift wie oben
      </p>

      <h2>Streitbeilegung</h2>
      <p>
        Zur Teilnahme an einem Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle sind wir weder verpflichtet noch bereit.
      </p>
    </Rechtstext>
  )
}
