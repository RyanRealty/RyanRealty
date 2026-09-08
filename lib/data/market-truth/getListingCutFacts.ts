/**
 * getListingCutFacts — what a price cut looks like in THIS listing's city.
 *
 * SITE-06 (Matt, site queue 2026-09-08): the listing page ends with the three
 * figures a buyer standing in front of a house actually wants beside the
 * asking price — how often a home here cut before it sold, how deep the
 * typical cut was, and how long the typical home waited for a contract.
 *
 * ── WHY THE MARKET TRUTH CELLS AND NOT AN AGGREGATE ────────────────────────
 * CLAUDE.md section 7 rule 6: never aggregate raw `listings` for a market
 * figure. `public.market_metric` already publishes all three, each with its own
 * sample_n, method, definition id, complete_through and computed_at — which is
 * exactly what the section 0 trace has to name. `getMetrics` is the one read
 * path for that table (lib/data/market-truth/getMetric.ts), so this function
 * composes it and formats; it computes no statistic of its own.
 *
 * ── THE WINDOW IS PINNED, AND THAT IS THE HONESTY RULE HERE ────────────────
 * All three stats carry `windowPolicy: 'ladder'` in the registry, which means
 * the publisher may widen 12 -> 24 -> 36 months for a thin city. The copy this
 * feeds says "in the last 12 months", so the read pins `windowMonths: 12` and
 * a city whose 12-month cell is not publishable prints NOTHING for that figure
 * rather than a wider window under a 12-month sentence (section 0 rule 7).
 * Each figure stands or falls on its own: Sisters can publish the pace and
 * withhold the cut share, and the section says only what it has.
 *
 * ── SEGMENT ────────────────────────────────────────────────────────────────
 * `detached`. `market_metric` has no bare-'A' bucket, and `detached` is the
 * established SFR proxy on every other surface that reads this table
 * (getSellBendMarket, getProofBlock). Named in the trace so nobody reads it as
 * "all homes".
 *
 * Live values on 2026-09-08 (city=bend, detached, window 12, period_end
 * 2026-09-08, definition mt-v1): pct_with_price_cut 0.465284474445516 over
 * 2,074 sales; median_price_cut_pct 0.0591805766312595 over 965; and
 * median_days_to_contract 29 over 1,987 — complete_through 2026-09-07.
 */
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { getMetrics, type MetricResult } from '@/lib/data/market-truth/getMetric'
import { DEFINITION_ID } from '@/lib/data/market-truth/registry'
import { cityDetachedSlug } from '@/lib/data/market-truth/getSellBendMarket'

/** The window the copy names. Pinned, never laddered — see the header. */
export const CUT_FACTS_WINDOW_MONTHS = 12
const SEGMENT = 'detached'

export type ListingCutFigure = {
  /** Raw published value: a share 0..1 for the two percentages, days for pace. */
  value: number
  /** Already formatted for the screen ("47%", "5.9%", "29 days"). */
  label: string
  /** Sales behind the figure. */
  sampleN: number
  /** One line naming table, filter, window, n and the read date (section 0). */
  source: string
}

export type ListingCutFacts = {
  cityLabel: string
  geoSlug: string
  windowMonths: number
  /** ISO instant this was read. */
  fetchedAt: string
  /** Latest close date the publisher had complete data through. */
  completeThrough: string | null
  /** Share of closed sales that cut at least once before closing. */
  cutShare: ListingCutFigure | null
  /** Median size of the cut, as a share of the original ask. */
  cutSize: ListingCutFigure | null
  /** Median days from list to under contract. NEVER `DaysOnMarket`. */
  daysToPending: ListingCutFigure | null
}

/** 0.465284 -> "47%". One decimal only when the whole number would mislead. */
function formatShare(value: number): string {
  const pct = value * 100
  return pct >= 10 ? `${Math.round(pct)}%` : `${Math.round(pct * 10) / 10}%`
}

