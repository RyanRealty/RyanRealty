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
 * NOW (Matt 2026-10-14): nothing for the essential tier; at the analytics tier
 * only client-document views and the intent events (ga4MirrorSends below).
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

/**
 * Since this day the mirror skips views the browser tag already counts
 * (analytics-tier visitors). From 2026-10-09 to GA4_MIRROR_CONSENTED_ONLY_SINCE
 * it covered visitors who had not allowed analytics cookies plus /cma and /bpo
 * client documents; since then, client documents and intent events at the
 * analytics tier only (docs/analytics/README.md "Server mirror").
 */
export const GA4_MIRROR_ESSENTIAL_ONLY_SINCE = '2026-10-09'

/**
 * Since this day (deployed the evening of 2026-10-14 PT) the mirror sends
 * NOTHING for an essential-tier visitor: one in a privacy-law region who has
 * not accepted cookies, or who allowed marketing only (Matt 2026-10-14). Those
 * hits carried no source and the visitor had not consented to analytics.
 * First-party visitor_sessions / visitor_events still record the visit, so the
 * site's own dashboard keeps counting it. See ga4MirrorSends.
 */
export const GA4_MIRROR_CONSENTED_ONLY_SINCE = '2026-10-15'

/** The track route's event types the mirror can copy to GA4. */
export const GA4_MIRROR_EVENT_TYPES = ['page_view', 'listing_view', 'intent_declared', 'welcome_back', 'email_opt', 'sms_opt'] as const

/**
 * Whether app/api/visitors/track copies one first-party event to GA4 through
 * the Measurement Protocol. The one rule, so a test holds it:
 *
 *   - essential tier (anything short of analytics consent): never
 *     (Matt 2026-10-14, GA4_MIRROR_CONSENTED_ONLY_SINCE);
 *   - a page_view / listing_view on a site page: never, the browser's Google
 *     tag counts it (since 2026-10-09);
 *   - a page_view / listing_view on a raw-HTML client document (/cma, /bpo,
 *     page category `client-document`): yes, the document runs no Google tag;
 *   - intent_declared, welcome_back, email_opt, sms_opt: yes (no browser tag
 *     sends them).
 *
 * Suppression (admin, a broker's browser, automation, non-production) is
 * decided separately and applies on top.
 */
export function ga4MirrorSends(input: { eventType: string; consent: string; pageCategory?: string | null; pageUrl?: string | null }): boolean {
  if (!(GA4_MIRROR_EVENT_TYPES as readonly string[]).includes(input.eventType)) return false
  if (input.consent !== 'analytics' && input.consent !== 'all') return false
  if (isGa4MirrorView(input.eventType) && !isClientDocumentView(input.pageCategory, input.pageUrl)) return false
  return true
}

/** A view event (page_view, listing_view); the mirror sends it to GA4 as `page_view`. */
export function isGa4MirrorView(eventType: string): boolean {
  return eventType === 'page_view' || eventType === 'listing_view'
}

/** A client document (/cma/<slug>, /bpo/<slug>) runs no Google tag. */
const CLIENT_DOCUMENT_PATH_RE = /^\/(?:cma|bpo)\/[^/]+/i

/**
 * A view on a raw-HTML client document. The tracker's own category is not
 * enough: the page address must be one too, so a site page that posts
 * `client-document` by mistake is not counted twice (the browser tag counts it).
 * Without an address (older callers) the category decides.
 */
function isClientDocumentView(pageCategory: string | null | undefined, pageUrl: string | null | undefined): boolean {
  if (pageCategory !== 'client-document') return false
  if (pageUrl === undefined || pageUrl === null) return true
  try {
    return CLIENT_DOCUMENT_PATH_RE.test(new URL(pageUrl).pathname)
  } catch {
    return false
  }
}

/**
 * First day GA4 sessions and traffic sources read as reliable: Unassigned
 * sessions fell from hundreds a day to 3 on 2026-10-12 (GA4 Data API,
 * sessionDefaultChannelGroup by date, read 2026-10-14).
 */
export const GA4_TRAFFIC_RELIABLE_FROM = '2026-10-12'

/** First day GA4 lead events carry the visit's source (server events join the GA4 session, #563). */
export const GA4_LEAD_SOURCE_RELIABLE_FROM = '2026-10-14'

/**
 * True when a GA4 window (YYYY-MM-DD, inclusive) includes days whose sessions,
 * sources and engagement the mirror inflated: any day from
 * GA4_MP_PAGE_VIEW_MIRROR_SINCE up to the day before GA4_TRAFFIC_RELIABLE_FROM.
 * A window that starts on or after the reliable day, or ends before the mirror
 * began, needs no caveat. This is about the data already in the GA4 property,
 * which production wrote, so it does not depend on the reader's environment.
 */
export function ga4WindowNeedsTrafficCaveat(startDate: string, endDate?: string): boolean {
  if (startDate >= GA4_TRAFFIC_RELIABLE_FROM) return false
  if (endDate !== undefined && endDate < GA4_MP_PAGE_VIEW_MIRROR_SINCE) return false
  return true
}

/** ga4WindowNeedsTrafficCaveat for a window of the last `days` days ending now. */
export function ga4LastDaysNeedTrafficCaveat(days: number, nowMs: number = Date.now()): boolean {
  return ga4WindowNeedsTrafficCaveat(new Date(nowMs - days * 86_400_000).toISOString().slice(0, 10))
}
