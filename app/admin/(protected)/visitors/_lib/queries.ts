/**
 * Server-side data fetching for /admin/visitors/* dashboards.
 *
 * Uses the Supabase service-role key to read visitor_sessions + visitor_events
 * directly. Admin layout already gates by admin_roles, so unauthorized callers
 * never reach this module.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type LiveSessionRow = {
  session_id: string
  source_domain: string
  first_seen_at: string
  last_seen_at: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
  landing_page: string | null
  ip_country: string | null
  ip_region: string | null
  ip_city: string | null
  identified_at: string | null
  fub_person_id: number | null
  crm_person_id: number | null
  identified_email: string | null
  identified_via: string | null
  engagement_score: number
  peak_score: number
  intent_tags: string[]
  hot_lead_fired_at: string | null
  events_backfilled_count: number
  /** Event count derived from a separate aggregation query. */
  event_count: number
}

export type LiveVisitorFilters = {
  /** 'all' | 'anonymous' | 'identified' — default 'all'. */
  identifiedFilter?: 'all' | 'anonymous' | 'identified'
  /** Filter by source_domain. Empty = all. */
  sourceDomain?: string
  /** Minimum engagement score. Default 0. */
  minScore?: number
  /** Limit returned rows. Default 50. */
  limit?: number
}

function getServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error('Supabase service role not configured')
  }
  return createClient(url, key)
}

/**
 * Fetch the most-recently-active visitor sessions, augmented with event counts.
 *
 * Returns one row per session, ordered by last_seen_at DESC. Includes both
 * anonymous and identified sessions by default; pass identifiedFilter to
 * narrow. Event count comes from a per-session aggregation, joined client-
 * side (Supabase JS does not support GROUP BY directly via the builder).
 */
export async function fetchLiveVisitors(filters: LiveVisitorFilters = {}): Promise<LiveSessionRow[]> {
  const supabase = getServiceSupabase()
  const {
    identifiedFilter = 'all',
    sourceDomain,
    minScore = 0,
    limit = 50,
  } = filters

  let query = supabase
    .from('visitor_sessions')
    .select(
      'session_id, source_domain, first_seen_at, last_seen_at, utm_source, utm_medium, utm_campaign, referrer, landing_page, ip_country, ip_region, ip_city, identified_at, fub_person_id, crm_person_id, identified_email, identified_via, engagement_score, peak_score, intent_tags, hot_lead_fired_at, events_backfilled_count'
    )
    .order('last_seen_at', { ascending: false })
    .limit(limit)

  if (minScore > 0) query = query.gte('engagement_score', minScore)
  if (sourceDomain) query = query.eq('source_domain', sourceDomain)
  if (identifiedFilter === 'anonymous')  query = query.is('identified_at', null)
  if (identifiedFilter === 'identified') query = query.not('identified_at', 'is', null)

  const { data: sessions, error } = await query
  if (error) throw new Error(`visitor_sessions read failed: ${error.message}`)
  if (!sessions || sessions.length === 0) return []

  // Per-session event count. Single round trip with IN-clause filter on the
  // session_ids we already fetched. Aggregation happens via the count() over
  // a select that just returns ids (Supabase doesn't expose GROUP BY in the
  // JS builder, so we count in JS).
  const sessionIds = sessions.map((s) => s.session_id)
  const { data: eventIds, error: evErr } = await supabase
    .from('visitor_events')
    .select('session_id')
    .in('session_id', sessionIds)
  if (evErr) throw new Error(`visitor_events count failed: ${evErr.message}`)

  const counts = new Map<string, number>()
  for (const row of eventIds ?? []) {
    const sid = (row as { session_id: string }).session_id
    counts.set(sid, (counts.get(sid) ?? 0) + 1)
  }

  return sessions.map((s) => ({
    ...(s as Omit<LiveSessionRow, 'event_count' | 'intent_tags'>),
    intent_tags: (s.intent_tags as string[]) ?? [],
    event_count: counts.get(s.session_id) ?? 0,
  }))
}

export type SessionEvent = {
  id: number
  event_at: string
  event_type: string
  page_url: string
  page_title: string | null
  page_category: string | null
  listing_mls: string | null
  listing_city: string | null
  listing_price: number | null
  scroll_depth_pct: number | null
  score_delta: number
  pushed_to_fub_at: string | null
}

/**
 * Fetch all events for a single session, oldest first. Used by the expandable
 * row on /admin/visitors/live to show the full browsing path.
 */
export async function fetchSessionEvents(sessionId: string, limit = 200): Promise<SessionEvent[]> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('visitor_events')
    .select('id, event_at, event_type, page_url, page_title, page_category, listing_mls, listing_city, listing_price, scroll_depth_pct, score_delta, pushed_to_fub_at')
    .eq('session_id', sessionId)
    .order('event_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`session events read failed: ${error.message}`)
  return (data ?? []) as SessionEvent[]
}

export type LiveSummary = {
  totalActive: number       // sessions with last_seen in last 5 min
  totalToday: number        // sessions seen at all today (UTC day)
  identifiedToday: number
  hotLeadsToday: number     // hot_lead_fired_at today
  topSource: string | null
  topSourceCount: number
}

/**
 * Quick aggregate stats for the page header. One round trip per metric;
 * cheap because all the indexes we need are in place.
 */
export async function fetchLiveSummary(): Promise<LiveSummary> {
  const supabase = getServiceSupabase()
  const now = new Date()
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()

  const [activeRes, todayRes, identifiedRes, hotRes, sourcesRes] = await Promise.all([
    supabase.from('visitor_sessions').select('session_id', { count: 'exact', head: true }).gte('last_seen_at', fiveMinAgo),
    supabase.from('visitor_sessions').select('session_id', { count: 'exact', head: true }).gte('last_seen_at', todayStart),
    supabase.from('visitor_sessions').select('session_id', { count: 'exact', head: true }).gte('last_seen_at', todayStart).not('identified_at', 'is', null),
    supabase.from('visitor_sessions').select('session_id', { count: 'exact', head: true }).gte('hot_lead_fired_at', todayStart),
    supabase.from('visitor_sessions').select('utm_source').gte('last_seen_at', todayStart).not('utm_source', 'is', null).limit(1000),
  ])

  // Build top-source histogram from the raw utm_source list
  let topSource: string | null = null
  let topSourceCount = 0
  if (sourcesRes.data) {
    const tally = new Map<string, number>()
    for (const row of sourcesRes.data as { utm_source: string | null }[]) {
      const s = row.utm_source?.trim().toLowerCase()
      if (!s) continue
      tally.set(s, (tally.get(s) ?? 0) + 1)
    }
    for (const [src, count] of tally) {
      if (count > topSourceCount) { topSource = src; topSourceCount = count }
    }
  }

  return {
    totalActive: activeRes.count ?? 0,
    totalToday: todayRes.count ?? 0,
    identifiedToday: identifiedRes.count ?? 0,
    hotLeadsToday: hotRes.count ?? 0,
    topSource,
    topSourceCount,
  }
}
