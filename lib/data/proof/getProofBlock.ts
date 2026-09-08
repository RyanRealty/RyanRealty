/**
 * getProofBlock — everything the proof section says, pulled fresh, with one
 * trace line per figure (CLAUDE.md section 0).
 *
 * Site queue SITE-11 (Matt 2026-09-07): "the MLS-sourced closed-sales line
 * re-pulled, and a per-listing outcome table (sale-to-list and days to pending
 * per Ryan Realty closing beside the Bend detached median for the same window,
 * count stated, no percentage headline)."
 *
 * ─── WHAT IT READS, AND WHY EACH ────────────────────────────────────────────
 *
 * 1. `listings`, one bounded filtered ROW read: every Ryan Realty LIST-SIDE
 *    closing INSIDE THE WINDOW (7 rows on 2026-09-08). This is not a market
 *    aggregate — it is our own record, small enough to fetch whole and compute
 *    in memory.
 *
 *    The `"CloseDate" >= windowStart` bound is load-bearing, not tidiness.
 *    Without it the planner drives off `StandardStatus = 'Closed'`, bitmap
 *    scans 385k rows and filters them by an unindexed leading-wildcard ILIKE:
 *    23.5s, 94k blocks read (EXPLAIN ANALYZE, live, 2026-09-08). With it the
 *    planner drives off `idx_listings_close_date` and the same read is 109ms.
 *    A 6h cache would have hidden that behind one unlucky visitor per window.
 *
 *    LIST SIDE, not buyer side, and the trace says so. Ryan Realty is also the
 *    buyer's office on 6 more closings. Sale-to-list and days-to-contract
 *    measure what a LISTING broker did: on a buyer-side deal the ratio is the
 *    other brokerage's pricing, and a low one is a win for our buyer, not a
 *    loss for us. Averaging the two sides together would produce a figure that
 *    means nothing.
 *
 *    The per-row figures this computes were checked against
 *    `public.market_fact_sale` — the very table the context medians are built
 *    from — for all 14 Ryan Realty closings it holds (live, 2026-09-08): every
 *    `days_to_contract` and every `sale_to_orig_list` agrees to full precision,
 *    including the retroactive entry the fact table independently tags
 *    `exclusion_reasons = {retroactive_entry}` and leaves with a null day
 *    count. `getProofBlock.int.test.ts` re-runs that comparison so a drift
 *    fails a test rather than shipping.
 *
 * 2. Market Truth cells via `getMetrics`, for the context medians. NOT a
 *    hand-rolled aggregate over `listings` — the schema snapshot's standing
 *    rule is "never aggregate from this table at request time", and the
 *    published cell already carries its own sample_n, definition id, and
 *    computed_at, which is what the trace has to name. Window is pinned to 12
 *    months on both sides, so the comparison is apples-to-apples by
 *    construction rather than by assertion.
 *
 * 3. `getBrokerageTrackRecord`, unchanged, for the all-time closed-sales line.
 *    It owns that figure already (it is what /sell's band prints), it carries
 *    its own 6h cache, and reusing it means the proof block and /sell cannot
 *    print two different counts of the same thing.
 *
 * 4. `getReviews`, unchanged, for the verified Google line and its quotes.
 *
 * ─── WHAT IT WILL NOT DO ────────────────────────────────────────────────────
 *
 * No address and no price per row. These are real homes belonging to real
 * former clients, the set is small enough to identify a seller from a close
 * month plus a price, and the section's job is the OUTCOME, not the listing.
 * The two figures per row, the close month, and the city are the whole row.
 *
 * No percentage headline (Matt). The block states the count and draws the
 * marks; it never leads with "97% of list" or a claim about beating anything.
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { getReviews, type Review } from '@/lib/data/reviews/getReviews'
import { getBrokerageTrackRecord } from '@/lib/data/track-record'
import { getMetrics, type MetricResult } from '@/lib/data/market-truth/getMetric'
import {
  computeProofOutcomes,
  PROOF_WINDOW_MONTHS,
  type ProofClosingInput,
  type ProofOutcomes,
} from '@/lib/data/proof/outcomes'

/** One figure's provenance. Everything a reviewer needs to re-run it. */
export type ProofTrace = {
  /**
   * Which figures this entry sources.
   *
   * `always` covers what the section prints in every form — the reviews, the
   * all-time record, the count and window of the closings. `outcomes` covers
   * ONLY the two strips: the per-home day and ratio computation, and the two
   * market medians they are drawn against.
   *
   * It exists because a trace is a list of the figures we PUBLISH (CLAUDE.md
   * section 0), and /sell publishes the section with the strips held (Matt
   * 2026-09-08). Shipping their provenance anyway put the market's own median
   * days-to-contract and sale-to-list in the disclosure of a page that draws
   * neither, next to a line saying we had computed ours and not printed it —
   * which is the held comparison, stated in prose, one summary open. The view
   * drops these entries when it does not draw the strips.
   */
  scope: 'always' | 'outcomes'
  figure: string
  source: string
  table: string
  filter: string
  window: string
  rows: number
  fetchedAt: string
  query: string
}

