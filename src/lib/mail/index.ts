import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '@/lib/env'

/**
 * Mail-Versand über das eigene Postfach.
 *
 * Zwei Entscheidungen, die hier festliegen:
 *
 * Erstens meldet der Versand sich ab, statt zu werfen, wenn kein Postfach
 * konfiguriert ist. Eine Anwendung, die beim Anlegen eines Kontos abstürzt,
 * weil ein Begrüssungsschreiben nicht rausging, ist schlechter als eine, die
 * das Konto anlegt und den Versand protokolliert.
 *
 * Zweitens sind die Nachrichten reiner Text mit einer schlichten
 * HTML-Fassung. Wer eine Mail zum Zurücksetzen eines Passworts bekommt, will
 * einen Link sehen und keine Bildergalerie — und schlichte Mails landen
 * seltener im Werbeordner.
 */

export type Versandergebnis = { ok: true } | { ok: false; grund: string }

/** Ist ein Postfach hinterlegt? */
export function versandBereit(): boolean {
  const e = env()
  return Boolean(e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASSWORD)
}

let transport: Transporter | null = null

function hole(): Transporter | null {
  if (!versandBereit()) return null
  if (transport) return transport
  const e = env()
  transport = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    // 465 spricht TLS von der ersten Sekunde an, 587 handelt es nach. Die
    // Unterscheidung am Port ist die Regel, die bei allen gängigen Anbietern
    // zutrifft — auch bei Hostinger.
    secure: e.SMTP_PORT === 465,
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASSWORD },
  })
  return transport
}

export async function sendeMail(nachricht: {
  an: string
  betreff: string
  text: string
}): Promise<Versandergebnis> {
  const versand = hole()
  if (!versand) {
    return { ok: false, grund: 'Kein Postfach hinterlegt (SMTP_HOST, SMTP_USER, SMTP_PASSWORD).' }
  }

  const e = env()
  try {
    await versand.sendMail({
      from: e.SMTP_FROM || e.SMTP_USER,
      to: nachricht.an,
      subject: nachricht.betreff,
      text: nachricht.text,
      html: alsHtml(nachricht.text),
    })
    return { ok: true }
  } catch (fehler) {
    return { ok: false, grund: fehler instanceof Error ? fehler.message : 'Unbekannter Fehler' }
  }
}

/**
 * Reintext in eine schlichte HTML-Fassung überführen.
 *
 * Absätze werden zu <p>, Adressen zu Verweisen — mehr nicht. Das reicht für
 * Mail-Programme, die kein Nur-Text anzeigen, und hält die Nachricht klein.
 */
function alsHtml(text: string): string {
  const abschnitte = text
    .split(/\n{2,}/)
    .map((absatz) => {
      const sicher = absatz
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
        .replace(/\n/g, '<br>')
      return `<p style="margin:0 0 16px">${sicher}</p>`
    })
    .join('')

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#161616;max-width:560px">${abschnitte}</div>`
}
