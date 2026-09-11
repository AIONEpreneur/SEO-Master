/**
 * Die öffentlichen Tarife — an genau einer Stelle.
 *
 * ACHTUNG: Die Preise sind Platzhalter, bis Kirsten sie festlegt. Die
 * ThriveCart-Adressen bleiben leer, bis die Produkte dort angelegt sind —
 * solange führen die Abo-Knöpfe zur kostenlosen Registrierung, und der
 * Hinweis darunter sagt das ehrlich dazu.
 */

export type Tarif = {
  kennung: 'FREE' | 'STARTER' | 'PRO'
  name: string
  preis: string
  preisHinweis: string
  beschreibung: string
  leistungen: string[]
  /** Kauf-Adresse (ThriveCart). Leer: Knopf führt zur Registrierung. */
  kaufUrl: string
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
      'Eigener Arbeitsbereich mit Login',
      'Schnell-Check ohne Grenzen',
      'Startguthaben für erste echte Recherchen und Analysen',
      'Alle Berichte in der App lesbar',
    ],
    kaufUrl: '',
    hervorgehoben: false,
  },
  {
    kennung: 'STARTER',
    name: 'Starter',
    preis: '29 €',
    preisHinweis: 'im Monat, jederzeit kündbar',
    beschreibung: 'Für die eigene Website: messen, nacharbeiten, mitnehmen.',
    leistungen: [
      'Monatliches Kontingent an Recherchen und Analysen',
      'Alle Exporte: CSV, „Für KI kopieren“, Berichte',
      'SEO4U-Browser-Extension',
      'MCP-Anbindung für Claude und ChatGPT',
    ],
    kaufUrl: '',
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
      'Team-Zugänge für den Arbeitsbereich',
    ],
    kaufUrl: '',
    hervorgehoben: false,
  },
]
