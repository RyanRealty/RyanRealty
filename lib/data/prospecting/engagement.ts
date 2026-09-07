import 'server-only'

/**
 * Bounded, cached engagement reads for the prospecting worklist (spec 07 §7)
 * and — since 2026-09-07 — for the CMA outcome column.
 *
 * Kills the per-load global newest-5,000 `visitor_events` scan in
 * lib/data/expired/dashboard.ts:140-165 (duplicated in
 * lib/data/fsbo/dashboard.ts:120-147). Engagement is a per-doc aggregate:
 * every query here is scoped to the caller's passed-in doc set (the ≤200
 * visible rows), never the whole table.
 *
 * Aggregation ported from lib/data/expired/dashboard.ts (steps 3-5:
 * email_events by `cma:<slug>` key, crm_timeline `sms_click` by person_id,
 * visitor_events `/cma/<slug>` page views) — same source tables, same
 * roll-up shape, scoped to the passed keys instead of every row/event.
 *
 * TWO SHAPES, ONE QUERY PASS. `DocEngagementDetail` is what the read actually
 * produces: every lifecycle stamp the three tables carry, firsts as well as
 * lasts. `ProspectEngagement` is the four-counter projection the worklist card
 * has always rendered. The CMA outcome column needs "when did they FIRST open
 * it" and "did it bounce", which counters cannot answer — so rather than a
 * second reader over the same three tables (which is how the pre-spec-07
 * duplication happened in the first place), the detail is computed once and the
 * counters are derived from it.
 */

import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { cmaSlugBase } from '@/lib/cma/address-slug'
import { cmaCampaignFromUrl } from '@/lib/cma/doc-links'
import type { ProspectEngagement, ProspectKind } from './types'

/** One doc's identity for a scoped engagement read. */
export interface ProspectEngagementKey {
  /** prospect id (listing_key | fsbo_url) — the result map's key. */
  id: string
  /** the built doc's slug (getBuiltDocForProspect state 'ready'|'sent'), else null. */
  slug: string | null
  /** resolved CRM person id (outreach_crm_person_id ?? fub_person_id), else null. */
  personId: number | null
}

export type ProspectEngagementMap = Record<string, ProspectEngagement>

/**
 * Everything the three engagement tables know about one document, unprojected.
 *
 * Timestamps are ISO strings straight from the row, never re-derived — a
 * "first opened" a report shows a broker must be the stamp the event carries.
 */
export interface DocEngagementDetail {
  /** email_events `sent` for `cma:<slug>` — the send this doc's tracking hangs off. */
  emailSentAt: string | null
  /** email_events `delivered` (Resend rail only; Gmail has no delivery receipt). */
  emailDeliveredAt: string | null
  emailOpens: number
  firstOpenAt: string | null
  lastOpenAt: string | null
  emailClicks: number
  firstClickAt: string | null
  lastClickAt: string | null
  /** Hard bounce or spam complaint on this send — an exception, not engagement. */
  bouncedAt: string | null
  /** Unsubscribe attributed to this send — also an exception. */
  unsubscribedAt: string | null
  /** `/cma/<slug>` page views (visitor_events, page_category client-document). */
  reportViews: number
  firstViewAt: string | null
  lastViewAt: string | null
  /**
   * Views of ryan-realty.com pages this DOCUMENT sent them to. Every address,
   * place and CTA a CMA prints goes through `trackedDocLink`, which stamps
   * `utm_campaign=<slug>` — so a tap on a comp is a visit belonging to that
   * document, not an anonymous listing view. This is the count of those.
   */
  siteViews: number
  firstSiteViewAt: string | null
  lastSiteViewAt: string | null
  /** Newest-first paths of those pages, at most three — WHICH comps they opened. */
  recentSitePaths: string[]
  /** SMS short-link taps (crm_timeline sms_click, scoped to this person). */
  linkTaps: number
  lastLinkTapAt: string | null
  /** Newest of every engagement stamp above. Exceptions do not count as activity. */
  lastActivityAt: string | null
}

