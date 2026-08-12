/**
 * getContactBehaviorSummary — the at-a-glance website behavior + intent picture
 * for the Contact-360 view (CONTACT360 Phase 2.6: "see what they are looking at
 * on the website").
 *
 * Resolve the contact's full identity via resolvePersonIdentity (the keystone),
 * then read their behavioral trail off `visitor_sessions` + `visitor_events` for
 * those stitched sessions and summarize it into:
 *
 *   { lastSeenAt, sessions30d, topListingsViewed[], topSearches[], intentSignals[] }
 *
 * The two derivations the broker reads at a glance — `deriveIntentSignals` and
 * `topByCount` — are PURE and unit-tested directly so the summary logic is
 * total and deterministic regardless of how the events come back from PostgREST.
 *
 * ── visitor_events columns used (verified against docs/DATABASE_SCHEMA_SNAPSHOT.md,
 *    the `visitor_events` table) ─────────────────────────────────────────────
 *   - session_id      text  NOT NULL — the identity join key (IN identity.sessionIds)
 *   - event_at        timestamptz NOT NULL — recency + 7d-window math
 *   - event_type      text  NOT NULL — the canonical vocabulary the tracker emits
 *                       (page_view | listing_view | search | scroll_depth |
 *                        section_view | cta_click | identify | signin — see
 *                        app/api/visitors/track ALLOWED_EVENT_TYPES)
 *   - page_url        text  NOT NULL — used to detect the mortgage-calculator tool
 *   - page_category   text  NULL — 'listing_detail' page-views count as listing
 *                       views (the visitor-backfill convention), 'financial_tools'
 *                       flags calculator use, 'seller_intent' flags valuation
 *   - listing_mls     text  NULL — the watched home's MLS key (rolled into topListings)
 *   - listing_street  text  NULL — best-effort address label when no live row
 *   - metadata        jsonb NULL — search labels live under metadata.query / .label / .term
 *
 * ── visitor_sessions columns used ──────────────────────────────────────────
 *   - session_id      text  NOT NULL — match key
 *   - last_seen_at    timestamptz NOT NULL — most-recent-visit ordering
 *   - first_seen_at   timestamptz NOT NULL — the 30-day-window count key
 *
 * ── IDENTITY JOIN (native, 2026-07-21) ─────────────────────────────────────
 * `resolvePersonIdentity().sessionIds` alone stitched sessions via the legacy
 * FUB id (visitor_sessions.fub_person_id) + email-keyed identity-map rows, so a
 * NATIVE lead (fub_legacy_id NULL) whose sessions carry only crm_person_id
 * resolved zero sessions. The summary now UNIONS that bundle with
 * resolveLeadSessionIds (lib/data/crm/getViewedListings.ts) — the native chain:
 * visitor_sessions.crm_person_id, the lockstep fub_person_id = crm id
 * convention (lib/visitor-backfill.ts:97-99), identity-map matches by
 * crm_person_id/fub_person_id/email, and every session sharing the person's
 * durable rr_vid. Truly anonymous pre-identify sessions (no rr_vid stitch yet)
 * remain unattributed until the visitor identifies in that browser.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
import { resolvePersonIdentity } from '@/lib/data/crm/resolvePersonIdentity'
import { resolveLeadSessionIds } from '@/lib/data/crm/getViewedListings'
import { createServiceClient } from '@/lib/supabase/service'

/** A home the contact viewed, with how many times. */
export type TopListingViewed = {
  listingKey: string
  address: string | null
  views: number
}

/** A search the contact ran, with how many times they ran it. */
export type TopSearch = {
  label: string
  count: number
}

/** Latest identified listing_view (MLS + street + when). */
export type LatestListingView = {
  listingMls: string | null
  listingStreet: string | null
  eventAt: string
}

