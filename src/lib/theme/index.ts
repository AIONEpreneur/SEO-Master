import { cookies } from 'next/headers'

export const THEME_COOKIE = 'seomaster_theme'

export type Theme = 'light' | 'dark' | 'system'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * Gewähltes Erscheinungsbild aus dem Cookie lesen.
 *
 * Die Wahl wird serverseitig ausgewertet und als data-theme an das
 * <html>-Element geschrieben. Damit steht die Farbe schon im ersten
 * ausgelieferten HTML – ohne diesen Schritt würde die Seite kurz hell
 * aufblitzen, bevor JavaScript die Wahl nachträgt.
 */
export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value
  return isTheme(value) ? value : 'system'
}
