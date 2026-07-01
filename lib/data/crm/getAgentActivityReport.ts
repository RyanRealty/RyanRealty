import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'

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
  /** Leads created in the period currently assigned to this broker */
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

  // 3. All queries run in maximum parallelism via four independent groups.
  //
  //    Group A — 7 COUNT-only queries for the PREVIOUS period totals.
  //              Uses { count: 'exact', head: true } so Supabase returns the real
  //              database COUNT(*) in the response header — never capped by max_rows.
  //
  //    Group B — Per-broker COUNT-only queries for the CURRENT period.
  //              Up to 3 brokers × 7 metrics = 21 queries, all run in parallel.
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
    prevTotalsGroup,
    perBrokerGroup,
    curTsGroup,
    prevTsGroup,
  ] = await Promise.all([

    // ── Group A: Previous period totals (7 COUNT queries) ──────────────────
    Promise.all([
      // a0: new leads (previous) — genuine lead_created events, NOT crm_people.created_at
      //     (crm_people.created_at reflects the bulk-import date, not real lead flow)
      sb.from('crm_timeline').select('id, crm_people!inner(assigned_broker)', { count: 'exact', head: true })
        .eq('kind', 'lead_created')
        .in('crm_people.assigned_broker', brokerSlugs)
        .gte('ts', prevStart).lte('ts', prevEnd),
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

    // ── Group B: Per-broker current period counts ──────────────────────────
    Promise.all(
      scopedBrokers.map((b) => {
        const slug = b.crm_slug
        return Promise.all([
          // b0: new leads — genuine lead_created events (ts in range, broker via join)
          sb.from('crm_timeline').select('id, crm_people!inner(assigned_broker)', { count: 'exact', head: true })
            .eq('kind', 'lead_created')
            .eq('crm_people.assigned_broker', slug)
            .gte('ts', start).lte('ts', end),
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
    Promise.all([
      // Genuine lead_created events for the newLeads sparkline (join needed for broker filter)
      sb.from('crm_timeline').select('ts, crm_people!inner(assigned_broker)')
        .eq('kind', 'lead_created')
        .in('crm_people.assigned_broker', brokerSlugs)
        .gte('ts', start).lte('ts', end),
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
    Promise.all([
      // Genuine lead_created events for the previous-period newLeads sparkline
      sb.from('crm_timeline').select('ts, crm_people!inner(assigned_broker)')
        .eq('kind', 'lead_created')
        .in('crm_people.assigned_broker', brokerSlugs)
        .gte('ts', prevStart).lte('ts', prevEnd),
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
  ])

  // 4. Unpack previous-period totals (from count queries — exact values)
  const [
    { count: prevNewLeadsCount },
    { count: prevCallsCount },
    { count: prevEmailsCount },
    { count: prevTextsCount },
    { count: prevNotesCount },
    { count: prevTasksCount },
    { count: prevApptsCount },
  ] = prevTotalsGroup

  const previousTotals: AgentActivityTotals = {
    newLeads: prevNewLeadsCount ?? 0,
    initiallyAssignedLeads: prevNewLeadsCount ?? 0,
    currentlyAssignedLeads: prevNewLeadsCount ?? 0,
    calls: prevCallsCount ?? 0,
    emails: prevEmailsCount ?? 0,
    texts: prevTextsCount ?? 0,
    notes: prevNotesCount ?? 0,
    tasksCompleted: prevTasksCount ?? 0,
    appointmentsSet: prevApptsCount ?? 0,
    appointments: prevApptsCount ?? 0,
  }

  // 5. Build per-broker rows from count results (exact, not capped)
  const rows: AgentActivityRow[] = scopedBrokers.map((b, i) => {
    const [
      { count: newLeadsCnt },
      { count: callsCnt },
      { count: emailsCnt },
      { count: textsCnt },
      { count: notesCnt },
      { count: tasksCnt },
      { count: apptsCnt },
    ] = perBrokerGroup[i]

    const newLeads = newLeadsCnt ?? 0
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

  // 7. Build time series from raw rows (for sparkline shape and chart)
  const [curLeadsRes, curTimelineRes, curTasksRes, curApptsRes] = curTsGroup
  const [prevLeadsRes, prevTimelineRes, prevTasksRes, prevApptsRes] = prevTsGroup

  // lead_created timeline events — only `ts` needed for the sparkline
  const curLeads = (curLeadsRes.data ?? []) as Array<{ ts: string }>
  const curTimeline = (curTimelineRes.data ?? []) as Array<{ ts: string; kind: string; broker: string | null }>
  const curTasks = (curTasksRes.data ?? []) as Array<{ completed_at: string | null; assigned_broker: string | null }>
  const curAppts = (curApptsRes.data ?? []) as Array<{ start_at: string; broker_slug: string | null }>

  const prevLeads = (prevLeadsRes.data ?? []) as Array<{ ts: string }>
  const prevTimeline = (prevTimelineRes.data ?? []) as Array<{ ts: string; kind: string; broker: string | null }>
  const prevTasks = (prevTasksRes.data ?? []) as Array<{ completed_at: string | null; assigned_broker: string | null }>
  const prevAppts = (prevApptsRes.data ?? []) as Array<{ start_at: string; broker_slug: string | null }>

  const timeSeries = buildTimeSeries(curTimeline, curLeads, curTasks, curAppts, start, end)
  const prevTimeSeries = buildTimeSeries(prevTimeline, prevLeads, prevTasks, prevAppts, prevStart, prevEnd)

  return {
    rows,
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
 *                  for broker scoping — NOT crm_people.created_at, which is the bulk-import date)
 *   - crm_timeline (calls/emails/texts/notes, filtered by ts + broker + kind)
 *   - crm_tasks (tasks completed, filtered by completed_at + assigned_broker)
 *   - crm_appointments (appointments, filtered by start_at + broker_slug)
 *
 * Count approach (Defect 1 fix — 2026-07-01):
 *   All KPI aggregate totals and per-broker breakdown values use
 *   { count: 'exact', head: true } queries that return the real database
 *   COUNT(*) via the Content-Range response header.  This bypasses the
 *   Supabase max_rows limit (default 1000) that previously caused every
 *   count > 1000 to report exactly "1,000".  Raw-row queries are retained
 *   only for the sparkline / chart time-series shape.
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
      'crm-agent-activity-v4',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-agent-activity', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
