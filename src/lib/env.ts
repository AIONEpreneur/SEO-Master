import { z } from 'zod'

/**
 * Zentrale Auswertung der Umgebungsvariablen. Fehlkonfiguration soll beim
 * Start auffallen und nicht erst mitten in einem Analyselauf.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // 32 Byte, hex- oder base64-kodiert. Erzeugen mit:
  //   openssl rand -base64 32
  ENCRYPTION_KEY: z.string().min(32),
  // Signierschlüssel für Session-Cookies.
  SESSION_SECRET: z.string().min(32),

  APP_URL: z.string().url().default('http://localhost:3000'),
  // Wenn gesetzt, dürfen sich nur diese E-Mail-Adressen registrieren.
  ALLOWED_SIGNUP_EMAILS: z.string().optional(),
  // Registrierung für beliebige Personen öffnen. Standardmässig geschlossen:
  // Eine offen erreichbare Anwendung, bei der sich jede Person ein Konto
  // anlegen kann, ist beim internen Betrieb nie gewollt.
  ALLOW_PUBLIC_SIGNUP: z.enum(['true', 'false']).default('false'),
  // Fallback-Zugangsdaten für den Einzelbetrieb. Im Mehrmandantenbetrieb
  // hinterlegt jede Organisation ihre Schlüssel stattdessen im Tresor.
  DATAFORSEO_LOGIN: z.string().optional(),
  DATAFORSEO_PASSWORD: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  APIFY_TOKEN: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  PAGESPEED_API_KEY: z.string().optional(),

  // --- Mail-Versand ---------------------------------------------------------
  // Alles optional: Ohne Konfiguration läuft die Anwendung weiter, nur der
  // Versand meldet sich ab. Ein fehlendes Postfach darf keine Anmeldung
  // verhindern.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /** Absender, etwa: SEO-Master <kirsten@mail.beispiel.de> */
  SMTP_FROM: z.string().optional(),

  // --- Stripe ---------------------------------------------------------------
  // Ebenfalls optional: Ohne Schlüssel bleibt der Abo-Bereich sichtbar, aber
  // als "noch nicht eingerichtet" beschriftet, statt Fehler zu werfen.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** Preis-Kennungen aus dem Stripe-Katalog (price_…). */
  STRIPE_PREIS_STARTER: z.string().optional(),
  STRIPE_PREIS_PRO: z.string().optional(),

  /** Wohin hochgeladene Profilbilder geschrieben werden. */
  UPLOAD_VERZEICHNIS: z.string().default('/data/uploads'),
})

let cached: z.infer<typeof schema> | null = null

export function env() {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ')
    throw new Error(`Ungültige Umgebungskonfiguration:\n  ${missing}`)
  }
  cached = parsed.data
  return cached
}

export const isProd = () => process.env.NODE_ENV === 'production'
