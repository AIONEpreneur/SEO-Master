import crypto from 'node:crypto'
import { env } from '@/lib/env'

/**
 * OAuth-Anmeldung für die MCP-Anbindung.
 *
 * Der Ablauf, den Claude und ChatGPT von sich aus beherrschen: Der Client
 * findet über die .well-known-Adressen den Anmeldeserver (das ist dieselbe
 * Anwendung), registriert sich selbst, schickt die Person zur Anmeldung und
 * Zustimmung hierher und tauscht den Einmal-Code gegen einen persönlichen
 * Zugangsschlüssel – denselben api_tokens-Eintrag, den auch die Extension
 * nutzt. Es gibt keine Client-Geheimnisse; die Sicherheit liegt in PKCE,
 * der geprüften Rücksprungadresse und der Zustimmung einer angemeldeten
 * Person.
 */

/**
 * Unter welcher Adresse diese Instanz von aussen erreichbar ist.
 *
 * APP_URL hat einen Vorgabewert auf localhost; bliebe es dabei, stünden in
 * den Discovery-Antworten Adressen, die nur auf dem Server selbst
 * funktionieren. Dann entscheidet der tatsächliche Aufruf.
 */
export function basisUrl(request: Request): string {
  const konfiguriert = env().APP_URL
  if (konfiguriert && !/^https?:\/\/localhost(:|$)/.test(konfiguriert)) {
    return konfiguriert.replace(/\/+$/, '')
  }
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!host) return konfiguriert.replace(/\/+$/, '')
  const protokoll = request.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${protokoll}://${host}`
}

/** RFC 8414 – wo Anmeldung, Token-Tausch und Registrierung zu finden sind. */
export function anmeldeserverMetadaten(basis: string) {
  return {
    issuer: basis,
    authorization_endpoint: `${basis}/oauth/authorize`,
    token_endpoint: `${basis}/api/oauth/token`,
    registration_endpoint: `${basis}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['seo-master'],
  }
}

/** RFC 9728 – welche Anmeldeserver für den MCP-Endpunkt zuständig sind. */
export function ressourcenMetadaten(basis: string) {
  return {
    resource: `${basis}/api/mcp`,
    authorization_servers: [basis],
    bearer_methods_supported: ['header'],
    scopes_supported: ['seo-master'],
  }
}

/**
 * PKCE-Nachweis prüfen (nur S256).
 *
 * Der Client hat beim Start den Hash seines Geheimnisses hinterlegt und
 * liefert am Token-Endpunkt das Geheimnis selbst nach. So kann ein
 * abgefangener Einmal-Code allein nicht eingelöst werden.
 */
export function pkceStimmt(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false
  const errechnet = crypto.createHash('sha256').update(verifier).digest('base64url')
  try {
    return crypto.timingSafeEqual(Buffer.from(errechnet), Buffer.from(challenge))
  } catch {
    return false
  }
}

/**
 * Zulässige Rücksprungadresse?
 *
 * Nur volle Übereinstimmung mit einer registrierten Adresse – und
 * registrieren lässt sich nur https (plus localhost für lokale Clients).
 */
export function zulaessigeRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri)
    if (parsed.protocol === 'https:') return true
    return parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

/** Gültigkeit eines Einmal-Codes. */
export const CODE_LEBENSDAUER_MS = 10 * 60 * 1000
