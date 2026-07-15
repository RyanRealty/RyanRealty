import 'server-only'
import { getLeadIntake } from './getLeadIntake'

/**
 * Real, verifiable KPI counts for the broker dashboard. Only numbers we can
 * actually compute from our data — no fabricated analytics (the data-accuracy
 * mandate forbids made-up figures).
 *
 * "New leads" = genuine INBOUND leads (web/portal/phone/social/referral) via
 * getLeadIntake — the single source of truth shared with /admin/analytics. This
 * is the fix for the long-standing overcount: the prior implementation counted
 * `crm_timeline.lead_created` events, which INCLUDE the ~14.5k Farm bulk import
 * (+ Import/Sphere), so the KPI read ~4,600 when real inbound was a few dozen.
 * Prospecting/import lists are lists we built, not leads, so they never count.
 */
export type DashboardKpis = {
  /** Genuine inbound leads created in the last 30 days (imports excluded). */
  newLeads30d: number
  /** Same, last 7 days — powers the "N this week" trend line. */
  newLeads7d: number
  /** Automated follow-ups paused and awaiting the broker's approval. */
  unactioned: number
}

/** Matches the 600s revalidate on getLeadIntake's unstable_cache. */
const TEN_MIN_MS = 600_000

export async function getDashboardKpis(brokerSlug: string | null, unactioned: number): Promise<DashboardKpis> {
  // Snap the window to 10-minute buckets: getLeadIntake's unstable_cache key
  // includes the ISO bounds, so millisecond-precision now() gave every
  // force-dynamic dashboard render a unique key and a guaranteed cache miss
  // (a full crm_people re-pagination per render). Rounding the end bound UP
  // is harmless — lte with a slightly-future bound still returns rows up to
  // now, and 10 minutes is the staleness the cache already accepts.
  const endMs = Math.ceil(Date.now() / TEN_MIN_MS) * TEN_MIN_MS
  const startMs = endMs - 30 * 86_400_000
  const intake = await getLeadIntake({
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    brokerSlug,
  })
  // The 7-day trend derives from the same read's per-day series (calendar-day
  // granularity) instead of paying a second full crm_people pagination.
  const weekFloor = new Date(endMs - 7 * 86_400_000).toISOString().slice(0, 10)
  const newLeads7d = intake.byDay
    .filter((d) => d.date >= weekFloor)
    .reduce((sum, d) => sum + d.inbound, 0)
  return { newLeads30d: intake.inboundLeads, newLeads7d, unactioned }
}
