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
 * Drain a read past the PostgREST 1000-row response cap: fetch .range() pages
 * until a short read (the getCrmSources.ts convention). crm_timeline carries
 * ~23K lead_created events alone, so every raw-row read in this report pages —
 * a single unpaged .select() silently returns at most 1000 rows. `page` must
 * apply a deterministic .order() so pages never overlap. Fails SOFT: on a page
 * error the rows read so far are returned (the report degrades, never throws).
 */
async function fetchAllPages<T>(
  label: string,
  page: (fromRow: number, toRow: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let fromRow = 0; fromRow < 200_000; fromRow += PAGE) {
    const { data, error } = await page(fromRow, fromRow + PAGE - 1)
    if (error) {
      console.error(`[getLeadSourcesReport] ${label}`, error.message)
      break
    }
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

/**
 * Embedded crm_people join carrying the source label. Supabase JS infers
 * embedded joins as arrays even for many-to-one relationships — accommodate
 * either shape at runtime.
 */
type EmbeddedSource = { source: string | null } | Array<{ source: string | null }> | null

/**
 * Unpack the embedded crm_people join. Returns null when the row has NO joined
 * person (a LEFT-embed miss — e.g. a task without person_id), which callers
 * exclude from per-source tallies exactly like the old !inner-join count
 * queries did. A person with an unspecified source returns { source: null }
 * and tallies into the '<unspecified>' bucket.
 */
function joinedSource(embed: EmbeddedSource | undefined): { source: string | null } | null {
  if (!embed) return null
  if (Array.isArray(embed)) return embed[0] ?? null
  return embed
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
  //    Group C — All-time lead_created rows (paged) → every source that has ever
  //              had a lead. ~23K events all-time (Farm bulk import included), so
  //              this MUST page past the 1000-row response cap or entire sources
  //              silently vanish from the table.
  //    Group D — Current-period raw rows (paged). Each read carries the joined
  //              crm_people.source so ONE pass serves the time series, the source
  //              discovery, AND the per-source tallies. Chosen over a per-source
  //              COUNT battery (7 queries × N sources per uncached render): the
  //              raw rows are already needed for the sparklines, so the tallies
  //              fall out of a single JS pass at a constant query count.
  //    Group E — Previous-period raw rows (paged) for the compare overlay.

  const [
    prevGroup,
    curTotalGroup,
    allTimeLeadRows,
    curLeadRows,
    curActivityRows,
    curTaskRows,
    curApptRows,
    prevTsGroup,
  ] = await Promise.all([

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

    // ── Group C: All-time lead_created → every source that has ever had a lead ─
    fetchAllPages<{ crm_people: EmbeddedSource }>('discover lead_created', (fromRow, toRow) =>
      sb.from('crm_timeline')
        .select('crm_people!inner(source, assigned_broker)')
        .eq('kind', 'lead_created')
        .in('crm_people.assigned_broker', brokerSlugs)
        .order('id', { ascending: true })
        .range(fromRow, toRow),
    ),

    // ── Group D: Current period raw rows (source-joined, paged) ───────────────
    // d1: lead_created — ts feeds the time series, source feeds per-source NEW LEADS.
    fetchAllPages<{ ts: string; crm_people: EmbeddedSource }>('current leads', (fromRow, toRow) =>
      sb.from('crm_timeline')
        .select('ts, crm_people!inner(source, assigned_broker)')
        .eq('kind', 'lead_created')
        .in('crm_people.assigned_broker', brokerSlugs)
        .gte('ts', start).lte('ts', end)
        .order('id', { ascending: true })
        .range(fromRow, toRow),
    ),
    // d2: activity — LEFT embed so person-less rows stay in the time series the
    //     way the un-joined read kept them. The timeline's own source column
    //     comes along so sequence-run events can be excluded from the tallies in
    //     JS (the COUNT queries' neq filter) while still contributing to source
    //     discovery, which never excluded them.
    fetchAllPages<{ ts: string; kind: string; source: string | null; crm_people: EmbeddedSource }>(
      'current activity',
      (fromRow, toRow) =>
        sb.from('crm_timeline')
          .select('ts, kind, source, crm_people(source)')
          .in('kind', ALL_ACTIVITY_KINDS)
          .in('broker', brokerSlugs)
          .gte('ts', start).lte('ts', end)
          .order('id', { ascending: true })
          .range(fromRow, toRow),
    ),
    // d3: tasks — LEFT embed: tasks without a person_id stay in the time series
    //     + KPI total but are excluded from per-source tallies (the documented
    //     V1 semantic).
    fetchAllPages<{ completed_at: string | null; crm_people: EmbeddedSource }>('current tasks', (fromRow, toRow) =>
      sb.from('crm_tasks')
        .select('completed_at, crm_people(source)')
        .in('assigned_broker', brokerSlugs)
        .gte('completed_at', start).lte('completed_at', end)
        .order('id', { ascending: true })
        .range(fromRow, toRow),
    ),
    // d4: appointments — person_id is non-null by filter, so the embed resolves
    //     for every well-formed row.
    fetchAllPages<{ start_at: string; crm_people: EmbeddedSource }>('current appointments', (fromRow, toRow) =>
      sb.from('crm_appointments')
        .select('start_at, crm_people(source)')
        .in('broker_slug', brokerSlugs)
        .not('person_id', 'is', null)
        .gte('start_at', start).lte('start_at', end)
        .order('id', { ascending: true })
        .range(fromRow, toRow),
    ),

    // ── Group E: Previous period raw rows for compare overlay (paged) ─────────
    Promise.all([
      fetchAllPages<{ ts: string }>('prev leads', (fromRow, toRow) =>
        sb.from('crm_timeline')
          .select('ts, crm_people!inner(assigned_broker)')
          .eq('kind', 'lead_created')
          .in('crm_people.assigned_broker', brokerSlugs)
          .gte('ts', prevStart).lte('ts', prevEnd)
          .order('id', { ascending: true })
          .range(fromRow, toRow),
      ),
      fetchAllPages<{ ts: string; kind: string }>('prev activity', (fromRow, toRow) =>
        sb.from('crm_timeline').select('ts,kind')
          .in('broker', brokerSlugs).in('kind', ALL_ACTIVITY_KINDS)
          .neq('source', 'sequence').gte('ts', prevStart).lte('ts', prevEnd)
          .order('id', { ascending: true })
          .range(fromRow, toRow),
      ),
      fetchAllPages<{ completed_at: string | null }>('prev tasks', (fromRow, toRow) =>
        sb.from('crm_tasks').select('completed_at')
          .in('assigned_broker', brokerSlugs)
          .gte('completed_at', prevStart).lte('completed_at', prevEnd)
          .order('id', { ascending: true })
          .range(fromRow, toRow),
      ),
      fetchAllPages<{ start_at: string }>('prev appointments', (fromRow, toRow) =>
        sb.from('crm_appointments').select('start_at')
          .in('broker_slug', brokerSlugs).not('person_id', 'is', null)
          .gte('start_at', prevStart).lte('start_at', prevEnd)
          .order('id', { ascending: true })
          .range(fromRow, toRow),
      ),
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

  // 5. Discover distinct source keys + tally per-source metrics in one pass over
  //    the paged raw rows. Always include null ('<unspecified>') — FUB shows it
  //    even when all-zero. Discovery = every source that has EVER had a lead
  //    (Group C) plus every source with activity in the period (d2).
  const allSourceKeys = new Set<string | null>([null])
  const perSource = {
    newLeads: new Map<string | null, number>(),
    calls: new Map<string | null, number>(),
    emails: new Map<string | null, number>(),
    texts: new Map<string | null, number>(),
    notes: new Map<string | null, number>(),
    tasksCompleted: new Map<string | null, number>(),
    appointments: new Map<string | null, number>(),
  }
  const bump = (m: Map<string | null, number>, key: string | null) => m.set(key, (m.get(key) ?? 0) + 1)

  for (const row of allTimeLeadRows) {
    const p = joinedSource(row.crm_people)
    if (p) allSourceKeys.add(p.source)
  }
  for (const row of curLeadRows) {
    const p = joinedSource(row.crm_people)
    if (p) bump(perSource.newLeads, p.source)
  }
  // Sequence-run events count for discovery but not for the tallies. The COUNT
  // queries' .neq('source','sequence') is SQL three-valued — a NULL timeline
  // source fails the predicate too — so both are skipped to keep the tallies
  // reconciled with the KPI totals.
  const isCountableActivity = (src: string | null) => src !== null && src !== 'sequence'
  for (const row of curActivityRows) {
    const p = joinedSource(row.crm_people)
    if (p) allSourceKeys.add(p.source)
    if (!p || !isCountableActivity(row.source)) continue
    if (CALL_KINDS.includes(row.kind)) bump(perSource.calls, p.source)
    else if (EMAIL_KINDS.includes(row.kind)) bump(perSource.emails, p.source)
    else if (TEXT_KINDS.includes(row.kind)) bump(perSource.texts, p.source)
    else if (NOTE_KINDS.includes(row.kind)) bump(perSource.notes, p.source)
  }
  for (const row of curTaskRows) {
    const p = joinedSource(row.crm_people)
    if (p) bump(perSource.tasksCompleted, p.source)
  }
  for (const row of curApptRows) {
    const p = joinedSource(row.crm_people)
    if (p) bump(perSource.appointments, p.source)
  }

  // Stable sort: <unspecified> first, then alphabetical
  const distinctSources = Array.from(allSourceKeys).sort((a, b) => {
    if (a === null) return -1
    if (b === null) return 1
    return a.localeCompare(b)
  })

  // 6. Per-source rows straight from the tallies — no per-source query fan-out
  //    (the previous implementation issued 7 exact-count queries per source).
  //
  //    V1 Notes:
  //    - tasks / appointments use person_id → crm_people join (FK auto-resolved by PostgREST).
  //    - Source attribution for calls/emails/texts/notes is "the person being contacted
  //      has source=X AND the activity was logged by a scoped broker".
  //      This is the same semantic FUB uses for its Lead Sources activity columns.

  const perSourceResults: LeadSourcesRow[] = distinctSources.map((srcKey) => ({
    sourceKey: srcKey,
    sourceName: srcKey ?? '<unspecified>',
    newLeads: perSource.newLeads.get(srcKey) ?? 0,
    calls: perSource.calls.get(srcKey) ?? 0,
    emails: perSource.emails.get(srcKey) ?? 0,
    texts: perSource.texts.get(srcKey) ?? 0,
    notes: perSource.notes.get(srcKey) ?? 0,
    tasksCompleted: perSource.tasksCompleted.get(srcKey) ?? 0,
    appointments: perSource.appointments.get(srcKey) ?? 0,
  }))

  // 7. Sort: most new leads first, then alphabetical (unspecified alphabetically first)
  const rows = [...perSourceResults].sort((a, b) => {
    if (b.newLeads !== a.newLeads) return b.newLeads - a.newLeads
    // Both equal newLeads — put unspecified first, then alpha
    if (a.sourceKey === null) return -1
    if (b.sourceKey === null) return 1
    return a.sourceName.localeCompare(b.sourceName)
  })

  // 8. Build time series for the chart. Sequence-run events are excluded from
  //    the activity buckets (same filter as the KPI counts); person-less rows
  //    stay in, matching the totals.
  const [prevLeadRows, prevActivityRows, prevTaskRows, prevApptRows] = prevTsGroup

  const timeSeries = buildTimeSeries(
    curActivityRows.filter((r) => isCountableActivity(r.source)),
    curLeadRows,
    curTaskRows,
    curApptRows,
    start, end,
  )
  const prevTimeSeries = buildTimeSeries(
    prevActivityRows,
    prevLeadRows,
    prevTaskRows,
    prevApptRows,
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
 * KPI totals use { count: 'exact', head: true } (exact DB COUNT(*), never capped by
 * PostgREST max_rows). Per-source counts, source discovery, and the time series tally
 * the raw rows, which are fetched in 1000-row .range() pages until a short read —
 * PostgREST caps every response at 1000 rows, so no read here trusts a single
 * unpaged .select() (~23K all-time lead_created events would otherwise truncate).
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
