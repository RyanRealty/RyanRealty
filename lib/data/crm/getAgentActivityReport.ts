import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { fetchClosedDealsByBroker } from '@/lib/data/crm/agentActivityClosedDeals'
import type { ClosedDealsRow } from '@/lib/data/crm/agentActivityClosedDeals'
import { classifyLeadSource } from './leadSourceTaxonomy'

export type { ClosedDealsRow } from '@/lib/data/crm/agentActivityClosedDeals'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DatePreset = 'today' | 'this_week' | 'this_month' | 'this_year'

export type AgentActivityParams = {
  /** null = all brokers (superuser/Everyone view) */
  brokerSlug: string | null
  datePreset: DatePreset | 'custom'
  dateStart?: string | null  // ISO datetime, required when preset='custom'
  dateEnd?: string | null    // ISO datetime, required when preset='custom'
}

export type AgentActivityRow = {
  brokerSlug: string
  brokerName: string
  /** Path to the broker's headshot image */
  avatarUrl: string | null
  /** Genuine inbound leads created in the period currently assigned to this broker (classifyLeadSource attributable — Farm/Import/Sphere outreach rows excluded) */
  newLeads: number
  /** Approximation of Initially Assigned (no assignment history table yet) */
  initiallyAssignedLeads: number
  /** Approximation of Currently Assigned (same as new leads, V1) */
  currentlyAssignedLeads: number
  /** Calls logged by this broker in the period (kind='call') */
  calls: number
  /** Emails sent/received personally by this broker (kind IN email_out, email_in) */
  emails: number
  /** Texts sent/received personally by this broker (kind IN sms_out, sms_in) */
  texts: number
  /** Notes added by this broker (kind='note') */
  notes: number
  /** Tasks marked complete by this broker in the period */
  tasksCompleted: number
  /** Appointments CREATED by this broker (broker_slug = slug) in the period */
  appointmentsSet: number
  /** Appointments this broker is associated with (same as set, V1 — no broker-invitees table) */
  appointments: number
}

export type AgentActivityTotals = Omit<AgentActivityRow, 'brokerSlug' | 'brokerName' | 'avatarUrl'>

/** Per-day aggregate for the time-series chart and KPI sparklines */
export type TimeSeriesPoint = {
  date: string  // YYYY-MM-DD
  newLeads: number
  calls: number
  emails: number
  texts: number
  notes: number
  tasksCompleted: number
  appointmentsSet: number
  appointments: number
}

export type AgentActivityResult = {
  rows: AgentActivityRow[]
  /** Per-broker closed-deal aggregates for the alternate "Show me" view (sorted by count desc) */
  closedDeals: ClosedDealsRow[]
  /** Totals for the current period (all scoped brokers combined) */
  totals: AgentActivityTotals
  /** Totals for the immediately preceding period of equal duration (for KPI delta) */
  previousTotals: AgentActivityTotals
  /** Per-day time series for the current period (all scoped brokers combined) */
  timeSeries: TimeSeriesPoint[]
  /** Per-day time series for the previous period (for compare-to-previous overlay) */
  prevTimeSeries: TimeSeriesPoint[]
  dateStart: string
  dateEnd: string
  prevDateStart: string
  prevDateEnd: string
}

// ── Date range resolver ────────────────────────────────────────────────────────

/**
 * Convert a named preset or custom range to {start, end} ISO strings.
 * All times are in server local time (UTC on Vercel). Oregon-specific calendar
 * events are close enough for a reporting context.
 * Pure — exported for testing.
 */
export function resolveDateRange(
  preset: string,
  customStart?: string | null,
  customEnd?: string | null,
): { start: string; end: string } {
  const now = new Date()
  const endIso = now.toISOString()

  if (preset === 'custom' && customStart && customEnd) {
    return { start: customStart, end: customEnd }
  }

  if (preset === 'today') {
    const start = new Date(now)
    start.setUTCHours(0, 0, 0, 0)
    return { start: start.toISOString(), end: endIso }
  }

  if (preset === 'this_week') {
    const start = new Date(now)
    start.setUTCDate(now.getUTCDate() - now.getUTCDay())
    start.setUTCHours(0, 0, 0, 0)
    return { start: start.toISOString(), end: endIso }
  }

  if (preset === 'this_year') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
    return { start: start.toISOString(), end: endIso }
  }

  // Default: this_month
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { start: start.toISOString(), end: endIso }
}

