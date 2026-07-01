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
 */
function buildTimeSeries(
  timelineEvents: Array<{ ts: string; kind: string }>,
  leads: Array<{ created_at: string }>,
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
    if (!inRange(lead.created_at, rangeStart, rangeEnd)) continue
    const day = lead.created_at.slice(0, 10)
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

  // 3. Parallel data fetch — all queries span the COMBINED period (prevStart → end)
  //    so we can split current vs. previous in JS with a single round-trip each.
  const [leadsResult, timelineResult, tasksResult, apptsResult] = await Promise.all([
    // a) All leads in combined period for scoped brokers
    sb
      .from('crm_people')
      .select('created_at,assigned_broker')
      .in('assigned_broker', brokerSlugs)
      .eq('deleted', false)
      .gte('created_at', prevStart)
      .lte('created_at', end),

    // b) Timeline events in combined period for scoped brokers
    sb
      .from('crm_timeline')
      .select('ts,kind,broker')
      .gte('ts', prevStart)
      .lte('ts', end)
      .in('kind', ALL_ACTIVITY_KINDS)
      .in('broker', brokerSlugs)
      .neq('source', 'sequence'),

    // c) Tasks completed in combined period for scoped brokers
    sb
      .from('crm_tasks')
      .select('completed_at,assigned_broker')
      .gte('completed_at', prevStart)
      .lte('completed_at', end)
      .in('assigned_broker', brokerSlugs),

    // d) Appointments in combined period for scoped brokers
    sb
      .from('crm_appointments')
      .select('start_at,broker_slug')
      .gte('start_at', prevStart)
      .lte('start_at', end)
      .not('person_id', 'is', null)
      .in('broker_slug', brokerSlugs),
  ])

  const leads = leadsResult.data ?? []
  const timelineEvents = (timelineResult.data ?? []) as Array<{ ts: string; kind: string; broker: string | null }>
  const tasks = (tasksResult.data ?? []) as Array<{ completed_at: string | null; assigned_broker: string | null }>
  const appts = (apptsResult.data ?? []) as Array<{ start_at: string; broker_slug: string | null }>

  // 4. Partition into current vs previous period
  const curLeads = leads.filter((l) => inRange(l.created_at, start, end)) as Array<{ created_at: string; assigned_broker: string | null }>
  const prevLeads = leads.filter((l) => inRange(l.created_at, prevStart, prevEnd)) as Array<{ created_at: string; assigned_broker: string | null }>
  const curTimeline = timelineEvents.filter((e) => inRange(e.ts, start, end))
  const prevTimeline = timelineEvents.filter((e) => inRange(e.ts, prevStart, prevEnd))
  const curTasks = tasks.filter((t) => t.completed_at && inRange(t.completed_at, start, end))
  const prevTasks = tasks.filter((t) => t.completed_at && inRange(t.completed_at, prevStart, prevEnd))
  const curAppts = appts.filter((a) => inRange(a.start_at, start, end))
  const prevAppts = appts.filter((a) => inRange(a.start_at, prevStart, prevEnd))

  // 5. Build per-broker aggregates for CURRENT period
  const newLeadsByBroker = new Map<string, number>()
  const callsByBroker = new Map<string, number>()
  const emailsByBroker = new Map<string, number>()
  const textsByBroker = new Map<string, number>()
  const notesByBroker = new Map<string, number>()
  const tasksByBroker = new Map<string, number>()
  const apptsByBroker = new Map<string, number>()

  for (const l of curLeads) {
    if (l.assigned_broker) newLeadsByBroker.set(l.assigned_broker, (newLeadsByBroker.get(l.assigned_broker) ?? 0) + 1)
  }
  for (const ev of curTimeline) {
    const slug = ev.broker
    if (!slug) continue
    if (CALL_KINDS.includes(ev.kind)) callsByBroker.set(slug, (callsByBroker.get(slug) ?? 0) + 1)
    else if (EMAIL_KINDS.includes(ev.kind)) emailsByBroker.set(slug, (emailsByBroker.get(slug) ?? 0) + 1)
    else if (TEXT_KINDS.includes(ev.kind)) textsByBroker.set(slug, (textsByBroker.get(slug) ?? 0) + 1)
    else if (NOTE_KINDS.includes(ev.kind)) notesByBroker.set(slug, (notesByBroker.get(slug) ?? 0) + 1)
  }
  for (const t of curTasks) {
    if (t.assigned_broker) tasksByBroker.set(t.assigned_broker, (tasksByBroker.get(t.assigned_broker) ?? 0) + 1)
  }
  for (const a of curAppts) {
    if (a.broker_slug) apptsByBroker.set(a.broker_slug, (apptsByBroker.get(a.broker_slug) ?? 0) + 1)
  }

  // 6. Build typed rows (current period per-broker)
  const rows: AgentActivityRow[] = scopedBrokers.map((b) => {
    const slug = b.crm_slug
    const newLeads = newLeadsByBroker.get(slug) ?? 0
    const apptsSet = apptsByBroker.get(slug) ?? 0
    return {
      brokerSlug: slug,
      brokerName: b.display_name ?? slug,
      avatarUrl: BROKER_HEADSHOT[slug] ?? b.photo_url ?? null,
      newLeads,
      initiallyAssignedLeads: newLeads,
      currentlyAssignedLeads: newLeads,
      calls: callsByBroker.get(slug) ?? 0,
      emails: emailsByBroker.get(slug) ?? 0,
      texts: textsByBroker.get(slug) ?? 0,
      notes: notesByBroker.get(slug) ?? 0,
      tasksCompleted: tasksByBroker.get(slug) ?? 0,
      appointmentsSet: apptsSet,
      appointments: apptsSet,
    }
  })

  // 7. Compute current period totals
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

  // 8. Compute previous period totals (all scoped brokers combined)
  let prevNewLeadsTotal = 0
  let prevCallsTotal = 0
  let prevEmailsTotal = 0
  let prevTextsTotal = 0
  let prevNotesTotal = 0
  let prevTasksTotal = 0
  let prevApptsTotal = 0

  for (const l of prevLeads) { if (l.assigned_broker) prevNewLeadsTotal++ }
  for (const ev of prevTimeline) {
    if (CALL_KINDS.includes(ev.kind)) prevCallsTotal++
    else if (EMAIL_KINDS.includes(ev.kind)) prevEmailsTotal++
    else if (TEXT_KINDS.includes(ev.kind)) prevTextsTotal++
    else if (NOTE_KINDS.includes(ev.kind)) prevNotesTotal++
  }
  for (const _t of prevTasks) { prevTasksTotal++ }
  for (const _a of prevAppts) { prevApptsTotal++ }

  const previousTotals: AgentActivityTotals = {
    newLeads: prevNewLeadsTotal,
    initiallyAssignedLeads: prevNewLeadsTotal,
    currentlyAssignedLeads: prevNewLeadsTotal,
    calls: prevCallsTotal,
    emails: prevEmailsTotal,
    texts: prevTextsTotal,
    notes: prevNotesTotal,
    tasksCompleted: prevTasksTotal,
    appointmentsSet: prevApptsTotal,
    appointments: prevApptsTotal,
  }

  // 9. Build time series for current and previous periods
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
 *   - crm_people (new lead counts, filtered by created_at + assigned_broker)
 *   - crm_timeline (calls/emails/texts/notes, filtered by ts + broker + kind)
 *   - crm_tasks (tasks completed, filtered by completed_at + assigned_broker)
 *   - crm_appointments (appointments, filtered by start_at + broker_slug)
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
      'crm-agent-activity-v2',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-agent-activity', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
