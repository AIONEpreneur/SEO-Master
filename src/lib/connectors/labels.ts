import type { Provider } from '@prisma/client'

/** Anzeigenamen der Anbieter. Die Enum-Werte gehören nicht in die Oberfläche. */
export const PROVIDER_LABELS: Record<Provider, string> = {
  DATAFORSEO: 'DataForSEO',
  FIRECRAWL: 'Firecrawl',
  APIFY: 'Apify',
  ANTHROPIC: 'Anthropic',
  PAGESPEED: 'PageSpeed Insights',
  SEARCH_CONSOLE: 'Search Console',
}

export function providerLabel(provider: Provider): string {
  return PROVIDER_LABELS[provider] ?? provider
}
