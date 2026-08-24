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

type RequestOptions = {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: unknown
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
  const { method = 'GET', headers = {}, body, timeoutMs = 60_000, retries = 2, provider } = options

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
        body: body === undefined ? undefined : JSON.stringify(body),
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
        throw new ConnectorError(
          provider,
          `HTTP ${response.status}: ${text.slice(0, 300)}`,
          response.status,
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