/** 0.0591805 -> "5.9%". Cut depth is small, so it keeps its tenth. */
function formatSmallShare(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

function formatDays(value: number): string {
  const days = Math.round(value)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

function traceLine(args: {
  cell: MetricResult
  cityLabel: string
  geoSlug: string
  fetchedAt: string
}): string {
  const { cell, cityLabel, geoSlug, fetchedAt } = args
  return [
    `public.market_metric`,
    `stat_id=${cell.statId}`,
    `geo_type=city`,
    `geo_slug=${geoSlug} (${cityLabel})`,
    `segment=${SEGMENT}`,
    `window_months=${cell.provenance.windowMonths}`,
    `definition_id=${cell.provenance.definitionId}`,
    `n=${cell.provenance.sampleN}`,
    `complete_through=${cell.provenance.completeThrough}`,
    `read ${fetchedAt.slice(0, 10)}`,
  ].join(' · ')
}

/** A cell publishes or it does not exist. No floors, no widened windows. */
function usable(cell: MetricResult | null): cell is MetricResult {
  return Boolean(
    cell &&
      cell.isPublishable &&
      cell.value != null &&
      Number.isFinite(cell.value) &&
      cell.provenance.windowMonths === CUT_FACTS_WINDOW_MONTHS,
  )
}

async function fetchListingCutFacts(
  citySlug: string,
  cityLabel: string,
): Promise<ListingCutFacts | null> {
  const geoSlug = cityDetachedSlug(citySlug)
  if (!geoSlug) return null
  const fetchedAt = new Date().toISOString()

  const [shareCell, sizeCell, paceCell] = await getMetrics(
    (['pct_with_price_cut', 'median_price_cut_pct', 'median_days_to_contract'] as const).map(
      (stat) => ({
        stat,
        geoType: 'city',
        geoSlug,
        segment: SEGMENT,
        windowMonths: CUT_FACTS_WINDOW_MONTHS,
        definitionId: DEFINITION_ID,
      }),
    ),
  )

  const figure = (
    cell: MetricResult | null,
    format: (value: number) => string,
  ): ListingCutFigure | null => {
    if (!usable(cell)) return null
    return {
      value: cell.value as number,
      label: format(cell.value as number),
      sampleN: cell.provenance.sampleN,
      source: traceLine({ cell, cityLabel, geoSlug, fetchedAt }),
    }
  }

  const cutShare = figure(shareCell, formatShare)
  const cutSize = figure(sizeCell, formatSmallShare)
  const daysToPending = figure(paceCell, formatDays)

  // Nothing publishable for this city: the section does not render at all.
  // A house in a city we cannot describe honestly gets its acts, not a blank
  // drawing (section 0 rule 7).
  if (!cutShare && !cutSize && !daysToPending) return null

  const completeThrough =
    [shareCell, sizeCell, paceCell]
      .filter(usable)
      .map((cell) => cell.provenance.completeThrough)
      .sort()
      .shift() ?? null

  return {
    cityLabel,
    geoSlug,
    windowMonths: CUT_FACTS_WINDOW_MONTHS,
    fetchedAt,
    completeThrough,
    cutShare,
    cutSize,
    daysToPending,
  }
}

const cachedListingCutFacts = makeResilientCached(
  fetchListingCutFacts,
  ['listing-cut-facts', 'v1'],
  { revalidate: 60 * 60 * 6, tags: ['market-truth', 'listing-cut-facts'] },
  null as ListingCutFacts | null,
)

/**
 * Re-pulled per city. `citySlug` is the listing's own city slug; `cityLabel`
 * is what the reader sees ("Bend"), so the copy never prints a raw slug
 * (TASTE.md, banned tells).
 */
export async function getListingCutFacts(input: {
  citySlug: string | null | undefined
  cityLabel: string | null | undefined
}): Promise<ListingCutFacts | null> {
  const slug = (input.citySlug ?? '').trim()
  const label = (input.cityLabel ?? '').trim()
  if (!slug || !label) return null
  return cachedListingCutFacts(slug, label)
}