export type DocEngagementDetailMap = Record<string, DocEngagementDetail>

const EMPTY_ENGAGEMENT: ProspectEngagement = {
  reportViews: 0,
  linkTaps: 0,
  emailOpens: 0,
  emailClicks: 0,
  lastActivityAt: null,
}

export const EMPTY_DOC_ENGAGEMENT_DETAIL: DocEngagementDetail = {
  emailSentAt: null,
  emailDeliveredAt: null,
  emailOpens: 0,
  firstOpenAt: null,
  lastOpenAt: null,
  emailClicks: 0,
  firstClickAt: null,
  lastClickAt: null,
  bouncedAt: null,
  unsubscribedAt: null,
  reportViews: 0,
  firstViewAt: null,
  lastViewAt: null,
  siteViews: 0,
  firstSiteViewAt: null,
  lastSiteViewAt: null,
  recentSitePaths: [],
  linkTaps: 0,
  lastLinkTapAt: null,
  lastActivityAt: null,
}

/** ISO timestamps sort lexically, so min/max need no Date parsing. */
function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

function later(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

/** Path only — a stored arrival URL carries the campaign query we do not display. */
function pathOf(pageUrl: string): string {
  try {
    return new URL(pageUrl, 'https://ryan-realty.com').pathname || '/'
  } catch {
    return '/'
  }
}

/**
 * The three most recent distinct pages, newest first. Distinct because a
 * seller who reloads one comp four times has opened one comp, and a broker
 * reading "which comps did they look at" must not be told the same address
 * three times while the other two are pushed off the end.
 */
function recentPaths(hits: Array<{ path: string; at: string | null }>): string[] {
  const sorted = [...hits].sort((a, b) => ((b.at ?? '') < (a.at ?? '') ? -1 : (b.at ?? '') > (a.at ?? '') ? 1 : 0))
  const out: string[] = []
  for (const h of sorted) {
    if (!out.includes(h.path)) out.push(h.path)
    if (out.length === 3) break
  }
  return out
}

/** The four-counter projection the prospecting worklist card has always shown. */
export function projectEngagement(detail: DocEngagementDetail): ProspectEngagement {
  return {
    reportViews: detail.reportViews,
    linkTaps: detail.linkTaps,
    emailOpens: detail.emailOpens,
    emailClicks: detail.emailClicks,
    lastActivityAt: detail.lastActivityAt,
  }
}

type EmailAgg = {
  sentAt: string | null
  deliveredAt: string | null
  opens: number
  firstOpenAt: string | null
  lastOpenAt: string | null
  clicks: number
  firstClickAt: string | null
  lastClickAt: string | null
  bouncedAt: string | null
  unsubscribedAt: string | null
}

function emptyEmailAgg(): EmailAgg {
  return {
    sentAt: null,
    deliveredAt: null,
    opens: 0,
    firstOpenAt: null,
    lastOpenAt: null,
    clicks: 0,
    firstClickAt: null,
    lastClickAt: null,
    bouncedAt: null,
    unsubscribedAt: null,
  }
}

async function computeEngagementDetail(
  keys: ProspectEngagementKey[],
): Promise<DocEngagementDetailMap> {
  if (keys.length === 0) return {}
  const sb = createServiceClient()

  const slugs = [...new Set(keys.map((k) => k.slug).filter((s): s is string => !!s))]
  const personIds = [...new Set(keys.map((k) => k.personId).filter((v): v is number => v != null))]

  // Email lifecycle — keyed to the DOC's own tracked send (`cma:<slug>`), not
  // any email_out for the person (spec §7, fixes Defect 10). Every lifecycle
  // event is read, not just open/click: a bounce or an unsubscribe is the
  // answer to "what happened after we sent it" just as much as an open is,
  // and a queue that showed opens but hid bounces would read as better news
  // than the truth.
  const emailAgg = new Map<string, EmailAgg>()
  const emailKeys = slugs.map((s) => `cma:${s}`)
  for (let i = 0; i < emailKeys.length; i += 100) {
    const chunk = emailKeys.slice(i, i + 100)
    const { data, error } = await sb
      .from('email_events')
      .select('email_key, event, occurred_at')
      .in('email_key', chunk)
    if (error) {
      console.error('[prospecting] engagement email_events read failed:', error.message)
      continue
    }
    for (const ev of data ?? []) {
      const slug = String(ev.email_key ?? '').slice(4)
      const agg = emailAgg.get(slug) ?? emptyEmailAgg()
      const at = (ev.occurred_at as string | null) ?? null
      switch (String(ev.event ?? '')) {
        case 'sent':
          agg.sentAt = earlier(agg.sentAt, at)
          break
        case 'delivered':
          agg.deliveredAt = earlier(agg.deliveredAt, at)
          break
        case 'open':
          agg.opens++
          agg.firstOpenAt = earlier(agg.firstOpenAt, at)
          agg.lastOpenAt = later(agg.lastOpenAt, at)
          break
        case 'click':
          agg.clicks++
          agg.firstClickAt = earlier(agg.firstClickAt, at)
          agg.lastClickAt = later(agg.lastClickAt, at)
          break
        case 'bounce':
        case 'complaint':
          agg.bouncedAt = earlier(agg.bouncedAt, at)
          break
        case 'unsubscribe':
          agg.unsubscribedAt = earlier(agg.unsubscribedAt, at)
          break
        default:
          break
      }
      emailAgg.set(slug, agg)
    }
  }

  // SMS short-link taps — crm_timeline sms_click, scoped to these person ids.
  const smsClicksByPid = new Map<number, { count: number; last: string | null }>()
  for (let i = 0; i < personIds.length; i += 100) {
    const chunk = personIds.slice(i, i + 100)
    const { data, error } = await sb
      .from('crm_timeline')
      .select('person_id, ts')
      .in('person_id', chunk)
      .eq('kind', 'sms_click')
    if (error) {
      console.error('[prospecting] engagement crm_timeline read failed:', error.message)
      continue
    }
    for (const t of data ?? []) {
      const pid = Number(t.person_id)
      const agg = smsClicksByPid.get(pid) ?? { count: 0, last: null }
      agg.count++
      const at = t.ts as string | null
      if (at && (!agg.last || at > agg.last)) agg.last = at
      smsClicksByPid.set(pid, agg)
    }
  }

  // Document page views — visitor_events, scoped to `/cma/<slug>` for exactly
  // these slugs (OR-chunked point matches, not a `%/cma/%` global scan).
  const viewsBySlug = new Map<string, { count: number; first: string | null; last: string | null }>()
  for (let i = 0; i < slugs.length; i += 25) {
    const chunk = slugs.slice(i, i + 25)
    const orExpr = chunk.map((s) => `page_url.ilike.%/cma/${s}%`).join(',')
    const { data, error } = await sb
      .from('visitor_events')
      .select('page_url, event_at')
      .eq('page_category', 'client-document')
      .eq('event_type', 'page_view')
      .or(orExpr)
    if (error) {
      console.error('[prospecting] engagement visitor_events read failed:', error.message)
      continue
    }
    const chunkSet = new Set(chunk)
    for (const v of data ?? []) {
      const m = String(v.page_url ?? '').match(/\/cma\/([a-z0-9-]+)/)
      if (!m) continue
      const slug = cmaSlugBase(m[1]!)
      if (!chunkSet.has(slug)) continue // guard: ilike is a substring match
      const agg = viewsBySlug.get(slug) ?? { count: 0, first: null, last: null }
      agg.count++
      const at = (v.event_at as string | null) ?? null
      agg.first = earlier(agg.first, at)
      agg.last = later(agg.last, at)
      viewsBySlug.set(slug, agg)
    }
  }

  // Site pages arrived at FROM the document (2026-09-07). Every link a CMA
  // prints goes through `trackedDocLink`, which stamps `utm_campaign=<slug>`,
  // and the visitor tracker stores the arrival URL query — so the campaign tag
  // is what makes a tap on a comp a visit belonging to THAT document instead of
  // an anonymous listing view.
  //
  // No `page_category` filter here on purpose: these land on listing, place and
  // market pages, each with its own category. The ilike is a substring match,
  // so every row is re-parsed and exact-matched against the chunk before it
  // counts — the same guard the `/cma/<slug>` pass above uses, and the reason a
  // slug that is a prefix of another cannot borrow its taps.
  const siteBySlug = new Map<
    string,
    { count: number; first: string | null; last: string | null; hits: Array<{ path: string; at: string | null }> }
  >()
  for (let i = 0; i < slugs.length; i += 25) {
    const chunk = slugs.slice(i, i + 25)
    const orExpr = chunk.map((s) => `page_url.ilike.%utm_campaign=${s}%`).join(',')
    const { data, error } = await sb
      .from('visitor_events')
      .select('page_url, event_at')
      .eq('event_type', 'page_view')
      .or(orExpr)
    if (error) {
      console.error('[prospecting] engagement campaign visits read failed:', error.message)
      continue
    }
    const chunkSet = new Set(chunk)
    for (const v of data ?? []) {
      const pageUrl = String(v.page_url ?? '')
      const campaign = cmaCampaignFromUrl(pageUrl)
      if (!campaign) continue
      const slug = cmaSlugBase(campaign)
      if (!chunkSet.has(slug)) continue
      const agg = siteBySlug.get(slug) ?? { count: 0, first: null, last: null, hits: [] }
      agg.count++
      const at = (v.event_at as string | null) ?? null
      agg.first = earlier(agg.first, at)
      agg.last = later(agg.last, at)
      agg.hits.push({ path: pathOf(pageUrl), at })
      siteBySlug.set(slug, agg)
    }
  }

  const result: DocEngagementDetailMap = {}
  for (const k of keys) {
    const em = (k.slug ? emailAgg.get(k.slug) : undefined) ?? emptyEmailAgg()
    const views = k.slug ? viewsBySlug.get(k.slug) : undefined
    const site = k.slug ? siteBySlug.get(k.slug) : undefined
    const sms = k.personId != null ? smsClicksByPid.get(k.personId) : undefined
    // Exceptions (bounce / unsubscribe) are deliberately NOT activity — a
    // bounce is the absence of a reader, and folding it in would make a dead
    // address look like a warm one on the row.
    let lastActivityAt: string | null = null
    for (const at of [em.lastOpenAt, em.lastClickAt, views?.last ?? null, site?.last ?? null, sms?.last ?? null]) {
      lastActivityAt = later(lastActivityAt, at)
    }
    result[k.id] = {
      emailSentAt: em.sentAt,
      emailDeliveredAt: em.deliveredAt,
      emailOpens: em.opens,
      firstOpenAt: em.firstOpenAt,
      lastOpenAt: em.lastOpenAt,
      emailClicks: em.clicks,
      firstClickAt: em.firstClickAt,
      lastClickAt: em.lastClickAt,
      bouncedAt: em.bouncedAt,
      unsubscribedAt: em.unsubscribedAt,
      reportViews: views?.count ?? 0,
      firstViewAt: views?.first ?? null,
      lastViewAt: views?.last ?? null,
      siteViews: site?.count ?? 0,
      firstSiteViewAt: site?.first ?? null,
      lastSiteViewAt: site?.last ?? null,
      recentSitePaths: recentPaths(site?.hits ?? []),
      linkTaps: sms?.count ?? 0,
      lastLinkTapAt: sms?.last ?? null,
      lastActivityAt,
    }
  }
  return result
}

// Two module-level cached wrappers (one per kind) — unstable_cache's tags
// array is fixed at wrap time, and the two kinds need distinct invalidation
// tags (`prospecting:engagement:expired` vs `prospecting:engagement:fsbo`).
// v2 keys: the cached VALUE shape widened from four counters to the full
// lifecycle detail, so the v1 entries are not merely stale, they are the wrong
// shape. A new key part retires them rather than reading them back.
const cachedEngagementExpired = unstable_cache(
  computeEngagementDetail,
  ['prospecting-engagement-expired-v2'],
  { revalidate: 60, tags: ['prospecting:engagement:expired'] },
)
const cachedEngagementFsbo = unstable_cache(
  computeEngagementDetail,
  ['prospecting-engagement-fsbo-v2'],
  { revalidate: 60, tags: ['prospecting:engagement:fsbo'] },
)

// Generic doc-engagement cache. Same computation, its own tag — the CMA
// performance report needs per-document engagement for docs that are NOT
// prospects (a CMA built for a walk-in seller has no expired/fsbo row), so it
// cannot borrow either prospecting tag without polluting their invalidation.
const cachedEngagementDoc = unstable_cache(computeEngagementDetail, ['doc-engagement-v2'], {
  revalidate: 60,
  tags: ['cma:engagement'],
})

/**
 * Full lifecycle detail for any bounded set of `/cma/<slug>` documents. Same
 * bounded-read contract as every reader here: callers pass the visible page's
 * keys, never the whole table. Degrades to zeroed detail rather than throwing —
 * engagement is a display convenience, not a compliance gate.
 */
export async function getDocEngagementDetail(
  keys: ProspectEngagementKey[],
): Promise<DocEngagementDetailMap> {
  if (keys.length === 0) return {}
  try {
    return await cachedEngagementDoc(keys)
  } catch (e) {
    console.error('[cma] getDocEngagementDetail failed:', e instanceof Error ? e.message : e)
    const fallback: DocEngagementDetailMap = {}
    for (const k of keys) fallback[k.id] = EMPTY_DOC_ENGAGEMENT_DETAIL
    return fallback
  }
}

/**
 * Per-document engagement for any bounded set of `/cma/<slug>` documents,
 * prospect-linked or not. Same bounded-read contract as the prospecting
 * variant: callers pass the visible page's keys, never the whole table.
 */
export async function getDocEngagement(keys: ProspectEngagementKey[]): Promise<ProspectEngagementMap> {
  if (keys.length === 0) return {}
  const detail = await getDocEngagementDetail(keys)
  const out: ProspectEngagementMap = {}
  for (const k of keys) out[k.id] = projectEngagement(detail[k.id] ?? EMPTY_DOC_ENGAGEMENT_DETAIL)
  return out
}

/**
 * Per-doc engagement for a bounded set of prospects (spec §7). Callers pass
 * the visible page's doc keys — never the whole table. Engagement is a
 * display convenience (not a compliance gate), so a read failure degrades to
 * zeroed engagement for the affected keys rather than throwing.
 */
export async function getProspectEngagement(
  kind: ProspectKind,
  keys: ProspectEngagementKey[],
): Promise<ProspectEngagementMap> {
  if (keys.length === 0) return {}
  try {
    const cached = kind === 'expired' ? cachedEngagementExpired : cachedEngagementFsbo
    const detail = await cached(keys)
    const out: ProspectEngagementMap = {}
    for (const k of keys) out[k.id] = projectEngagement(detail[k.id] ?? EMPTY_DOC_ENGAGEMENT_DETAIL)
    return out
  } catch (e) {
    console.error('[prospecting] getProspectEngagement failed:', e instanceof Error ? e.message : e)
    const fallback: ProspectEngagementMap = {}
    for (const k of keys) fallback[k.id] = EMPTY_ENGAGEMENT
    return fallback
  }
}

export { EMPTY_ENGAGEMENT }
