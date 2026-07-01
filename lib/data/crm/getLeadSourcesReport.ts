import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { resolveDateRange } from './getAgentActivityReport'
import type { DatePreset, TimeSeriesPoint } from './getAgentActivityReport'

// Re-export TimeSeriesPoint so page + chart components share one type
export type { DatePreset, TimeSeriesPoint }

// ── Types ─────────────────────────────────────────────────────────────────────

export type LeadSourcesParams = {
  /** null = all brokers (superuser/Everyone view) */
  brokerSlug: string | null
  datePreset: DatePreset | 'custom'
  dateStart?: string | null
  dateEnd?: string | null
}

export type LeadSourcesRow = {
  sourceName: string       // display label — null maps to '<unspecified>'
  sourceKey: string | null // raw crm_people.source value (null = unspecified)
  newLeads: number
  calls: number
  emails: number
  texts: number
  notes: number
  tasksCompleted: number
  appointments: number
}

export type LeadSourcesTotals = {
  newLeads: number
  calls: number
  emails: number
  texts: number
  notes: number
  tasksCompleted: number
  appointments: number
}

export type LeadSourcesResult = {
  /** Rows sorted: most new leads first, then alphabetical by sourceName */
  rows: LeadSourcesRow[]
  /** KPI strip totals for the current period (exact count queries) */
  totals: LeadSourcesTotals
  /** Totals for the immediately preceding period of equal length (for KPI delta) */
  previousTotals: LeadSourcesTotals
  /** Per-day time series for the current period (sparklines + chart) */
  timeSeries: TimeSeriesPoint[]
  /** Per-day time series for the previous period (compare overlay) */
  prevTimeSeries: TimeSeriesPoint[]
  dateStart: string
  dateEnd: string
  prevDateStart: string
  prevDateEnd: string
}

// ── Activity kind groupings (mirrors getAgentActivityReport) ──────────────────

const CALL_KINDS = ['call', 'voicemail']
const EMAIL_KINDS = ['email_out', 'email_in']
const TEXT_KINDS = ['sms_out', 'sms_in']
const NOTE_KINDS = ['note']
const ALL_ACTIVITY_KINDS = [...CALL_KINDS, ...EMAIL_KINDS, ...TEXT_KINDS, ...NOTE_KINDS]

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvePreviousPeriod(start: string, end: string) {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const durationMs = endMs - startMs
  const prevEndMs = startMs - 1
  return {
    prevStart: new Date(prevEndMs - durationMs).toISOString(),
    prevEnd: new Date(prevEndMs).toISOString(),
  }
}

function inRange(ts: string, start: string, end: string) {
  return ts >= start && ts <= end
}

/**
 * Build a per-day TimeSeriesPoint[] from pre-fetched raw event data.
 * Mirrors the same function in getAgentActivityReport.ts.
 * Kept local to avoid a circular import between the two DAL files.
 */
function buildTimeSeries(
  timelineEvents: Array<{ ts: string; kind: string }>,
  leads: Array<{ ts: string }>,
  tasks: Array<{ completed_at: string | null }>,
  appts: Array<{ start_at: string }>,
  rangeStart: string,
  rangeEnd: string,
): TimeSeriesPoint[] {
  const points = new Map<string, TimeSeriesPoint>()

  const s = new Date(rangeStart)
  const e = new Date(rangeEnd)
  const cur = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()))
  const endDay = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()))

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
    const p = points.get(ev.ts.slice(0, 10))
    if (!p) continue
    if (CALL_KINDS.includes(ev.kind)) p.calls++
    else if (EMAIL_KINDS.includes(ev.kind)) p.emails++
    else if (TEXT_KINDS.includes(ev.kind)) p.texts++
    else if (NOTE_KINDS.includes(ev.kind)) p.notes++
  }
  for (const lead of leads) {
    if (!inRange(lead.ts, rangeStart, rangeEnd)) continue
    const p = points.get(lead.ts.slice(0, 10))
    if (p) p.newLeads++
  }
  for (const task of tasks) {
    if (!task.completed_at || !inRange(task.completed_at, rangeStart, rangeEnd)) continue
    const p = points.get(task.completed_at.slice(0, 10))
    if (p) p.tasksCompleted++
  }
  for (const appt of appts) {
    if (!inRange(appt.start_at, rangeStart, rangeEnd)) continue
    const p = points.get(appt.start_at.slice(0, 10))
    if (p) { p.appointmentsSet++; p.appointments++ }
  }

  return Array.from(points.values())
}

