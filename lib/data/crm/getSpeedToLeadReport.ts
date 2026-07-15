import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { resolveDateRange } from './getAgentActivityReport'
import type { DatePreset } from './getAgentActivityReport'
import { classifyLeadSource } from './leadSourceTaxonomy'

// INFERRED REPORT — no direct FUB Speed to Lead screen frame exists in the captured
// reference set. Definition is inferred from FUB's published help documentation:
// "Speed to Lead" = time from lead_created event to the first outbound contact
// (call / email_out / sms_out / voicemail) to that person, aggregated by lead source.
// Audit verified 2026-07-01 against project dwvlophlbvvygjfxcrhm:
//   18,207 lead_created events · 18 distinct sources (all-time)
//   39,692 email_out · 2,122 sms_out · 64 call · 1 voicemail outbound events
//   Ryan-Realty.com: median 34s · Farm: median ~78 days (bulk import + drip pattern)
//   inbound-call: median 0s (the inbound call IS the lead event)
//
// Lead universe (taxonomy fix 2026-07-14): the lead_created trigger fires on
// every crm_people insert, so the raw events include the bulk
// Farm/Import/Sphere/Expired/FSBO outreach rows — lists we built, never leads
// (the Farm "median ~78 days" above is that artifact). Each event's source is
// classified via leadSourceTaxonomy and only attributable inbound leads
// (web/portal/phone/social/referral) enter the report, matching getLeadIntake +
// getOverviewReport — the org-wide "new leads" definition.

export type { DatePreset }

// ── Types ─────────────────────────────────────────────────────────────────────

export type SpeedToLeadParams = {
  /** null = all brokers (superuser/Everyone view) */
  brokerSlug: string | null
  datePreset: DatePreset | 'custom'
  dateStart?: string | null
  dateEnd?: string | null
}

/** Per-source row for the Speed to Lead breakdown table. */
export type SpeedToLeadRow = {
  /** Display label; null source maps to '<unspecified>' */
  sourceName: string
  /** Raw crm_people.source value (null = unspecified) */
  sourceKey: string | null
  /** Genuine inbound leads created in the date window by this source (leadSourceTaxonomy — outreach lists excluded) */
  totalLeads: number
  /** Leads that received at least one outbound contact after lead creation */
  contactedLeads: number
  /** Median elapsed seconds from lead_created → first outbound contact (null if none contacted) */
  medianSeconds: number | null
  /** Average elapsed seconds from lead_created → first outbound contact (null if none contacted) */
  avgSeconds: number | null
}

export type SpeedToLeadTotals = {
  totalLeads: number
  contactedLeads: number
  medianSeconds: number | null
  avgSeconds: number | null
}

