import { env } from '@/lib/env'

/**
 * Ereignisse nach draussen melden — an einen Webhook.
 *
 * Bewusst kein eingebauter Slack-Anschluss. Slack hat eigene Formate,
 * eigene Zugangsdaten und ändert sie; morgen soll es vielleicht Telegram
 * sein, eine Tabelle oder eine SMS. Was diese Anwendung verlässlich kann,
 * ist zu sagen "es ist etwas passiert, hier sind die Daten". Was daraus
 * wird, entscheidet der Workflow am anderen Ende — n8n, Make, ein eigenes
 * Skript.
 *
 * Fehlt die Adresse, passiert nichts. Kein Fehler, keine Meldung: Ein
 * Webhook ist eine Zutat, keine Voraussetzung.
 */

export type Ereignis = {
  /** Punktnotation, damit sich im Workflow danach verzweigen lässt. */
  art: 'wunsch.neu' | 'probe'
  titel: string
  text: string
  /** Wo es passiert ist — Name des Arbeitsbereichs. */
  bereich?: string
  /** Wer es ausgelöst hat. Name oder Adresse, nie beides. */
  person?: string
  /** Direktlink in die Anwendung, damit der Weg von Slack zurück kurz ist. */
  url?: string
}

export function webhookEingerichtet(): boolean {
  return Boolean(env().WEBHOOK_URL)
}

/**
 * Ein Ereignis senden.
 *
 * Antwortet immer mit einem Ergebnis statt zu werfen. Der Grund ist die
 * Reihenfolge der Wichtigkeit: Ein Wunsch ist gespeichert, bevor hier
 * irgendetwas passiert. Ein Aussetzer beim Melden darf die Eintragende
 * nicht mit einer Fehlermeldung begrüssen — für sie hat alles geklappt,
 * und das stimmt auch.
 */
export async function sendeEreignis(
  ereignis: Ereignis,
): Promise<{ ok: true } | { ok: false; grund: string }> {
  const { WEBHOOK_URL, WEBHOOK_TOKEN, APP_URL } = env()
  if (!WEBHOOK_URL) return { ok: false, grund: 'Keine Webhook-Adresse hinterlegt.' }

  const koerper = JSON.stringify({
    ...ereignis,
    quelle: 'seo-master',
    app: APP_URL,
    zeitpunkt: new Date().toISOString(),
  })

  try {
    // Eine Zeitgrenze ist Pflicht: Ohne sie hängt das Absenden des Formulars
    // an der Erreichbarkeit eines fremden Servers.
    const abbruch = AbortSignal.timeout(5000)
    const antwort = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Header-Authentifizierung, weil der Webhook-Baustein von n8n genau
        // die von Haus aus kann. Ein signierter Hash wäre sauberer, würde
        // aber am anderen Ende einen Funktionsbaustein verlangen.
        ...(WEBHOOK_TOKEN ? { Authorization: `Bearer ${WEBHOOK_TOKEN}` } : {}),
      },
      body: koerper,
      signal: abbruch,
    })

    if (!antwort.ok) {
      return { ok: false, grund: `Der Webhook antwortete mit ${antwort.status}.` }
    }
    return { ok: true }
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : 'Unbekannter Fehler'
    console.error('[webhook] Senden fehlgeschlagen:', fehler)
    return { ok: false, grund }
  }
}
