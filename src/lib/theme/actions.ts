'use server'

import { cookies } from 'next/headers'
import { THEME_COOKIE, isTheme, type Theme } from './index'

/** Erscheinungsbild dauerhaft für dieses Gerät hinterlegen. */
export async function setThemeAction(theme: Theme) {
  if (!isTheme(theme)) return

  const store = await cookies()
  store.set(THEME_COOKIE, theme, {
    path: '/',
    sameSite: 'lax',
    // Ein Jahr – die Wahl soll nicht nach ein paar Tagen zurückspringen.
    maxAge: 60 * 60 * 24 * 365,
    // Bewusst kein httpOnly: die Umschaltung wirkt sofort im Browser,
    // noch bevor der Server antwortet.
    httpOnly: false,
  })
}
