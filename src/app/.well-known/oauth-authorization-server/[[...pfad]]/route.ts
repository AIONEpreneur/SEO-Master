import { anmeldeserverMetadaten, basisUrl } from '@/lib/mcp/oauth'
import { extAntwort, extPreflight } from '@/lib/extension/cors'

export const dynamic = 'force-dynamic'

/**
 * OAuth-Discovery (RFC 8414): Wo sind Anmeldung, Token-Tausch und
 * Registrierung? MCP-Clients fragen die Adresse auch mit angehängtem Pfad
 * ab (/.well-known/oauth-authorization-server/api/mcp) – deshalb der
 * optionale Sammelpfad; die Antwort ist dieselbe.
 */
export function GET(request: Request) {
  return extAntwort(anmeldeserverMetadaten(basisUrl(request)))
}

export function OPTIONS() {
  return extPreflight()
}
