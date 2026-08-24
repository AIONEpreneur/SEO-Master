import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>

// scrypt aus der Node-Standardbibliothek – kein nativer Build nötig, was das
// Docker-Image schlank und den Betrieb auf dem VPS unkompliziert hält.
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEYLEN = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16)
  const derived = await scrypt(password, salt, KEYLEN, PARAMS)
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${derived.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt') return false
  const derived = await scrypt(password, Buffer.from(salt, 'base64'), KEYLEN, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  })
  const expected = Buffer.from(hash, 'base64')
  if (expected.length !== derived.length) return false
  return crypto.timingSafeEqual(expected, derived)
}
