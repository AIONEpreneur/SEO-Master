import { ressourcenMetadaten, basisUrl } from '@/lib/mcp/oauth'
import { extAntwort, extPreflight } from '@/lib/extension/cors'

export const dynamic = 'force-dynamic'

/**
 * Ressourcen-Discovery (RFC 9728): Welcher Anmeldeserver ist für den
 * MCP-Endpunkt zuständig? Hierhin verweist der WWW-Authenticate-Header,
 * den /api/mcp bei fehlender Anmeldung mitschickt – damit weiss ein
 * MCP-Client, wo er den Anmelde-Fluss beginnen muss.
 */
export function GET(request: Request) {
  return extAntwort(ressourcenMetadaten(basisUrl(request)))
}

export function OPTIONS() {
  return extPreflight()
}