export type SpeedToLeadResult = {
  /** Rows sorted by totalLeads DESC */
  rows: SpeedToLeadRow[]
  /** Aggregate totals across all sources */
  totals: SpeedToLeadTotals
  dateStart: string
  dateEnd: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Outbound contact kinds that count as "first contact" for Speed to Lead.
 * Includes automated outreach (email_out from drip sequences) — this matches
 * FUB's behavior where the first touch in any channel counts.
 */
const OUTBOUND_KINDS = ['call', 'email_out', 'sms_out', 'voicemail'] as const

/**
 * Supabase PostgREST default page size.
 * Never use rows.length as a count — this cap silently truncates large result sets.
 * All queries that might return >1000 rows use .range() pagination loops.
 */
const PAGE_SIZE = 1000

/**
 * Max person_ids per .in() clause to keep PostgREST URL lengths safe (~2 KB limit).
 * At 200 ids × ~10 chars each = ~2 KB, well within the safe zone.
 */
const PERSON_ID_CHUNK_SIZE = 200

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Median of a pre-sorted array of numbers. Returns null for empty arrays. */
function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

/** Average of an array of numbers. Returns null for empty arrays. */
function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

// ── Raw type helpers for Supabase join results ─────────────────────────────────
// Supabase JS infers embedded joins as arrays even for many-to-one relationships.
// Cast through unknown to accommodate either shape at runtime.

type PersonInner = { source: string | null; assigned_broker: string | null }
type LeadEventRaw = {
  person_id: number
  ts: string
  crm_people: PersonInner[] | PersonInner | null
}

type ContactEventRaw = {
  person_id: number
  ts: string
  kind: string
}

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readSpeedToLead(params: SpeedToLeadParams): Promise<SpeedToLeadResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(params.datePreset, params.dateStart, params.dateEnd)

  const EMPTY: SpeedToLeadResult = {
    rows: [],
    totals: { totalLeads: 0, contactedLeads: 0, medianSeconds: null, avgSeconds: null },
    dateStart: start,
    dateEnd: end,
  }

  // 1. Broker roster — CRM-active brokers with a crm_slug
  const { data: brokerRows, error: brokerError } = await sb
    .from('brokers')
    .select('crm_slug')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)
    .order('sort_order', { ascending: true })

  if (brokerError) console.error('[getSpeedToLeadReport] brokers error', brokerError.message)

  const allBrokerSlugs = (brokerRows ?? [])
    .map((b) => b.crm_slug)
    .filter(Boolean) as string[]

  const brokerSlugs = params.brokerSlug
    ? allBrokerSlugs.filter((s) => s === params.brokerSlug)
    : allBrokerSlugs

  if (brokerSlugs.length === 0) return EMPTY

  // ── Phase 1: Paginate all lead_created events in [start, end] for scoped brokers ──
  //
  // Uses .range(offset, offset + PAGE_SIZE - 1) in a loop to bypass the 1000-row cap.
  // The crm_people!inner() join scopes results to the selected broker(s) AND gives
  // us the person's source label in the same round trip.
  //
  // NEVER use rows.length as a count — the 1000-row default cap would silently
  // truncate brokers with >1000 leads in a period (defect documented in agent-activity).

  const leadEvents: LeadEventRaw[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('crm_timeline')
      .select('person_id, ts, crm_people!inner(source, assigned_broker)')
      .eq('kind', 'lead_created')
      .in('crm_people.assigned_broker', brokerSlugs)
      .gte('ts', start)
      .lte('ts', end)
      // Stable order on the unique id: .range() without ORDER BY is
      // nondeterministic between pages — Postgres may reorder rows, dropping or
      // double-counting events across page boundaries (same hazard documented in
      // buildCrmPeopleQuery's tie-breaker).
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('[getSpeedToLeadReport] lead_created page error', error.message)
      break
    }
    const page = (data ?? []) as unknown as LeadEventRaw[]
    leadEvents.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  if (leadEvents.length === 0) return EMPTY

  // Normalize: for each person, keep the EARLIEST lead_created event in the window.
  // A person can technically appear multiple times if re-queued.
  // Taxonomy gate: only genuine inbound leads (classifyLeadSource attributable)
  // enter the universe — Farm/Import/Sphere/Expired/FSBO outreach rows are lists
  // we built, never leads. Classification is keyword-based JS, so it cannot be
  // pushed into PostgREST; the filter runs here over the paged rows.
  const personLeadMap = new Map<number, { lead_ts: string; source: string | null }>()

  for (const ev of leadEvents) {
    const people = Array.isArray(ev.crm_people) ? ev.crm_people[0] : ev.crm_people
    const src = people?.source ?? null
    if (!classifyLeadSource(src).attributable) continue

    const existing = personLeadMap.get(ev.person_id)
    if (!existing || ev.ts < existing.lead_ts) {
      personLeadMap.set(ev.person_id, { lead_ts: ev.ts, source: src })
    }
  }

  if (personLeadMap.size === 0) return EMPTY

  const personIds = Array.from(personLeadMap.keys())

  // ── Phase 2: Fetch all outbound contacts for the found person_ids ────────────
  //
  // Chunked into PERSON_ID_CHUNK_SIZE batches to keep URL lengths safe.
  // Each chunk is independently paginated in case a single person has >1000 contacts.
  // Lower bound ts >= start: since lead_created.ts >= start, any contact AFTER
  // creation must also have ts >= start, so this filter correctly limits the fetch.
  //
  // No broker filter here — we capture all outbound contacts to those leads
  // (including automated drip emails that may not carry a broker attribution).

  const chunks: number[][] = []
  for (let i = 0; i < personIds.length; i += PERSON_ID_CHUNK_SIZE) {
    chunks.push(personIds.slice(i, i + PERSON_ID_CHUNK_SIZE))
  }

  // Fetch chunks in parallel; each chunk is paginated internally.
  const allContacts: ContactEventRaw[] = []

  await Promise.all(
    chunks.map(async (chunk) => {
      let chunkOffset = 0
      while (true) {
        const { data, error } = await sb
          .from('crm_timeline')
          .select('person_id, ts, kind')
          .in('kind', [...OUTBOUND_KINDS])
          .in('person_id', chunk)
          .gte('ts', start)
          // Stable order — same page-boundary determinism requirement as Phase 1.
          .order('id', { ascending: true })
          .range(chunkOffset, chunkOffset + PAGE_SIZE - 1)

        if (error) {
          console.error('[getSpeedToLeadReport] contacts page error', error.message)
          break
        }
        const page = (data ?? []) as unknown as ContactEventRaw[]
        allContacts.push(...page)
        if (page.length < PAGE_SIZE) break
        chunkOffset += PAGE_SIZE
      }
    }),
  )

  // ── Phase 3: Per-person — first outbound contact AFTER their lead_created.ts ──
  //
  // Build: person_id → earliest contact ts where contact.ts > lead_created.ts
  const firstContactMap = new Map<number, string>() // person_id → contact ts

  for (const contact of allContacts) {
    const lead = personLeadMap.get(contact.person_id)
    if (!lead) continue
    if (contact.ts <= lead.lead_ts) continue // must be strictly AFTER lead creation

    const existing = firstContactMap.get(contact.person_id)
    if (!existing || contact.ts < existing) {
      firstContactMap.set(contact.person_id, contact.ts)
    }
  }

  // ── Phase 4: Aggregate by source ─────────────────────────────────────────────

  type SourceAgg = {
    sourceKey: string | null
    totalLeads: number
    contactedLeads: number
    elapsedSecondsArr: number[]
  }

  const sourceAgg = new Map<string, SourceAgg>()

  for (const [personId, { lead_ts, source }] of personLeadMap) {
    // Map key: use a sentinel string for null sources so Map.get() works
    const mapKey = source ?? '\x00unspecified'
    const agg: SourceAgg = sourceAgg.get(mapKey) ?? {
      sourceKey: source,
      totalLeads: 0,
      contactedLeads: 0,
      elapsedSecondsArr: [],
    }

    agg.totalLeads++

    const contactTs = firstContactMap.get(personId)
    if (contactTs) {
      agg.contactedLeads++
      const elapsed = Math.round(
        (new Date(contactTs).getTime() - new Date(lead_ts).getTime()) / 1000,
      )
      if (elapsed >= 0) {
        agg.elapsedSecondsArr.push(elapsed)
      }
    }

    sourceAgg.set(mapKey, agg)
  }

  // 5. Build rows — sort elapsed for median, then sort rows by totalLeads DESC
  const rows: SpeedToLeadRow[] = Array.from(sourceAgg.values())
    .map((agg): SpeedToLeadRow => {
      const sorted = [...agg.elapsedSecondsArr].sort((a, b) => a - b)
      return {
        sourceName: agg.sourceKey ?? '<unspecified>',
        sourceKey: agg.sourceKey,
        totalLeads: agg.totalLeads,
        contactedLeads: agg.contactedLeads,
        medianSeconds: median(sorted),
        avgSeconds: average(agg.elapsedSecondsArr),
      }
    })
    .sort((a, b) => {
      if (b.totalLeads !== a.totalLeads) return b.totalLeads - a.totalLeads
      // Tie-break: unspecified first, then alpha
      if (a.sourceKey === null) return -1
      if (b.sourceKey === null) return 1
      return a.sourceName.localeCompare(b.sourceName)
    })

  // 6. Compute totals across all sources
  const allElapsedSorted: number[] = []
  let totalLeads = 0
  let contactedLeads = 0

  for (const agg of sourceAgg.values()) {
    totalLeads += agg.totalLeads
    contactedLeads += agg.contactedLeads
    for (const s of agg.elapsedSecondsArr) allElapsedSorted.push(s)
  }
  allElapsedSorted.sort((a, b) => a - b)

  const totals: SpeedToLeadTotals = {
    totalLeads,
    contactedLeads,
    medianSeconds: median(allElapsedSorted),
    avgSeconds: average(allElapsedSorted),
  }

  return { rows, totals, dateStart: start, dateEnd: end }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Speed to Lead report — per-source elapsed time from lead_created to first outbound contact.
 * Cached 10 minutes to match the reporting cache TTL across all CRM reports.
 *
 * INFERRED REPORT: no direct FUB Speed to Lead frame was captured. Definition is inferred
 * from FUB's published help documentation and standard industry Speed to Lead semantics.
 *
 * Metric → crm_* table mapping:
 *   totalLeads     → COUNT(DISTINCT person_id) from crm_timeline WHERE kind='lead_created'
 *                    AND ts IN [start,end], JOIN crm_people for source + broker scope,
 *                    classified via leadSourceTaxonomy — only attributable inbound
 *                    sources count (Farm/Import/Sphere/Expired/FSBO outreach lists
 *                    excluded, matching getLeadIntake + getOverviewReport).
 *                    Paginated with .range() — never rows.length (1000-row cap defect).
 *
 *   contactedLeads → subset of totalLeads WHERE at least one crm_timeline row exists
 *                    with kind IN ('call','email_out','sms_out','voicemail') AND
 *                    person_id = lead.person_id AND ts > lead_created.ts.
 *                    Outbound contacts fetched in chunks of 200 person_ids, paginated.
 *
 *   medianSeconds  → PERCENTILE_CONT(0.5) of elapsed_seconds across contacted leads
 *                    in the source group (computed in-process after paginated fetch).
 *
 *   avgSeconds     → AVG(elapsed_seconds) across contacted leads in the source group.
 *
 * Design choice — in-process aggregation vs SQL:
 *   An inline SQL RPC would be more efficient for large date windows, but requires
 *   a migration and breaks the existing DAL-only pattern. For this brokerage's data
 *   volume (<1000 leads/month typical), paginated in-process aggregation is correct.
 *   Revisit with a DB-side RPC if date windows spanning >50K events become common.
 *
 * V1 known limitations:
 *   - "First contact" includes automated drip emails (email_out from sequences).
 *     This matches FUB's behavior — the first touch in any channel counts.
 *   - For a lead with multiple lead_created events in the window, only the earliest is used.
 *   - Broker filter scopes Phase 1 (which leads to measure). Phase 2 (outbound contacts)
 *     is unfiltered by broker — any team member's contact to those leads counts.
 */
export async function getSpeedToLeadReport(
  params: SpeedToLeadParams,
): Promise<SpeedToLeadResult> {
  const cached = unstable_cache(
    () => readSpeedToLead(params),
    [
      // v2: lead universe switched from raw lead_created events to the
      // taxonomy-filtered inbound definition (2026-07-14).
      'crm-speed-to-lead-v2',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-speed-to-lead', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
