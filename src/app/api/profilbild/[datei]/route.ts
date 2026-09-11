import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getSession } from '@/lib/auth/session'
import { verzeichnis, medientyp, nameIstGueltig } from '@/lib/profil/bilder'

export const dynamic = 'force-dynamic'

/**
 * Profilbilder ausliefern.
 *
 * Über eine eigene Route statt als statische Datei: Die Bilder liegen in
 * einem Datenordner ausserhalb der Anwendung, damit sie einen Neubau des
 * Containers überstehen. Gezeigt werden sie nur angemeldeten Personen — ein
 * Profilbild ist nichts, was ins offene Netz gehört.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ datei: string }> }) {
  if (!(await getSession())) return new Response('Nicht angemeldet', { status: 401 })

  const { datei } = await params
  // Der Name muss einer sein, den diese Anwendung selbst vergeben hat. Damit
  // ist jeder Ausbruch aus dem Ordner ausgeschlossen — Pfadanteile wie ".."
  // bestehen die Prüfung nicht.
  if (!nameIstGueltig(datei)) return new Response('Nicht gefunden', { status: 404 })

  try {
    const inhalt = await readFile(join(verzeichnis(), datei))
    return new Response(new Uint8Array(inhalt), {
      headers: {
        'content-type': medientyp(datei),
        // Der Name wechselt bei jedem neuen Bild, deshalb darf die alte
        // Fassung lange im Zwischenspeicher bleiben.
        'cache-control': 'private, max-age=86400',
      },
    })
  } catch {
    return new Response('Nicht gefunden', { status: 404 })
  }
}
