import crypto from 'node:crypto'
import { env } from '@/lib/env'

/**
 * Datentresor für API-Zugangsdaten.
 *
 * Secrets liegen ausschliesslich als AES-256-GCM-Chiffrat in der Datenbank.
 * Der Schlüssel kommt aus ENCRYPTION_KEY und liegt nie in der Datenbank – wer
 * einen Datenbank-Dump erbeutet, hält damit noch keine fremden API-Schlüssel.
 */

const ALGORITHM = 'aes-256-gcm'

function key(): Buffer {
  const raw = env().ENCRYPTION_KEY
  // Hex (64 Zeichen) oder Base64 zulassen, damit `openssl rand` in beiden
  // gängigen Ausgabeformaten direkt funktioniert.
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY muss 32 Byte ergeben (openssl rand -base64 32)')
  }
  return buf
}

export type SealedSecret = { ciphertext: string; iv: string; authTag: string }

export function seal(plain: unknown): SealedSecret {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv)
  const data = Buffer.concat([
    cipher.update(JSON.stringify(plain), 'utf8'),
    cipher.final(),
  ])
  return {
    ciphertext: data.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  }
}

export function open<T = unknown>(sealed: SealedSecret): T {
  const decipher = crypto.createDecipheriv(ALGORITHM, key(), Buffer.from(sealed.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(sealed.authTag, 'base64'))
  const plain = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
    decipher.final(),
  ])
  return JSON.parse(plain.toString('utf8')) as T
}

/**
 * Kurzer Hinweis für die Oberfläche: zeigt genug, um einen Schlüssel
 * wiederzuerkennen, aber zu wenig, um ihn zu verwenden.
 */
export function hintOf(secret: string): string {
  if (secret.length <= 8) return '••••'
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}