export type ProofQuote = {
  /** Stable id built from the source row, for React keys and hover targets. */
  id: string
  /** The review exactly as written. Never trimmed, never paraphrased. */
  text: string
  author: string
  /** ISO date or null, as the source records it. */
  date: string | null
  rating: number
}

export type ProofReviews = {
  count: number
  averageRating: number
  source: 'google'
  quotes: ProofQuote[]
}

export type ProofRecord = {
  homesSold: number
  totalVolume: number
  avgSalePrice: number
}

/** The published market cell the outcome marks are measured against. */
export type ProofContext = {
  geoType: string
  geoSlug: string
  /** "Bend" — the label the section prints. Never the raw slug. */
  label: string
  medianDaysToContract: number | null
  medianDaysToContractN: number
  medianSaleToOriginal: number | null
  medianSaleToOriginalN: number
  closedCount: number | null
  definitionId: string | null
  computedAt: string | null
}

export type ProofBlock = {
  window: { months: number; start: string; end: string }
  reviews: ProofReviews | null
  record: ProofRecord | null
  outcomes: ProofOutcomes
  context: ProofContext | null
  trace: ProofTrace[]
}

const RYAN_REALTY_OFFICE = '%ryan realty%'
const CLOSING_COLUMNS =
  'ListNumber, City, property_sub_type, OriginalListPrice, ClosePrice, OnMarketDate, purchase_contract_date, CloseDate'
/** 7 closings in the live window, 17 list side in the brokerage's whole history. Headroom, not a page. */
const CLOSING_CAP = 500

