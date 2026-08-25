import type { Provider } from '@prisma/client'

/** Anzeigenamen der Anbieter. Die Enum-Werte gehören nicht in die Oberfläche. */
export const PROVIDER_LABELS: Record<Provider, string> = {
  DATAFORSEO: 'DataForSEO',
  FIRECRAWL: 'Firecrawl',
  APIFY: 'Apify',
  ANTHROPIC: 'Anthropic',
  PAGESPEED: 'PageSpeed Insights',
  // Nicht mehr in Verwendung; der Enum-Wert bleibt aus Gründen der
  // Verträglichkeit bestehen und braucht deshalb weiterhin eine Beschriftung.
  SEARCH_CONSOLE: 'Search Console',
}

export function providerLabel(provider: Provider): string {
  return PROVIDER_LABELS[provider] ?? provider
}
