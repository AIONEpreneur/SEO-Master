import { db } from '@/lib/db'
import { open } from '@/lib/crypto/vault'
import { env } from '@/lib/env'
import type { Provider } from '@prisma/client'

export type DataForSeoSecret = { login: string; password: string }
export type ApiKeySecret = { apiKey: string }
type SecretShape = DataForSeoSecret | ApiKeySecret

/**
 * Zugangsdaten für einen Anbieter auflösen.
 *
 * Vorrang hat der Tresor der Organisation. Erst wenn dort nichts hinterlegt
 * ist, greifen die Server-Umgebungsvariablen. Damit funktioniert der interne
 * Einzelbetrieb ohne Einrichtung, während zahlende Kundinnen später ihre
 * eigenen Schlüssel mitbringen und getrennt abgerechnet werden können.
 */
export async function resolveSecret<T extends SecretShape>(
  organizationId: string,
  provider: Provider,
): Promise<T | null> {
  const credential = await db.credential.findFirst({
    where: { organizationId, provider, isActive: true },
    orderBy: { updatedAt: 'desc' },
  })

  if (credential) {
    return open<T>({
      ciphertext: credential.ciphertext,
      iv: credential.iv,
      authTag: credential.authTag,
    })
  }

  return fallbackFromEnv<T>(provider)
}

function fallbackFromEnv<T extends SecretShape>(provider: Provider): T | null {
  const e = env()
  switch (provider) {
    case 'DATAFORSEO':
      return e.DATAFORSEO_LOGIN && e.DATAFORSEO_PASSWORD
        ? ({ login: e.DATAFORSEO_LOGIN, password: e.DATAFORSEO_PASSWORD } as T)
        : null
    case 'FIRECRAWL':
      return e.FIRECRAWL_API_KEY ? ({ apiKey: e.FIRECRAWL_API_KEY } as T) : null
    case 'APIFY':
      return e.APIFY_TOKEN ? ({ apiKey: e.APIFY_TOKEN } as T) : null
    case 'ANTHROPIC':
      return e.ANTHROPIC_API_KEY ? ({ apiKey: e.ANTHROPIC_API_KEY } as T) : null
    case 'PAGESPEED':
      return e.PAGESPEED_API_KEY ? ({ apiKey: e.PAGESPEED_API_KEY } as T) : null
    default:
      return null
  }
}

/**
 * Die Anbieter, die die Anwendung tatsächlich benutzt.
 *
 * Bewusst nicht der vollständige Provider-Enum: SEARCH_CONSOLE steht dort noch
 * drin, weil bestehende Datenbankzeilen den Wert kennen, wird aber nirgends
 * mehr abgefragt. Stand er hier mit, meldete die Übersicht dauerhaft einen
 * fehlenden Anbieter, den man gar nicht mehr einrichten kann.
 */
export const VERWENDETE_ANBIETER = [
  'DATAFORSEO',
  'FIRECRAWL',
  'APIFY',
  'ANTHROPIC',
  'PAGESPEED',
] as const satisfies readonly Provider[]

export type VerwendeterAnbieter = (typeof VERWENDETE_ANBIETER)[number]

/** Welche Anbieter sind für diese Organisation einsatzbereit? */
export async function availableProviders(
  organizationId: string,
): Promise<Record<VerwendeterAnbieter, boolean>> {
  const entries = await Promise.all(
    VERWENDETE_ANBIETER.map(async (p) => [p, (await resolveSecret(organizationId, p)) !== null] as const),
  )
  return Object.fromEntries(entries) as Record<VerwendeterAnbieter, boolean>
}
