import 'server-only'
import { unstable_cache } from '@/lib/data/cache/next-cache'
import { createServiceClient } from '@/lib/supabase/service'
import {
  classifyLeadSource,
  CHANNEL_LABEL,
  type LeadChannel,
} from './leadSourceTaxonomy'
import { classifyCaptureDoor, type CaptureDoorId } from '@/lib/data/analytics/captureDoors'

/**
 * getLeadIntake — the single source of truth for "how many leads did we get" on
 * every marketing dashboard (analytics, reports, lead-flow).
 *
 * Reads native `crm_people` (the system of record since the CRM cutover) over a
 * date range and classifies each row's `source` via leadSourceTaxonomy. The key
 * accuracy move: it separates genuine INBOUND leads (web/portal/phone/social/
 * referral) from OUTREACH LISTS we built ourselves (Farm/Import/Sphere/Expired/
 * FSBO). A dashboard that counts all crm_people rows as leads is off by ~500×
 * because bulk prospecting imports dwarf real inbound volume.
 *
 * This function replaced every `marketing_assignments` read on the dashboards.
 * `marketing_assignments` was the CRM-era attribution ledger; it stopped being
 * written at the 2026-06-24 CRM cutover and its dashboard queries filtered on a
 * non-existent `created_at` column, so those numbers were always 0/stale.
 *
 * DAL boundary (G1): the raw crm_people read lives here. Pages the five needed
 * columns (id, name, source, assigned_broker, created_at) — NEVER trusts
 * rows.length for termination beyond the short-read check (PostgREST 1000-row
 * cap). Cached 10 min to match the reporting TTL used across the CRM DAL.
 *
 * byDoor and recent (2026-10-14, the Website view of /admin/analytics) are the
 * same inbound rows read two more ways: by the form or path that created the
 * person (classifyCaptureDoor, the funnel's one door catalog) and newest first
 * with the person id, so every row can open /admin/crm/[id].
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
  /** Inbound leads by the form or path that created them, descending count. */
  byDoor: { door: CaptureDoorId; label: string; count: number }[]
  /** The newest inbound leads (at most RECENT_CAP), newest first. */
  recent: LeadIntakeRecent[]
  /** True when crm_people could not be read (dashboard shows a degraded tile). */
  unreadable: boolean
}

export type LeadIntakeRecent = {
  id: number
  /** crm_people.name as stored; null when the person has none. */
  name: string | null
  createdAt: string
  source: string | null
  channelLabel: string
  doorLabel: string
  /** assigned_broker slug, lower-cased; 'unassigned' when empty. */
  broker: string
}

const RECENT_CAP = 25

type Row = {
  id: number
  name: string | null
  source: string | null
  assigned_broker: string | null
  created_at: string
}

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
    byDoor: [],
    recent: [],
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
      .select('id, name, source, assigned_broker, created_at')
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
  const doorAgg = new Map<CaptureDoorId, { label: string; count: number }>()
  const inboundRows: Array<{ row: Row; channelLabel: string; doorLabel: string; broker: string }> = []
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
      // door (inbound only): which form or path created the person
      const door = classifyCaptureDoor(r.source)
      const dd = doorAgg.get(door.id) ?? { label: door.label, count: 0 }
      dd.count += 1
      doorAgg.set(door.id, dd)
      inboundRows.push({ row: r, channelLabel: CHANNEL_LABEL[cls.channel], doorLabel: door.label, broker: b })
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

  const byDoor = Array.from(doorAgg.entries())
    .map(([door, v]) => ({ door, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count)

  // Rows arrive oldest first (the paged read orders by created_at ascending).
  const recent: LeadIntakeRecent[] = inboundRows
    .slice(-RECENT_CAP)
    .reverse()
    .map(({ row, channelLabel, doorLabel, broker }) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      source: row.source,
      channelLabel,
      doorLabel,
      broker,
    }))

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
    byDoor,
    recent,
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
    ['crm-lead-intake-v2', input.startIso, input.endIso, input.brokerSlug ?? 'all'],
    { tags: ['crm-lead-intake', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
