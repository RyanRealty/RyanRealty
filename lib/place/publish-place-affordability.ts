/**
 * Build the props for `<V3PlaceAffordability />` from what a place page already
 * holds. Pure — no fetch, no client, no DOM — so the sentences a visitor reads
 * and the domain a slider runs on are both testable without a database.
 *
 * ONE HELPER, TWO TEMPLATES. The city node and the neighborhood node publish
 * their median asking price from different reads (`market_metric`
 * median_list_active at city grain; `getNeighborhoodPublicInventory` inside the
 * recorded boundary at neighborhood grain), and each already prints that figure
 * with its own trace. This helper takes whichever one the page publishes and
 * carries the SAME number into the calculator, so the calculator can never
 * disagree with the section above it (CLAUDE.md section 0, reconciliation).
 *
 * WHAT IT REFUSES TO DO.
 *  · It never invents a rate. A rate arrives measured and dated, or it arrives
 *    null and the component says the number is the visitor's assumption.
 *  · It never turns a cash SHARE into a down payment. The share decides which
 *    mode the calculator opens on and nothing else.
 *  · It never publishes a count of homes under the ceiling. See
 *    `V3PlaceAffordability.view.ts` for the measured reason.
 *  · It returns null rather than opening a calculator with no number in it,
 *    because a form with an empty box is not an answer.
 */

import type { LiveMortgageRate } from '@/lib/data/market/getLiveMortgageRate'
import type { PublicMixRow } from '@/lib/data/market-truth/public-mix'
import { formatPaceShare } from '@/lib/data/market-truth/public-pace'
import { formatDate } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { roundCeilingDown, opensOnCash } from '@/lib/finance/affordability'
import type {
  AffordabilityMixSlice,
  V3PlaceAffordabilityProps,
} from '@/components/site/v3'

/** How a financing key reads to a person. Keys are `market_metric` financing_mix's. */
const FINANCING_NAME: Record<string, string> = {
  cash: 'Cash',
  conventional: 'Conventional loan',
  fha: 'FHA loan',
  va: 'VA loan',
  usda: 'USDA loan',
  'fha 203(k)': 'FHA 203(k) loan',
  'fha 203(b)': 'FHA 203(b) loan',
  'seller financing': 'Seller financing',
  private: 'Private loan',
  contract: 'Land-sale contract',
  assumed: 'Assumed loan',
  other: 'Other financing',
}

/** The slider's floor. Below this a Central Oregon house is a data error. */
const PRICE_FLOOR = 100_000
/** How far above the local middle the slider reaches before you type instead. */
const PRICE_HEADROOM = 2.75
/** The slider's own step, so a drag lands on a number a person would say. */
const PRICE_STEP = 5_000
/** Used when a place publishes no median at all, so the dials still open somewhere. */
const PRICE_FALLBACK_CEILING = 1_500_000

export type PublishPlaceAffordabilityInput = {
  placeName: string
  placeSlug: string
  grain: 'city' | 'neighborhood'
  /** The median asking price this page already publishes. Null is allowed. */
  medianListPrice: number | null
  /** The count that median was taken over, for the trace. Null withholds it. */
  activeCount: number | null
  /** The page's own as-of stamp for that read. Null withholds the date. */
  computedAt: string | null
  /** The page's OWN homes link. The ceiling is appended; no URL is invented. */
  browseHref: string
  /** The measured 30-year rate, or null when the series published none. */
  rate: LiveMortgageRate | null
  /** The rate the visitor starts from when nothing was measured. */
  fallbackRatePct: number
  /** This place's detached financing mix. */
  mix: PublicMixRow
  /** Share of closed detached sales that were cash, 0 to 1. Seeds the mode only. */
  cashShare: number | null
}

export function publishPlaceAffordability(
  input: PublishPlaceAffordabilityInput,
): V3PlaceAffordabilityProps | null {
  const {
    placeName,
    placeSlug,
    grain,
    medianListPrice,
    activeCount,
    computedAt,
    browseHref,
    rate,
    fallbackRatePct,
    mix,
    cashShare,
  } = input

  if (!placeName.trim() || !browseHref.trim()) return null
  if (!Number.isFinite(fallbackRatePct) || fallbackRatePct <= 0) return null

  const median =
    medianListPrice != null && Number.isFinite(medianListPrice) && medianListPrice > 0
      ? Math.round(medianListPrice)
      : null

  // The opening number is the place's own middle, rounded the same way the
  // ceiling is rounded, so the first figure on screen is already a figure the
  // button could carry.
  const opening = Math.max(PRICE_FLOOR, roundCeilingDown(median ?? PRICE_FALLBACK_CEILING / PRICE_HEADROOM))
  const priceMax = Math.max(
    opening + PRICE_STEP,
    Math.ceil((opening * PRICE_HEADROOM) / PRICE_STEP) * PRICE_STEP,
  )

  const medianSource =
    median == null
      ? `${placeName} publishes no median asking price for single-family homes right now, so the calculator opens on a round number rather than on this market.`
      : [
          `Median asking price ${formatPriceExact(median)},`,
          grain === 'city'
            ? `market_metric median_list_active, ${placeName} detached, the same row this page's market section prints`
            : `the single-family homes for sale inside ${placeName}'s recorded boundary, the same population this page's own count prints`,
          activeCount != null ? `over ${activeCount} homes for sale` : null,
          computedAt ? `read ${formatDate(computedAt)}.` : "read on this page's last refresh.",
        ]
          .filter(Boolean)
          .join(', ')
          .replace(/,\s*\./g, '.')

  const slices: AffordabilityMixSlice[] = mix.financing
    .filter((bit) => Number.isFinite(bit.share) && bit.share > 0)
    .slice(0, 4)
    .map((bit) => ({
      key: bit.key,
      name: FINANCING_NAME[bit.key] ?? bit.key,
      share: bit.share,
      label: bit.floor ? `at least ${formatPaceShare(bit.share)}` : formatPaceShare(bit.share),
    }))

  const mixSource =
    slices.length > 0
      ? `market_metric financing_mix, ${placeName} detached closed sales, 12-month window widened by the metric registry's ladder where a place is thin. Shares under 5% are not published, so these do not add to 100%. This is how OTHER buyers paid; it is not a suggestion about your down payment.`
      : `${placeName} has not published a financing mix for detached sales.`

  return {
    eyebrow: `${placeName} · What it costs`,
    heading: 'Run the number both ways',
    placeName,
    placeSlug,
    grain,
    medianListPrice: median,
    medianSource,
    rate: rate
      ? {
          pct: rate.ratePct,
          weekLabel: formatDate(rate.weekStart),
          sourceName:
            rate.source === 'freddie:pmms30'
              ? 'Freddie Mac 30-year fixed'
              : `published 30-year fixed (${rate.source})`,
        }
      : null,
    fallbackRatePct,
    mix: slices,
    mixSource,
    cashShare: cashShare != null && Number.isFinite(cashShare) ? cashShare : null,
    browseHref,
    priceMin: PRICE_FLOOR,
    priceMax,
    priceStep: PRICE_STEP,
    openingPrice: opening,
    openingMode: opensOnCash(cashShare) ? 'cash' : 'financed',
  }
}