const EMPTY_TOTALS: LeadSourcesTotals = {
  newLeads: 0, calls: 0, emails: 0, texts: 0,
  notes: 0, tasksCompleted: 0, appointments: 0,
}

/**
 * Apply a crm_people.source filter to an in-progress PostgREST query builder.
 *
 * Using `any` here is intentional: the Supabase JS generic chain types are too
 * complex to thread through a helper signature while still accepting both
 * `.is()` (null) and `.eq()` (string) branches. This function is private to the
 * DAL file and the return type is always `PostgrestFilterBuilder` which resolves
 * to `{ count: number | null }` for head-count queries.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySourceFilter(q: any, srcKey: string | null): any {
  return srcKey === null
    ? q.is('crm_people.source', null)
    : q.eq('crm_people.source', srcKey)
}

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readLeadSources(params: LeadSourcesParams): Promise<LeadSourcesResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(params.datePreset, params.dateStart, params.dateEnd)
  const { prevStart, prevEnd } = resolvePreviousPeriod(start, end)

  // 1. Broker roster — CRM-active brokers with a crm_slug
  const { data: brokerRows, error: brokerError } = await sb
    .from('brokers')
    .select('crm_slug')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)
    .order('sort_order', { ascending: true })

  if (brokerError) console.error('[getLeadSourcesReport] brokers error', brokerError.message)

  const allBrokerSlugs = (brokerRows ?? [])
    .map((b) => b.crm_slug)
    .filter(Boolean) as string[]

  const brokerSlugs = params.brokerSlug
    ? allBrokerSlugs.filter((s) => s === params.brokerSlug)
    : allBrokerSlugs

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

  // 2. Fire all query groups in parallel.
  //
  //    Group A — 7 COUNT queries for the PREVIOUS period (exact totals for KPI deltas).
  //    Group B — 7 COUNT queries for the CURRENT period (exact KPI totals).
  //    Group C — Discover distinct source names:
  //              (C1) All-time lead_created events → sources that have ever had a lead.
  //              (C2) Activity events in current period → sources with activity now.
  //              Both queries are naturally bounded in size (lead_created events are rare).
  //    Group D — Raw rows for current period time series (sparklines + chart).
  //    Group E — Raw rows for previous period time series (compare overlay).
  //
  //    Per-source count queries run in a THIRD parallel wave after distinct sources
  //    are known (Group F below). Not merged into this wave to keep the outer
  //    Promise.all readable.

  const [prevGroup, curTotalGroup, discoverGroup, curTsGroup, prevTsGroup] = await Promise.all([

    // ── Group A: Previous period totals ───────────────────────────────────────
    Promise.all([
      // a0: new leads — genuine lead_created events, NOT crm_people.created_at
      sb.from('crm_timeline')
        .select('id, crm_people!inner(assigned_broker)', { count: 'exact', head: true })
        .eq('kind', 'lead_created')
        .in('crm_people.assigned_broker', brokerSlugs)
        .gte('ts', prevStart).lte('ts', prevEnd),
      // a1: calls
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', CALL_KINDS).neq('source', 'sequence')
        .gte('ts', prevStart).lte('ts', prevEnd),
      // a2: emails
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', EMAIL_KINDS).neq('source', 'sequence')
        .gte('ts', prevStart).lte('ts', prevEnd),
      // a3: texts
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', TEXT_KINDS).neq('source', 'sequence')
        .gte('ts', prevStart).lte('ts', prevEnd),
      // a4: notes
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', NOTE_KINDS).neq('source', 'sequence')
        .gte('ts', prevStart).lte('ts', prevEnd),
      // a5: tasks completed
      sb.from('crm_tasks').select('id', { count: 'exact', head: true })
        .in('assigned_broker', brokerSlugs)
        .gte('completed_at', prevStart).lte('completed_at', prevEnd),
      // a6: appointments
      sb.from('crm_appointments').select('id', { count: 'exact', head: true })
        .in('broker_slug', brokerSlugs).not('person_id', 'is', null)
        .gte('start_at', prevStart).lte('start_at', prevEnd),
    ] as const),

    // ── Group B: Current period totals ─────────────────────────────────────────
    Promise.all([
      sb.from('crm_timeline')
        .select('id, crm_people!inner(assigned_broker)', { count: 'exact', head: true })
        .eq('kind', 'lead_created')
        .in('crm_people.assigned_broker', brokerSlugs)
        .gte('ts', start).lte('ts', end),
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', CALL_KINDS).neq('source', 'sequence')
        .gte('ts', start).lte('ts', end),
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', EMAIL_KINDS).neq('source', 'sequence')
        .gte('ts', start).lte('ts', end),
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', TEXT_KINDS).neq('source', 'sequence')
        .gte('ts', start).lte('ts', end),
      sb.from('crm_timeline').select('id', { count: 'exact', head: true })
        .in('broker', brokerSlugs).in('kind', NOTE_KINDS).neq('source', 'sequence')
        .gte('ts', start).lte('ts', end),
      sb.from('crm_tasks').select('id', { count: 'exact', head: true })
        .in('assigned_broker', brokerSlugs)
        .gte('completed_at', start).lte('completed_at', end),
      sb.from('crm_appointments').select('id', { count: 'exact', head: true })
        .in('broker_slug', brokerSlugs).not('person_id', 'is', null)
        .gte('start_at', start).lte('start_at', end),
    ] as const),

    // ── Group C: Discover distinct source names ────────────────────────────────
    Promise.all([
      // C1: All-time lead_created events → every source that has ever had a lead.
      //     Bounded in size (lead_created events are rare in a small brokerage).
      sb.from('crm_timeline')
        .select('crm_people!inner(source, assigned_broker)')
        .eq('kind', 'lead_created')
        .in('crm_people.assigned_broker', brokerSlugs),
      // C2: Activity events in the current period → sources active now.
      //     Catches sources that have calls/emails/texts/notes but no lead_created.
      sb.from('crm_timeline')
        .select('crm_people!inner(source, assigned_broker)')
        .in('kind', ALL_ACTIVITY_KINDS)
        .in('broker', brokerSlugs)
        .gte('ts', start).lte('ts', end),
    ] as const),

    // ── Group D: Current period raw rows for sparklines + chart ───────────────
    Promise.all([
      sb.from('crm_timeline')
        .select('ts, crm_people!inner(assigned_broker)')
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

    // ── Group E: Previous period raw rows for compare overlay ─────────────────
    Promise.all([
      sb.from('crm_timeline')
        .select('ts, crm_people!inner(assigned_broker)')
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

  // 3. Unpack previous period totals
  const [
    { count: prevNewLeads },
    { count: prevCalls },
    { count: prevEmails },
    { count: prevTexts },
    { count: prevNotes },
    { count: prevTasks },
    { count: prevAppts },
  ] = prevGroup

  const previousTotals: LeadSourcesTotals = {
    newLeads: prevNewLeads ?? 0,
    calls: prevCalls ?? 0,
    emails: prevEmails ?? 0,
    texts: prevTexts ?? 0,
    notes: prevNotes ?? 0,
    tasksCompleted: prevTasks ?? 0,
    appointments: prevAppts ?? 0,
  }

  // 4. Unpack current period totals
  const [
    { count: curNewLeads },
    { count: curCalls },
    { count: curEmails },
    { count: curTexts },
    { count: curNotes },
    { count: curTasks },
    { count: curAppts },
  ] = curTotalGroup

  const totals: LeadSourcesTotals = {
    newLeads: curNewLeads ?? 0,
    calls: curCalls ?? 0,
    emails: curEmails ?? 0,
    texts: curTexts ?? 0,
    notes: curNotes ?? 0,
    tasksCompleted: curTasks ?? 0,
    appointments: curAppts ?? 0,
  }

  // 5. Collect distinct source keys from discover queries.
  //    Always include null ('<unspecified>') — FUB shows it even when all-zero.
  const allSourceKeys = new Set<string | null>([null])

  // Supabase JS infers embedded joins as arrays even for many-to-one relationships.
  // Cast through unknown to accommodate either shape at runtime.
  type PersonRow = Array<{ source: string | null; assigned_broker: string | null }>
  type DiscoverRow = { crm_people: PersonRow }
  const [leadSrcRes, actSrcRes] = discoverGroup

  for (const row of (leadSrcRes.data ?? []) as unknown as DiscoverRow[]) {
    const src = Array.isArray(row.crm_people)
      ? row.crm_people[0]?.source ?? null
      : (row.crm_people as { source: string | null } | null)?.source ?? null
    allSourceKeys.add(src)
  }
  for (const row of (actSrcRes.data ?? []) as unknown as DiscoverRow[]) {
    const src = Array.isArray(row.crm_people)
      ? row.crm_people[0]?.source ?? null
      : (row.crm_people as { source: string | null } | null)?.source ?? null
    allSourceKeys.add(src)
  }

  // Stable sort: <unspecified> first, then alphabetical
  const distinctSources = Array.from(allSourceKeys).sort((a, b) => {
    if (a === null) return -1
    if (b === null) return 1
    return a.localeCompare(b)
  })

  // 6. Per-source count queries (Group F) — one Promise.all per source × 7 metrics.
  //
  //    Source filter is applied via `applySourceFilter` which uses `any` because the
  //    Supabase chain generics are too complex to thread through a typed helper.
  //    Every query still returns `{ count: number | null }` — the cast is safe.
  //
  //    V1 Notes:
  //    - tasks / appointments use person_id → crm_people join (FK auto-resolved by PostgREST).
  //    - Source attribution for calls/emails/texts/notes is "the person being contacted
  //      has source=X AND the activity was logged by a scoped broker".
  //      This is the same semantic FUB uses for its Lead Sources activity columns.

  const perSourceResults = await Promise.all(
    distinctSources.map(async (srcKey): Promise<LeadSourcesRow> => {
      const [
        { count: nlCount },
        { count: callCount },
        { count: emailCount },
        { count: textCount },
        { count: noteCount },
        { count: taskCount },
        { count: apptCount },
      ] = (await Promise.all([
        // new leads — lead_created event for a person with this source + broker scope
        applySourceFilter(
          sb.from('crm_timeline')
            .select('id, crm_people!inner(source, assigned_broker)', { count: 'exact', head: true })
            .eq('kind', 'lead_created')
            .in('crm_people.assigned_broker', brokerSlugs)
            .gte('ts', start).lte('ts', end),
          srcKey,
        ),
        // calls — activity on people with this source, logged by scoped broker
        applySourceFilter(
          sb.from('crm_timeline')
            .select('id, crm_people!inner(source)', { count: 'exact', head: true })
            .in('kind', CALL_KINDS)
            .in('broker', brokerSlugs)
            .neq('source', 'sequence')
            .gte('ts', start).lte('ts', end),
          srcKey,
        ),
        // emails
        applySourceFilter(
          sb.from('crm_timeline')
            .select('id, crm_people!inner(source)', { count: 'exact', head: true })
            .in('kind', EMAIL_KINDS)
            .in('broker', brokerSlugs)
            .neq('source', 'sequence')
            .gte('ts', start).lte('ts', end),
          srcKey,
        ),
        // texts
        applySourceFilter(
          sb.from('crm_timeline')
            .select('id, crm_people!inner(source)', { count: 'exact', head: true })
            .in('kind', TEXT_KINDS)
            .in('broker', brokerSlugs)
            .neq('source', 'sequence')
            .gte('ts', start).lte('ts', end),
          srcKey,
        ),
        // notes
        applySourceFilter(
          sb.from('crm_timeline')
            .select('id, crm_people!inner(source)', { count: 'exact', head: true })
            .in('kind', NOTE_KINDS)
            .in('broker', brokerSlugs)
            .neq('source', 'sequence')
            .gte('ts', start).lte('ts', end),
          srcKey,
        ),
        // tasks completed — joined to crm_people via person_id FK
        applySourceFilter(
          sb.from('crm_tasks')
            .select('id, crm_people!inner(source)', { count: 'exact', head: true })
            .in('assigned_broker', brokerSlugs)
            .gte('completed_at', start).lte('completed_at', end),
          srcKey,
        ),
        // appointments — joined to crm_people via person_id FK
        applySourceFilter(
          sb.from('crm_appointments')
            .select('id, crm_people!inner(source)', { count: 'exact', head: true })
            .in('broker_slug', brokerSlugs)
            .not('person_id', 'is', null)
            .gte('start_at', start).lte('start_at', end),
          srcKey,
        ),
      ])) as [
        { count: number | null },
        { count: number | null },
        { count: number | null },
        { count: number | null },
        { count: number | null },
        { count: number | null },
        { count: number | null },
      ]

      return {
        sourceKey: srcKey,
        sourceName: srcKey ?? '<unspecified>',
        newLeads: nlCount ?? 0,
        calls: callCount ?? 0,
        emails: emailCount ?? 0,
        texts: textCount ?? 0,
        notes: noteCount ?? 0,
        tasksCompleted: taskCount ?? 0,
        appointments: apptCount ?? 0,
      }
    }),
  )

  // 7. Sort: most new leads first, then alphabetical (unspecified alphabetically first)
  const rows = [...perSourceResults].sort((a, b) => {
    if (b.newLeads !== a.newLeads) return b.newLeads - a.newLeads
    // Both equal newLeads — put unspecified first, then alpha
    if (a.sourceKey === null) return -1
    if (b.sourceKey === null) return 1
    return a.sourceName.localeCompare(b.sourceName)
  })

  // 8. Build time series for the chart
  const [curLeadsRes, curTimelineRes, curTasksRes, curApptsRes] = curTsGroup
  const [prevLeadsRes, prevTimelineRes, prevTasksRes, prevApptsRes] = prevTsGroup

  const timeSeries = buildTimeSeries(
    (curTimelineRes.data ?? []) as Array<{ ts: string; kind: string }>,
    (curLeadsRes.data ?? []) as Array<{ ts: string }>,
    (curTasksRes.data ?? []) as Array<{ completed_at: string | null }>,
    (curApptsRes.data ?? []) as Array<{ start_at: string }>,
    start, end,
  )
  const prevTimeSeries = buildTimeSeries(
    (prevTimelineRes.data ?? []) as Array<{ ts: string; kind: string }>,
    (prevLeadsRes.data ?? []) as Array<{ ts: string }>,
    (prevTasksRes.data ?? []) as Array<{ completed_at: string | null }>,
    (prevApptsRes.data ?? []) as Array<{ start_at: string }>,
    prevStart, prevEnd,
  )

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
 * Lead Sources report data — per-source lead counts + activity metrics over a date range.
 * Cached 10 minutes to match FUB's documented cache TTL for reporting.
 *
 * Source tables:
 *   crm_people         — source label (crm_people.source)
 *   crm_timeline       — lead_created events (new leads), call/email/text/note activity
 *   crm_tasks          — tasks completed (joined to crm_people via person_id for source)
 *   crm_appointments   — appointments (joined to crm_people via person_id for source)
 *
 * Metric→table mapping:
 *   newLeads        → crm_timeline (kind='lead_created') JOIN crm_people.source + assigned_broker
 *   calls           → crm_timeline (kind IN call,voicemail) JOIN crm_people.source
 *   emails          → crm_timeline (kind IN email_out,email_in) JOIN crm_people.source
 *   texts           → crm_timeline (kind IN sms_out,sms_in) JOIN crm_people.source
 *   notes           → crm_timeline (kind='note') JOIN crm_people.source
 *   tasksCompleted  → crm_tasks.completed_at JOIN crm_people.source via person_id
 *   appointments    → crm_appointments.start_at JOIN crm_people.source via person_id
 *
 * All KPI totals + per-source counts use { count: 'exact', head: true } (exact DB COUNT(*),
 * never capped by PostgREST max_rows). Raw rows are fetched only for sparklines / chart.
 *
 * V1 known limitations:
 *   - Sources appearing ONLY in crm_people (never linked to any timeline event, task, or
 *     appointment) will not appear in the table. This includes FUB source labels that have
 *     never had a lead or activity (e.g., a brand-new source with 0 records). This is an
 *     honest empty state — such sources have no data to display.
 *   - '<unspecified>' (null source) is always included in the table.
 *   - Task source attribution requires crm_tasks.person_id to be set. Tasks without a
 *     linked person_id are excluded from per-source counts (but included in the KPI total).
 */
export async function getLeadSourcesReport(
  params: LeadSourcesParams,
): Promise<LeadSourcesResult> {
  const cached = unstable_cache(
    () => readLeadSources(params),
    [
      'crm-lead-sources-v1',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-lead-sources', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
