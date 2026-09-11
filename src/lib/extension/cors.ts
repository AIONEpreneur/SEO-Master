/**
 * CORS für die Extension-Endpunkte.
 *
 * Das Popup der Browser-Extension ruft von einer chrome-extension://-Herkunft
 * aus an. Für die im Manifest eingetragene Server-Adresse braucht es kein
 * CORS – wohl aber, sobald die Adresse in den Einstellungen geändert wird
 * (eigene Domain, lokaler Test). Die Endpunkte geben ohne gültigen Token
 * nichts preis, deshalb ist die offene Herkunft hier unbedenklich; auf
 * Cookies stützt sich unter /api/ext ohnehin nichts.
 */
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  // mcp-protocol-version schicken MCP-Clients bei jeder Anfrage mit.
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
}

export function extAntwort(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS })
}

/** Preflight-Antwort; jede /api/ext-Route exportiert sie als OPTIONS. */
export function extPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
