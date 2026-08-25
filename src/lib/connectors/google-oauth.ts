import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { request, ConnectorError } from './http'
import { env } from '@/lib/env'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

/**
 * Nur lesend, nur Search Console.
 *
 * Google zeigt der Nutzerin im Zustimmungsfenster genau diesen Umfang. Je
 * enger er ist, desto eher stimmt jemand zu – und desto weniger Schaden
 * könnte ein gestohlenes Token anrichten.
 */
export const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

/** Zugangsdaten, die nach erfolgreicher Anmeldung im Tresor landen. */
export type OAuthSecret = {
  /** Der eigentliche Dauerzugang. Access-Token werden daraus abgeleitet. */
  refresh_token: string
  /** Das Google-Konto, das zugestimmt hat – zur Anzeige im Tresor. */
  account?: string
}

/** Ist der Anmelde-Knopf auf dieser Installation überhaupt eingerichtet? */
export function oauthKonfiguriert(): boolean {
  const e = env()
  return Boolean(e.GOOGLE_OAUTH_CLIENT_ID && e.GOOGLE_OAUTH_CLIENT_SECRET)
}

export function redirectUri(): string {
  return `${env().APP_URL.replace(/\/$/, '')}/api/google/callback`
}

/**
 * Zustandswert für den Umweg über Google.
 *
 * Google schickt die Nutzerin zu sich und danach zurück. Ohne Absicherung
 * könnte jemand einen manipulierten Rückweg auslösen und fremde Zugangsdaten
 * in einen anderen Arbeitsbereich schreiben lassen. Deshalb wird der Zustand
 * signiert: Er trägt die Organisation, eine Zufallszahl und ein Ablaufdatum,
 * und ohne den Signierschlüssel der Installation lässt er sich nicht fälschen.
 */
export function signiereZustand(organizationId: string): string {
  const inhalt = JSON.stringify({
    o: organizationId,
    n: randomBytes(9).toString('base64url'),
    e: Date.now() + 10 * 60 * 1000,
  })
  const daten = Buffer.from(inhalt, 'utf8').toString('base64url')
  return `${daten}.${signatur(daten)}`
}

export function pruefeZustand(zustand: string): { organizationId: string } | null {
  const [daten, mitgegeben] = zustand.split('.')
  if (!daten || !mitgegeben) return null

  // Zeitkonstanter Vergleich: Ein zeichenweiser Abbruch verriete über die
  // Antwortzeit, wie viele Zeichen bereits stimmen.
  const erwartet = signatur(daten)
  const a = Buffer.from(mitgegeben)
  const b = Buffer.from(erwartet)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const inhalt = JSON.parse(Buffer.from(daten, 'base64url').toString('utf8'))
    if (typeof inhalt.o !== 'string' || typeof inhalt.e !== 'number') return null
    if (inhalt.e < Date.now()) return null
    return { organizationId: inhalt.o }
  } catch {
    return null
  }
}

function signatur(daten: string): string {
  return createHmac('sha256', env().SESSION_SECRET).update(daten).digest('base64url')
}

/**
 * Adresse des Zustimmungsfensters.
 *
 * `access_type=offline` und `prompt=consent` sind beide nötig, damit Google
 * ein Refresh-Token herausgibt. Ohne sie kommt nur ein Zugriffstoken, das nach
 * einer Stunde verfällt – die Verbindung wäre am nächsten Tag tot, ohne dass
 * jemand versteht, warum.
 */
export function anmeldeAdresse(organizationId: string): string {
  const e = env()
  const url = new URL(AUTH_URL)
  url.searchParams.set('client_id', e.GOOGLE_OAUTH_CLIENT_ID ?? '')
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', signiereZustand(organizationId))
  return url.toString()
}

/** Den Einmalcode aus dem Rückweg gegen einen Dauerzugang tauschen. */
export async function tauscheCode(code: string): Promise<OAuthSecret> {
  const e = env()
  const antwort = await request<{
    refresh_token?: string
    access_token?: string
    id_token?: string
    error_description?: string
  }>(TOKEN_URL, {
    method: 'POST',
    provider: 'Google',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody: new URLSearchParams({
      code,
      client_id: e.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: e.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }).toString(),
    timeoutMs: 30_000,
    retries: 0,
  })

  if (!antwort.refresh_token) {
    throw new ConnectorError(
      'Google',
      antwort.error_description ??
        'Google hat keinen Dauerzugang herausgegeben. Das passiert, wenn dieses Konto bereits verbunden war – in den Google-Kontoeinstellungen unter "Drittanbieter-Apps" den Zugriff entfernen und erneut verbinden.',
      400,
    )
  }

  return { refresh_token: antwort.refresh_token, account: kontoAus(antwort.id_token) }
}

/** Ein frisches Zugriffstoken aus dem Dauerzugang. */
export async function frischesToken(refreshToken: string): Promise<{ token: string; gueltigBis: number }> {
  const e = env()
  const antwort = await request<{ access_token?: string; expires_in?: number; error_description?: string }>(
    TOKEN_URL,
    {
      method: 'POST',
      provider: 'Google',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      rawBody: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: e.GOOGLE_OAUTH_CLIENT_ID ?? '',
        client_secret: e.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
        grant_type: 'refresh_token',
      }).toString(),
      timeoutMs: 30_000,
      retries: 1,
    },
  )

  if (!antwort.access_token) {
    throw new ConnectorError(
      'Google',
      antwort.error_description ??
        'Die Google-Verbindung ist nicht mehr gültig. Vermutlich wurde der Zugriff im Google-Konto entzogen – im Datentresor erneut verbinden.',
      401,
    )
  }

  return {
    token: antwort.access_token,
    gueltigBis: Math.floor(Date.now() / 1000) + (antwort.expires_in ?? 3600),
  }
}

/**
 * Den Zugriff bei Google zurückgeben.
 *
 * Beim Löschen im Tresor verschwindet sonst nur die eigene Kopie, während die
 * Freigabe im Google-Konto der Nutzerin bestehen bleibt. Das wäre gegenüber
 * jemandem, der bewusst trennt, unaufrichtig.
 */
export async function widerrufe(refreshToken: string): Promise<void> {
  await request<unknown>(REVOKE_URL, {
    method: 'POST',
    provider: 'Google',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody: new URLSearchParams({ token: refreshToken }).toString(),
    timeoutMs: 20_000,
    retries: 0,
  })
}

/**
 * Die E-Mail-Adresse aus dem id_token lesen – nur zur Anzeige.
 *
 * Die Signatur wird bewusst nicht geprüft: Das Token kommt hier direkt aus
 * Googles Token-Endpunkt über eine TLS-Verbindung, es wurde nicht über den
 * Browser gereicht. Verwendet wird es ausschliesslich als Beschriftung im
 * Tresor, nie für eine Berechtigung.
 */
function kontoAus(idToken: string | undefined): string | undefined {
  if (!idToken) return undefined
  try {
    const teil = idToken.split('.')[1]
    if (!teil) return undefined
    const inhalt = JSON.parse(Buffer.from(teil, 'base64url').toString('utf8'))
    return typeof inhalt.email === 'string' ? inhalt.email : undefined
  } catch {
    return undefined
  }
}
