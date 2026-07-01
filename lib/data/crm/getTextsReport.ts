import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { resolveDateRange } from './getAgentActivityReport'

// ── INFERRED REPORT ───────────────────────────────────────────────────────────
// This report mirrors the Calls report structure and follows standard FUB Texts
// reporting conventions. No dedicated FUB GIF frame was captured for this tab,
// so the layout and metric set are inferred from the Calls report + FUB's
// documented Texts reporting behavior (per-agent sent/received/conversations/
// response-rate). A code comment is left on each metric clarifying its source.
// ─────────────────────────────────────────────────────────────────────────────

// ── Re-export the date preset type from the shared module ──────────────────────
export type { DatePreset } from './getAgentActivityReport'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TextsParams = {
  /** null = all brokers (superuser/Everyone view) */
  brokerSlug: string | null
  datePreset: string
  dateStart?: string | null
  dateEnd?: string | null
}

/**
 * Per-broker row for the Texts report breakdown table.
 *
 * Metric → crm_* source mapping (INFERRED — mirrors Calls report; no FUB GIF frame captured):
 *
 * | Metric              | Source                                                                |
 * |---------------------|-----------------------------------------------------------------------|
 * | sent                | crm_timeline kind='sms_out', broker=slug, ts in [start,end],         |
 * |                     |   source != 'sequence' (personal texts only, matches Agent Activity) |
 * | sentPeople          | count(DISTINCT person_id) from sms_out rows                           |
 * | received            | crm_timeline kind='sms_in',  broker=slug, ts in [start,end],         |
 * |                     |   source != 'sequence' (personal texts only, matches Agent Activity) |
 * | receivedPeople      | count(DISTINCT person_id) from sms_in rows                            |
 * | conversations       | count(DISTINCT person_id) present in BOTH sms_out AND sms_in sets     |
 * | responseRate        | conversations / sentPeople × 100 (% of texted people who replied)    |
 *
 * Sequence filter: source='sequence' rows are excluded from all metrics so this
 * report's "Texts Sent"/"Received" agrees with Agent Activity's "Texts" column,
 * which applies the same neq('source','sequence') filter.
 *
 * Pagination: counts use PostgREST exact-count HEAD requests (no row cap).
 * Distinct-people sets are built by paginating person_id in 1000-row pages so
 * brokers with >1000 messages (e.g. Matt 1044+ sms_out) produce correct set sizes.
 */
export type TextsRow = {
  brokerSlug: string
  brokerName: string
  avatarUrl: string | null
  /** Outbound texts sent by this broker (kind='sms_out', source!='sequence'). */
  sent: number
  sentPeople: number
  /** Inbound texts received by this broker's number (kind='sms_in', source!='sequence'). */
  received: number
  receivedPeople: number
  /**
   * 2-way conversations — distinct people who both received a text from this
   * broker AND replied (i.e. appear in both sms_out and sms_in person_id sets).
   */
  conversations: number
  /**
   * Response rate — conversations / sentPeople × 100.
   * null when sentPeople = 0 (displayed as "—").
   */
  responseRate: number | null
}

export type TextsTotals = Omit<TextsRow, 'brokerSlug' | 'brokerName' | 'avatarUrl'>

