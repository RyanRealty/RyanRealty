import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { resolveDateRange } from './getAgentActivityReport'
import { classifyLeadSource } from './leadSourceTaxonomy'

// Re-export for convenience (used by the page to pass datePreset type)
export type { DatePreset } from './getAgentActivityReport'

// ── Types ─────────────────────────────────────────────────────────────────────

export type OverviewParams = {
  /** null = all brokers (superuser / Everyone view) */
  brokerSlug: string | null
  datePreset: string
  dateStart?: string | null
  dateEnd?: string | null
}

/**
 * Top-line aggregate KPI totals for the Overview report.
 *
 * Metric → crm_* source mapping:
 *
 * | Metric         | Source table    | Filter                                          |
 * |----------------|-----------------|--------------------------------------------------|
 * | newLeads       | crm_timeline    | kind='lead_created', joined crm_people for broker + source, INBOUND sources only (leadSourceTaxonomy) |
 * | calls          | crm_timeline    | kind IN ('call','voicemail'), broker column       |
 * | emails         | crm_timeline    | kind IN ('email_out','email_in'), broker column   |
 * | texts          | crm_timeline    | kind IN ('sms_out','sms_in'), broker column       |
 * | notes          | crm_timeline    | kind='note', broker column                        |
 * | tasksCompleted | crm_tasks       | completed_at in range, assigned_broker column     |
 * | appointments   | crm_appointments| start_at in range, broker_slug column             |
 *
 * Activity counts use { count: 'exact', head: true } — the real database
 * COUNT(*) via Content-Range header, bypassing the Supabase max_rows cap.
 *
 * newLeads is the exception: the lead_created trigger fires for EVERY
 * crm_people insert (imports included), so a raw COUNT would include the
 * ~14.5k Farm + Import + Sphere outreach rows — the exact overcount
 * getDashboardKpis was rebuilt to exclude. Instead we page the events with
 * the joined crm_people.source and count only rows whose source classifies
 * as a genuine inbound lead via classifyLeadSource — the same taxonomy
 * getLeadIntake (the org-wide "new leads" source of truth) applies, so this
 * report agrees with /admin/broker-dashboard and /admin/analytics.
 */
export type OverviewTotals = {
  newLeads: number
  calls: number
  emails: number
  texts: number
  notes: number
  tasksCompleted: number
  appointments: number
}

/** Per-day breakdown for KPI sparklines. */
export type OverviewTimeSeriesPoint = {
  date: string       // YYYY-MM-DD
  newLeads: number
  calls: number
  emails: number
  texts: number
  notes: number
  tasksCompleted: number
  appointments: number
}

export type OverviewResult = {
  totals: OverviewTotals
  /** Totals for the preceding period of equal length (for delta arrows). */
  previousTotals: OverviewTotals
  /** Per-day time series for the current period (sparkline shape). */
  timeSeries: OverviewTimeSeriesPoint[]
  dateStart: string
  dateEnd: string
  prevDateStart: string
  prevDateEnd: string
}

// ── Kind groupings (must match Agent Activity and Calls reports) ───────────────

const CALL_KINDS = ['call', 'voicemail']
const EMAIL_KINDS = ['email_out', 'email_in']
const TEXT_KINDS = ['sms_out', 'sms_in']
const NOTE_KINDS = ['note']
const ALL_ACTIVITY_KINDS = [...CALL_KINDS, ...EMAIL_KINDS, ...TEXT_KINDS, ...NOTE_KINDS]

const EMPTY_TOTALS: OverviewTotals = {
  newLeads: 0,
  calls: 0,
  emails: 0,
  texts: 0,
  notes: 0,
  tasksCompleted: 0,
  appointments: 0,
}

// ── Previous period resolver ───────────────────────────────────────────────────

/**
 * Compute the preceding period of equal duration immediately before start.
 * Matches the pattern in getAgentActivityReport (inline to avoid import cycle).
 */
function resolvePreviousPeriod(
  start: string,
  end: string,
): { prevStart: string; prevEnd: string } {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const durationMs = endMs - startMs
  const prevEndMs = startMs - 1
  const prevStartMs = prevEndMs - durationMs
  return {
    prevStart: new Date(prevStartMs).toISOString(),
    prevEnd: new Date(prevEndMs).toISOString(),
  }
}

// ── Inbound lead events (taxonomy-filtered) ────────────────────────────────────

