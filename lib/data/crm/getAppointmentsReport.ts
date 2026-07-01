import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { resolveDateRange } from './getAgentActivityReport'

// ── Re-export the date preset type from the shared module ──────────────────────
export type { DatePreset } from './getAgentActivityReport'

// ── INFERRED REPORT ───────────────────────────────────────────────────────────
//
// FUB description (hub page): "See a list of appointments & outcomes with
// details on lead source and agent."
//
// No dedicated FUB screen was captured for this report. Layout and KPI set are
// inferred from the FUB hub description + standard FUB Appointments report
// conventions (total / set / by-outcome breakdown, detail list with date, person,
// agent, type, outcome, lead source).
//
// ── Metric → crm_* source mapping ────────────────────────────────────────────
//
// | Metric               | Source table / column                              |
// |----------------------|----------------------------------------------------|
// | total appointments   | crm_appointments, count(*), broker_slug in scope,  |
// |                      |   start_at in [start, end]                         |
// | set (with person)    | same, WHERE person_id IS NOT NULL                  |
// | by outcome           | same, grouped by outcome_id → crm_appointment_     |
// |                      |   outcomes.name                                     |
// | detail rows          | crm_appointments JOIN crm_people (name, source)    |
// |                      |   JOIN crm_appointment_types (name for type_label)  |
// |                      |   JOIN crm_appointment_outcomes (name for outcome)  |
// | lead source          | crm_people.source                                   |
// | previous period      | count('exact',head:true) for delta computation     |
//
// ── Types ─────────────────────────────────────────────────────────────────────

export type AppointmentsParams = {
  /** null = all brokers (superuser / Everyone view) */
  brokerSlug: string | null
  datePreset: string
  dateStart?: string | null
  dateEnd?: string | null
}

/** One row in the appointments detail table. */
export type AppointmentRow = {
  id: number
  /** ISO datetime string for display */
  startAt: string
  endAt: string
  allDay: boolean
  title: string
  location: string | null
  /** broker_slug of the assigned agent */
  brokerSlug: string
  /** Display name resolved from the brokers roster */
  brokerName: string
  /** Appointment type label (from crm_appointment_types.name) — null if no type set */
  typeLabel: string | null
  /** Outcome label (from crm_appointment_outcomes.name) — null if no outcome recorded */
  outcomeLabel: string | null
  /** person_id from crm_appointments */
  personId: number | null
  /** Display name from crm_people — null if no linked person or person deleted */
  personName: string | null
  /** Lead source from crm_people.source — null if no linked person */
  leadSource: string | null
}

/** Per-outcome KPI bucket (for the outcome breakdown tiles). */
export type OutcomeBucket = {
  outcomeName: string
  count: number
}

export type AppointmentsTotals = {
  /** All appointments in scope (broker + date range) */
  total: number
  /** Appointments with a linked person_id (i.e. "set" — attached to a lead) */
  set: number
  /** Previous period total (for delta computation in KPI tiles) */
  previousTotal: number
  /** Previous period set count */
  previousSet: number
}