export type TextsResult = {
  rows: TextsRow[]
  totals: TextsTotals
  dateStart: string
  dateEnd: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

const EMPTY_TOTALS: TextsTotals = {
  sent: 0,
  sentPeople: 0,
  received: 0,
  receivedPeople: 0,
  conversations: 0,
  responseRate: null,
}

// ── Pagination helper ─────────────────────────────────────────────────────────
//
// PostgREST caps any `.select()` response at 1000 rows by default. For brokers
// with high message volumes (Matt: 1044+ non-sequence sms_out YTD), fetching
// person_id rows would be silently truncated, producing wrong distinct-people
// counts and wrong conversation intersections.
//
// Strategy:
//   1. Exact COUNT — one HEAD request (`{ count: 'exact', head: true }`) that
//      returns the true total without fetching any rows.
//   2. Paginated person_id fetch — loop with `.range(offset, offset+PAGE-1)`
//      until a page returns fewer than PAGE rows, accumulating into a Set for
//      O(1) intersection later.
//
// The count comes from step 1 (authoritative). The peopleSet comes from step 2.

const PAGE_SIZE = 1000

async function fetchSmsMetrics(
  sb: ReturnType<typeof createServiceClient>,
  slug: string,
  kind: 'sms_out' | 'sms_in',
  start: string,
  end: string,
): Promise<{ count: number; peopleSet: Set<number> }> {
  // Step 1 — exact count (no row data returned, no cap applies)
  const { count, error: countError } = await sb
    .from('crm_timeline')
    .select('*', { count: 'exact', head: true })
    .eq('broker', slug)
    .eq('kind', kind)
    .neq('source', 'sequence')
    .gte('ts', start)
    .lte('ts', end)

  if (countError) {
    console.error(`[getTextsReport] count error ${slug}/${kind}`, countError.message)
  }

  // Step 2 — paginated person_id fetch to build the distinct-people set
  const peopleSet = new Set<number>()
  let offset = 0

  while (true) {
    const { data, error } = await sb
      .from('crm_timeline')
      .select('person_id')
      .eq('broker', slug)
      .eq('kind', kind)
      .neq('source', 'sequence')
      .gte('ts', start)
      .lte('ts', end)
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error(
        `[getTextsReport] page error ${slug}/${kind} offset=${offset}`,
        error.message,
      )
      break
    }

    const rows = (data ?? []) as Array<{ person_id: number }>
    for (const r of rows) peopleSet.add(r.person_id)

    if (rows.length < PAGE_SIZE) break // final page
    offset += PAGE_SIZE
  }

  return { count: count ?? peopleSet.size, peopleSet }
}

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readTextsReport(params: TextsParams): Promise<TextsResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(params.datePreset, params.dateStart, params.dateEnd)

  // 1. Broker roster — crm-active brokers with a crm_slug
  const { data: brokerRows, error: brokerError } = await sb
    .from('brokers')
    .select('crm_slug,display_name,photo_url')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)
    .order('sort_order', { ascending: true })

  if (brokerError) console.error('[getTextsReport] brokers error', brokerError.message)

  const allBrokers = (brokerRows ?? []).filter((b) => b.crm_slug) as Array<{
    crm_slug: string
    display_name: string | null
    photo_url: string | null
  }>

  const scopedBrokers = params.brokerSlug
    ? allBrokers.filter((b) => b.crm_slug === params.brokerSlug)
    : allBrokers

  const brokerSlugs = scopedBrokers.map((b) => b.crm_slug)

  if (brokerSlugs.length === 0) {
    return { rows: [], totals: { ...EMPTY_TOTALS }, dateStart: start, dateEnd: end }
  }

  // 2. Per-broker parallel queries.
  //
  //    Each broker gets two fetchSmsMetrics calls (sms_out + sms_in). Each call
  //    issues one HEAD count request + as many 1000-row person_id pages as needed.
  //    Matt YTD requires 2 pages for sms_out (1044 rows); all others fit in 1.
  //
  //    source != 'sequence' is applied in every query so automated drip texts are
  //    excluded, matching the Agent Activity report's "Texts" column definition.
  //
  const perBrokerGroup = await Promise.all(
    scopedBrokers.map((b) => {
      const slug = b.crm_slug
      return Promise.all([
        fetchSmsMetrics(sb, slug, 'sms_out', start, end),
        fetchSmsMetrics(sb, slug, 'sms_in', start, end),
      ] as const)
    }),
  )

  // 3. Build per-broker rows
  const rows: TextsRow[] = scopedBrokers.map((b, i) => {
    const [sentMetrics, receivedMetrics] = perBrokerGroup[i]

    // Texts sent — exact count from HEAD request; people from paginated Set
    const sent = sentMetrics.count
    const sentPeopleSet = sentMetrics.peopleSet
    const sentPeople = sentPeopleSet.size

    // Texts received — exact count from HEAD request; people from paginated Set
    const received = receivedMetrics.count
    const receivedPeopleSet = receivedMetrics.peopleSet
    const receivedPeople = receivedPeopleSet.size

    // 2-way conversations — person_id appears in both sent and received Sets
    let conversations = 0
    for (const pid of sentPeopleSet) {
      if (receivedPeopleSet.has(pid)) conversations++
    }

    // Response rate — % of texted people who replied back
    const responseRate =
      sentPeople > 0
        ? Math.round((conversations / sentPeople) * 100 * 10) / 10
        : null

    return {
      brokerSlug: b.crm_slug,
      brokerName: b.display_name ?? b.crm_slug,
      avatarUrl: BROKER_HEADSHOT[b.crm_slug] ?? b.photo_url ?? null,
      sent,
      sentPeople,
      received,
      receivedPeople,
      conversations,
      responseRate,
    }
  })

  // 4. Totals — sum across all scoped broker rows.
  //    responseRate is re-derived from the aggregate conversations/sentPeople
  //    so it is mathematically correct (not an average of per-broker rates).
  const aggSentPeople = rows.reduce((sum, r) => sum + r.sentPeople, 0)
  const aggConversations = rows.reduce((sum, r) => sum + r.conversations, 0)

  const totals: TextsTotals = {
    sent: rows.reduce((sum, r) => sum + r.sent, 0),
    sentPeople: aggSentPeople,
    received: rows.reduce((sum, r) => sum + r.received, 0),
    receivedPeople: rows.reduce((sum, r) => sum + r.receivedPeople, 0),
    conversations: aggConversations,
    responseRate:
      aggSentPeople > 0
        ? Math.round((aggConversations / aggSentPeople) * 100 * 10) / 10
        : null,
  }

  return { rows, totals, dateStart: start, dateEnd: end }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Texts report data — per-broker outbound/inbound SMS counts, conversation
 * counts, and response rate over a date range.
 *
 * Cached 10 minutes (matching FUB's documented reporting cache TTL).
 * Cache is keyed on filter params so different combos get separate entries.
 *
 * Source tables:
 *   - crm_timeline kind='sms_out', source!='sequence' → personal texts SENT by broker
 *   - crm_timeline kind='sms_in',  source!='sequence' → personal texts RECEIVED
 *
 * Sequence filter: automated drip/sequence messages (source='sequence') are
 * excluded so this report's counts match the Agent Activity "Texts" column.
 *
 * Cap fix (v2): counts use exact-count HEAD requests; distinct-people sets use
 * paginated 1000-row fetches. The old v1 approach (`rows.length` after a single
 * select) was silently truncated at 1000, causing e.g. Matt's "Texts Sent" to
 * show 1000 instead of the correct value (1044 non-sequence YTD as of 2026-07-01).
 *
 * INFERRED REPORT: no dedicated FUB GIF frame was captured for the Texts tab.
 * Metrics and layout mirror the Calls report + standard FUB Texts conventions.
 */
export async function getTextsReport(params: TextsParams): Promise<TextsResult> {
  const cached = unstable_cache(
    () => readTextsReport(params),
    [
      'crm-texts-report-v2',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-texts', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
