import 'server-only'
import { unstable_cache } from 'next/cache'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/data/client'
import { resolveDateRange } from './getAgentActivityReport'
import type { DatePreset } from './getAgentActivityReport'
import { classifyLeadSource } from './leadSourceTaxonomy'

export type { DatePreset }

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContactAttemptsParams = {
  /** null = all brokers (superuser / Everyone view) */
  brokerSlug: string | null
  datePreset: DatePreset | 'custom'
  dateStart?: string | null  // ISO datetime, required when preset='custom'
  dateEnd?: string | null    // ISO datetime, required when preset='custom'
}

export type ContactAttemptsRow = {
  /** Display label — null source maps to '<unspecified>' */
  sourceName: string
  /** Raw crm_people.source value (null = unspecified) */
  sourceKey: string | null
  /** Distinct leads with a lead_created event in the period for this source */
  leads: number
  /** Total outbound contact events for those leads in the period */
  totalAttempts: number
  /**
   * totalAttempts / leads (0 when leads = 0).
   * Expressed as a float; display with one decimal.
   */
  avgAttempts: number
}

export type ContactAttemptsTotals = {
  /** Total leads across all sources */
  leads: number
  /** Total outbound contact events across all leads */
  totalAttempts: number
  /** Overall average across all leads regardless of source */
  avgAttempts: number
}

