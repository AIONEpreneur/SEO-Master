import Stripe from 'stripe'
import { env } from '@/lib/env'
import { TARIFE } from './tarife'
import type { Plan } from '@prisma/client'

/**
 * Abo-Verwaltung über Stripe.
 *
 * Die Aufgabenteilung ist bewusst so gewählt, dass diese Anwendung nie
 * Kartendaten sieht: Gekauft wird auf einer von Stripe gehosteten Seite,
 * Bezahldaten und Kündigung verwaltet die Kundin im Stripe-Kundenportal.
 * Hier laufen nur zwei Dinge zusammen — das Erzeugen dieser beiden Adressen
 * und der Webhook, der den Zustand zurückschreibt.
 *
 * Ohne Schlüssel meldet sich alles sauber ab, statt zu werfen: Eine Instanz
 * ohne Stripe soll laufen, nur eben ohne Abo-Knöpfe.
 */

let client: Stripe | null = null

export function stripe(): Stripe | null {
  const key = env().STRIPE_SECRET_KEY
  if (!key) return null
  if (!client) client = new Stripe(key)
  return client
}

export function stripeBereit(): boolean {
  return Boolean(env().STRIPE_SECRET_KEY)
}

/** Welche Preis-Kennung gehört zu welchem Tarif? */
export function preisFuer(plan: 'STARTER' | 'PRO'): string | null {
  const e = env()
  return (plan === 'STARTER' ? e.STRIPE_PREIS_STARTER : e.STRIPE_PREIS_PRO) ?? null
}

/** Umgekehrt: Zu welchem Tarif gehört diese Preis-Kennung? */
export function planFuerPreis(preisId: string | null | undefined): Plan | null {
  if (!preisId) return null
  const e = env()
  if (preisId === e.STRIPE_PREIS_STARTER) return 'STARTER'
  if (preisId === e.STRIPE_PREIS_PRO) return 'PRO'
  return null
}

/** Welche Tarife lassen sich tatsächlich buchen? */
export function buchbareTarife(): Array<'STARTER' | 'PRO'> {
  if (!stripeBereit()) return []
  return (['STARTER', 'PRO'] as const).filter((p) => preisFuer(p) !== null)
}

export function monatsguthaben(plan: Plan): number {
  return TARIFE.find((t) => t.kennung === plan)?.monatsguthaben ?? 0
}

/**
 * Zählt ein Abo als bezahlt?
 *
 * `trialing` gehört dazu — wer in einer Probezeit ist, soll arbeiten können.
 * `past_due` bewusst auch: Eine fehlgeschlagene Abbuchung sperrt nicht
 * sofort aus, Stripe versucht es mehrere Tage lang erneut. Erst `canceled`
 * oder `unpaid` beenden den Zugang.
 */
export function aboTraegt(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due'
}

export const ABO_TEXTE: Record<string, string> = {
  active: 'Aktiv',
  trialing: 'Probezeit',
  past_due: 'Zahlung offen',
  canceled: 'Gekündigt',
  unpaid: 'Nicht bezahlt',
  incomplete: 'Noch nicht abgeschlossen',
  incomplete_expired: 'Abgelaufen',
  paused: 'Pausiert',
}
