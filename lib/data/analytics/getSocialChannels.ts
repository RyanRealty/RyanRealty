/**
 * getSocialChannels — dedicated social-channel figures for
 * /admin/analytics/social.
 *
 * Recognises every common social referrer host even when UTMs are missing
 * (Facebook, Instagram, TikTok, YouTube, LinkedIn, X/Twitter, Pinterest,
 * Threads, Reddit, Snapchat) via `classifySocial`, mirroring the auto-
 * inference the WP snippet uses so both surfaces report consistent numbers.
 *
 * DAL boundary (G1): raw .from() lives here. Fails soft — callers get an
 * `unreadable` flag instead of a thrown error, per §0 (an honest empty
 * state, never a silent zero presented as a real figure).
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'

/** Maps a free-form source string onto a canonical social channel, or null for non-social. */
export function classifySocial(source: string | null | undefined): string | null {
  if (!source) return null
  const s = source.toLowerCase()
  if (/(^|[/_.\s-])(facebook|fb)([/_.\s-]|$)/.test(s) || s === 'fb' || s === 'facebook') return 'Facebook'
  if (/instagram|insta(\b|gram)/.test(s)) return 'Instagram'
  if (/tiktok/.test(s)) return 'TikTok'
  if (/youtube|^yt$/.test(s)) return 'YouTube'
  if (/linkedin/.test(s)) return 'LinkedIn'
  if (/\b(x|twitter|t\.co)\b/.test(s)) return 'X / Twitter'
  if (/pinterest/.test(s)) return 'Pinterest'
  if (/threads/.test(s)) return 'Threads'
  if (/reddit/.test(s)) return 'Reddit'
  if (/snapchat/.test(s)) return 'Snapchat'
  return null
}

export type SocialHeadlineSummary = {
  liveNow: number
  today: number
  last7d: number
  identified7d: number
  hot7d: number
  unreadable: boolean
  errorMessage?: string
}

export async function getSocialHeadlineSummary(): Promise<SocialHeadlineSummary> {
  const supabase = createServiceClient()
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

  // Paged read — PostgREST caps single responses at 1,000 rows, so a bare
  // .limit(5000) would silently truncate.
  const { rows: data, error } = await fetchPagedRows(
    (from, to) =>
      supabase
        .from('visitor_sessions')
        .select('session_id, utm_source, last_seen_at, first_seen_at, identified_at, hot_lead_fired_at')
        .gte('first_seen_at', sevenDaysAgo)
        .order('session_id', { ascending: true })
        .range(from, to),
    5000,
  )
  if (error) {
    console.error('[getSocialHeadlineSummary]', error.message)
    return { liveNow: 0, today: 0, last7d: 0, identified7d: 0, hot7d: 0, unreadable: true, errorMessage: error.message }
  }

  const social = data.filter((r) => classifySocial((r as { utm_source: string | null }).utm_source) !== null)
  const today = social.filter((r) => (r as { first_seen_at: string }).first_seen_at >= todayStart)
  const liveNow = social.filter((r) => (r as { last_seen_at: string }).last_seen_at >= fiveMinAgo)
  const identified = social.filter((r) => (r as { identified_at: string | null }).identified_at !== null)
  const hot = social.filter((r) => (r as { hot_lead_fired_at: string | null }).hot_lead_fired_at !== null)

  return {
    liveNow: liveNow.length,
    today: today.length,
    last7d: social.length,
    identified7d: identified.length,
    hot7d: hot.length,
    unreadable: false,
  }
}

export type SocialChannelRow = {
  channel: string
  sessions: number
  identified: number
  hot: number
  identifyRate: number
  hotRate: number
  avgScore: number
  campaignCount: number
  topCity: string
}

export type SocialChannelBreakdownResult = {
  rows: SocialChannelRow[]
  unreadable: boolean
  errorMessage?: string
}

