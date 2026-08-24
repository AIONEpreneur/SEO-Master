export class ConnectorError extends Error {
  constructor(
    public provider: string,
    message: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(`[${provider}] ${message}`)
    this.name = 'ConnectorError'
  }
}

/**
 * Verständliche Meldung für einen Anbieterfehler.
 *
 * Die Antworten der Anbieter sind für Programme gedacht, nicht für Menschen.
 * Roh in den Bericht übernommen, steht dort abgeschnittenes JSON statt eines
 * Hinweises, was zu tun ist.
 */
export function erklaereFehler(provider: string, status: number | undefined): string | null {
  switch (status) {
    case 401:
    case 403:
      return `${provider} hat die Zugangsdaten abgelehnt. Im Datentresor prüfen und auf „Prüfen" klicken.`
    case 402:
      return `Das Guthaben bei ${provider} ist aufgebraucht.`
    case 404:
      return `${provider} kennt diese Abfrage nicht – möglicherweise ist der Endpunkt im gebuchten Tarif nicht enthalten.`
    case 429:
      return `${provider} hat zu viele Anfragen erhalten. Später erneut versuchen.`
    default:
      if (status && status >= 500) return `${provider} ist derzeit nicht erreichbar.`
      return null
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: unknown
  /**
   * Rumpf, der unverändert gesendet wird.
   *
   * Für Endpunkte, die kein JSON annehmen – Googles Token-Endpunkt etwa
   * verlangt formkodierte Felder. Hat Vorrang vor `body`; der Inhaltstyp muss
   * dann über `headers` mitgegeben werden.
   */
  rawBody?: string
  timeoutMs?: number
  retries?: number
  provider: string
}

/**
 * HTTP-Aufruf mit Zeitlimit und Wiederholung.
 *
 * Wiederholt wird nur bei Fehlern, die vorübergehend sein können (429, 5xx,
 * Netzabbruch). Ein 401 oder 400 wird sofort weitergereicht – erneutes Senden
 * verbrennt nur Kontingent.
 */
export async function request<T>(url: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', headers = {}, body, rawBody, timeoutMs = 60_000, retries = 2, provider } = options

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...headers,
        },
        body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        const retryable = response.status === 429 || response.status >= 500
        if (retryable && attempt < retries) {
          lastError = new ConnectorError(provider, `HTTP ${response.status}`, response.status, text)
          await sleep(2 ** attempt * 1000)
          continue
        }
        const erklaerung = erklaereFehler(provider, response.status)
        throw new ConnectorError(
          provider,
          erklaerung ?? `HTTP ${response.status}: ${text.slice(0, 200)}`,
          response.status,
          text.slice(0, 500),
        )
      }

      return (await response.json()) as T
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

  throw lastError instanceof Error
    ? lastError
    : new ConnectorError(provider, 'Unbekannter Netzwerkfehler')
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
