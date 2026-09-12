import type { Organization } from '@prisma/client'
import { aboTraegt } from './stripe'

/**
 * Darf dieser Arbeitsbereich von aussen zugreifen?
 *
 * "Von aussen" heisst: Browser-Extension und KI-Anbindung (MCP) — alles,
 * was über einen Zugangsschlüssel läuft statt über die Anmeldung in der App.
 * Genau das sind die Teile, die laut Preisliste zum Abo gehören.
 *
 * Der Unterschied zum Guthaben ist wichtig: Das Guthaben begrenzt, wie viel
 * eine Abfrage kosten darf. Es sagt nichts darüber, ob jemand überhaupt
 * zugreifen darf. Wer kündigt, behält sein Restguthaben — es war bezahlt —,
 * aber der Zugang von aussen endet mit dem bezahlten Zeitraum.
 *
 * Was hier bewusst NICHT passiert: Der Schlüssel wird nicht gelöscht. Er
 * ruht. Wer wieder bucht, kann seine Extension und seine KI-Anbindung
 * weiterbenutzen, ohne alles neu einzurichten — und wer den Schlüssel
 * endgültig loswerden will, widerruft ihn in der App. Ein gelöschter
 * Schlüssel wäre eine Strafe für das Kündigen, kein Schutz.
 */
export type Zugangsurteil =
  | { erlaubt: true }
  | { erlaubt: false; grund: 'kein-abo' | 'abgelaufen' }

export function aussenzugang(organisation: {
  plan: Organization['plan']
  aboStatus: string | null
  aboLaeuftBis: Date | null
}): Zugangsurteil {
  // Interne Arbeitsbereiche zahlen nicht und sind nicht gemeint.
  if (organisation.plan === 'INTERNAL') return { erlaubt: true }

  // Ein laufendes Abo trägt — auch eines, dessen Zahlung gerade hakt und
  // eines, das zum Periodenende gekündigt ist: Stripe lässt den Status
  // solange auf "active", und bezahlt ist bezahlt.
  if (aboTraegt(organisation.aboStatus)) return { erlaubt: true }

  // Nachlauf: Meldet Stripe das Ende früher, als der bezahlte Zeitraum
  // reicht, gilt trotzdem der bezahlte Zeitraum.
  if (organisation.aboLaeuftBis && organisation.aboLaeuftBis > new Date()) {
    return { erlaubt: true }
  }

  return { erlaubt: false, grund: organisation.aboStatus ? 'abgelaufen' : 'kein-abo' }
}

/** Kurz und für Menschen — steht so in der App und in der Fehlerantwort. */
export function zugangsHinweis(urteil: Zugangsurteil): string {
  if (urteil.erlaubt) return 'Extension und KI-Anbindung sind freigeschaltet.'
  return urteil.grund === 'abgelaufen'
    ? 'Das Abo ist beendet. Extension und KI-Anbindung ruhen, bis wieder eines läuft — dein Zugangsschlüssel bleibt bestehen und gilt dann sofort wieder.'
    : 'Extension und KI-Anbindung gehören zum Abo. Sobald eines läuft, funktioniert dein Zugangsschlüssel ohne weiteres Zutun.'
}
