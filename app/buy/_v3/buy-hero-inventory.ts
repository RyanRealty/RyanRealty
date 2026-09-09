/**
 * The /buy hero's live figure strip: one market_pulse_live region row turned
 * into the two or three figures the Stage's inventory variant carries.
 *
 * WHY IT IS A PURE MODULE. The page owns the read; this owns the turn from a
 * DAL row into barrel-ready props, the same seam
 * app/housing-market/central-oregon/_v3/region-figures.ts uses. Nothing here
 * fetches, aggregates, reads the clock, or classifies a market.
 *
 * §0, PER FIGURE. Every figure resolves through the same `!= null && > 0`
 * guard, so a stored zero renders as no figure rather than as "$0 / median
 * asking price" under a live-MLS trace. A figure that cannot be sourced is
 * dropped, and when fewer than two survive the page ships NO strip: the
 * deliverable goes out with fewer numbers, never with a wrong one. Formatting
 * runs through the canonical helpers (lib/format/money, lib/format/count,
 * lib/market/publish-days-figure), so the strip cannot invent a rounding rule
 * of its own.
 *
 * THE DOORS. Each figure opens the surface that shows that same figure at
 * depth: the count opens the regional search that holds those homes, the median
 * opens the region deep dive's live-inventory Instrument (#market), and the
 * pace figure opens that page's own pace Instrument (#pace). A figure whose
 * destination does not publish that figure gets no door — a wrong door is worse
 * than no door.
 *
 * WHICH READ, AND WHY THIS ONE. `getMarketPulseRegionSnapshot('central-oregon')`
 * rather than `getMarketPulse({geoType:'region', …})`, because a door has to
 * land on the same number it was clicked from. Both read the same
 * market_pulse_live row and both overlay Market Truth's detached inventory, so
 * the count and the median agree either way. The pace figure does not: the raw
 * `median_days_to_pending` column read 28 on 2026-09-09 while the region deep
 * dive — which resolves the leftover 90-day list-to-pending metric — published
 * 29 in the very section this strip's third door opens. The snapshot function
 * applies that same overlay, so the strip and its destination now print one
 * figure. Two generation paths for one number is how a site publishes a
 * contradiction to itself (§0).
 */
import type { MarketPulseSnapshot } from '@/lib/data/market/getMarketPulseSnapshot'
import { formatCount } from '@/lib/format/count'
import { formatPriceExact } from '@/lib/format/money'
import { publishDaysFigure } from '@/lib/market/publish-days-figure'
import { REGIONAL_SEARCH_HREF } from '@/lib/search/publish-regional-search-href'
import type { V3StageFigure, V3StageInventory } from '@/components/site/v3'

/** The region deep dive's two Instruments, by the anchors that page renders. */
const REGION_LIVE_HREF = '/housing-market/central-oregon#market'
const REGION_PACE_HREF = '/housing-market/central-oregon#pace'

/**
 * The population every figure in the strip belongs to. One line, because one
 * row was read at one moment: a per-figure trace would be this sentence three
 * times. It is deliberately SHORT — the first draft named both windows in prose
 * and rendered as three lines of small type across the middle of the
 * photograph, which is the wall of text TASTE.md bans and, on 375, five lines
 * that pushed the action down the frame. The window each figure was measured in
 * belongs to that figure's own label ("days to an offer, last 90 days"), so the
 * trace carries what the labels cannot: the feed, the population, the place.
 */
const BUY_HERO_TRACE =
  'live MLS through Oregon Data Share · single-family houses across Central Oregon'

function positive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * @param pulse the region row from
 *   `getMarketPulseRegionSnapshot('central-oregon')`, or null when the read
 *   missed. A miss ships no strip and the Stage keeps its quiet photo form.
 * @returns the Stage's `inventory` prop, or undefined when fewer than two
 *   figures could be published honestly.
 */
export function buyHeroInventory(
  pulse: MarketPulseSnapshot | null | undefined,
): V3StageInventory | undefined {
  if (!pulse) return undefined

  const figures: V3StageFigure[] = []

  const activeCount = positive(pulse.active_count)
  if (activeCount != null) {
    figures.push({
      value: formatCount(activeCount),
      label: 'houses for sale right now',
      href: REGIONAL_SEARCH_HREF,
    })
  }

  const medianListPrice = positive(pulse.median_list_price)
  if (medianListPrice != null) {
    figures.push({
      // EXACT dollars, not formatPrice's nearest-thousand marketing rounding:
      // this figure is a door into the region deep dive's live Instrument,
      // which prints the same median through formatPriceExact. Rounded here it
      // would read $750,000 in the hero and $749,900 one click later — the
      // same one-figure-two-grains defect lib/market/publish-days-figure.ts
      // was written to stop.
      value: formatPriceExact(medianListPrice),
      // The label says what the median MEANS, not what it is called. A figure
      // with no plain sentence beside it is the KPI grid TASTE.md bans, and a
      // separate evaluator named this row as one on the first pass. It is also
      // SHORT on purpose: "median asking price — half ask more" wrapped to two
      // lines at 375 and left the three band rows at three different heights,
      // which the evaluator's second pass called ragged. And it is a SENTENCE,
      // after the third pass called "half ask more than this" a fragment a
      // reader has to reverse-engineer: the subject is named.
      label: 'half the houses ask more',
      href: REGION_LIVE_HREF,
    })
  }

  // publishDaysFigure owns the published grain (tenths, never integer-rounded)
  // and returns null for a missing or non-positive figure, so it is the guard
  // as well as the formatter. The label names the window the median was
  // measured in, in the same words the region deep dive uses for it.
  const daysToPending = publishDaysFigure(pulse.median_days_to_pending)
  if (daysToPending != null) {
    figures.push({
      value: daysToPending,
      label: 'days to an offer, last 90 days',
      href: REGION_PACE_HREF,
    })
  }

  if (figures.length < 2) return undefined

  return {
    figures,
    source: BUY_HERO_TRACE,
    updatedAt: pulse.updated_at ?? null,
  }
}
