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

export async function getDashboardKpis(brokerSlug: string | null, unactioned: number): Promise<DashboardKpis> {
  const nowMs = new Date().getTime()
  const iso = (ms: number) => new Date(ms).toISOString()
  const [d30, d7] = await Promise.all([
    getLeadIntake({ startIso: iso(nowMs - 30 * 86_400_000), endIso: iso(nowMs), brokerSlug }),
    getLeadIntake({ startIso: iso(nowMs - 7 * 86_400_000), endIso: iso(nowMs), brokerSlug }),
  ])
  return { newLeads30d: d30.inboundLeads, newLeads7d: d7.inboundLeads, unactioned }
}
