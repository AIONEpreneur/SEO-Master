import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import crypto from 'node:crypto'
import { env } from '@/lib/env'

/**
 * Profilbilder.
 *
 * Sie liegen ausserhalb des Anwendungsverzeichnisses in einem eigenen
 * Datenordner (UPLOAD_VERZEICHNIS, im Container ein Volume). Das ist keine
 * Feinheit: Läge das Bild unter public/, wäre es nach dem nächsten
 * Neubau des Containers weg.
 *
 * Ausgeliefert werden die Bilder über eine eigene Route, nicht als statische
 * Datei — so lässt sich prüfen, wer fragt, und der Dateiname verrät nichts
 * über die Person.
 */

/** Was angenommen wird — und womit ausgeliefert wird. */
const ERLAUBT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Mehr als das braucht ein Profilbild nicht. */
export const HOECHSTGROESSE = 2 * 1024 * 1024

export function verzeichnis(): string {
  return env().UPLOAD_VERZEICHNIS
}

export function medientyp(datei: string): string {
  const endung = datei.split('.').pop()?.toLowerCase()
  const treffer = Object.entries(ERLAUBT).find(([, e]) => e === endung)
  return treffer?.[0] ?? 'application/octet-stream'
}

export type Ablageergebnis = { ok: true; datei: string } | { ok: false; grund: string }

/**
 * Ein hochgeladenes Bild ablegen.
 *
 * Der Dateiname wird gewürfelt, nicht vom Upload übernommen: Ein Name aus
 * der Anfrage könnte Pfadanteile enthalten und aus dem Ordner ausbrechen.
 * Geprüft wird ausserdem der Anfang der Datei — der angegebene Typ ist nur
 * eine Behauptung des Browsers, die Signatur nicht.
 */
export async function legeBildAb(datei: File): Promise<Ablageergebnis> {
  const endung = ERLAUBT[datei.type]
  if (!endung) {
    return { ok: false, grund: 'Bitte ein Bild als JPG, PNG oder WebP hochladen.' }
  }
  if (datei.size > HOECHSTGROESSE) {
    return { ok: false, grund: 'Das Bild ist grösser als 2 MB. Bitte ein kleineres wählen.' }
  }

  const inhalt = Buffer.from(await datei.arrayBuffer())
  if (!signaturPasst(inhalt, endung)) {
    return { ok: false, grund: 'Die Datei ist kein gültiges Bild.' }
  }

  const name = `${crypto.randomBytes(16).toString('hex')}.${endung}`
  const ordner = verzeichnis()
  await mkdir(ordner, { recursive: true })
  await writeFile(join(ordner, name), inhalt)
  return { ok: true, datei: name }
}

/** Ein abgelegtes Bild entfernen. Fehlt es schon, ist das kein Fehler. */
export async function entferneBild(datei: string | null): Promise<void> {
  if (!datei || !/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(datei)) return
  await unlink(join(verzeichnis(), datei)).catch(() => {})
}

/** Ist der Name einer, den diese Anwendung selbst vergeben hat? */
export function nameIstGueltig(datei: string): boolean {
  return /^[a-f0-9]{32}\.(jpg|png|webp)$/.test(datei)
}

/**
 * Stimmt der Dateianfang mit dem behaupteten Typ überein?
 *
 * Drei Signaturen reichen: JPEG beginnt mit FF D8 FF, PNG mit dem bekannten
 * acht Byte langen Kopf, WebP trägt "RIFF" und ab Byte acht "WEBP".
 */
function signaturPasst(inhalt: Buffer, endung: string): boolean {
  if (inhalt.length < 12) return false
  if (endung === 'jpg') return inhalt[0] === 0xff && inhalt[1] === 0xd8 && inhalt[2] === 0xff
  if (endung === 'png') {
    return inhalt.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (endung === 'webp') {
    return inhalt.subarray(0, 4).toString() === 'RIFF' && inhalt.subarray(8, 12).toString() === 'WEBP'
  }
  return false
}
