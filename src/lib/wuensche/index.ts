import type { WunschStatus } from '@prisma/client'

/**
 * Wünsche für künftige Funktionen.
 *
 * Ein Wunsch gehört dem Arbeitsbereich, nicht der Anwendung: Eine Kundin
 * sieht ihre eigenen und die ihres Teams, nie die einer anderen. Der Betrieb
 * sieht alle — nur so lässt sich erkennen, was mehrfach gewünscht wird.
 *
 * Der Status ist kein Schmuck. Ein Wunsch ohne sichtbare Antwort fühlt sich
 * an wie ein Brief in einen Briefkasten ohne Leerung; wer zweimal so etwas
 * erlebt hat, schreibt nicht mehr.
 */

export const STATUS_LABEL: Record<WunschStatus, string> = {
  OFFEN: 'Offen',
  GEPLANT: 'Geplant',
  UMGESETZT: 'Umgesetzt',
  ABGELEHNT: 'Nicht geplant',
}

export const STATUS_FARBE: Record<WunschStatus, string> = {
  OFFEN: 'bg-sand',
  GEPLANT: 'bg-blau',
  UMGESETZT: 'bg-limette',
  ABGELEHNT: 'bg-rosa',
}

/** Was der Status für die Wartende bedeutet — in einem Satz. */
export const STATUS_ERKLAERUNG: Record<WunschStatus, string> = {
  OFFEN: 'Gelesen, noch nicht entschieden.',
  GEPLANT: 'Kommt. Ein Datum gibt es noch nicht.',
  UMGESETZT: 'Fertig — steht in den Neuigkeiten.',
  ABGELEHNT: 'Wird nicht gebaut. Der Grund steht dabei.',
}

export const STATUS_WERTE: WunschStatus[] = ['OFFEN', 'GEPLANT', 'UMGESETZT', 'ABGELEHNT']
