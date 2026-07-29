import 'server-only'

/**
 * Bounded, cached engagement reads for the prospecting worklist (spec 07 §7).
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
 */

import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { cmaSlugBase } from '@/lib/cma/address-slug'
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

const EMPTY_ENGAGEMENT: ProspectEngagement = {
  reportViews: 0,
  linkTaps: 0,
  emailOpens: 0,
  emailClicks: 0,
  lastActivityAt: null,
}

async function computeEngagement(keys: ProspectEngagementKey[]): Promise<ProspectEngagementMap> {
  if (keys.length === 0) return {}
  const sb = createServiceClient()

  const slugs = [...new Set(keys.map((k) => k.slug).filter((s): s is string => !!s))]
  const personIds = [...new Set(keys.map((k) => k.personId).filter((v): v is number => v != null))]

  // Email opens/clicks — keyed to the DOC's own tracked event (`cma:<slug>`),
  // not any email_out for the person (spec §7, fixes Defect 10).
  const emailAgg = new Map<string, { opens: number; clicks: number; last: string | null }>()
  const emailKeys = slugs.map((s) => `cma:${s}`)
  for (let i = 0; i < emailKeys.length; i += 100) {
    const chunk = emailKeys.slice(i, i + 100)
    const { data, error } = await sb
      .from('email_events')
      .select('email_key, event, occurred_at')
      .in('email_key', chunk)
      .in('event', ['open', 'click'])
    if (error) {
      console.error('[prospecting] engagement email_events read failed:', error.message)
      continue
    }
    for (const ev of data ?? []) {
      const slug = String(ev.email_key ?? '').slice(4)
      const agg = emailAgg.get(slug) ?? { opens: 0, clicks: 0, last: null }
      if (ev.event === 'open') agg.opens++
      else agg.clicks++
      const at = ev.occurred_at as string | null
      if (at && (!agg.last || at > agg.last)) agg.last = at
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
  const viewsBySlug = new Map<string, { count: number; last: string | null }>()
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
      const agg = viewsBySlug.get(slug) ?? { count: 0, last: null }
      agg.count++
      const at = v.event_at as string | null
      if (at && (!agg.last || at > agg.last)) agg.last = at
      viewsBySlug.set(slug, agg)
    }
  }

  const result: ProspectEngagementMap = {}
  for (const k of keys) {
    const em = k.slug ? emailAgg.get(k.slug) : undefined
    const views = k.slug ? viewsBySlug.get(k.slug) : undefined
    const sms = k.personId != null ? smsClicksByPid.get(k.personId) : undefined
    const lastCandidates = [em?.last ?? null, views?.last ?? null, sms?.last ?? null].filter(
      (v): v is string => !!v,
    )
    result[k.id] = {
      reportViews: views?.count ?? 0,
      linkTaps: sms?.count ?? 0,
      emailOpens: em?.opens ?? 0,
      emailClicks: em?.clicks ?? 0,
      lastActivityAt: lastCandidates.length ? lastCandidates.sort().at(-1)! : null,
    }
  }
  return result
}

// Two module-level cached wrappers (one per kind) — unstable_cache's tags
// array is fixed at wrap time, and the two kinds need distinct invalidation
// tags (`prospecting:engagement:expired` vs `prospecting:engagement:fsbo`).
const cachedEngagementExpired = unstable_cache(computeEngagement, ['prospecting-engagement-expired-v1'], {
  revalidate: 60,
  tags: ['prospecting:engagement:expired'],
})
const cachedEngagementFsbo = unstable_cache(computeEngagement, ['prospecting-engagement-fsbo-v1'], {
  revalidate: 60,
  tags: ['prospecting:engagement:fsbo'],
})

// Generic doc-engagement cache. Same computation, its own tag — the CMA
// performance report needs per-document engagement for docs that are NOT
// prospects (a CMA built for a walk-in seller has no expired/fsbo row), so it
// cannot borrow either prospecting tag without polluting their invalidation.
const cachedEngagementDoc = unstable_cache(computeEngagement, ['doc-engagement-v1'], {
  revalidate: 60,
  tags: ['cma:engagement'],
})

/**
 * Per-document engagement for any bounded set of `/cma/<slug>` documents,
 * prospect-linked or not. Same bounded-read contract as the prospecting
 * variant: callers pass the visible page's keys, never the whole table.
 */
export async function getDocEngagement(keys: ProspectEngagementKey[]): Promise<ProspectEngagementMap> {
  if (keys.length === 0) return {}
  try {
    return await cachedEngagementDoc(keys)
  } catch (e) {
    console.error('[cma] getDocEngagement failed:', e instanceof Error ? e.message : e)
    const fallback: ProspectEngagementMap = {}
    for (const k of keys) fallback[k.id] = EMPTY_ENGAGEMENT
    return fallback
  }
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
    return await cached(keys)
  } catch (e) {
    console.error('[prospecting] getProspectEngagement failed:', e instanceof Error ? e.message : e)
    const fallback: ProspectEngagementMap = {}
    for (const k of keys) fallback[k.id] = EMPTY_ENGAGEMENT
    return fallback
  }
}

export { EMPTY_ENGAGEMENT }