/**
 * Fetch the window's lead_created events with the owning contact's CURRENT
 * source, then keep only genuine inbound leads (classifyLeadSource attributable
 * — web/portal/phone/social/referral). Farm/Import/Sphere/Expired/FSBO outreach
 * rows are lists we built, never leads (see getLeadIntake for the canonical
 * definition every dashboard shares).
 *
 * Classification is keyword-based JS, so it cannot be pushed into PostgREST —
 * we page the rows (1000-row server cap) and filter in app code, exactly like
 * getLeadIntake does over crm_people.
 */
async function fetchInboundLeadEvents(
  sb: ReturnType<typeof createServiceClient>,
  brokerSlugs: string[],
  start: string,
  end: string,
): Promise<Array<{ ts: string }>> {
  type EventRow = {
    ts: string
    crm_people: { assigned_broker: string | null; source: string | null } | Array<{ assigned_broker: string | null; source: string | null }> | null
  }
  const inbound: Array<{ ts: string }> = []
  const PAGE = 1000
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data, error } = await sb
      .from('crm_timeline')
      .select('ts, crm_people!inner(assigned_broker, source)')
      .eq('kind', 'lead_created')
      .in('crm_people.assigned_broker', brokerSlugs)
      .gte('ts', start)
      .lte('ts', end)
      .order('ts', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[getOverviewReport] lead_created page error', error.message)
      break
    }
    const page = (data ?? []) as unknown as EventRow[]
    for (const row of page) {
      const person = Array.isArray(row.crm_people) ? row.crm_people[0] : row.crm_people
      if (classifyLeadSource(person?.source ?? null).attributable) {
        inbound.push({ ts: row.ts })
      }
    }
    if (page.length < PAGE) break
  }
  return inbound
}

// ── Time series builder ────────────────────────────────────────────────────────

/**
 * Produce one OverviewTimeSeriesPoint per calendar day in [rangeStart, rangeEnd]
 * from pre-fetched raw rows. Rows outside the range are silently skipped.
 * Row volume is low enough for sparklines (monthly ~90-day range = ≤90 points).
 *
 * Note: raw-row queries may be capped at the Supabase max_rows setting on very
 * high-volume periods. For the totals row, count:'exact', head:true is used
 * (see the parallel count group below) — these sparklines show shape only.
 */