export type ContactAttemptsResult = {
  /** Per-source rows, sorted most-leads-first then alphabetical */
  rows: ContactAttemptsRow[]
  /** KPI totals for the current period */
  totals: ContactAttemptsTotals
  /** Totals for the immediately preceding period of equal length (KPI delta) */
  previousTotals: ContactAttemptsTotals
  dateStart: string
  dateEnd: string
  prevDateStart: string
  prevDateEnd: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Timeline kinds that count as an outbound contact attempt.
 * 'voicemail' is included — reaching voicemail is still an outreach event.
 * Inbound ('sms_in', 'email_in', 'call' when the lead calls us) and internal
 * ('note') events are excluded. Automated drip events are filtered via
 * .neq('source', 'sequence') at query time.
 */
const OUTBOUND_ATTEMPT_KINDS = ['call', 'voicemail', 'email_out', 'sms_out'] as const

/** Rows per paginated sweep — matches Supabase max_rows default. */
const PAGE_SIZE = 1000

// ── Period helper ──────────────────────────────────────────────────────────────

function resolvePreviousPeriod(
  start: string,
  end: string,
): { prevStart: string; prevEnd: string } {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const durationMs = endMs - startMs
  const prevEndMs = startMs - 1
  return {
    prevStart: new Date(prevEndMs - durationMs).toISOString(),
    prevEnd: new Date(prevEndMs).toISOString(),
  }
}

// ── Paginated sweep helpers ────────────────────────────────────────────────────

/**
 * Paginate crm_timeline kind='lead_created' events in [start, end] for scoped
 * brokers. Returns Map<personId, source> for GENUINE INBOUND leads only.
 *
 * The lead_created trigger fires on every crm_people insert, so the raw events
 * include the bulk Farm/Import/Sphere/Expired/FSBO outreach rows — lists we
 * built, never leads. Each row's source is classified through
 * leadSourceTaxonomy and only attributable (web/portal/phone/social/referral)
 * rows are kept, matching getLeadIntake + getOverviewReport (the org-wide
 * "new leads" definition every dashboard shares). Classification is
 * keyword-based JS, so it cannot be pushed into PostgREST — filter runs in app
 * code after each page.
 *
 * Pagination loop (PAGE_SIZE=1000, stable order until a short read) prevents
 * the Supabase max_rows cap from silently truncating counts. A monthly window
 * at a 3-broker brokerage is typically < 100 rows, but 'this_year' or bulk
 * inserts may exceed 1000 raw event rows.
 *
 * The crm_people!inner join scopes to `assigned_broker IN brokerSlugs` and
 * returns the person's source label in one round trip per page.
 */
async function buildLeadSourceMap(
  sb: SupabaseClient,
  brokerSlugs: string[],
  start: string,
  end: string,
): Promise<Map<number, string | null>> {
  const personSourceMap = new Map<number, string | null>()
  let offset = 0

  // Supabase JS infers embedded joins as either array or object depending on
  // the relationship cardinality. Use `unknown` cast + runtime check.
  type JoinedPerson =
    | Array<{ source: string | null; assigned_broker: string | null }>
    | { source: string | null; assigned_broker: string | null }
    | null

  while (true) {
    const { data, error } = await sb
      .from('crm_timeline')
      .select('person_id, crm_people!inner(source, assigned_broker)')
      .eq('kind', 'lead_created')
      .in('crm_people.assigned_broker', brokerSlugs)
      .gte('ts', start)
      .lte('ts', end)
      // Stable order on the unique id: .range() without ORDER BY is
      // nondeterministic between pages (rows can drop or double-count across
      // page boundaries).
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('[getContactAttemptsReport] lead_created page error', error.message)
      break
    }
    if (!data || data.length === 0) break

    for (const row of data as unknown as Array<{
      person_id: number
      crm_people: JoinedPerson
    }>) {
      const joined = row.crm_people
      const source: string | null = joined
        ? Array.isArray(joined)
          ? (joined[0]?.source ?? null)
          : ((joined as { source: string | null }).source ?? null)
        : null
      // Taxonomy gate — outreach-list / import / unknown rows are not leads.
      if (!classifyLeadSource(source).attributable) continue
      personSourceMap.set(row.person_id, source)
    }

    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return personSourceMap
}

/**
 * Paginate outbound contact events in [start, end] for scoped brokers.
 * Returns Map<personId, attemptCount>.
 *
 * Scoped by crm_timeline.broker (who placed the call / sent the message).
 * Excludes source='sequence' (automated drip sequences are not manual attempts).
 *
 * All person_ids are returned — the caller filters to known-lead persons in JS.
 */
async function buildAttemptMap(
  sb: SupabaseClient,
  brokerSlugs: string[],
  start: string,
  end: string,
): Promise<Map<number, number>> {
  const attemptMap = new Map<number, number>()
  let offset = 0

  while (true) {
    const { data, error } = await sb
      .from('crm_timeline')
      .select('person_id')
      .in('kind', [...OUTBOUND_ATTEMPT_KINDS])
      .in('broker', brokerSlugs)
      .neq('source', 'sequence')
      .gte('ts', start)
      .lte('ts', end)
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('[getContactAttemptsReport] outbound events page error', error.message)
      break
    }
    if (!data || data.length === 0) break

    for (const row of data as Array<{ person_id: number }>) {
      attemptMap.set(row.person_id, (attemptMap.get(row.person_id) ?? 0) + 1)
    }

    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return attemptMap
}

// ── Aggregation helpers ────────────────────────────────────────────────────────

/**
 * Combine the two maps into per-source rows.
 *
 * Only persons present in `personSourceMap` (i.e., had a lead_created event)
 * are counted. Their attempt counts are looked up from `attemptMap`; persons
 * with no outbound events contribute 0 to the average (they were leads but
 * received no attempts in the period — honest empty state).
 */
function aggregateBySource(
  personSourceMap: Map<number, string | null>,
  attemptMap: Map<number, number>,
): ContactAttemptsRow[] {
  const sourceLeads = new Map<string | null, number>()
  const sourceTotalAttempts = new Map<string | null, number>()

  for (const [personId, source] of personSourceMap.entries()) {
    sourceLeads.set(source, (sourceLeads.get(source) ?? 0) + 1)
    sourceTotalAttempts.set(
      source,
      (sourceTotalAttempts.get(source) ?? 0) + (attemptMap.get(personId) ?? 0),
    )
  }

  const rows: ContactAttemptsRow[] = []
  for (const [sourceKey, leads] of sourceLeads.entries()) {
    const totalAttempts = sourceTotalAttempts.get(sourceKey) ?? 0
    rows.push({
      sourceName: sourceKey ?? '<unspecified>',
      sourceKey,
      leads,
      totalAttempts,
      avgAttempts: leads > 0 ? totalAttempts / leads : 0,
    })
  }

  // Sort: most leads first → <unspecified> before alphabetical → alpha
  rows.sort((a, b) => {
    if (b.leads !== a.leads) return b.leads - a.leads
    if (a.sourceKey === null) return -1
    if (b.sourceKey === null) return 1
    return a.sourceName.localeCompare(b.sourceName)
  })

  return rows
}

function deriveTotals(rows: ContactAttemptsRow[]): ContactAttemptsTotals {
  const leads = rows.reduce((s, r) => s + r.leads, 0)
  const totalAttempts = rows.reduce((s, r) => s + r.totalAttempts, 0)
  return {
    leads,
    totalAttempts,
    avgAttempts: leads > 0 ? totalAttempts / leads : 0,
  }
}

const EMPTY_TOTALS: ContactAttemptsTotals = { leads: 0, totalAttempts: 0, avgAttempts: 0 }

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readContactAttempts(
  params: ContactAttemptsParams,
): Promise<ContactAttemptsResult> {
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

  if (brokerError) {
    console.error('[getContactAttemptsReport] brokers error', brokerError.message)
  }

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
      dateStart: start,
      dateEnd: end,
      prevDateStart: prevStart,
      prevDateEnd: prevEnd,
    }
  }

  // 2. Run current and previous period sweeps in parallel.
  //
  //    Each period requires two paginated passes:
  //
  //    Pass A — crm_timeline (kind='lead_created') JOIN crm_people
  //             → Map<personId, source>
  //             Identifies which people are "leads in this period" and their source.
  //
  //    Pass B — crm_timeline (kind IN outbound_attempt_kinds, broker IN brokerSlugs)
  //             → Map<personId, attemptCount>
  //             Counts outbound contact events per person for the scoped brokers.
  //
  //    Both use PAGE_SIZE=1000 pagination to avoid the Supabase max_rows cap.
  //    Per-source avg is computed in JS by combining the two maps — no raw SQL,
  //    no GROUP BY, no query that returns more rows than PAGE_SIZE at once.
  //
  //    Four independent async functions run; Promise.all fires all in parallel.

  const [
    [curPersonSourceMap, curAttemptMap],
    [prevPersonSourceMap, prevAttemptMap],
  ] = await Promise.all([
    Promise.all([
      buildLeadSourceMap(sb, brokerSlugs, start, end),
      buildAttemptMap(sb, brokerSlugs, start, end),
    ]),
    Promise.all([
      buildLeadSourceMap(sb, brokerSlugs, prevStart, prevEnd),
      buildAttemptMap(sb, brokerSlugs, prevStart, prevEnd),
    ]),
  ])

  // 3. Aggregate per-source rows for each period
  const rows = aggregateBySource(curPersonSourceMap, curAttemptMap)
  const prevRows = aggregateBySource(prevPersonSourceMap, prevAttemptMap)

  // 4. Derive KPI totals from the aggregated rows
  const totals = deriveTotals(rows)
  const previousTotals = deriveTotals(prevRows)

  return {
    rows,
    totals,
    previousTotals,
    dateStart: start,
    dateEnd: end,
    prevDateStart: prevStart,
    prevDateEnd: prevEnd,
  }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Contact Attempts report — average outbound contacts per lead, broken down by source.
 *
 * INFERRED: No dedicated FUB frame exists for Contact Attempts as a standalone
 * page. This report mirrors the semantic of FUB's "Contact Attempts" subview
 * of Lead Sources (hub href: /admin/crm/reporting/lead-sources?view=attempts).
 * Metric definitions are inferred from the FUB Lead Sources documentation and
 * the hub card description: "See how many times you follow up on average by
 * source." (see @/lib/crm/reporting-constants HUB_LEAD_SOURCE_REPORTS).
 *
 * Metric → crm_* table mapping:
 *
 *   leads         → crm_timeline (kind='lead_created', ts in [start,end])
 *                   JOIN crm_people (source + assigned_broker scope),
 *                   classified via leadSourceTaxonomy — only attributable
 *                   inbound sources count (Farm/Import/Sphere/Expired/FSBO
 *                   outreach lists excluded, matching getLeadIntake).
 *                   COUNT(DISTINCT person_id) per source
 *
 *   totalAttempts → crm_timeline (kind IN call|voicemail|email_out|sms_out)
 *                   WHERE broker IN brokerSlugs, source != 'sequence', ts in range
 *                   Events filtered in JS to person_ids from the lead set above
 *                   SUM of events per source
 *
 *   avgAttempts   → totalAttempts / leads  (0 when leads = 0)
 *
 * 1000-cap avoidance:
 *   Both paginated sweeps use .range(offset, offset+999) loops — never
 *   .count('exact') because the per-person raw rows are needed for aggregation.
 *   Aggregation runs entirely in JavaScript; no GROUP BY or raw SQL.
 *
 * Cached 10 minutes (matches FUB's documented reporting cache TTL).
 * Cache keys include all filter params so different filter combos get separate
 * cache entries.
 *
 * V1 known limitations:
 *   - Leads are the taxonomy-filtered inbound set, so per-source rows only show
 *     genuine inbound sources — outreach lists we built (Farm, Import, Sphere,
 *     Expired, FSBO) never appear as "leads" here.
 *   - Outbound events are scoped by crm_timeline.broker (who sent the message),
 *     not by crm_people.assigned_broker. A broker contacting another broker's
 *     lead appears in the sender's scope, not the assignee's.
 *   - Automated drip touches (source='sequence') are excluded. Only manual
 *     broker outreach counts as a contact attempt.
 *   - 'voicemail' is counted as an attempt (dialing and reaching voicemail
 *     is an outbound contact event from the timeline perspective).
 *   - Leads with a lead_created event but no outbound attempts in the period
 *     contribute 0 to the average (honest — they were not contacted).
 */
export async function getContactAttemptsReport(
  params: ContactAttemptsParams,
): Promise<ContactAttemptsResult> {
  const cached = unstable_cache(
    () => readContactAttempts(params),
    [
      // v2: leads switched from raw lead_created counts to the
      // taxonomy-filtered inbound definition (2026-07-14).
      'crm-contact-attempts-v2',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-contact-attempts', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
