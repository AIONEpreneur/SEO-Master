import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { anmeldeAdresse, oauthKonfiguriert } from '@/lib/connectors/google-oauth'
import { env } from '@/lib/env'

/**
 * Start der Google-Anmeldung.
 *
 * Ein Knopf im Tresor führt hierher; von hier geht es weiter zu Google. Der
 * Umweg über eine eigene Route statt eines direkten Links ist wichtig: Nur so
 * lässt sich vorher prüfen, wer angemeldet ist, und der Zustand signieren.
 */
export async function GET() {
  const zurueck = `${env().APP_URL.replace(/\/$/, '')}/settings/vault`

  // Nur Verwaltende dürfen Zugänge herstellen – dieselbe Schwelle wie beim
  // Eintragen eines Schlüssels.
  const session = await requireRole('ADMIN')

  if (!oauthKonfiguriert()) {
    return NextResponse.redirect(`${zurueck}?google=nicht-eingerichtet`)
  }

  return NextResponse.redirect(anmeldeAdresse(session.organizationId))
}