function buildTimeSeries(
  timelineEvents: Array<{ ts: string; kind: string }>,
  leads: Array<{ ts: string }>,
  tasks: Array<{ completed_at: string | null }>,
  appts: Array<{ start_at: string }>,
  rangeStart: string,
  rangeEnd: string,
): OverviewTimeSeriesPoint[] {
  const points = new Map<string, OverviewTimeSeriesPoint>()

  const startD = new Date(rangeStart)
  const endD = new Date(rangeEnd)
  const cur = new Date(
    Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), startD.getUTCDate()),
  )
  const endDay = new Date(
    Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth(), endD.getUTCDate()),
  )

  while (cur <= endDay) {
    const key = cur.toISOString().slice(0, 10)
    points.set(key, {
      date: key,
      newLeads: 0,
      calls: 0,
      emails: 0,
      texts: 0,
      notes: 0,
      tasksCompleted: 0,
      appointments: 0,
    })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  for (const ev of timelineEvents) {
    if (ev.ts < rangeStart || ev.ts > rangeEnd) continue
    const day = ev.ts.slice(0, 10)
    const p = points.get(day)
    if (!p) continue
    if (CALL_KINDS.includes(ev.kind)) p.calls++
    else if (EMAIL_KINDS.includes(ev.kind)) p.emails++
    else if (TEXT_KINDS.includes(ev.kind)) p.texts++
    else if (NOTE_KINDS.includes(ev.kind)) p.notes++
  }

  for (const lead of leads) {
    if (lead.ts < rangeStart || lead.ts > rangeEnd) continue
    const day = lead.ts.slice(0, 10)
    const p = points.get(day)
    if (p) p.newLeads++
  }

  for (const task of tasks) {
    if (
      !task.completed_at ||
      task.completed_at < rangeStart ||
      task.completed_at > rangeEnd
    )
      continue
    const day = task.completed_at.slice(0, 10)
    const p = points.get(day)
    if (p) p.tasksCompleted++
  }

  for (const appt of appts) {
    if (appt.start_at < rangeStart || appt.start_at > rangeEnd) continue
    const day = appt.start_at.slice(0, 10)
    const p = points.get(day)
    if (p) p.appointments++
  }

  return Array.from(points.values())
}

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readOverviewReport(params: OverviewParams): Promise<OverviewResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(params.datePreset, params.dateStart, params.dateEnd)
  const { prevStart, prevEnd } = resolvePreviousPeriod(start, end)

  // 1. Broker roster — crm-active brokers with a crm_slug
  const { data: brokerRows, error: brokerError } = await sb
    .from('brokers')
    .select('crm_slug')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)

  if (brokerError) console.error('[getOverviewReport] brokers error', brokerError.message)

  const allSlugs = (
    (brokerRows ?? []).filter((b) => b.crm_slug) as Array<{ crm_slug: string }>
  ).map((b) => b.crm_slug)

  const brokerSlugs = params.brokerSlug
    ? allSlugs.filter((s) => s === params.brokerSlug)
    : allSlugs

  if (brokerSlugs.length === 0) {
    return {
      totals: { ...EMPTY_TOTALS },
      previousTotals: { ...EMPTY_TOTALS },
      timeSeries: [],
      dateStart: start,
      dateEnd: end,
      prevDateStart: prevStart,
      prevDateEnd: prevEnd,
    }
  }

  // 2. Four parallel query groups:
  //    Leads    — inbound lead_created events, current + previous window
  //               (paged rows classified via leadSourceTaxonomy — a raw COUNT
  //               would include bulk-import rows; see fetchInboundLeadEvents)
  //    Group A  — current period activity totals (6 × { count:'exact', head:true })
  //    Group B  — previous period activity totals (same 6 queries, prior window)
  //    Group C  — current period raw rows for sparkline time series
  //
  //  Groups A+B give exact database COUNT(*), bypassing the max_rows cap.
  //  Group C rows may be capped; they're used only for sparkline shape.

  const [curLeadEvents, prevLeadEvents, curGroup, prevGroup, tsGroup] = await Promise.all([
    fetchInboundLeadEvents(sb, brokerSlugs, start, end),
    fetchInboundLeadEvents(sb, brokerSlugs, prevStart, prevEnd),
    // ── Group A: current period totals ────────────────────────────────────────
    Promise.all([
      // a1: calls (inbound + voicemail)
      sb
        .from('crm_timeline')
        .select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs)
        .in('kind', CALL_KINDS)
        .neq('source', 'sequence')
        .gte('ts', start)
        .lte('ts', end),
      // a2: emails
      sb
        .from('crm_timeline')
        .select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs)
        .in('kind', EMAIL_KINDS)
        .neq('source', 'sequence')
        .gte('ts', start)
        .lte('ts', end),
      // a3: texts
      sb
        .from('crm_timeline')
        .select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs)
        .in('kind', TEXT_KINDS)
        .neq('source', 'sequence')
        .gte('ts', start)
        .lte('ts', end),
      // a4: notes
      sb
        .from('crm_timeline')
        .select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs)
        .in('kind', NOTE_KINDS)
        .neq('source', 'sequence')
        .gte('ts', start)
        .lte('ts', end),
      // a5: tasks completed
      sb
        .from('crm_tasks')
        .select('id', { count: 'exact', head: true })
        .in('assigned_broker', brokerSlugs)
        .gte('completed_at', start)
        .lte('completed_at', end),
      // a6: appointments
      sb
        .from('crm_appointments')
        .select('id', { count: 'exact', head: true })
        .in('broker_slug', brokerSlugs)
        .not('person_id', 'is', null)
        .gte('start_at', start)
        .lte('start_at', end),
    ] as const),

    // ── Group B: previous period totals ──────────────────────────────────────
    Promise.all([
      sb
        .from('crm_timeline')
        .select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs)
        .in('kind', CALL_KINDS)
        .neq('source', 'sequence')
        .gte('ts', prevStart)
        .lte('ts', prevEnd),
      sb
        .from('crm_timeline')
        .select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs)
        .in('kind', EMAIL_KINDS)
        .neq('source', 'sequence')
        .gte('ts', prevStart)
        .lte('ts', prevEnd),
      sb
        .from('crm_timeline')
        .select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs)
        .in('kind', TEXT_KINDS)
        .neq('source', 'sequence')
        .gte('ts', prevStart)
        .lte('ts', prevEnd),
      sb
        .from('crm_timeline')
        .select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs)
        .in('kind', NOTE_KINDS)
        .neq('source', 'sequence')
        .gte('ts', prevStart)
        .lte('ts', prevEnd),
      sb
        .from('crm_tasks')
        .select('id', { count: 'exact', head: true })
        .in('assigned_broker', brokerSlugs)
        .gte('completed_at', prevStart)
        .lte('completed_at', prevEnd),
      sb
        .from('crm_appointments')
        .select('id', { count: 'exact', head: true })
        .in('broker_slug', brokerSlugs)
        .not('person_id', 'is', null)
        .gte('start_at', prevStart)
        .lte('start_at', prevEnd),
    ] as const),

    // ── Group C: current period raw rows (sparkline shape only) ──────────────
    // (lead sparkline rows come from curLeadEvents above — already inbound-only)
    Promise.all([
      // calls / emails / texts / notes
      sb
        .from('crm_timeline')
        .select('ts,kind')
        .in('broker', brokerSlugs)
        .in('kind', ALL_ACTIVITY_KINDS)
        .neq('source', 'sequence')
        .gte('ts', start)
        .lte('ts', end),
      // tasks
      sb
        .from('crm_tasks')
        .select('completed_at')
        .in('assigned_broker', brokerSlugs)
        .gte('completed_at', start)
        .lte('completed_at', end),
      // appointments
      sb
        .from('crm_appointments')
        .select('start_at')
        .in('broker_slug', brokerSlugs)
        .not('person_id', 'is', null)
        .gte('start_at', start)
        .lte('start_at', end),
    ] as const),
  ])

  // 3. Unpack current totals (newLeads = inbound-classified event rows)
  const [
    { count: callsCount },
    { count: emailsCount },
    { count: textsCount },
    { count: notesCount },
    { count: tasksCount },
    { count: apptsCount },
  ] = curGroup

  const totals: OverviewTotals = {
    newLeads: curLeadEvents.length,
    calls: callsCount ?? 0,
    emails: emailsCount ?? 0,
    texts: textsCount ?? 0,
    notes: notesCount ?? 0,
    tasksCompleted: tasksCount ?? 0,
    appointments: apptsCount ?? 0,
  }

  // 4. Unpack previous period totals
  const [
    { count: prevCallsCount },
    { count: prevEmailsCount },
    { count: prevTextsCount },
    { count: prevNotesCount },
    { count: prevTasksCount },
    { count: prevApptsCount },
  ] = prevGroup

  const previousTotals: OverviewTotals = {
    newLeads: prevLeadEvents.length,
    calls: prevCallsCount ?? 0,
    emails: prevEmailsCount ?? 0,
    texts: prevTextsCount ?? 0,
    notes: prevNotesCount ?? 0,
    tasksCompleted: prevTasksCount ?? 0,
    appointments: prevApptsCount ?? 0,
  }

  // 5. Build time series for sparklines
  const [timelineRes, tasksRes, apptsRes] = tsGroup

  const timeline = (timelineRes.data ?? []) as Array<{ ts: string; kind: string }>
  const tasks = (tasksRes.data ?? []) as Array<{ completed_at: string | null }>
  const appts = (apptsRes.data ?? []) as Array<{ start_at: string }>

  const timeSeries = buildTimeSeries(timeline, curLeadEvents, tasks, appts, start, end)

  return {
    totals,
    previousTotals,
    timeSeries,
    dateStart: start,
    dateEnd: end,
    prevDateStart: prevStart,
    prevDateEnd: prevEnd,
  }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Overview report — top-line activity KPIs for the selected period + broker scope.
 * Cached 10 minutes (matching FUB's documented reporting cache TTL).
 *
 * Source tables:
 *   crm_timeline (lead_created / call / voicemail / email_* / sms_* / note)
 *   crm_tasks    (completed_at)
 *   crm_appointments (start_at)
 *
 * Count approach: activity totals use { count:'exact', head:true } which
 * returns the real database COUNT(*) via the Content-Range response header,
 * bypassing the Supabase max_rows cap.  Raw-row queries are retained only for
 * the per-day sparkline time series.
 *
 * newLeads: paged lead_created events classified through leadSourceTaxonomy
 * (inbound sources only, matching getLeadIntake) — the lead_created trigger
 * fires on every crm_people insert, so bulk Farm/Import/Sphere/Expired/FSBO
 * outreach rows must be excluded or the KPI overcounts by orders of magnitude
 * versus the broker dashboard.
 *
 * V1 approximations (honest empty states):
 *   - calls = all call + voicemail timeline events; outbound click-to-call
 *     is included when logged, but currently all calls are inbound (Twilio webhook).
 */
export async function getOverviewReport(
  params: OverviewParams,
): Promise<OverviewResult> {
  const cached = unstable_cache(
    () => readOverviewReport(params),
    [
      // v2: newLeads switched from raw lead_created counts to the
      // taxonomy-filtered inbound definition (2026-07-14).
      'crm-overview-report-v2',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-overview', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