/**
 * Compute the preceding period of equal length immediately before the given window.
 * E.g., if current = Jun 1–30 (2,592,000 s), previous = May 2–31.
 */
function resolvePreviousPeriod(start: string, end: string): { prevStart: string; prevEnd: string } {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const durationMs = endMs - startMs
  const prevEndMs = startMs - 1  // 1 ms before current period starts
  const prevStartMs = prevEndMs - durationMs
  return {
    prevStart: new Date(prevStartMs).toISOString(),
    prevEnd: new Date(prevEndMs).toISOString(),
  }
}

// ── Broker headshot map ───────────────────────────────────────────────────────

const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

// ── Timeline kind groupings ───────────────────────────────────────────────────

const CALL_KINDS = ['call', 'voicemail']
const EMAIL_KINDS = ['email_out', 'email_in']
const TEXT_KINDS = ['sms_out', 'sms_in']
const NOTE_KINDS = ['note']
const ALL_ACTIVITY_KINDS = [...CALL_KINDS, ...EMAIL_KINDS, ...TEXT_KINDS, ...NOTE_KINDS]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Whether an ISO timestamp falls within [start, end] (string comparison is safe for ISO 8601). */
function inRange(ts: string, start: string, end: string): boolean {
  return ts >= start && ts <= end
}

const EMPTY_TOTALS: AgentActivityTotals = {
  newLeads: 0, initiallyAssignedLeads: 0, currentlyAssignedLeads: 0,
  calls: 0, emails: 0, texts: 0, notes: 0,
  tasksCompleted: 0, appointmentsSet: 0, appointments: 0,
}

/**
 * Build a per-day TimeSeriesPoint[] for the given period from pre-fetched raw data.
 * Only events with timestamps in [rangeStart, rangeEnd] are counted.
 * Note: raw rows may be capped at the Supabase max_rows limit; the time series
 * reflects the shape of available data (not exact per-day totals for high-volume periods).
 *
 * `leads` are genuine lead_created timeline events (kind='lead_created'), keyed on
 * their `ts` column — NOT crm_people rows keyed on `created_at` (which reflects the
 * bulk-import date and would spike the entire year with the import artifact).
 */
function buildTimeSeries(
  timelineEvents: Array<{ ts: string; kind: string }>,
  leads: Array<{ ts: string }>,
  tasks: Array<{ completed_at: string | null }>,
  appts: Array<{ start_at: string }>,
  rangeStart: string,
  rangeEnd: string,
): TimeSeriesPoint[] {
  // Initialise a map entry for every calendar day in the range
  const points = new Map<string, TimeSeriesPoint>()

  const startD = new Date(rangeStart)
  const endD = new Date(rangeEnd)
  // Normalise to UTC midnight so date arithmetic is stable
  const cur = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), startD.getUTCDate()))
  const endDay = new Date(Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth(), endD.getUTCDate()))

  while (cur <= endDay) {
    const key = cur.toISOString().slice(0, 10)
    points.set(key, {
      date: key,
      newLeads: 0, calls: 0, emails: 0, texts: 0,
      notes: 0, tasksCompleted: 0, appointmentsSet: 0, appointments: 0,
    })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  for (const ev of timelineEvents) {
    if (!inRange(ev.ts, rangeStart, rangeEnd)) continue
    const day = ev.ts.slice(0, 10)
    const p = points.get(day)
    if (!p) continue
    if (CALL_KINDS.includes(ev.kind)) p.calls++
    else if (EMAIL_KINDS.includes(ev.kind)) p.emails++
    else if (TEXT_KINDS.includes(ev.kind)) p.texts++
    else if (NOTE_KINDS.includes(ev.kind)) p.notes++
  }

  for (const lead of leads) {
    if (!inRange(lead.ts, rangeStart, rangeEnd)) continue
    const day = lead.ts.slice(0, 10)
    const p = points.get(day)
    if (p) p.newLeads++
  }

  for (const task of tasks) {
    if (!task.completed_at || !inRange(task.completed_at, rangeStart, rangeEnd)) continue
    const day = task.completed_at.slice(0, 10)
    const p = points.get(day)
    if (p) p.tasksCompleted++
  }

  for (const appt of appts) {
    if (!inRange(appt.start_at, rangeStart, rangeEnd)) continue
    const day = appt.start_at.slice(0, 10)
    const p = points.get(day)
    if (p) { p.appointmentsSet++; p.appointments++ }
  }

  return Array.from(points.values())
}

// ── Inbound lead events (taxonomy-filtered) ────────────────────────────────────

