import type { Criterion, Finding, ModuleResult } from './types'
import { weightedScore, scoreLabel, statusFor } from './types'
import type { SocialProfile } from '@/lib/connectors/apify'

/**
 * Social-Profil-Analyse.
 *
 * Bewertet wird, was für Auffindbarkeit und Autorität zählt: ist das Profil
 * durchsuchbar, ist die Positionierung erkennbar, führt ein Weg zur eigenen
 * Seite, und findet echte Interaktion statt?
 */
export function analyzeSocial(input: {
  profile: SocialProfile
  /** Erwartete Interaktionsrate der Plattform in Prozent – Vergleichsmassstab. */
  benchmark?: number
}): ModuleResult {
  const p = input.profile
  const findings: Finding[] = []
  const criteria: Criterion[] = []
  const benchmark = input.benchmark ?? PLATFORM_BENCHMARKS[p.platform] ?? 1.5

  // --- Profil-Vollständigkeit ----------------------------------------------
  {
    const parts = [
      { ok: Boolean(p.displayName), label: 'Anzeigename' },
      { ok: Boolean(p.bio && p.bio.length > 40), label: 'aussagekräftige Bio' },
      { ok: Boolean(p.externalUrl), label: 'Link zur Website' },
      { ok: Boolean(p.handle), label: 'Handle' },
    ]
    const hits = parts.filter((x) => x.ok).length
    const score = clamp(hits * 2.5)
    const missing = parts.filter((x) => !x.ok).map((x) => x.label)

    if (!p.externalUrl) {
      findings.push({
        id: 'social-no-link',
        severity: 'critical',
        title: 'Kein Link zur Website im Profil',
        why: 'Ohne Link im Profil endet jede Aufmerksamkeit auf der Plattform. Der Verweis ist zugleich ein Signal, das Suchmaschinen und KI-Systeme der Marke zuordnen.',
        action: 'Website im Profil-Link hinterlegen – idealerweise mit UTM-Parametern, um die Wirkung messbar zu machen.',
        effort: 'gering',
        impact: 'hoch',
      })
    }
    if (!p.bio || p.bio.length < 40) {
      findings.push({
        id: 'social-weak-bio',
        severity: 'quickwin',
        title: 'Bio zu dünn',
        why: 'Die Bio ist der Text, über den Menschen und Plattform-Suche das Profil einordnen. Zu kurz heisst: nicht auffindbar und nicht einprägsam.',
        action: 'Bio nach dem Muster "[Für wen] + [welches Ergebnis] + [wodurch]" aufbauen und dabei die Begriffe verwenden, nach denen die Zielgruppe tatsächlich sucht.',
        effort: 'gering',
        impact: 'mittel',
      })
    }
    criteria.push({
      key: 'completeness',
      label: 'Profil-Vollständigkeit',
      score,
      weight: 30,
      detail: `${hits} von 4 Profilelementen gepflegt.${missing.length ? ` Fehlt: ${missing.join(', ')}.` : ''}`,
      status: statusFor(score),
    })
  }

  // --- Auffindbarkeit -------------------------------------------------------
  {
    // Keywords in Name und Bio entscheiden über die Auffindbarkeit in der
    // plattforminternen Suche.
    const bioWords = (p.bio ?? '').split(/\s+/).length
    const hasKeywordish = /(coach|beratung|consulting|expert|strateg|mentor|training|agentur|design|marketing|seo|ki|ai)/i.test(
      `${p.displayName ?? ''} ${p.bio ?? ''}`,
    )
    let score = 3
    if (hasKeywordish) score += 3
    if (bioWords >= 15) score += 2
    if (p.verified) score += 1
    score = clamp(score)

    if (!hasKeywordish) {
      findings.push({
        id: 'social-no-keywords',
        severity: 'quickwin',
        title: 'Keine Suchbegriffe in Name und Bio',
        why: 'Die Suche innerhalb der Plattform gewichtet Anzeigenamen und Bio stark. Ohne die Begriffe der Zielgruppe wird das Profil nur über den Namen gefunden.',
        action: 'Anzeigenamen um die Tätigkeit erweitern (z. B. "Vorname Nachname · KI-Beratung für Solopreneure") und die Kernbegriffe in der Bio unterbringen.',
        effort: 'gering',
        impact: 'mittel',
      })
    }
    criteria.push({
      key: 'discoverability',
      label: 'Auffindbarkeit',
      score,
      weight: 25,
      detail: `Bio mit ${bioWords} Wörtern${hasKeywordish ? ', Fachbegriffe enthalten' : ', ohne erkennbare Fachbegriffe'}${p.verified ? ', verifiziert' : ''}.`,
      status: statusFor(score),
    })
  }

  // --- Reichweite -----------------------------------------------------------
  {
    const f = p.followers
    if (f === null) {
      criteria.push({ key: 'reach', label: 'Reichweite', score: 0, weight: 20, detail: 'Keine Followerzahl ermittelbar.', status: 'unknown' })
    } else {
      const score = f < 100 ? 1 : f < 1000 ? 3 : f < 5000 ? 5 : f < 25000 ? 7 : 9
      criteria.push({
        key: 'reach',
        label: 'Reichweite',
        score,
        weight: 20,
        detail: `${f.toLocaleString('de-DE')} Follower${p.postsCount ? `, ${p.postsCount} Beiträge` : ''}.`,
        status: statusFor(score),
      })
    }
  }

  // --- Interaktion ----------------------------------------------------------
  {
    if (p.avgEngagement === null) {
      criteria.push({ key: 'engagement', label: 'Interaktionsrate', score: 0, weight: 25, detail: 'Nicht berechenbar – keine Beitragsdaten verfügbar.', status: 'unknown' })
    } else {
      const ratio = p.avgEngagement / benchmark
      const score = clamp(Math.min(10, ratio * 5))
      const detail = `${p.avgEngagement.toFixed(2)} % Interaktionsrate (Plattform-Richtwert: ${benchmark} %).`

      if (ratio < 0.6) {
        findings.push({
          id: 'social-low-engagement',
          severity: 'quickwin',
          title: `Interaktionsrate unter dem Richtwert (${p.avgEngagement.toFixed(2)} % gegenüber ${benchmark} %)`,
          why: 'Der Algorithmus verteilt Reichweite nach Interaktion. Niedrige Werte begrenzen die Sichtbarkeit unabhängig von der Followerzahl.',
          action: 'Formate testen, die zur Reaktion auffordern: konkrete Fragen am Beitragsende, Umfragen, Erfahrungsberichte statt reiner Tipps. Über vier Wochen messen, welches Format trägt.',
          effort: 'mittel',
          impact: 'hoch',
        })
      }
      criteria.push({ key: 'engagement', label: 'Interaktionsrate', score, weight: 25, detail, status: statusFor(score) })
    }
  }

  const score = weightedScore(criteria)

  return {
    module: 'SOCIAL',
    score,
    label: scoreLabel(score),
    criteria,
    findings,
    data: {
      platform: p.platform,
      handle: p.handle,
      displayName: p.displayName,
      followers: p.followers,
      postsCount: p.postsCount,
      avgEngagement: p.avgEngagement,
      benchmark,
      verified: p.verified,
      externalUrl: p.externalUrl,
      bio: p.bio,
      recentPosts: p.recentPosts.slice(0, 6),
    },
  }
}

/** Übliche Interaktionsraten je Plattform, als Vergleichsmassstab. */
const PLATFORM_BENCHMARKS: Record<string, number> = {
  instagram: 1.2,
  tiktok: 4.5,
  linkedin: 2.0,
  youtube: 1.8,
  facebook: 0.6,
  x: 0.5,
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n * 10) / 10))
