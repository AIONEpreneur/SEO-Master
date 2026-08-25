import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seal } from '@/lib/crypto/vault'
import { env } from '@/lib/env'
import { pruefeZustand, tauscheCode } from '@/lib/connectors/google-oauth'
import { SearchConsoleClient } from '@/lib/connectors/search-console'

/**
 * Rückweg von Google.
 *
 * Hier landet die Nutzerin nach der Zustimmung. Der Einmalcode wird gegen
 * einen Dauerzugang getauscht und verschlüsselt im Tresor abgelegt.
 *
 * Bewusst ohne Sitzungsprüfung: Google schickt den Browser hierher zurück, und
 * je nach Einstellung kommt das Sitzungs-Cookie bei einer Weiterleitung von
 * aussen nicht mit. Die Zuordnung trägt stattdessen der signierte Zustand –
 * er kann ohne den Signierschlüssel dieser Installation nicht gefälscht
 * werden und läuft nach zehn Minuten ab.
 */
export async function GET(request: Request) {
  const zurueck = `${env().APP_URL.replace(/\/$/, '')}/settings/vault`
  const params = new URL(request.url).searchParams

  // Die Nutzerin hat im Google-Fenster abgebrochen.
  const fehler = params.get('error')
  if (fehler) {
    return NextResponse.redirect(`${zurueck}?google=abgebrochen`)
  }

  const code = params.get('code')
  const zustand = params.get('state')
  if (!code || !zustand) {
    return NextResponse.redirect(`${zurueck}?google=unvollstaendig`)
  }

  const geprueft = pruefeZustand(zustand)
  if (!geprueft) {
    return NextResponse.redirect(`${zurueck}?google=ungueltig`)
  }

  try {
    const secret = await tauscheCode(code)

    // Sofort ausprobieren. Ein Zugang, der zwar besteht, aber auf keine
    // Property zeigt, ist wertlos – und das soll jetzt auffallen, nicht erst
    // beim ersten Analyselauf.
    let detail: string | null = null
    let ok = true
    let pruefFehler: string | null = null
    try {
      const ergebnis = await new SearchConsoleClient(secret).verify()
      detail = `${ergebnis.sites.length} ${ergebnis.sites.length === 1 ? 'Property' : 'Properties'}: ${ergebnis.sites.join(', ')}`
    } catch (e) {
      ok = false
      pruefFehler = e instanceof Error ? e.message.replace(/^\[[^\]]+\]\s*/, '').slice(0, 300) : 'Unbekannter Fehler'
    }

    const sealed = seal(secret)
    await db.credential.upsert({
      where: {
        organizationId_provider_label: {
          organizationId: geprueft.organizationId,
          provider: 'SEARCH_CONSOLE',
          label: 'Standard',
        },
      },
      create: {
        organizationId: geprueft.organizationId,
        provider: 'SEARCH_CONSOLE',
        label: 'Standard',
        ...sealed,
        hint: secret.account ?? 'Google-Konto',
        lastCheckedAt: new Date(),
        lastCheckOk: ok,
        lastCheckError: pruefFehler,
        lastCheckDetail: detail,
      },
      update: {
        ...sealed,
        hint: secret.account ?? 'Google-Konto',
        isActive: true,
        lastCheckedAt: new Date(),
        lastCheckOk: ok,
        lastCheckError: pruefFehler,
        lastCheckDetail: detail,
      },
    })

    await db.auditLog.create({
      data: {
        organizationId: geprueft.organizationId,
        action: 'vault.google-verbunden',
        target: secret.account ?? 'Google-Konto',
      },
    })

    return NextResponse.redirect(`${zurueck}?google=${ok ? 'verbunden' : 'ohne-property'}`)
  } catch {
    return NextResponse.redirect(`${zurueck}?google=fehlgeschlagen`)
  }
}