const EMPTY_OUTCOMES: ProofOutcomes = {
  rows: [],
  closings: 0,
  saleToOriginalN: 0,
  daysToContractN: 0,
  daysExcludedN: 0,
  medianSaleToOriginal: null,
  medianDaysToContract: null,
  cities: [],
  publishable: false,
  quietReason: 'Too few recent closings here to chart.',
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** The reported window: `months` back from today, inclusive on both ends. */
export function proofWindow(now: Date, months = PROOF_WINDOW_MONTHS): { start: string; end: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCMonth(start.getUTCMonth() - months)
  return { start: isoDay(start), end: isoDay(end) }
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

function quoteFrom(r: Review, index: number): ProofQuote {
  return {
    id: `${r.reviewDate ?? 'undated'}-${index}`,
    text: r.text,
    author: r.reviewerName ?? 'Google reviewer',
    date: r.reviewDate,
    rating: r.rating,
  }
}

function cell(results: (MetricResult | null)[], index: number): MetricResult | null {
  const r = results[index]
  return r && r.isPublishable && r.value != null ? r : null
}

async function fetchProofBlock(input: {
  geoType: string
  geoSlug: string
  geoLabel: string
  quoteLimit: number
}): Promise<ProofBlock> {
  const now = new Date()
  const fetchedAt = now.toISOString()
  const window = proofWindow(now)
  const windowLabel = `CloseDate ${window.start}..${window.end} (${PROOF_WINDOW_MONTHS} months)`

  const sb = createServiceClient()

  const [closingsRes, trackRecord, reviews, metrics] = await Promise.all([
    sb
      .from('listings')
      .select(CLOSING_COLUMNS)
      // The date bound goes FIRST for a reason — see the header. Without it
      // this read is 23.5s; with it, 109ms.
      .gte('CloseDate', `${window.start}T00:00:00Z`)
      .ilike('ListOfficeName', RYAN_REALTY_OFFICE)
      .eq('StandardStatus', 'Closed')
      .not('ClosePrice', 'is', null)
      .order('CloseDate', { ascending: false })
      .limit(CLOSING_CAP),
    getBrokerageTrackRecord().catch(() => null),
    getReviews(input.quoteLimit).catch(() => null),
    getMetrics([
      {
        stat: 'median_days_to_contract',
        geoType: input.geoType,
        geoSlug: input.geoSlug,
        segment: 'detached',
        windowMonths: PROOF_WINDOW_MONTHS,
      },
      {
        stat: 'median_sale_to_original_list',
        geoType: input.geoType,
        geoSlug: input.geoSlug,
        segment: 'detached',
        windowMonths: PROOF_WINDOW_MONTHS,
      },
      {
        stat: 'closed_count',
        geoType: input.geoType,
        geoSlug: input.geoSlug,
        segment: 'detached',
        windowMonths: PROOF_WINDOW_MONTHS,
      },
    ]).catch(() => [null, null, null] as (MetricResult | null)[]),
  ])

  // THROW on a transient DB error so makeResilientCached never caches an empty
  // proof block: one pooler blip would otherwise blank the section for the
  // whole 6h window. A genuine no-rows result is a legitimate empty.
  if (closingsRes.error) {
    throw new Error(`[getProofBlock] ${closingsRes.error.message ?? JSON.stringify(closingsRes.error)}`)
  }

  const raw = (closingsRes.data ?? []) as Array<Record<string, unknown>>
  const closings: ProofClosingInput[] = raw.map((r) => ({
    id: str(r['ListNumber']) ?? '',
    city: str(r['City']),
    propertySubType: str(r['property_sub_type']),
    originalListPrice: num(r['OriginalListPrice']),
    closePrice: num(r['ClosePrice']),
    onMarketDate: str(r['OnMarketDate']),
    contractDate: str(r['purchase_contract_date']),
    closeDate: str(r['CloseDate']),
  }))

  const outcomes = computeProofOutcomes({
    closings,
    windowStart: window.start,
    windowEnd: window.end,
  })

  // The all-time closed-sales line comes from the function that owns it, so
  // /sell's band and this block cannot print two counts of one thing.
  const record: ProofRecord | null = trackRecord

  const dtc = cell(metrics, 0)
  const stol = cell(metrics, 1)
  const closed = cell(metrics, 2)
  const context: ProofContext | null =
    dtc || stol
      ? {
          geoType: input.geoType,
          geoSlug: input.geoSlug,
          label: input.geoLabel,
          medianDaysToContract: dtc?.value ?? null,
          medianDaysToContractN: dtc?.provenance.sampleN ?? 0,
          medianSaleToOriginal: stol?.value ?? null,
          medianSaleToOriginalN: stol?.provenance.sampleN ?? 0,
          closedCount: closed?.value ?? null,
          definitionId: (dtc ?? stol)?.provenance.definitionId ?? null,
          computedAt: (dtc ?? stol)?.provenance.computedAt ?? null,
        }
      : null

  const proofReviews: ProofReviews | null =
    reviews && reviews.count > 0
      ? {
          count: reviews.count,
          averageRating: reviews.averageRating,
          source: 'google',
          quotes: reviews.reviews.map(quoteFrom),
        }
      : null

  const trace: ProofTrace[] = []

  if (proofReviews) {
    trace.push({
      scope: 'always',
      figure: `${proofReviews.averageRating.toFixed(1)} average from ${proofReviews.count} Google reviews`,
      source: 'Google Business Profile, ingested live',
      table: 'public.reviews',
      filter: "source = 'google' AND is_hidden = false",
      window: 'all reviews, no date filter',
      rows: proofReviews.count,
      fetchedAt,
      query: 'getReviews() — lib/data/reviews/getReviews.ts',
    })
  }

  if (record) {
    trace.push({
      scope: 'always',
      figure: `${record.homesSold} homes closed, listed by Ryan Realty`,
      source: 'Central Oregon MLS via Supabase listings',
      table: 'public.listings',
      filter:
        "\"ListOfficeName\" ILIKE '%ryan realty%' AND \"StandardStatus\" = 'Closed' AND \"ClosePrice\" IS NOT NULL (LIST SIDE only; buyer-side closings excluded)",
      window: 'every closing on record, no date filter',
      rows: record.homesSold,
      fetchedAt,
      query: 'getBrokerageTrackRecord() — lib/data/track-record.ts',
    })
  }

  // Two entries, because the section publishes the COUNT in every form and the
  // per-home computation only when it draws the strips. One combined entry made
  // the quiet form's disclosure announce a measurement it does not show.
  trace.push({
    scope: 'always',
    figure: `${outcomes.closings} Ryan Realty closings in the window`,
    source: 'Central Oregon MLS via Supabase listings',
    table: 'public.listings',
    filter: `"ListOfficeName" ILIKE '%ryan realty%' AND "StandardStatus" = 'Closed' (list side); cities ${outcomes.cities.join(', ') || 'none'}`,
    window: windowLabel,
    rows: outcomes.closings,
    fetchedAt,
    query: 'getProofBlock() — lib/data/proof/getProofBlock.ts',
  })

  trace.push({
    scope: 'outcomes',
    figure: `sale-to-original-list on ${outcomes.saleToOriginalN} of them, days-to-contract on ${outcomes.daysToContractN} (${outcomes.daysExcludedN} dropped by the market definition)`,
    source: 'Central Oregon MLS via Supabase listings, computed with the Market Truth fact definitions',
    table: 'public.listings',
    filter: `"ListOfficeName" ILIKE '%ryan realty%' AND "StandardStatus" = 'Closed' (list side); cities ${outcomes.cities.join(', ') || 'none'}`,
    window: windowLabel,
    rows: outcomes.closings,
    fetchedAt,
    query:
      'sale_to_orig_list = "ClosePrice" / "OriginalListPrice"; days_to_contract = purchase_contract_date - "OnMarketDate", kept when >= 0 (refresh_market_fact_sale)',
  })

  if (context?.medianDaysToContract != null) {
    trace.push({
      scope: 'outcomes',
      figure: `${context.label} detached median days to contract ${Math.round(context.medianDaysToContract)}`,
      source: `Market Truth cell, definition ${context.definitionId ?? '?'}`,
      table: 'public.market_metric',
      filter: `stat_id = 'median_days_to_contract' AND geo_type = '${context.geoType}' AND geo_slug = '${context.geoSlug}' AND segment = 'detached'`,
      window: `${PROOF_WINDOW_MONTHS} months, same window as the closings above`,
      rows: context.medianDaysToContractN,
      fetchedAt,
      query: `getMetrics([{ stat: 'median_days_to_contract', ... }]) — computed ${context.computedAt ?? '?'}`,
    })
  }

  if (context?.medianSaleToOriginal != null) {
    trace.push({
      scope: 'outcomes',
      figure: `${context.label} detached median sale to original list ${(context.medianSaleToOriginal * 100).toFixed(1)}%`,
      source: `Market Truth cell, definition ${context.definitionId ?? '?'}`,
      table: 'public.market_metric',
      filter: `stat_id = 'median_sale_to_original_list' AND geo_type = '${context.geoType}' AND geo_slug = '${context.geoSlug}' AND segment = 'detached'`,
      window: `${PROOF_WINDOW_MONTHS} months, same window as the closings above`,
      rows: context.medianSaleToOriginalN,
      fetchedAt,
      query: `getMetrics([{ stat: 'median_sale_to_original_list', ... }]) — computed ${context.computedAt ?? '?'}`,
    })
  }

  return { window: { months: PROOF_WINDOW_MONTHS, ...window }, reviews: proofReviews, record, outcomes, context, trace }
}

const EMPTY_BLOCK: ProofBlock = {
  window: { months: PROOF_WINDOW_MONTHS, start: '', end: '' },
  reviews: null,
  record: null,
  outcomes: EMPTY_OUTCOMES,
  context: null,
  trace: [],
}

const cachedProofBlock = makeResilientCached(
  fetchProofBlock,
  ['proof-block-v1'],
  { revalidate: 6 * 60 * 60, tags: ['market', 'listings', 'reviews'] },
  EMPTY_BLOCK,
)

/**
 * The proof block for one place. `geoType`/`geoSlug` choose the market the
 * outcome marks are measured against, and `geoLabel` is what the section
 * prints — the closings themselves are brokerage-wide, so the label must name
 * the context market honestly rather than implying the closings are all from
 * there. The section prints the closings' own cities beside it.
 */
export function getProofBlock(
  input: { geoType?: string; geoSlug?: string; geoLabel?: string; quoteLimit?: number } = {},
): Promise<ProofBlock> {
  return cachedProofBlock({
    geoType: input.geoType ?? 'city',
    geoSlug: input.geoSlug ?? 'bend',
    geoLabel: input.geoLabel ?? 'Bend',
    quoteLimit: input.quoteLimit ?? 3,
  })
}
