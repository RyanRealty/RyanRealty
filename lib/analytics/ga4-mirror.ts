/**
 * The GA4 Measurement Protocol page-view mirror, as data: when it is on, and
 * which stored GA4 figures it shapes (visibility audit 2026-09-22, TRACK-1).
 *
 * THE MIRROR. Since 2026-08-10 (commit 416911b31, authored by Matt)
 * app/api/visitors/track/route.ts re-sends every essential-tier page_view,
 * listing_view and a few intent events to GA4 through Measurement Protocol
 * (lib/ga4-measurement-protocol.ts), with a client_id derived from the
 * first-party rr_session_id, engagement_time_msec 100, and no session_start,
 * first_visit or traffic-source fields. GA4 counts those hits as sessions and
 * users it never measured. Re-derived for the 14 days from 2026-09-08
 * (site_signal source ga4_data_api): page_view 28,804 against session_start 370
 * and first_visit 262; account sessions 8,743, of which source '(not set)'
 * 8,593 and 'google / organic' 1. Weekly users went from 33 (week of 08-03) to
 * 7,021 (week of 08-10) the week the mirror shipped.
 *
 * So GA4 sessions, users, new users, engagement, bounce, session duration, the
 * lead-event rate (sessions are its denominator) and every source/medium row are
 * artifacts of the mirror while it runs. Page views and event counts are real
 * first-party events relayed, and are NOT stamped.
 *
 * Keeping or retiring the mirror is Matt's decision (his commit); P7 owns the
 * track route and may add session/attribution fields to it. When the mirror is
 * retired, or starts carrying a per-visit session id and traffic source, update
 * isGa4PageViewMirrorOn and the metric sets here — the snapshot cron and the
 * admin notices read nothing else.
 */

/** First production day of the mirror (commit 416911b31, 2026-08-10 07:34 -0700). */
export const GA4_MP_PAGE_VIEW_MIRROR_SINCE = '2026-08-10'

type MirrorEnv = Partial<Record<'GA4_API_SECRET' | 'GA4_MEASUREMENT_ID' | 'NEXT_PUBLIC_GA4_MEASUREMENT_ID', string>>

/**
 * True when GA4 data for `date` (YYYY-MM-DD) carries mirrored page views.
 * The mirror is a no-op without GA4_API_SECRET and a measurement id
 * (fireGa4Event's getCreds), so it is on exactly when both exist in this
 * deployment's environment and the date is on or after the first mirror day.
 */
export function isGa4PageViewMirrorOn(date: string, env: MirrorEnv = process.env as MirrorEnv): boolean {
  if (date < GA4_MP_PAGE_VIEW_MIRROR_SINCE) return false
  const secret = (env.GA4_API_SECRET ?? '').trim()
  const measurementId = (env.GA4_MEASUREMENT_ID || env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '').trim()
  return secret.length > 0 && measurementId.length > 0
}

/** Account-scope GA4 metrics the mirror shapes (the names the snapshot cron writes). */
export const MIRROR_SHAPED_ACCOUNT_METRICS: ReadonlySet<string> = new Set([
  'sessions',
  'total_users',
  'new_users',
  'avg_session_duration_seconds',
  'engagement_rate',
  'bounce_rate',
  'lead_event_rate',
])

/** Source-scope metrics written per session source/medium (topSources). */
export const MIRROR_SHAPED_SOURCE_METRICS: ReadonlySet<string> = new Set(['sessions', 'users', 'engaged_sessions'])

type RowKey = { scope: string; scope_id: string; metric: string }

/**
 * True for a stored GA4 row whose value the mirror shapes. The source/medium
 * rows are the ones topSources writes: scope 'source', a source/medium
 * scope_id, and sessions/users/engaged_sessions. The lead_source and AI-engine
 * rows share scope 'source' but use other metrics and are not stamped.
 */
export function isMirrorShapedRow(row: RowKey): boolean {
  if (row.scope === 'account') return MIRROR_SHAPED_ACCOUNT_METRICS.has(row.metric)
  if (row.scope === 'source') {
    return !row.scope_id.startsWith('lead_source:') && MIRROR_SHAPED_SOURCE_METRICS.has(row.metric)
  }
  return false
}

/**
 * Stamp metadata.mirror_inflated=true on every mirror-shaped row when the
 * mirror was on for that day. Rows are copied, never mutated. Unshaped rows and
 * mirror-off days pass through untouched, so a backfill of a pre-2026-08-10
 * day stays unstamped.
 */
export function stampMirrorInflated<T extends RowKey & { metadata?: Record<string, unknown> }>(
  rows: T[],
  mirrorOn: boolean,
): T[] {
  if (!mirrorOn) return rows
  return rows.map((r) =>
    isMirrorShapedRow(r)
      ? { ...r, metadata: { ...(r.metadata ?? {}), mirror_inflated: true, mirror_since: GA4_MP_PAGE_VIEW_MIRROR_SINCE } }
      : r,
  )
}
