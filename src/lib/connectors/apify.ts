import { request } from './http'
import type { ApiKeySecret } from './credentials'

const BASE = 'https://api.apify.com/v2'

/**
 * Apify – Social-Media-Profile.
 *
 * DataForSEO deckt Suchmaschinen ab, aber keine Profildaten von Instagram,
 * LinkedIn oder TikTok. Dafür laufen bei Apify fertige Actors, die synchron
 * aufgerufen werden können.
 */
export class ApifyClient {
  constructor(private secret: ApiKeySecret) {}

  async verify(): Promise<{ ok: true; username?: string }> {
    const response = await request<{ data?: { username?: string } }>(`${BASE}/users/me`, {
      provider: 'Apify',
      headers: { authorization: `Bearer ${this.secret.apiKey}` },
      timeoutMs: 20_000,
      retries: 0,
    })
    return { ok: true, username: response.data?.username }
  }

  /**
   * Actor synchron ausführen und die Datensätze zurückgeben.
   * `timeoutMs` deckelt die Laufzeit, damit ein hängender Actor nicht den
   * gesamten Analyselauf blockiert.
   */
  async runActor<T>(actorId: string, input: unknown, timeoutMs = 180_000): Promise<T[]> {
    const path = actorId.replace('/', '~')
    return request<T[]>(
      `${BASE}/acts/${path}/run-sync-get-dataset-items?timeout=${Math.floor(timeoutMs / 1000)}`,
      {
        method: 'POST',
        provider: 'Apify',
        headers: { authorization: `Bearer ${this.secret.apiKey}` },
        body: input,
        timeoutMs: timeoutMs + 15_000,
        retries: 0,
      },
    )
  }
}

export type SocialPlatform = 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'facebook' | 'x'

/** Plattform aus einer Profil-URL ableiten. */
export function detectPlatform(url: string): SocialPlatform | null {
  const host = safeHost(url)
  if (!host) return null
  if (host.includes('instagram.')) return 'instagram'
  if (host.includes('linkedin.')) return 'linkedin'
  if (host.includes('tiktok.')) return 'tiktok'
  if (host.includes('youtube.') || host.includes('youtu.be')) return 'youtube'
  if (host.includes('facebook.') || host.includes('fb.com')) return 'facebook'
  if (host === 'x.com' || host.includes('twitter.')) return 'x'
  return null
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Actor-Zuordnung je Plattform.
 *
 * Bewusst als Konfiguration und nicht fest verdrahtet: Actors im Apify-Store
 * ändern sich, und über die Umgebungsvariable lässt sich ein anderer Actor
 * einsetzen, ohne den Code anzufassen.
 */
export const DEFAULT_ACTORS: Record<SocialPlatform, string> = {
  instagram: process.env.APIFY_ACTOR_INSTAGRAM ?? 'apify/instagram-profile-scraper',
  linkedin: process.env.APIFY_ACTOR_LINKEDIN ?? 'dev_fusion/linkedin-profile-scraper',
  tiktok: process.env.APIFY_ACTOR_TIKTOK ?? 'clockworks/tiktok-profile-scraper',
  youtube: process.env.APIFY_ACTOR_YOUTUBE ?? 'streamers/youtube-scraper',
  facebook: process.env.APIFY_ACTOR_FACEBOOK ?? 'apify/facebook-pages-scraper',
  x: process.env.APIFY_ACTOR_X ?? 'apidojo/twitter-user-scraper',
}

/** Eingabeformat je Actor – die Actors erwarten unterschiedliche Felder. */
export function actorInput(platform: SocialPlatform, profileUrl: string): unknown {
  const handle = profileUrl.replace(/\/+$/, '').split('/').filter(Boolean).pop() ?? ''
  switch (platform) {
    case 'instagram':
      return { usernames: [handle.replace('@', '')] }
    case 'linkedin':
      return { profileUrls: [profileUrl] }
    case 'tiktok':
      return { profiles: [handle.replace('@', '')], resultsPerPage: 20 }
    case 'youtube':
      return { startUrls: [{ url: profileUrl }], maxResults: 20 }
    case 'facebook':
      return { startUrls: [{ url: profileUrl }] }
    case 'x':
      return { startUrls: [profileUrl], maxItems: 20 }
  }
}

/**
 * Vereinheitlichtes Profil. Die Actors liefern jeweils eigene Feldnamen; die
 * Analyse arbeitet nur noch mit dieser Form.
 */
export type SocialProfile = {
  platform: SocialPlatform
  handle: string | null
  displayName: string | null
  bio: string | null
  followers: number | null
  following: number | null
  postsCount: number | null
  verified: boolean
  externalUrl: string | null
  avgEngagement: number | null
  recentPosts: Array<{ text: string | null; likes: number | null; comments: number | null; url: string | null }>
}

export function normalizeProfile(platform: SocialPlatform, raw: Record<string, unknown>): SocialProfile {
  const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

  const posts = Array.isArray(raw.latestPosts)
    ? (raw.latestPosts as Record<string, unknown>[])
    : Array.isArray(raw.posts)
      ? (raw.posts as Record<string, unknown>[])
      : []

  const recentPosts = posts.slice(0, 12).map((p) => ({
    text: s(p.caption ?? p.text ?? p.title ?? p.description),
    likes: n(p.likesCount ?? p.likes ?? p.diggCount ?? p.favoriteCount),
    comments: n(p.commentsCount ?? p.comments ?? p.replyCount),
    url: s(p.url ?? p.postUrl ?? p.webVideoUrl),
  }))

  const followers = n(
    raw.followersCount ?? raw.followers ?? raw.fans ?? raw.subscriberCount ?? raw.followerCount,
  )

  // Interaktionsrate: durchschnittliche Reaktionen je Beitrag im Verhältnis zur
  // Reichweite. Ohne Followerzahl nicht sinnvoll berechenbar.
  const engagements = recentPosts
    .map((p) => (p.likes ?? 0) + (p.comments ?? 0))
    .filter((v) => v > 0)
  const avgEngagement =
    engagements.length > 0 && followers && followers > 0
      ? (engagements.reduce((a, b) => a + b, 0) / engagements.length / followers) * 100
      : null

  return {
    platform,
    handle: s(raw.username ?? raw.handle ?? raw.publicIdentifier ?? raw.uniqueId),
    displayName: s(raw.fullName ?? raw.name ?? raw.displayName ?? raw.title ?? raw.nickName),
    bio: s(raw.biography ?? raw.bio ?? raw.about ?? raw.description ?? raw.summary),
    followers,
    following: n(raw.followsCount ?? raw.following ?? raw.followingCount),
    postsCount: n(raw.postsCount ?? raw.videoCount ?? raw.mediaCount ?? raw.statusesCount),
    verified: Boolean(raw.verified ?? raw.isVerified ?? raw.is_verified),
    externalUrl: s(raw.externalUrl ?? raw.website ?? raw.link ?? raw.externalLink),
    avgEngagement,
    recentPosts,
  }
}