/**
 * Fetch the window's lead_created events with the owning contact's CURRENT
 * source + assigned broker, then keep only genuine inbound leads
 * (classifyLeadSource attributable — web/portal/phone/social/referral).
 * Farm/Import/Sphere/Expired/FSBO outreach rows are lists we built, never
 * leads — the lead_created trigger fires on EVERY crm_people insert, so a raw
 * COUNT includes the ~14.5k Farm + Import + Sphere rows and overcounts by
 * orders of magnitude versus the broker dashboard (see getLeadIntake and
 * getOverviewReport for the shared canonical definition).
 *
 * Classification is keyword-based JS, so it cannot be pushed into PostgREST —
 * we page the rows (1000-row server cap, stable order) and filter in app code,
 * exactly like getOverviewReport's fetchInboundLeadEvents. The join returns
 * assigned_broker so ONE paged fetch serves both the per-broker breakdown and
 * the combined totals/sparklines.
 */
async function fetchInboundLeadEvents(
  sb: ReturnType<typeof createServiceClient>,
  brokerSlugs: string[],
  rangeStart: string,
  rangeEnd: string,
): Promise<Array<{ ts: string; broker: string | null }>> {
  type EventRow = {
    ts: string
    crm_people: { assigned_broker: string | null; source: string | null } | Array<{ assigned_broker: string | null; source: string | null }> | null
  }
  const inbound: Array<{ ts: string; broker: string | null }> = []
  const PAGE = 1000
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data, error } = await sb
      .from('crm_timeline')
      .select('ts, crm_people!inner(assigned_broker, source)')
      .eq('kind', 'lead_created')
      .in('crm_people.assigned_broker', brokerSlugs)
      .gte('ts', rangeStart)
      .lte('ts', rangeEnd)
      .order('ts', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[getAgentActivityReport] lead_created page error', error.message)
      break
    }
    const page = (data ?? []) as unknown as EventRow[]
    for (const row of page) {
      const person = Array.isArray(row.crm_people) ? row.crm_people[0] : row.crm_people
      if (classifyLeadSource(person?.source ?? null).attributable) {
        inbound.push({ ts: row.ts, broker: person?.assigned_broker ?? null })
      }
    }
    if (page.length < PAGE) break
  }
  return inbound
}

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readAgentActivity(params: AgentActivityParams): Promise<AgentActivityResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(params.datePreset, params.dateStart, params.dateEnd)
  const { prevStart, prevEnd } = resolvePreviousPeriod(start, end)

  // 1. Broker roster — only CRM-active brokers with a crm_slug
  const { data: brokerRows, error: brokerError } = await sb
    .from('brokers')
    .select('crm_slug,display_name,photo_url')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)
    .order('sort_order', { ascending: true })

  if (brokerError) console.error('[getAgentActivityReport] brokers error', brokerError.message)

  const allBrokers = (brokerRows ?? []).filter((b) => b.crm_slug) as Array<{
    crm_slug: string
    display_name: string | null
    photo_url: string | null
  }>

  // 2. Scope: which broker slugs to include
  const scopedBrokers = params.brokerSlug
    ? allBrokers.filter((b) => b.crm_slug === params.brokerSlug)
    : allBrokers

  const brokerSlugs = scopedBrokers.map((b) => b.crm_slug)

  if (brokerSlugs.length === 0) {
    return {
      rows: [],
      closedDeals: [],
      totals: { ...EMPTY_TOTALS },
      previousTotals: { ...EMPTY_TOTALS },
      timeSeries: [],
      prevTimeSeries: [],
      dateStart: start,
      dateEnd: end,
      prevDateStart: prevStart,
      prevDateEnd: prevEnd,
    }
  }

  // 3. All queries run in maximum parallelism via five independent groups.
  //
  //    Leads    — inbound lead_created events, current + previous windows.
  //               Paged rows classified via leadSourceTaxonomy: a raw COUNT
  //               would include the bulk Farm/Import/Sphere outreach rows
  //               (see fetchInboundLeadEvents). Serves the per-broker
  //               breakdown, both totals, and both sparklines.
  //
  //    Group A — 6 COUNT-only activity queries for the PREVIOUS period totals.
  //              Uses { count: 'exact', head: true } so Supabase returns the real
  //              database COUNT(*) in the response header — never capped by max_rows.
  //
  //    Group B — Per-broker COUNT-only activity queries for the CURRENT period.
  //              Up to 3 brokers × 6 metrics = 18 queries, all run in parallel.
  //              Gives exact per-broker values for the breakdown table; totals
  //              are derived by summing across brokers.
  //
  //    Group C — Raw-row queries for the CURRENT period time series (sparklines + chart).
  //              Rows may be capped by the Supabase max_rows setting; these give
  //              sparkline shape, not exact per-day totals on high-volume periods.
  //
  //    Group D — Raw-row queries for the PREVIOUS period time series (compare overlay).
  //
  const [
    curInboundLeads,
    prevInboundLeads,
    prevTotalsGroup,
    perBrokerGroup,
    curTsGroup,
    prevTsGroup,
    closedDeals,
  ] = await Promise.all([

    // ── Inbound lead events (taxonomy-filtered, paged) ──────────────────────
    fetchInboundLeadEvents(sb, brokerSlugs, start, end),
    fetchInboundLeadEvents(sb, brokerSlugs, prevStart, prevEnd),

    // ── Group A: Previous period activity totals (6 COUNT queries) ──────────
    Promise.all([
      // a1: calls (previous)
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', CALL_KINDS).neq('source', 'sequence')
        .gte('ts', prevStart).lte('ts', prevEnd),
      // a2: emails (previous)
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', EMAIL_KINDS).neq('source', 'sequence')
        .gte('ts', prevStart).lte('ts', prevEnd),
      // a3: texts (previous)
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', TEXT_KINDS).neq('source', 'sequence')
        .gte('ts', prevStart).lte('ts', prevEnd),
      // a4: notes (previous)
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', NOTE_KINDS).neq('source', 'sequence')
        .gte('ts', prevStart).lte('ts', prevEnd),
      // a5: tasks completed (previous)
      sb.from('crm_tasks').select('id', { count: 'exact', head: true })
        .in('assigned_broker', brokerSlugs)
        .gte('completed_at', prevStart).lte('completed_at', prevEnd),
      // a6: appointments (previous)
      sb.from('crm_appointments').select('id', { count: 'exact', head: true })
        .in('broker_slug', brokerSlugs).not('person_id', 'is', null)
        .gte('start_at', prevStart).lte('start_at', prevEnd),
    ] as const),

    // ── Group B: Per-broker current period activity counts ─────────────────
    // (per-broker newLeads come from curInboundLeads above — the joined
    //  assigned_broker is on every classified event row)
    Promise.all(
      scopedBrokers.map((b) => {
        const slug = b.crm_slug
        return Promise.all([
          // b1: calls
          sb.from('crm_timeline').select('id', { count: 'exact', head: true })
            .eq('broker', slug).in('kind', CALL_KINDS).neq('source', 'sequence')
            .gte('ts', start).lte('ts', end),
          // b2: emails
          sb.from('crm_timeline').select('id', { count: 'exact', head: true })
            .eq('broker', slug).in('kind', EMAIL_KINDS).neq('source', 'sequence')
            .gte('ts', start).lte('ts', end),
          // b3: texts
          sb.from('crm_timeline').select('id', { count: 'exact', head: true })
            .eq('broker', slug).in('kind', TEXT_KINDS).neq('source', 'sequence')
            .gte('ts', start).lte('ts', end),
          // b4: notes
          sb.from('crm_timeline').select('id', { count: 'exact', head: true })
            .eq('broker', slug).in('kind', NOTE_KINDS).neq('source', 'sequence')
            .gte('ts', start).lte('ts', end),
          // b5: tasks completed
          sb.from('crm_tasks').select('id', { count: 'exact', head: true })
            .eq('assigned_broker', slug)
            .gte('completed_at', start).lte('completed_at', end),
          // b6: appointments
          sb.from('crm_appointments').select('id', { count: 'exact', head: true })
            .eq('broker_slug', slug).not('person_id', 'is', null)
            .gte('start_at', start).lte('start_at', end),
        ] as const)
      })
    ),

    // ── Group C: Current period raw rows for sparklines + chart ───────────
    // (newLeads sparkline rows come from curInboundLeads above — already
    //  paged + inbound-only)
    Promise.all([
      sb.from('crm_timeline').select('ts,kind,broker')
        .in('broker', brokerSlugs).in('kind', ALL_ACTIVITY_KINDS)
        .neq('source', 'sequence').gte('ts', start).lte('ts', end),
      sb.from('crm_tasks').select('completed_at,assigned_broker')
        .in('assigned_broker', brokerSlugs)
        .gte('completed_at', start).lte('completed_at', end),
      sb.from('crm_appointments').select('start_at,broker_slug')
        .in('broker_slug', brokerSlugs).not('person_id', 'is', null)
        .gte('start_at', start).lte('start_at', end),
    ] as const),

    // ── Group D: Previous period raw rows for compare overlay ─────────────
    // (prev newLeads sparkline rows come from prevInboundLeads above)
    Promise.all([
      sb.from('crm_timeline').select('ts,kind,broker')
        .in('broker', brokerSlugs).in('kind', ALL_ACTIVITY_KINDS)
        .neq('source', 'sequence').gte('ts', prevStart).lte('ts', prevEnd),
      sb.from('crm_tasks').select('completed_at,assigned_broker')
        .in('assigned_broker', brokerSlugs)
        .gte('completed_at', prevStart).lte('completed_at', prevEnd),
      sb.from('crm_appointments').select('start_at,broker_slug')
        .in('broker_slug', brokerSlugs).not('person_id', 'is', null)
        .gte('start_at', prevStart).lte('start_at', prevEnd),
    ] as const),

    // ── Group E: Closed deals per broker (for the "closed deals" alternate view) ──
    fetchClosedDealsByBroker(
      scopedBrokers.map((b) => ({
        slug: b.crm_slug,
        name: b.display_name ?? b.crm_slug,
        avatarUrl: BROKER_HEADSHOT[b.crm_slug] ?? b.photo_url ?? null,
      })),
      start,
      end,
    ),
  ])

  // 4. Unpack previous-period totals (activity from count queries — exact values;
  //    newLeads from the paged, taxonomy-classified event rows)
  const [
    { count: prevCallsCount },
    { count: prevEmailsCount },
    { count: prevTextsCount },
    { count: prevNotesCount },
    { count: prevTasksCount },
    { count: prevApptsCount },
  ] = prevTotalsGroup

  const previousTotals: AgentActivityTotals = {
    newLeads: prevInboundLeads.length,
    initiallyAssignedLeads: prevInboundLeads.length,
    currentlyAssignedLeads: prevInboundLeads.length,
    calls: prevCallsCount ?? 0,
    emails: prevEmailsCount ?? 0,
    texts: prevTextsCount ?? 0,
    notes: prevNotesCount ?? 0,
    tasksCompleted: prevTasksCount ?? 0,
    appointmentsSet: prevApptsCount ?? 0,
    appointments: prevApptsCount ?? 0,
  }

  // 5. Build per-broker rows — activity from count results (exact, not capped);
  //    newLeads from the classified inbound events, grouped by assigned broker.
  const curInboundByBroker = new Map<string, number>()
  for (const ev of curInboundLeads) {
    if (ev.broker) curInboundByBroker.set(ev.broker, (curInboundByBroker.get(ev.broker) ?? 0) + 1)
  }

  const rows: AgentActivityRow[] = scopedBrokers.map((b, i) => {
    const [
      { count: callsCnt },
      { count: emailsCnt },
      { count: textsCnt },
      { count: notesCnt },
      { count: tasksCnt },
      { count: apptsCnt },
    ] = perBrokerGroup[i]

    const newLeads = curInboundByBroker.get(b.crm_slug) ?? 0
    const apptsSet = apptsCnt ?? 0

    return {
      brokerSlug: b.crm_slug,
      brokerName: b.display_name ?? b.crm_slug,
      avatarUrl: BROKER_HEADSHOT[b.crm_slug] ?? b.photo_url ?? null,
      newLeads,
      initiallyAssignedLeads: newLeads,
      currentlyAssignedLeads: newLeads,
      calls: callsCnt ?? 0,
      emails: emailsCnt ?? 0,
      texts: textsCnt ?? 0,
      notes: notesCnt ?? 0,
      tasksCompleted: tasksCnt ?? 0,
      appointmentsSet: apptsSet,
      appointments: apptsSet,
    }
  })

  // 6. Current period totals — sum per-broker rows (exact because count queries)
  const totals: AgentActivityTotals = rows.reduce(
    (acc, r) => ({
      newLeads: acc.newLeads + r.newLeads,
      initiallyAssignedLeads: acc.initiallyAssignedLeads + r.initiallyAssignedLeads,
      currentlyAssignedLeads: acc.currentlyAssignedLeads + r.currentlyAssignedLeads,
      calls: acc.calls + r.calls,
      emails: acc.emails + r.emails,
      texts: acc.texts + r.texts,
      notes: acc.notes + r.notes,
      tasksCompleted: acc.tasksCompleted + r.tasksCompleted,
      appointmentsSet: acc.appointmentsSet + r.appointmentsSet,
      appointments: acc.appointments + r.appointments,
    }),
    { ...EMPTY_TOTALS },
  )

  // 7. Build time series from raw rows (for sparkline shape and chart).
  //    Lead sparkline rows are the classified inbound events fetched above.
  const [curTimelineRes, curTasksRes, curApptsRes] = curTsGroup
  const [prevTimelineRes, prevTasksRes, prevApptsRes] = prevTsGroup

  const curTimeline = (curTimelineRes.data ?? []) as Array<{ ts: string; kind: string; broker: string | null }>
  const curTasks = (curTasksRes.data ?? []) as Array<{ completed_at: string | null; assigned_broker: string | null }>
  const curAppts = (curApptsRes.data ?? []) as Array<{ start_at: string; broker_slug: string | null }>

  const prevTimeline = (prevTimelineRes.data ?? []) as Array<{ ts: string; kind: string; broker: string | null }>
  const prevTasks = (prevTasksRes.data ?? []) as Array<{ completed_at: string | null; assigned_broker: string | null }>
  const prevAppts = (prevApptsRes.data ?? []) as Array<{ start_at: string; broker_slug: string | null }>

  const timeSeries = buildTimeSeries(curTimeline, curInboundLeads, curTasks, curAppts, start, end)
  const prevTimeSeries = buildTimeSeries(prevTimeline, prevInboundLeads, prevTasks, prevAppts, prevStart, prevEnd)

  return {
    rows,
    closedDeals,
    totals,
    previousTotals,
    timeSeries,
    prevTimeSeries,
    dateStart: start,
    dateEnd: end,
    prevDateStart: prevStart,
    prevDateEnd: prevEnd,
  }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Agent Activity report data — aggregate per-broker counts over a date range.
 * Cached 10 minutes to match FUB's documented cache TTL for reporting.
 * Cache is keyed on the filter params so different filter combos get separate
 * cache entries.
 *
 * Source tables:
 *   - crm_timeline (kind='lead_created' for new leads, filtered by ts; join to crm_people
 *                  for broker scoping + source — NOT crm_people.created_at, which is the
 *                  bulk-import date)
 *   - crm_timeline (calls/emails/texts/notes, filtered by ts + broker + kind)
 *   - crm_tasks (tasks completed, filtered by completed_at + assigned_broker)
 *   - crm_appointments (appointments, filtered by start_at + broker_slug)
 *   - crm_deals + crm_deal_stages (closed deals + commission for the alternate
 *     "Show me → which team member has closed the most deals" view)
 *
 * Count approach (Defect 1 fix — 2026-07-01):
 *   All activity KPI aggregate totals and per-broker breakdown values use
 *   { count: 'exact', head: true } queries that return the real database
 *   COUNT(*) via the Content-Range response header.  This bypasses the
 *   Supabase max_rows limit (default 1000) that previously caused every
 *   count > 1000 to report exactly "1,000".  Raw-row queries are retained
 *   only for the sparkline / chart time-series shape.
 *
 * newLeads (taxonomy fix — 2026-07-14):
 *   Paged lead_created events classified through leadSourceTaxonomy (inbound
 *   sources only, matching getLeadIntake + getOverviewReport). The
 *   lead_created trigger fires on every crm_people insert, so a raw COUNT
 *   would include the bulk Farm/Import/Sphere/Expired/FSBO outreach rows and
 *   overcount versus the broker dashboard. Pagination uses .range() with a
 *   stable order until a short read — never a single 1000-capped read.
 *
 * V1 approximations (documented):
 *   - initiallyAssignedLeads = newLeads (no crm_lead_assignments history table yet)
 *   - currentlyAssignedLeads = newLeads (same)
 *   - appointments = appointmentsSet (no per-broker invitees table yet)
 *   - Personal 1:1 filter: excludes source='sequence'; cannot distinguish
 *     personal_1to1 vs automated_marketing without a communication_type column
 */
export async function getAgentActivityReport(
  params: AgentActivityParams,
): Promise<AgentActivityResult> {
  const cached = unstable_cache(
    () => readAgentActivity(params),
    [
      // v6: newLeads switched from raw lead_created counts to the
      // taxonomy-filtered inbound definition (2026-07-14).
      'crm-agent-activity-v6',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-agent-activity', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
