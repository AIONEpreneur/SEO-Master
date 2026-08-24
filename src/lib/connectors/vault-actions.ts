'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { seal, hintOf } from '@/lib/crypto/vault'
import { DataForSeoClient } from './dataforseo'
import { FirecrawlClient } from './firecrawl'
import { ApifyClient } from './apify'
import { resolveSecret } from './credentials'
import { providerLabel } from './labels'
import type { Provider } from '@prisma/client'

export type VaultState = { error?: string; success?: string }

/**
 * Zugangsdaten im Tresor ablegen.
 *
 * Der Klartext wird sofort verschlüsselt und nie zurückgegeben – auch nicht an
 * die Person, die ihn eingetragen hat. Wer den Schlüssel ändern will, trägt
 * einen neuen ein.
 */
export async function saveCredentialAction(_prev: VaultState, formData: FormData): Promise<VaultState> {
  const session = await requireRole('ADMIN')
  const provider = String(formData.get('provider')) as Provider
  const label = String(formData.get('label') ?? 'Standard').trim() || 'Standard'

  let secret: Record<string, string>
  let hint: string

  if (provider === 'DATAFORSEO') {
    const login = String(formData.get('login') ?? '').trim()
    const password = String(formData.get('password') ?? '').trim()
    if (!login || !password) return { error: 'Login und Passwort werden beide benötigt.' }
    secret = { login, password }
    hint = login
  } else {
    const apiKey = String(formData.get('apiKey') ?? '').trim()
    if (!apiKey) return { error: 'Bitte den Schlüssel eintragen.' }
    secret = { apiKey }
    hint = hintOf(apiKey)
  }

  const sealed = seal(secret)

  await db.credential.upsert({
    where: { organizationId_provider_label: { organizationId: session.organizationId, provider, label } },
    create: {
      organizationId: session.organizationId,
      provider,
      label,
      ...sealed,
      hint,
    },
    update: { ...sealed, hint, isActive: true, lastCheckedAt: null, lastCheckOk: null, lastCheckError: null },
  })

  await db.auditLog.create({
    data: {
      organizationId: session.organizationId,
      userId: session.id,
      action: 'vault.save',
      target: provider,
    },
  })

  revalidatePath('/settings/vault')
  return { success: `${providerLabel(provider)} gespeichert.` }
}

export async function deleteCredentialAction(formData: FormData) {
  const session = await requireRole('ADMIN')
  const id = String(formData.get('id'))
  await db.credential.deleteMany({ where: { id, organizationId: session.organizationId } })
  await db.auditLog.create({
    data: { organizationId: session.organizationId, userId: session.id, action: 'vault.delete', target: id },
  })
  revalidatePath('/settings/vault')
}

/**
 * Zugangsdaten gegen den Anbieter prüfen.
 *
 * Sinnvoller als nur zu speichern: ein Tippfehler fällt sonst erst mitten im
 * ersten Analyselauf auf.
 */
export async function testCredentialAction(formData: FormData) {
  const session = await requireRole('ADMIN')
  const provider = String(formData.get('provider')) as Provider

  let ok = false
  let error: string | null = null

  try {
    switch (provider) {
      case 'DATAFORSEO': {
        const secret = await resolveSecret<{ login: string; password: string }>(session.organizationId, provider)
        if (!secret) throw new Error('Keine Zugangsdaten hinterlegt')
        const result = await new DataForSeoClient(secret).verify()
        ok = result.ok
        break
      }
      case 'FIRECRAWL': {
        const secret = await resolveSecret<{ apiKey: string }>(session.organizationId, provider)
        if (!secret) throw new Error('Kein Schlüssel hinterlegt')
        await new FirecrawlClient(secret).verify()
        ok = true
        break
      }
      case 'APIFY': {
        const secret = await resolveSecret<{ apiKey: string }>(session.organizationId, provider)
        if (!secret) throw new Error('Kein Schlüssel hinterlegt')
        await new ApifyClient(secret).verify()
        ok = true
        break
      }
      case 'ANTHROPIC': {
        const secret = await resolveSecret<{ apiKey: string }>(session.organizationId, provider)
        if (!secret) throw new Error('Kein Schlüssel hinterlegt')
        const response = await fetch('https://api.anthropic.com/v1/models?limit=1', {
          headers: { 'x-api-key': secret.apiKey, 'anthropic-version': '2023-06-01' },
          signal: AbortSignal.timeout(20_000),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        ok = true
        break
      }
      case 'PAGESPEED': {
        const secret = await resolveSecret<{ apiKey: string }>(session.organizationId, provider)
        const url = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
        url.searchParams.set('url', 'https://example.com')
        url.searchParams.set('category', 'seo')
        if (secret?.apiKey) url.searchParams.set('key', secret.apiKey)
        const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        ok = true
        break
      }
      default:
        throw new Error('Prüfung für diesen Anbieter nicht verfügbar')
    }
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 300) : 'Unbekannter Fehler'
  }

  await db.credential.updateMany({
    where: { organizationId: session.organizationId, provider },
    data: { lastCheckedAt: new Date(), lastCheckOk: ok, lastCheckError: error },
  })

  revalidatePath('/settings/vault')
}
