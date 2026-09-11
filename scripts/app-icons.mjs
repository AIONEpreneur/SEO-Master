/**
 * Die Symbole der Anwendung erzeugen — Browser-Tab, Lesezeichen, Startbildschirm.
 *
 *   node scripts/app-icons.mjs        (oder: npm run icons)
 *
 * Dasselbe Zeichen wie die Erweiterung SEO4U: ein Funke auf lila Fläche mit
 * Tinten-Kontur. Das Gegenstück liegt im Repo seo-for-you unter
 * scripts/icons.mjs — wer die Form hier ändert, muss sie dort mitändern,
 * sonst zerfällt ein Produkt in zwei.
 *
 * Erzeugt werden drei Dateien in src/app/, wo Next sie von selbst findet:
 *
 *   favicon.ico     16, 32 und 48 Pixel in einer Datei — der Tab
 *   icon.svg        beliebig scharf, wird von neueren Browsern bevorzugt
 *   apple-icon.png  180 Pixel für den Startbildschirm auf iOS
 *
 * Der Tab zeigt das Symbol bei 16 Pixeln. Deshalb tragen favicon und
 * icon.svg die gedrungene Fassung des Funkens ohne eigene Kontur: Bei dieser
 * Grösse ist jede Linie unter einem Pixel weg, und aus Kontur plus Schatten
 * wird ein grauer Klecks statt eines Zeichens. Nur apple-icon.png hat Platz
 * für die volle Fassung mit Schatten und zweitem Funken.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const hier = dirname(fileURLToPath(import.meta.url))
const ziel = join(hier, '..', 'src', 'app')

/** Die Farben aus globals.css, unverändert. */
const LILA = '#AC8EF0'
const TINTE = '#161616'
const CREME = '#FFFDF8'
const LIMETTE = '#C9E265'

/**
 * Vier Spitzen aus einem Kasten von 44 × 44.
 *
 * `taille` ist der Abstand der Einbuchtungen von der Mitte: je grösser, desto
 * breiter die Arme. 5 ist der schlanke Funke der Oberfläche, 6 die Fassung
 * fürs Tab-Symbol — breit genug, dass die Arme bei 16 Pixeln stehen bleiben,
 * schlank genug, dass kein Karo daraus wird.
 */
function funkenPfad(taille) {
  const m = 22
  const a = m - taille
  const b = m + taille
  return `M${m} 0 L${b} ${a} L44 ${m} L${b} ${b} L${m} 44 L${a} ${b} L0 ${m} L${a} ${a} Z`
}

function funke({ x, y, faktor, taille, fuellung, kontur }) {
  const linie = kontur ? ` stroke="${TINTE}" stroke-width="${kontur}" stroke-linejoin="round"` : ''
  return `<g transform="translate(${x} ${y}) scale(${faktor}) translate(-22 -22)">
    <path d="${funkenPfad(taille)}" fill="${fuellung}"${linie}/>
  </g>`
}

/** Die volle Fassung: Schatten, Kontur, schlanker Funke, Akzent. */
function zeichenGross() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="14" y="20" width="104" height="104" rx="30" fill="${TINTE}"/>
  <rect x="8" y="8" width="104" height="104" rx="30" fill="${LILA}" stroke="${TINTE}" stroke-width="7"/>
  ${funke({ x: 60, y: 60, faktor: 1.3, taille: 5, fuellung: CREME, kontur: 3.2 })}
  ${funke({ x: 92, y: 30, faktor: 0.42, taille: 6, fuellung: LIMETTE, kontur: 6 })}
</svg>`
}

/** Die Fassung fürs Tab: nur Fläche, Kontur und ein kräftiger Funke. */
function zeichenKlein() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="5" y="5" width="118" height="118" rx="32" fill="${LILA}" stroke="${TINTE}" stroke-width="10"/>
  ${funke({ x: 64, y: 64, faktor: 2.2, taille: 6, fuellung: CREME, kontur: 0 })}
</svg>`
}

/**
 * Mehrere PNG in eine ICO-Datei packen.
 *
 * sharp kann kein ICO schreiben, aber das Format ist ein blosser Behälter:
 * ein Kopf, je Bild ein Verzeichniseintrag, dann die Bilddaten hintereinander.
 * Seit Vista dürfen darin PNG statt der alten Bitmaps stehen — das spart die
 * halbe Implementierung und jeden heutigen Browser stört es nicht.
 *
 * Warum überhaupt noch ICO, wo icon.svg daneben liegt: Suchmaschinen und
 * ältere Browser fragen stur /favicon.ico ab. Fehlt die Datei, steht in der
 * Trefferliste ein leeres Blatt statt des Zeichens.
 */
function packeIco(bilder) {
  const KOPF = 6
  const EINTRAG = 16
  const kopf = Buffer.alloc(KOPF)
  kopf.writeUInt16LE(0, 0) // reserviert
  kopf.writeUInt16LE(1, 2) // 1 = Symbol (2 wäre ein Mauszeiger)
  kopf.writeUInt16LE(bilder.length, 4)

  const eintraege = []
  let versatz = KOPF + EINTRAG * bilder.length

  for (const { groesse, daten } of bilder) {
    const e = Buffer.alloc(EINTRAG)
    // 0 bedeutet 256 — mehr passt in ein Byte nicht.
    e.writeUInt8(groesse >= 256 ? 0 : groesse, 0)
    e.writeUInt8(groesse >= 256 ? 0 : groesse, 1)
    e.writeUInt8(0, 2) // keine Farbtabelle
    e.writeUInt8(0, 3) // reserviert
    e.writeUInt16LE(1, 4) // Ebenen
    e.writeUInt16LE(32, 6) // Bit je Bildpunkt
    e.writeUInt32LE(daten.length, 8)
    e.writeUInt32LE(versatz, 12)
    eintraege.push(e)
    versatz += daten.length
  }

  return Buffer.concat([kopf, ...eintraege, ...bilder.map((b) => b.daten)])
}

mkdirSync(ziel, { recursive: true })

// --- Der Tab -----------------------------------------------------------------
const klein = Buffer.from(zeichenKlein())
const imIco = []
for (const groesse of [16, 32, 48]) {
  imIco.push({ groesse, daten: await sharp(klein).resize(groesse, groesse).png().toBuffer() })
}
writeFileSync(join(ziel, 'favicon.ico'), packeIco(imIco))
console.log('src/app/favicon.ico — 16, 32, 48')

writeFileSync(join(ziel, 'icon.svg'), zeichenKlein() + '\n')
console.log('src/app/icon.svg — beliebige Grösse')

// --- Der Startbildschirm -----------------------------------------------------
await sharp(Buffer.from(zeichenGross()))
  .resize(180, 180)
  // iOS legt das Symbol auf einen eigenen Grund und kennt keine Transparenz:
  // Ohne Hintergrund stünde der Schatten auf Schwarz.
  .flatten({ background: CREME })
  .png()
  .toFile(join(ziel, 'apple-icon.png'))
console.log('src/app/apple-icon.png — 180×180')