/** The at-a-glance behavior + intent summary the Contact-360 panel renders. */
export type ContactBehaviorSummary = {
  lastSeenAt: string | null
  sessions30d: number
  topListingsViewed: TopListingViewed[]
  topSearches: TopSearch[]
  intentSignals: string[]
  latestListingView: LatestListingView | null
}

/** The minimal visitor_events row shape the pure derivations reason over. */
export type BehaviorEventRow = {
  event_type: string
  event_at: string | null
  page_url: string | null
  page_category: string | null
  listing_mls: string | null
  listing_street: string | null
  metadata: Record<string, unknown> | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Pure helper (unit-tested directly): roll a list of rows up by a string key
 * into the top-N most frequent, descending by count. Rows whose key is null /
 * empty are skipped. Ties break by first-seen order (stable) so the output is
 * deterministic. n <= 0 returns an empty list.
 *
 * Used for both topListingsViewed (key = listing_mls) and topSearches
 * (key = the derived search label).
 */
export function topByCount<T extends Record<string, unknown>>(
  rows: ReadonlyArray<T>,
  key: keyof T,
  n: number,
): Array<{ value: string; count: number }> {
  if (n <= 0) return []
  const counts = new Map<string, number>()
  for (const row of rows ?? []) {
    const raw = row?.[key]
    const value = raw === null || raw === undefined ? '' : String(raw).trim()
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  // Map iteration order is first-insertion order, so a stable sort by count
  // descending preserves first-seen order on ties.
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}

/** True when an event is, for intent purposes, a "viewed a listing" event. */
function isListingViewEvent(e: BehaviorEventRow): boolean {
  return (
    e.event_type === 'listing_view' ||
    (e.event_type === 'page_view' && e.page_category === 'listing_detail')
  )
}

/** Pure: newest listing_view that names a home (street or MLS). */
export function pickLatestListingView(
  events: ReadonlyArray<BehaviorEventRow>,
): LatestListingView | null {
  let best: LatestListingView | null = null
  let bestT = -Infinity
  for (const e of events ?? []) {
    if (!isListingViewEvent(e)) continue
    const t = e.event_at ? Date.parse(e.event_at) : NaN
    if (!Number.isFinite(t)) continue
    const mls = String(e.listing_mls ?? '').trim()
    const street = String(e.listing_street ?? '').trim()
    if (!mls && !street) continue
    if (t > bestT) {
      bestT = t
      best = {
        listingMls: mls || null,
        listingStreet: street || null,
        eventAt: e.event_at as string,
      }
    }
  }
  return best
}

/** True when an event is a search. */
function isSearchEvent(e: BehaviorEventRow): boolean {
  return e.event_type === 'search'
}

/** True when an event reflects mortgage-calculator / financial-tool use. */
function isMortgageCalculatorEvent(e: BehaviorEventRow): boolean {
  if (e.page_category === 'financial_tools') return true
  const url = String(e.page_url ?? '').toLowerCase()
  return url.includes('mortgage-calculator') || url.includes('/tools/mortgage')
}

/** True when an event reflects home-value / seller-intent interest. */
function isSellerIntentEvent(e: BehaviorEventRow): boolean {
  if (e.page_category === 'seller_intent') return true
  const url = String(e.page_url ?? '').toLowerCase()
  return (
    url.includes('home-valuation') ||
    url.includes('home-value') ||
    url.includes('/sell/valuation') ||
    url.includes('seller-home-value')
  )
}

/**
 * Pure helper (unit-tested directly): derive the human-readable intent signals
 * from a contact's event trail. Each signal is an at-a-glance flag a broker can
 * scan. Order is stable (most-decisive intent first). Returns [] for no events.
 *
 * The `now` parameter is injectable so the 7-day window is deterministic in
 * tests; it defaults to Date.now() in production.
 *
 * Signals (each emitted at most once):
 *   - 'viewed N+ listings in 7 days'  — N distinct homes in the trailing week
 *     (only emitted at the 5+ threshold the runbook calls out as hot)
 *   - 'repeat visitor'                — the trail spans 2+ distinct days
 *   - 'price-drop watcher'            — viewed a home flagged as a price drop
 *   - 'mortgage-calculator user'      — used a financial tool / mortgage calc
 *   - 'home-value seeker'             — hit a seller-intent / valuation surface
 *   - 'active searcher'               — ran 3+ searches
 */
export function deriveIntentSignals(
  events: ReadonlyArray<BehaviorEventRow>,
  now: number = Date.now(),
): string[] {
  const signals: string[] = []
  if (!events || events.length === 0) return signals

  // Distinct listings viewed in the trailing 7 days (the hot-buyer signal).
  const cutoff = now - 7 * MS_PER_DAY
  const recentListingKeys = new Set<string>()
  let sawMortgage = false
  let sawSellerIntent = false
  let sawPriceDrop = false
  let searchCount = 0
  const distinctDays = new Set<string>()

  for (const e of events) {
    const t = e.event_at ? Date.parse(e.event_at) : NaN
    if (Number.isFinite(t)) {
      // Day bucket (UTC date portion) for the repeat-visitor check.
      distinctDays.add(new Date(t).toISOString().slice(0, 10))
    }
    if (isListingViewEvent(e)) {
      const key = String(e.listing_mls ?? '').trim()
      if (key && Number.isFinite(t) && t >= cutoff) recentListingKeys.add(key)
    }
    if (isSearchEvent(e)) searchCount += 1
    if (isMortgageCalculatorEvent(e)) sawMortgage = true
    if (isSellerIntentEvent(e)) sawSellerIntent = true
    // A price-drop watch is carried on the event metadata by the price-drop
    // surfaces (metadata.price_drop / metadata.priceDrop boolean-ish flag).
    const md = e.metadata
    if (md && typeof md === 'object') {
      const flag =
        (md as Record<string, unknown>)['price_drop'] ?? (md as Record<string, unknown>)['priceDrop']
      if (flag === true || flag === 'true' || flag === 1) sawPriceDrop = true
    }
  }

  if (recentListingKeys.size >= 5) {
    signals.push(`viewed ${recentListingKeys.size}+ listings in 7 days`)
  }
  if (distinctDays.size >= 2) signals.push('repeat visitor')
  if (sawPriceDrop) signals.push('price-drop watcher')
  if (sawMortgage) signals.push('mortgage-calculator user')
  if (sawSellerIntent) signals.push('home-value seeker')
  if (searchCount >= 3) signals.push('active searcher')

  return signals
}

/**
 * Derive a human-readable label for a search event. The search surfaces stash
 * the human query under metadata (query / label / term / keyword); fall back to
 * the search page's query string when metadata is absent. Returns '' when
 * nothing usable is present (the caller drops empty labels).
 */
function deriveSearchLabel(e: BehaviorEventRow): string {
  const md = e.metadata
  if (md && typeof md === 'object') {
    for (const k of ['query', 'label', 'term', 'keyword', 'q']) {
      const v = (md as Record<string, unknown>)[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  // Fall back to the search page's query string (e.g. "/search?q=Bend").
  const url = String(e.page_url ?? '').trim()
  if (url) {
    try {
      const u = new URL(url, 'https://ryan-realty.com')
      const q = u.searchParams.get('q') || u.searchParams.get('city') || u.searchParams.get('keyword')
      if (q && q.trim()) return q.trim()
    } catch {
      /* unparseable url — fall through to empty */
    }
  }
  return ''
}

/**
 * Build the readable behavior/intent summary for a CRM contact from their real
 * visitor data. Single call -> the whole picture. Empty/safe defaults when the
 * contact has no stitched sessions or no events.
 */
export async function getContactBehaviorSummary(
  crmPersonId: number,
): Promise<ContactBehaviorSummary> {
  const empty: ContactBehaviorSummary = {
    lastSeenAt: null,
    sessions30d: 0,
    topListingsViewed: [],
    topSearches: [],
    intentSignals: [],
    latestListingView: null,
  }

  const identity = await resolvePersonIdentity(crmPersonId)

  const sb = createServiceClient()

  // Native identity chain (crm_person_id + lockstep + rr_vid) unioned with the
  // legacy/email bundle so BOTH native and FUB-imported leads resolve sessions.
  const nativeSessionIds = await resolveLeadSessionIds(sb, {
    crmPersonId,
    fubLegacyId: identity.fubLegacyId,
    emails: identity.emails,
  })
  const sessionIds = [...new Set([...identity.sessionIds, ...nativeSessionIds])].filter(Boolean)
  if (sessionIds.length === 0) return empty

  // Sessions: last-seen recency + 30-day session count. Bounded read.
  const { data: sessions } = await sb
    .from('visitor_sessions')
    .select('session_id,first_seen_at,last_seen_at')
    .in('session_id', sessionIds)
    .order('last_seen_at', { ascending: false })
    .limit(500)

  const sessionRows = sessions ?? []
  const lastSeenAt =
    sessionRows.length > 0 ? ((sessionRows[0].last_seen_at as string | null) ?? null) : null

  const thirtyDaysAgo = Date.now() - 30 * MS_PER_DAY
  const sessions30d = sessionRows.filter((s) => {
    const t = s.first_seen_at ? Date.parse(s.first_seen_at as string) : NaN
    return Number.isFinite(t) && t >= thirtyDaysAgo
  }).length

  // Events across those sessions, most-recent first, bounded.
  const { data: rawEvents } = await sb
    .from('visitor_events')
    .select('event_type,event_at,page_url,page_category,listing_mls,listing_street,metadata')
    .in('session_id', sessionIds)
    .order('event_at', { ascending: false })
    .limit(1000)

  const events: BehaviorEventRow[] = (rawEvents ?? []).map((e) => ({
    event_type: String(e.event_type ?? ''),
    event_at: (e.event_at as string | null) ?? null,
    page_url: (e.page_url as string | null) ?? null,
    page_category: (e.page_category as string | null) ?? null,
    listing_mls: (e.listing_mls as string | null) ?? null,
    listing_street: (e.listing_street as string | null) ?? null,
    metadata: (e.metadata as Record<string, unknown> | null) ?? null,
  }))

  if (events.length === 0) {
    return { ...empty, lastSeenAt, sessions30d, latestListingView: null }
  }

  // Top listings viewed: roll up the listing-view events by MLS key.
  const listingViewRows = events
    .filter(isListingViewEvent)
    .filter((e) => String(e.listing_mls ?? '').trim().length > 0)
  const addressByKey = new Map<string, string | null>()
  for (const e of listingViewRows) {
    const key = String(e.listing_mls).trim()
    if (!addressByKey.has(key)) {
      const street = String(e.listing_street ?? '').trim()
      addressByKey.set(key, street || null)
    }
  }
  const topListingsViewed: TopListingViewed[] = topByCount(listingViewRows, 'listing_mls', 5).map(
    (r) => ({
      listingKey: r.value,
      address: addressByKey.get(r.value) ?? null,
      views: r.count,
    }),
  )

  // Top searches: derive a human label per search event, then roll up by label.
  const searchLabelRows = events
    .filter(isSearchEvent)
    .map((e) => ({ label: deriveSearchLabel(e) }))
    .filter((r) => r.label.length > 0)
  const topSearches: TopSearch[] = topByCount(searchLabelRows, 'label', 5).map((r) => ({
    label: r.value,
    count: r.count,
  }))

  const intentSignals = deriveIntentSignals(events)
  const latestListingView = pickLatestListingView(events)

  return { lastSeenAt, sessions30d, topListingsViewed, topSearches, intentSignals, latestListingView }
}
