/**
 * Die öffentlichen Tarife — an genau einer Stelle.
 *
 * ACHTUNG: Preise und Guthaben sind Platzhalter, bis Kirsten sie festlegt.
 * Welcher Preis bei Stripe hinterlegt ist, steht nicht hier, sondern in den
 * Umgebungsvariablen STRIPE_PREIS_STARTER und STRIPE_PREIS_PRO — solange die
 * fehlen, führen die Abo-Knöpfe offen beschriftet zur Registrierung.
 */

import { plaetzeLeistung } from './plaetze'

export type Tarif = {
  kennung: 'FREE' | 'STARTER' | 'PRO'
  name: string
  preis: string
  preisHinweis: string
  beschreibung: string
  leistungen: string[]
  /**
   * Guthaben, das mit jedem bezahlten Monat aufgefüllt wird.
   * Ein Credit ist ein Cent an Anbieterkosten: Eine Analyse kostet etwa 40,
   * eine Recherche etwa 10. Die Zahl ist bewusst so gewählt, dass zwischen
   * Preis und Anbieterkosten Luft für Support und Weiterentwicklung bleibt.
   */
  monatsguthaben: number
  /** Flächenfarbe der Karte — die Akzentfarben der Vorlage. */
  farbe: 'creme' | 'orange' | 'limette'
  hervorgehoben: boolean
}

export const TARIFE: Tarif[] = [
  {
    kennung: 'FREE',
    name: 'Umschauen',
    preis: '0 €',
    preisHinweis: 'für immer',
    beschreibung: 'In Ruhe ansehen, wie ehrliche Sichtbarkeitsmessung aussieht.',
    leistungen: [
      plaetzeLeistung('FREE'),
      'Eigener Arbeitsbereich mit Login',
      'Schnell-Check ohne Grenzen',
      'Startguthaben für echte Recherchen und Analysen',
      'Alle Berichte in der App lesbar',
    ],
    monatsguthaben: 0,
    farbe: 'creme',
    hervorgehoben: false,
  },
  {
    kennung: 'STARTER',
    name: 'Starter',
    preis: '29 €',
    preisHinweis: 'im Monat, jederzeit kündbar',
    beschreibung: 'Für die eigene Website: messen, nacharbeiten, mitnehmen.',
    leistungen: [
      plaetzeLeistung('STARTER'),
      'Monatliches Kontingent an Recherchen und Analysen',
      'Alle Exporte: CSV, „Für KI kopieren“, Berichte',
      'SEO4U-Browser-Extension',
      'Claude und ChatGPT direkt angebunden',
    ],
    monatsguthaben: 1200,
    farbe: 'orange',
    hervorgehoben: true,
  },
  {
    kennung: 'PRO',
    name: 'Pro',
    preis: '79 €',
    preisHinweis: 'im Monat, jederzeit kündbar',
    beschreibung: 'Für alle, die mehrere Websites oder Kundinnen betreuen.',
    leistungen: [
      'Grosses Monatskontingent',
      'Alles aus Starter',
      'Wettbewerbs-Vergleiche und Verlauf',
      plaetzeLeistung('PRO'),
    ],
    monatsguthaben: 4000,
    farbe: 'limette',
    hervorgehoben: false,
  },
]
