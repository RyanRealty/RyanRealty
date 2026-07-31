import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * DAL for public.user_events scoped to ONE signed-in visitor — the source
 * behind the /account portal's Activity panel (Phase 4.1,
 * docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md, "see their own activity").
 *
 * The table is the site's own instrumentation: TrackListingView writes
 * `listing_view`, the search funnel (Phase 0.5) writes `search_*`, and the
 * page tracker writes `page_view`. Nothing new is recorded for the portal —
 * this only reads what already exists.
 *
 * Deliberately UNCACHED. Every row is per-person and the panel is a private,
 * always-fresh surface, so an unstable_cache window here would only serve one
 * visitor their own stale feed while holding memory for everyone else. Same
 * shape as the session-scoped alert readers in lib/data/leads/listingAlertsUser.ts:
 * the service client is used, and EVERY query carries .eq('user_id', <caller>),
 * so a caller can only ever read the rows for the user id it passes.
 *
 * §0: these are exact counts and exact rows. A failed read returns empty / zero
 * rather than an estimate.
 */

const TABLE = 'user_events'

/** Event types the portal feed knows how to describe. */
export const PORTAL_ACTIVITY_EVENT_TYPES = [
  'listing_view',
  'search_filter_apply',
  'search_map_draw',
  'search_save',
  'search_zero_results',
  'alert_create',
  'page_view',
] as const

export type PortalActivityEventType = (typeof PORTAL_ACTIVITY_EVENT_TYPES)[number]

export type UserActivityEvent = {
  id: string
  eventType: string
  eventAt: string
  pagePath: string | null
  listingKey: string | null
  payload: Record<string, unknown> | null
}

export type UserActivitySummary = {
  /** Start of the counted window (ISO). */
  sinceIso: string
  windowDays: number
  listingViews: number
  searchesApplied: number
  pageViews: number
}

/** The visitor's newest activity rows, newest first. */
export async function getUserActivityEvents(
  userId: string,
  limit = 40,
): Promise<UserActivityEvent[]> {
  const uid = (userId ?? '').trim()
  if (!uid) return []
  const safeLimit = Number.isFinite(limit) ? Math.min(200, Math.max(1, Math.floor(limit))) : 40

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, event_type, event_at, page_path, listing_key, payload')
    .eq('user_id', uid)
    .in('event_type', [...PORTAL_ACTIVITY_EVENT_TYPES])
    .order('event_at', { ascending: false })
    .limit(safeLimit)
  if (error) {
    console.error('[getUserActivityEvents]', error.message)
    return []
  }

  const rows = (data ?? []) as Array<{
    id: string
    event_type: string
    event_at: string
    page_path: string | null
    listing_key: string | null
    payload: Record<string, unknown> | null
  }>
  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    eventAt: r.event_at,
    pagePath: r.page_path,
    listingKey: r.listing_key,
    payload: r.payload ?? null,
  }))
}

/**
 * Exact head counts over a trailing window, one per event type. Zero is a real
 * answer: it means the site recorded nothing for this person in that window.
 */
export async function getUserActivitySummary(
  userId: string,
  windowDays = 30,
): Promise<UserActivitySummary> {
  const days = Number.isFinite(windowDays) ? Math.min(365, Math.max(1, Math.floor(windowDays))) : 30
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const empty: UserActivitySummary = {
    sinceIso,
    windowDays: days,
    listingViews: 0,
    searchesApplied: 0,
    pageViews: 0,
  }

  const uid = (userId ?? '').trim()
  if (!uid) return empty

  const supabase = createServiceClient()
  const countOf = async (eventType: PortalActivityEventType): Promise<number> => {
    const { count, error } = await supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('event_type', eventType)
      .gte('event_at', sinceIso)
    if (error) {
      console.error('[getUserActivitySummary]', eventType, error.message)
      return 0
    }
    return count ?? 0
  }

  const [listingViews, searchesApplied, pageViews] = await Promise.all([
    countOf('listing_view'),
    countOf('search_filter_apply'),
    countOf('page_view'),
  ])

  return { ...empty, listingViews, searchesApplied, pageViews }
}
