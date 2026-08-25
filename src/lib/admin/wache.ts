import { redirect } from 'next/navigation'
import { getSession, type SessionUser } from '@/lib/auth/session'

/**
 * Zugang zur Betriebsverwaltung.
 *
 * Getrennt von den Rollen innerhalb eines Arbeitsbereichs: Eine Kundin ist in
 * ihrem eigenen Bereich Inhaberin und hat dort alle Rechte – hier hat sie
 * nichts zu suchen. Massgeblich ist allein isSuperAdmin.
 *
 * Nicht "verboten", sondern Weiterleitung zur Übersicht: Wer keine
 * Betriebsverwaltung hat, soll nicht einmal erfahren, dass es sie gibt.
 */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isSuperAdmin) redirect('/dashboard')
  return session
}
