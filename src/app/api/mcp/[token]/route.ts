import { resolveApiToken, resolveApiTokenWert } from '@/lib/auth/api-token'
import { beantworteMcp } from '@/lib/mcp/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * MCP-Endpunkt (Streamable HTTP, zustandslos).
 *
 * Verbunden wird mit der Adresse `https://…/api/mcp/<zugangsschlüssel>` –
 * der Schlüssel steht in der Adresse, weil die Verbindungs-Dialoge von
 * Claude und ChatGPT nur eine Adresse entgegennehmen, keine eigenen Header.
 * Ein mitgeschickter Authorization-Header gilt trotzdem zuerst.
 *
 * Jede Anfrage wird mit einer einzelnen JSON-Antwort beantwortet; einen
 * Ereignisstrom (GET/SSE) gibt es bewusst nicht – dafür antwortet der
 * Endpunkt mit 405, was das Protokoll ausdrücklich vorsieht.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // Erst der Header, dann der Schlüssel aus der Adresse. Der zweite Versuch
  // lohnt nur, wenn der erste am fehlenden Schlüssel scheiterte — steht das
  // Abo im Weg, steht es auf beiden Wegen im Weg.
  const ausHeader = await resolveApiToken(request)
  const zugang = ausHeader.ok || ausHeader.grund === 'kein-zugang'
    ? ausHeader
    : await resolveApiTokenWert(decodeURIComponent(token))

  if (!zugang.ok) {
    return Response.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32001,
          message:
            zugang.grund === 'kein-zugang'
              ? zugang.hinweis
              : 'Der Zugangsschlüssel in der Adresse ist unbekannt oder widerrufen. In SEO-Master unter Einstellungen → Extension einen neuen erzeugen.',
        },
      },
      // 402 statt 401: Der Schlüssel stimmt, es fehlt das Abo.
      { status: zugang.grund === 'kein-zugang' ? 402 : 401 },
    )
  }
  const kontext = zugang.kontext

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Der Anfragetext ist kein gültiges JSON.' } },
      { status: 400 },
    )
  }

  // Ältere Clients bündeln mehrere Anfragen als Liste.
  if (Array.isArray(body)) {
    const antworten = (await Promise.all(body.map((a) => beantworteMcp(kontext, a ?? {})))).filter(
      (a): a is Record<string, unknown> => a !== null,
    )
    if (antworten.length === 0) return new Response(null, { status: 202 })
    return Response.json(antworten)
  }

  const antwort = await beantworteMcp(kontext, (body ?? {}) as Record<string, unknown>)
  // Eine Notification erwartet keine Antwort – nur die Bestätigung.
  if (antwort === null) return new Response(null, { status: 202 })
  return Response.json(antwort)
}

export function GET() {
  // Kein Ereignisstrom: Der Server arbeitet zustandslos, jede Antwort kommt
  // direkt auf die POST-Anfrage.
  return new Response(null, { status: 405, headers: { allow: 'POST' } })
}

export function DELETE() {
  // Keine Sitzungen – es gibt nichts zu beenden.
  return new Response(null, { status: 405, headers: { allow: 'POST' } })
}
