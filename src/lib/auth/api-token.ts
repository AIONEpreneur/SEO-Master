import { db } from '@/lib/db'
import { hashToken } from '@/lib/crypto/vault'
import { extAntwort } from '@/lib/extension/cors'
import { aussenzugang, zugangsHinweis } from '@/lib/billing/zugang'
import type { Organization } from '@prisma/client'

/**
 * Zugang über einen persönlichen API-Token (Browser-Extension SEO4U).
 *
 * Das Gegenstück zur Cookie-Sitzung für Aufrufe von ausserhalb der App: Die
 * Extension schickt `Authorization: Bearer <token>`. Gespeichert ist nur der
 * Hash; ein Widerruf (revokedAt) und eine Kontosperre wirken sofort.
 *
 * Das Ergebnis ist absichtlich keine Nullprüfung, sondern ein Urteil mit
 * Grund. Ein gültiger Schlüssel ohne laufendes Abo ist etwas anderes als ein
 * unbekannter, und die Kundin muss den Unterschied erfahren: Wer auf
 * "Schlüssel ungültig" hin einen neuen erzeugt, hat danach zwei Schlüssel,
 * die beide nicht gehen, und schreibt zu Recht eine verärgerte Mail.
 *
 * Dass der Abo-Test hier steht und nicht in den einzelnen Endpunkten, ist
 * der eigentliche Punkt: So kann ihn kein neuer Endpunkt vergessen. Der
 * Typ erzwingt, dass jede Aufrufstelle beide Fälle behandelt.
 */
export type TokenKontext = {
  tokenId: string
  userId: string
  userName: string | null
  organization: Organization
}

export type TokenErgebnis =
  | { ok: true; kontext: TokenKontext }
  /** Unbekannt, widerrufen oder das Konto ist gesperrt. */
  | { ok: false; grund: 'unbekannt' }
  /** Der Schlüssel stimmt — es fehlt das Abo. */
  | { ok: false; grund: 'kein-zugang'; hinweis: string }

export async function resolveApiToken(request: Request): Promise<TokenErgebnis> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  return resolveApiTokenWert(token)
}

/**
 * Denselben Schlüssel als blossen Wert auflösen – für die MCP-Anbindung,
 * bei der der Schlüssel in der Adresse steht statt im Authorization-Header
 * (die Verbindungs-Dialoge von Claude und ChatGPT nehmen nur eine Adresse
 * entgegen, keine eigenen Header).
 */
export async function resolveApiTokenWert(token: string): Promise<TokenErgebnis> {
  if (!token) return { ok: false, grund: 'unbekannt' }

  const eintrag = await db.apiToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true, organization: true },
  })
  if (!eintrag || eintrag.revokedAt || eintrag.user.suspendedAt) {
    return { ok: false, grund: 'unbekannt' }
  }

  // Der Schlüssel ist echt. Trägt das Abo ihn auch?
  const urteil = aussenzugang(eintrag.organization)
  if (!urteil.erlaubt) {
    return { ok: false, grund: 'kein-zugang', hinweis: zugangsHinweis(urteil) }
  }

  // Grobe Auflösung reicht: "zuletzt benutzt" ist eine Anzeige für die
  // Einstellungsseite, kein Protokoll – eine Schreibaktion pro Stunde genügt.
  const stunde = 60 * 60 * 1000
  if (!eintrag.lastUsedAt || Date.now() - eintrag.lastUsedAt.getTime() > stunde) {
    await db.apiToken.update({ where: { id: eintrag.id }, data: { lastUsedAt: new Date() } })
  }

  return {
    ok: true,
    kontext: {
      tokenId: eintrag.id,
      userId: eintrag.userId,
      userName: eintrag.user.name,
      organization: eintrag.organization,
    },
  }
}

/**
 * Einheitliche Fehlerantwort für die Extension-Endpunkte.
 *
 * Zwei Fälle, zwei Texte. Beim fehlenden Abo steht ausdrücklich dabei, dass
 * der Schlüssel in Ordnung ist — sonst erzeugt die Kundin einen neuen und
 * wundert sich, dass auch der nicht geht.
 */
export function tokenFehler(ergebnis: Extract<TokenErgebnis, { ok: false }>) {
  if (ergebnis.grund === 'kein-zugang') {
    return extAntwort(
      { ok: false, error: 'kein_zugang', message: ergebnis.hinweis },
      // 402: Die Anfrage ist in Ordnung, es fehlt die Bezahlung. Ein 401
      // hiesse "Schlüssel falsch" und wäre eine Lüge.
      402,
    )
  }
  return extAntwort(
    {
      ok: false,
      error: 'invalid_token',
      message: 'Der Zugangsschlüssel ist unbekannt oder widerrufen. Bitte in SEO-Master unter Einstellungen → Extension einen neuen erzeugen.',
    },
    401,
  )
}
