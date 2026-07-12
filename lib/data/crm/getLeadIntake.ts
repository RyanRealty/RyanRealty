import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import {
  classifyLeadSource,
  CHANNEL_LABEL,
  type LeadChannel,
} from './leadSourceTaxonomy'

/**
 * getLeadIntake — the single source of truth for "how many leads did we get" on
 * every marketing dashboard (analytics, reports, lead-flow).
 *
 * Reads native `crm_people` (the system of record since the FUB cutover) over a
 * date range and classifies each row's `source` via leadSourceTaxonomy. The key
 * accuracy move: it separates genuine INBOUND leads (web/portal/phone/social/
 * referral) from OUTREACH LISTS we built ourselves (Farm/Import/Sphere/Expired/
 * FSBO). A dashboard that counts all crm_people rows as leads is off by ~500×
 * because bulk prospecting imports dwarf real inbound volume.
 *
 * This function replaced every `marketing_assignments` read on the dashboards.
 * `marketing_assignments` was the FUB-era attribution ledger; it stopped being
 * written at the 2026-06-24 FUB cutover and its dashboard queries filtered on a
 * non-existent `created_at` column, so those numbers were always 0/stale.
 *
 * DAL boundary (G1): the raw crm_people read lives here. Pages the three needed
 * columns (source, assigned_broker, created_at) — NEVER trusts rows.length for
 * termination beyond the short-read check (PostgREST 1000-row cap). Cached 10
 * min to match the reporting TTL used across the CRM DAL.
 */

export type LeadIntakeInput = {
  /** Inclusive ISO start (e.g. '2026-06-12T00:00:00Z'). */
  startIso: string
  /** Inclusive ISO end (e.g. '2026-07-12T23:59:59Z'). */
  endIso: string
  /** Optional broker slug filter (attributable metrics only). */
  brokerSlug?: string | null
}

export type LeadIntakeChannel = {
  channel: LeadChannel
  label: string
  count: number
  attributable: boolean
}

export type LeadIntake = {
  startIso: string
  endIso: string
  /** All crm_people rows created in the window, including bulk imports. */
  totalRows: number
  /** Genuine inbound/direct leads (web/portal/phone/social/referral). */
  inboundLeads: number
  /** Rows added from outreach lists (prospecting + bulk import). Not leads. */
  outreachAdded: number
  /** Per-channel breakdown, attributable channels first, descending count. */
  byChannel: LeadIntakeChannel[]
  /** Top raw sources among inbound leads, descending count. */
  bySource: { source: string; channel: LeadChannel; count: number }[]
  /** Inbound leads by assigned broker, descending count. */
  byBroker: { broker: string; count: number }[]
  /** Per-day inbound vs outreach counts (ascending date). */
  byDay: { date: string; inbound: number; outreach: number }[]
  /** True when crm_people could not be read (dashboard shows a degraded tile). */
  unreadable: boolean
}

type Row = { source: string | null; assigned_broker: string | null; created_at: string }

function emptyIntake(startIso: string, endIso: string, unreadable: boolean): LeadIntake {
  return {
    startIso,
    endIso,
    totalRows: 0,
    inboundLeads: 0,
    outreachAdded: 0,
    byChannel: [],
    bySource: [],
    byBroker: [],
    byDay: [],
    unreadable,
  }
}

async function readLeadIntake(input: LeadIntakeInput): Promise<LeadIntake> {
  const { startIso, endIso, brokerSlug } = input
  const sb = createServiceClient()
  const rows: Row[] = []
  const PAGE = 1000
  for (let from = 0; from < 200_000; from += PAGE) {
    let q = sb
      .from('crm_people')
      .select('source, assigned_broker, created_at')
      .eq('deleted', false)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (brokerSlug) q = q.eq('assigned_broker', brokerSlug)
    const { data, error } = await q
    if (error) {
      console.error('[getLeadIntake]', error.message)
      return emptyIntake(startIso, endIso, true)
    }
    const page = (data ?? []) as Row[]
    rows.push(...page)
    if (page.length < PAGE) break
  }

  const channelAgg = new Map<LeadChannel, { count: number; attributable: boolean }>()
  const sourceAgg = new Map<string, { channel: LeadChannel; count: number }>()
  const brokerAgg = new Map<string, number>()
  const dayAgg = new Map<string, { inbound: number; outreach: number }>()
  let inboundLeads = 0
  let outreachAdded = 0

  for (const r of rows) {
    const cls = classifyLeadSource(r.source)
    // channel
    const ch = channelAgg.get(cls.channel) ?? { count: 0, attributable: cls.attributable }
    ch.count += 1
    channelAgg.set(cls.channel, ch)
    // day
    const day = r.created_at.slice(0, 10)
    const d = dayAgg.get(day) ?? { inbound: 0, outreach: 0 }
    if (cls.attributable) {
      inboundLeads += 1
      d.inbound += 1
      // source (inbound only — outreach sources are lists, not lead sources)
      const key = (r.source ?? '(unspecified)').trim() || '(unspecified)'
      const s = sourceAgg.get(key) ?? { channel: cls.channel, count: 0 }
      s.count += 1
      sourceAgg.set(key, s)
      // broker (inbound only)
      const b = (r.assigned_broker ?? 'unassigned').trim().toLowerCase() || 'unassigned'
      brokerAgg.set(b, (brokerAgg.get(b) ?? 0) + 1)
    } else if (cls.outreachList) {
      outreachAdded += 1
      d.outreach += 1
    }
    dayAgg.set(day, d)
  }

  const byChannel = Array.from(channelAgg.entries())
    .map(([channel, v]) => ({
      channel,
      label: CHANNEL_LABEL[channel],
      count: v.count,
      attributable: v.attributable,
    }))
    .sort((a, b) => {
      if (a.attributable !== b.attributable) return a.attributable ? -1 : 1
      return b.count - a.count
    })

  const bySource = Array.from(sourceAgg.entries())
    .map(([source, v]) => ({ source, channel: v.channel, count: v.count }))
    .sort((a, b) => b.count - a.count)

  const byBroker = Array.from(brokerAgg.entries())
    .map(([broker, count]) => ({ broker, count }))
    .sort((a, b) => b.count - a.count)

  const byDay = Array.from(dayAgg.entries())
    .map(([date, v]) => ({ date, inbound: v.inbound, outreach: v.outreach }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    startIso,
    endIso,
    totalRows: rows.length,
    inboundLeads,
    outreachAdded,
    byChannel,
    bySource,
    byBroker,
    byDay,
    unreadable: false,
  }
}

/**
 * Cached public API. 10-minute TTL, tagged so a lead-capture write can bust it
 * (tags: 'crm-lead-intake', 'crm-reporting').
 */
export async function getLeadIntake(input: LeadIntakeInput): Promise<LeadIntake> {
  const cached = unstable_cache(
    () => readLeadIntake(input),
    ['crm-lead-intake-v1', input.startIso, input.endIso, input.brokerSlug ?? 'all'],
    { tags: ['crm-lead-intake', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