export async function getSocialChannelBreakdown(): Promise<SocialChannelBreakdownResult> {
  const supabase = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { rows: data, error } = await fetchPagedRows(
    (from, to) =>
      supabase
        .from('visitor_sessions')
        .select('session_id, utm_source, utm_medium, utm_campaign, identified_at, hot_lead_fired_at, ip_city, engagement_score')
        .gte('first_seen_at', sevenDaysAgo)
        .order('session_id', { ascending: true })
        .range(from, to),
    5000,
  )
  if (error) {
    console.error('[getSocialChannelBreakdown]', error.message)
    return { rows: [], unreadable: true, errorMessage: error.message }
  }

  type ChannelAgg = {
    sessions: number
    identified: number
    hot: number
    campaigns: Set<string>
    topCity: Map<string, number>
    engagedSum: number
  }
  const byChannel = new Map<string, ChannelAgg>()
  for (const raw of data) {
    const row = raw as {
      utm_source: string | null
      utm_medium: string | null
      utm_campaign: string | null
      identified_at: string | null
      hot_lead_fired_at: string | null
      ip_city: string | null
      engagement_score: number
    }
    const ch = classifySocial(row.utm_source)
    if (!ch) continue
    const a = byChannel.get(ch) ?? {
      sessions: 0,
      identified: 0,
      hot: 0,
      campaigns: new Set<string>(),
      topCity: new Map<string, number>(),
      engagedSum: 0,
    }
    a.sessions += 1
    if (row.identified_at) a.identified += 1
    if (row.hot_lead_fired_at) a.hot += 1
    if (row.utm_campaign) a.campaigns.add(row.utm_campaign)
    if (row.ip_city) a.topCity.set(row.ip_city, (a.topCity.get(row.ip_city) ?? 0) + 1)
    a.engagedSum += row.engagement_score ?? 0
    byChannel.set(ch, a)
  }

  const rows: SocialChannelRow[] = Array.from(byChannel.entries())
    .map(([channel, a]) => {
      let topCity = ''
      let topCityCount = 0
      for (const [c, n] of a.topCity) {
        if (n > topCityCount) {
          topCity = c
          topCityCount = n
        }
      }
      return {
        channel,
        sessions: a.sessions,
        identified: a.identified,
        hot: a.hot,
        identifyRate: a.sessions ? a.identified / a.sessions : 0,
        hotRate: a.sessions ? a.hot / a.sessions : 0,
        avgScore: a.sessions ? a.engagedSum / a.sessions : 0,
        campaignCount: a.campaigns.size,
        topCity,
      }
    })
    .sort((x, y) => y.sessions - x.sessions)

  return { rows, unreadable: false }
}

export type SocialLiveFeedRow = {
  sessionId: string
  utmSource: string | null
  utmCampaign: string | null
  lastSeenAt: string
  engagementScore: number
  intentTags: string[]
  ipCity: string | null
  identifiedEmail: string | null
  fubPersonId: number | null
}

export type SocialLiveFeedResult = {
  rows: SocialLiveFeedRow[]
  unreadable: boolean
  errorMessage?: string
}

export async function getSocialLiveFeed(): Promise<SocialLiveFeedResult> {
  const supabase = createServiceClient()
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select(
      'session_id, utm_source, utm_medium, utm_campaign, last_seen_at, engagement_score, intent_tags, ip_city, identified_email, fub_person_id',
    )
    .gte('last_seen_at', thirtyMinAgo)
    .order('last_seen_at', { ascending: false })
    .limit(40)
  if (error) {
    console.error('[getSocialLiveFeed]', error.message)
    return { rows: [], unreadable: true, errorMessage: error.message }
  }
  type FeedRow = {
    session_id: string
    utm_source: string | null
    utm_campaign: string | null
    last_seen_at: string
    engagement_score: number
    intent_tags: string[]
    ip_city: string | null
    identified_email: string | null
    fub_person_id: number | null
  }
  const rows = (data ?? [])
    .filter((r) => classifySocial((r as { utm_source: string | null }).utm_source) !== null)
    .map((r) => {
      const row = r as FeedRow
      return {
        sessionId: row.session_id,
        utmSource: row.utm_source,
        utmCampaign: row.utm_campaign,
        lastSeenAt: row.last_seen_at,
        engagementScore: row.engagement_score,
        intentTags: row.intent_tags ?? [],
        ipCity: row.ip_city,
        identifiedEmail: row.identified_email,
        fubPersonId: row.fub_person_id,
      }
    })
  return { rows, unreadable: false }
}
