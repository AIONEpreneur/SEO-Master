import { ConnectorError, erklaereFehler, sleep } from './http'

/**
 * OpenSEO – zweiter Datenanbieter neben DataForSEO, betrieben als eigener
 * Docker-Dienst neben dieser Anwendung (siehe docs/OPENSEO-INTEGRATION.md).
 *
 * OpenSEO hat keine allgemeine REST-API. Die einzige Schnittstelle nach
 * aussen ist der MCP-Server über HTTP (JSON-RPC: `initialize` →
 * `notifications/initialized` → `tools/call`). Dieser Client spricht das
 * Protokoll direkt, ohne zusätzliche Abhängigkeit – Antworten kommen je nach
 * Serverfassung als JSON oder als SSE-Strom, beides wird gelesen.
 *
 * Wichtig fürs Guthaben: Wiederholt wird nur bei Transportfehlern (Netz,
 * 429, 5xx). Ein Fehler, den das Werkzeug selbst meldet, wird sofort
 * weitergereicht – erneutes Senden würde denselben Datenkauf noch einmal
 * anstossen.
 */

const PROVIDER = 'OpenSEO'
const PROTOCOL_VERSION = '2025-06-18'

/** Antwort von `get_domain_overview` (structuredContent des Werkzeugs). */
export type OpenSeoDomainOverview = {
  domain?: string
  scope?: string
  displayTarget?: string
  organicTraffic?: number | null
  organicKeywords?: number | null
  backlinks?: number | null
  referringDomains?: number | null
}

type JsonRpcResponse = {
  jsonrpc: '2.0'
  id?: number | string | null
  result?: Record<string, unknown>
  error?: { code: number; message: string; data?: unknown }
}

type ToolCallResult = {
  isError?: boolean
  content?: Array<{ type: string; text?: string }>
  structuredContent?: Record<string, unknown>
}

export class OpenSeoClient {
  private mcpUrl: string
  private apiKey: string | null
  private sessionId: string | null = null
  private initialisiert: Promise<void> | null = null
  private nextId = 1
  /** projectId je Domain, damit ein Lauf nicht mehrfach nachschlägt. */
  private projekte = new Map<string, string>()

  constructor(options: { mcpUrl: string; apiKey?: string | null }) {
    this.mcpUrl = options.mcpUrl
    // local_noauth braucht keinen Schlüssel; im hosted-Modus kommt hier der
    // oseo_-Schlüssel an und wird als Bearer-Token mitgesendet.
    this.apiKey = options.apiKey ?? null
  }

  /**
   * Erreichbarkeit und Konfiguration des Dienstes prüfen, ohne Guthaben zu
   * verbrauchen. Der Health-Check meldet im Selbstbetrieb auch, ob der
   * DataForSEO-Schlüssel im Container hinterlegt ist.
   */
  async verify(): Promise<{ ok: true; status?: string }> {
    const healthUrl = new URL('/api/health', this.mcpUrl).toString()
    const response = await fetch(healthUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      throw new ConnectorError(
        PROVIDER,
        erklaereFehler(PROVIDER, response.status) ?? `HTTP ${response.status}`,
        response.status,
      )
    }
    const body = (await response.json().catch(() => null)) as { status?: string } | null
    return { ok: true, status: body?.status }
  }

  /**
   * Domain-Übersicht: organischer Traffic, Keyword-Anzahl, Backlinks,
   * verweisende Domains. Kostet OpenSEO-Credits (~100–300), wird von OpenSEO
   * 12 Stunden je Domain zwischengespeichert und landet im Forschungs-Log
   * des Projekts.
   */
  async domainOverview(params: {
    domain: string
    locationCode: number
    languageCode: string
  }): Promise<OpenSeoDomainOverview | null> {
    const projectId = await this.ensureProject(params.domain, params.locationCode, params.languageCode)
    const result = await this.callTool('get_domain_overview', {
      projectId,
      domain: params.domain,
      locationCode: params.locationCode,
      languageCode: params.languageCode,
    })
    return (result.structuredContent as OpenSeoDomainOverview | undefined) ?? null
  }

  /**
   * Jedes OpenSEO-Werkzeug verlangt eine `projectId`. Sie wird hier
   * aufgelöst: vorhandenes Projekt zur Domain suchen, sonst eines anlegen.
   * Beide Aufrufe sind laut Werkzeugbeschreibung kostenlos.
   *
   * Dass alle Abrufe derselben Domain im selben Projekt landen, ist kein
   * Selbstzweck: nur so greift das Forschungs-Log, das Wiederholabrufe
   * innerhalb von 30 Tagen aus dem Speicher bedient statt neu zu kaufen.
   */
  private async ensureProject(
    domain: string,
    locationCode: number,
    languageCode: string,
  ): Promise<string> {
    const schluessel = domain.toLowerCase().replace(/^www\./, '')
    const bekannt = this.projekte.get(schluessel)
    if (bekannt) return bekannt

    const liste = await this.callTool('list_projects', {})
    const projects =
      (liste.structuredContent?.projects as Array<{ id?: string; domain?: string | null }> | undefined) ?? []
    const vorhanden = projects.find(
      (p) => (p.domain ?? '').toLowerCase().replace(/^www\./, '') === schluessel,
    )
    if (vorhanden?.id) {
      this.projekte.set(schluessel, vorhanden.id)
      return vorhanden.id
    }

    const angelegt = await this.callTool('create_project', {
      name: schluessel,
      domain: schluessel,
      locationCode,
      languageCode,
    })
    const id = (angelegt.structuredContent?.project as { id?: string } | undefined)?.id
    if (!id) throw new ConnectorError(PROVIDER, 'Projekt angelegt, aber keine ID erhalten')
    this.projekte.set(schluessel, id)
    return id
  }

