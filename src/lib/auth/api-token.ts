import { db } from '@/lib/db'
import { hashToken } from '@/lib/crypto/vault'
import { extAntwort } from '@/lib/extension/cors'
import type { Organization } from '@prisma/client'

/**
 * Zugang über einen persönlichen API-Token (Browser-Extension SEO4U).
 *
 * Das Gegenstück zur Cookie-Sitzung für Aufrufe von ausserhalb der App: Die
 * Extension schickt `Authorization: Bearer <token>`. Gespeichert ist nur der
 * Hash; ein Widerruf (revokedAt) und eine Kontosperre wirken sofort.
 */
export type TokenKontext = {
  tokenId: string
  userId: string
  userName: string | null
  organization: Organization
}

export async function resolveApiToken(request: Request): Promise<TokenKontext | null> {
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
export async function resolveApiTokenWert(token: string): Promise<TokenKontext | null> {
  if (!token) return null

  const eintrag = await db.apiToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true, organization: true },
  })
  if (!eintrag || eintrag.revokedAt || eintrag.user.suspendedAt) return null

  // Grobe Auflösung reicht: "zuletzt benutzt" ist eine Anzeige für die
  // Einstellungsseite, kein Protokoll – eine Schreibaktion pro Stunde genügt.
  const stunde = 60 * 60 * 1000
  if (!eintrag.lastUsedAt || Date.now() - eintrag.lastUsedAt.getTime() > stunde) {
    await db.apiToken.update({ where: { id: eintrag.id }, data: { lastUsedAt: new Date() } })
  }

  return {
    tokenId: eintrag.id,
    userId: eintrag.userId,
    userName: eintrag.user.name,
    organization: eintrag.organization,
  }
}

/** Einheitliche Fehlerantwort für die Extension-Endpunkte. */
export function tokenFehler() {
  return extAntwort(
    {
      ok: false,
      error: 'invalid_token',
      message: 'Der Zugangsschlüssel ist unbekannt oder widerrufen. Bitte in SEO-Master unter Einstellungen → Extension einen neuen erzeugen.',
    },
    401,
  )
}