export type AppointmentsResult = {
  totals: AppointmentsTotals
  /** Up to 500 most-recent appointment rows for the detail table */
  rows: AppointmentRow[]
  /** Breakdown of appointment count by outcome (current period only) */
  byOutcome: OutcomeBucket[]
  dateStart: string
  dateEnd: string
  prevDateStart: string
  prevDateEnd: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute the preceding period of the same duration immediately before [start, end]. */
function resolvePreviousPeriod(start: string, end: string): { prevStart: string; prevEnd: string } {
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

const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}
// Re-exported for the page component to use for the avatar column.
export { BROKER_HEADSHOT }

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readAppointmentsReport(params: AppointmentsParams): Promise<AppointmentsResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(params.datePreset, params.dateStart, params.dateEnd)
  const { prevStart, prevEnd } = resolvePreviousPeriod(start, end)

  // 1. Broker roster — crm-active brokers with a crm_slug
  const { data: brokerRows, error: brokerError } = await sb
    .from('brokers')
    .select('crm_slug,display_name,photo_url')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)
    .order('sort_order', { ascending: true })

  if (brokerError) console.error('[getAppointmentsReport] brokers error', brokerError.message)

  const allBrokers = (brokerRows ?? []).filter((b) => b.crm_slug) as Array<{
    crm_slug: string
    display_name: string | null
    photo_url: string | null
  }>

  const scopedBrokers = params.brokerSlug
    ? allBrokers.filter((b) => b.crm_slug === params.brokerSlug)
    : allBrokers

  const brokerSlugs = scopedBrokers.map((b) => b.crm_slug)

  const EMPTY: AppointmentsResult = {
    totals: { total: 0, set: 0, previousTotal: 0, previousSet: 0 },
    rows: [],
    byOutcome: [],
    dateStart: start,
    dateEnd: end,
    prevDateStart: prevStart,
    prevDateEnd: prevEnd,
  }

  if (brokerSlugs.length === 0) return EMPTY

  // 2. Lookup tables — appointment types + outcomes (small, static-ish, no scope filter)
  const [typesRes, outcomesRes] = await Promise.all([
    sb.from('crm_appointment_types').select('id,name').eq('active', true).order('ord'),
    sb.from('crm_appointment_outcomes').select('id,name').eq('active', true).order('ord'),
  ])

  const typeMap = new Map<number, string>(
    ((typesRes.data ?? []) as Array<{ id: number; name: string }>).map((r) => [r.id, r.name]),
  )
  const outcomeMap = new Map<number, string>(
    ((outcomesRes.data ?? []) as Array<{ id: number; name: string }>).map((r) => [r.id, r.name]),
  )

  // 3. Parallel count queries (current + previous totals, both broker-scoped).
  //    Uses { count: 'exact', head: true } so the real DB COUNT(*) is returned
  //    via the Content-Range header — never capped by the Supabase max_rows limit.
  const [
    { count: totalCount },
    { count: setCount },
    { count: prevTotalCount },
    { count: prevSetCount },
  ] = await Promise.all([
    // current period — all appointments
    sb.from('crm_appointments').select('id', { count: 'exact', head: true })
      .in('broker_slug', brokerSlugs)
      .gte('start_at', start).lte('start_at', end),
    // current period — set (has a linked person)
    sb.from('crm_appointments').select('id', { count: 'exact', head: true })
      .in('broker_slug', brokerSlugs)
      .not('person_id', 'is', null)
      .gte('start_at', start).lte('start_at', end),
    // previous period — all
    sb.from('crm_appointments').select('id', { count: 'exact', head: true })
      .in('broker_slug', brokerSlugs)
      .gte('start_at', prevStart).lte('start_at', prevEnd),
    // previous period — set
    sb.from('crm_appointments').select('id', { count: 'exact', head: true })
      .in('broker_slug', brokerSlugs)
      .not('person_id', 'is', null)
      .gte('start_at', prevStart).lte('start_at', prevEnd),
  ])

  // 4. Detail rows — up to 500 most-recent appointments in scope.
  //    Join crm_people for name + source. Outcome + type resolved from lookup maps.
  //    Ordered newest-first to mirror FUB's Appointments list default.
  const { data: apptRows, error: apptError } = await sb
    .from('crm_appointments')
    .select(
      [
        'id',
        'title',
        'start_at',
        'end_at',
        'all_day',
        'location',
        'broker_slug',
        'type_id',
        'outcome_id',
        'person_id',
        'crm_people(name,source)',
      ].join(','),
    )
    .in('broker_slug', brokerSlugs)
    .gte('start_at', start)
    .lte('start_at', end)
    .order('start_at', { ascending: false })
    .limit(500)

  if (apptError) console.error('[getAppointmentsReport] appointments error', apptError.message)

  // Build the broker display-name map (slug → display name)
  const brokerNameMap = new Map<string, string>(
    allBrokers.map((b) => [b.crm_slug, b.display_name ?? b.crm_slug]),
  )

  type RawAppt = {
    id: number
    title: string
    start_at: string
    end_at: string
    all_day: boolean
    location: string | null
    broker_slug: string
    type_id: number | null
    outcome_id: number | null
    person_id: number | null
    crm_people: { name: string | null; source: string | null } | null
  }

  const rows: AppointmentRow[] = ((apptRows ?? []) as unknown as RawAppt[]).map((r) => ({
    id: r.id,
    startAt: r.start_at,
    endAt: r.end_at,
    allDay: r.all_day,
    title: r.title,
    location: r.location,
    brokerSlug: r.broker_slug,
    brokerName: brokerNameMap.get(r.broker_slug) ?? r.broker_slug,
    typeLabel: r.type_id != null ? (typeMap.get(r.type_id) ?? null) : null,
    outcomeLabel: r.outcome_id != null ? (outcomeMap.get(r.outcome_id) ?? null) : null,
    personId: r.person_id,
    personName: r.crm_people?.name ?? null,
    leadSource: r.crm_people?.source ?? null,
  }))

  // 5. By-outcome breakdown — tally from the fetched rows (bounded by the 500-row
  //    limit; for an exact count per-outcome on high-volume periods, add dedicated
  //    count queries. At Ryan Realty's appointment volume this is accurate.)
  const outcomeCounts = new Map<string, number>()
  for (const r of rows) {
    const label = r.outcomeLabel ?? '(no outcome)'
    outcomeCounts.set(label, (outcomeCounts.get(label) ?? 0) + 1)
  }
  const byOutcome: OutcomeBucket[] = Array.from(outcomeCounts.entries())
    .map(([outcomeName, count]) => ({ outcomeName, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totals: {
      total: totalCount ?? 0,
      set: setCount ?? 0,
      previousTotal: prevTotalCount ?? 0,
      previousSet: prevSetCount ?? 0,
    },
    rows,
    byOutcome,
    dateStart: start,
    dateEnd: end,
    prevDateStart: prevStart,
    prevDateEnd: prevEnd,
  }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Appointments report data — list of appointments with outcome, type, lead
 * source, and per-period KPI totals.
 *
 * INFERRED: No dedicated FUB screen was captured. Report shape is inferred
 * from the FUB hub description ("See a list of appointments & outcomes with
 * details on lead source and agent.") + standard FUB Appointments conventions.
 *
 * Cached 10 minutes to match FUB's documented reporting cache TTL.
 * Cache is keyed on filter params so different combos get separate entries.
 *
 * Source tables:
 *   - crm_appointments: id, start_at, end_at, all_day, title, location,
 *       broker_slug, type_id, outcome_id, person_id
 *   - crm_people: name, source (joined via person_id)
 *   - crm_appointment_types: id, name (lookup for type_label)
 *   - crm_appointment_outcomes: id, name (lookup for outcome_label)
 *
 * V1 approximations (documented):
 *   - byOutcome uses the 500-row detail fetch, not dedicated COUNT queries.
 *     Accurate at Ryan Realty's appointment volume (<500/month typical);
 *     add per-outcome COUNT('exact',head) queries if volume grows.
 *   - "Set" = has a linked person_id. FUB's definition may differ slightly
 *     (e.g. requires a confirmed invite_sent); tracked as a V1 approximation.
 */
export async function getAppointmentsReport(
  params: AppointmentsParams,
): Promise<AppointmentsResult> {
  const cached = unstable_cache(
    () => readAppointmentsReport(params),
    [
      'crm-appointments-report-v1',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-appointments', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