  // --- MCP-Protokoll ---------------------------------------------------------

  private async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    await this.initialize()

    let antwort: JsonRpcResponse | null
    try {
      antwort = await this.rpc(
        { method: 'tools/call', params: { name, arguments: args } },
        // Datenaufrufe reichen an DataForSEO durch und dürfen dauern.
        { timeoutMs: 120_000 },
      )
    } catch (error) {
      // Eine verlorene Sitzung (Neustart des Containers) ist kein Ausfall:
      // einmal neu anmelden und denselben Aufruf wiederholen.
      if (error instanceof ConnectorError && (error.status === 404 || error.status === 400)) {
        this.sessionId = null
        this.initialisiert = null
        await this.initialize()
        antwort = await this.rpc({ method: 'tools/call', params: { name, arguments: args } }, { timeoutMs: 120_000 })
      } else {
        throw error
      }
    }

    if (!antwort) throw new ConnectorError(PROVIDER, `Keine Antwort auf ${name}`)
    if (antwort.error) {
      throw new ConnectorError(PROVIDER, `${name}: ${antwort.error.message}`, undefined, antwort.error)
    }

    const result = antwort.result as ToolCallResult | undefined
    if (!result) throw new ConnectorError(PROVIDER, `Leere Antwort auf ${name}`)
    if (result.isError) {
      const text = result.content?.find((c) => c.type === 'text')?.text ?? 'Werkzeug meldet einen Fehler'
      throw new ConnectorError(PROVIDER, `${name}: ${text.slice(0, 300)}`)
    }
    return result
  }

  private initialize(): Promise<void> {
    // Als geteiltes Promise, damit parallele Collector nicht mehrere
    // Sitzungen gleichzeitig eröffnen.
    this.initialisiert ??= (async () => {
      const antwort = await this.rpc({
        method: 'initialize',
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'seo-master-worker', version: '1.0.0' },
        },
      })
      if (!antwort || antwort.error) {
        throw new ConnectorError(
          PROVIDER,
          `MCP-Anmeldung fehlgeschlagen: ${antwort?.error?.message ?? 'keine Antwort'}`,
        )
      }
      await this.rpc({ method: 'notifications/initialized' }, { notification: true })
    })()
    return this.initialisiert
  }

  /**
   * Ein JSON-RPC-Aufruf über Streamable HTTP.
   *
   * Zeitlimit und Wiederholung entsprechen dem gemeinsamen `request` der
   * anderen Anbieter; der Weg ist nur deshalb eigen, weil hier die
   * Antwort-Header (Sitzungs-ID) und SSE-Rümpfe gebraucht werden.
   */
  private async rpc(
    payload: { method: string; params?: Record<string, unknown> },
    options?: { timeoutMs?: number; notification?: boolean },
  ): Promise<JsonRpcResponse | null> {
    const { timeoutMs = 60_000, notification = false } = options ?? {}
    const id = notification ? undefined : this.nextId++
    const body = JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id }), ...payload })

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': PROTOCOL_VERSION,
    }
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId

    const retries = 2
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(this.mcpUrl, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        })

        const session = response.headers.get('mcp-session-id')
        if (session) this.sessionId = session

        if (!response.ok) {
          const text = await response.text().catch(() => '')
          const retryable = response.status === 429 || response.status >= 500
          if (retryable && attempt < retries) {
            lastError = new ConnectorError(PROVIDER, `HTTP ${response.status}`, response.status, text)
            await sleep(2 ** attempt * 1000)
            continue
          }
          throw new ConnectorError(
            PROVIDER,
            erklaereFehler(PROVIDER, response.status) ?? `HTTP ${response.status}: ${text.slice(0, 200)}`,
            response.status,
            text.slice(0, 500),
          )
        }

        // 202 bestätigt eine Notification ohne Rumpf.
        if (response.status === 202 || response.status === 204) return null

        const contentType = response.headers.get('content-type') ?? ''
        const text = await response.text()
        if (contentType.includes('text/event-stream')) {
          return findeAntwort(parseSse(text), id)
        }
        const parsed = JSON.parse(text) as JsonRpcResponse | JsonRpcResponse[]
        return findeAntwort(Array.isArray(parsed) ? parsed : [parsed], id)
      } catch (error) {
        if (error instanceof ConnectorError && error.status && error.status < 500 && error.status !== 429) {
          throw error
        }
        lastError = error
        if (attempt < retries) {
          await sleep(2 ** attempt * 1000)
          continue
        }
      } finally {
        clearTimeout(timer)
      }
    }

    throw lastError instanceof Error ? lastError : new ConnectorError(PROVIDER, 'Unbekannter Netzwerkfehler')
  }
}

/** SSE-Rumpf in JSON-RPC-Nachrichten zerlegen (nur `data:`-Zeilen zählen). */
function parseSse(text: string): JsonRpcResponse[] {
  const nachrichten: JsonRpcResponse[] = []
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((zeile) => zeile.startsWith('data:'))
      .map((zeile) => zeile.slice(5).trim())
      .join('\n')
    if (!data) continue
    try {
      nachrichten.push(JSON.parse(data) as JsonRpcResponse)
    } catch {
      // Keep-alive- und Kommentarzeilen sind kein JSON und keine Antwort.
    }
  }
  return nachrichten
}

/**
 * Die Antwort auf die eigene Anfrage heraussuchen. Der Strom darf daneben
 * Server-Notifications (Fortschritt, Logging) enthalten – die tragen keine
 * oder eine fremde ID und werden übergangen.
 */
function findeAntwort(nachrichten: JsonRpcResponse[], id: number | undefined): JsonRpcResponse | null {
  if (id === undefined) return null
  return nachrichten.find((n) => n.id === id && (n.result !== undefined || n.error !== undefined)) ?? null
}
