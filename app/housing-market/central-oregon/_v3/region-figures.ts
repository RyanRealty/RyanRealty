/**
 * The region market_pulse_live row, turned into the TWO Instruments it actually
 * supports, for /housing-market/central-oregon.
 *
 * WHY THIS FILE EXISTS: the same reason ./region-sections.ts does. ci:file-size-budget
 * treats a file crossing 600 LOC as a hard fail and its own instruction is to split
 * rather than re-baseline. The seam is unchanged: the page owns the reads, the one
 * months-of-supply derivation, the JSON-LD and the JSX, and a _v3 module owns the pure
 * turn from a DAL row into barrel-ready props. Nothing here fetches, reads the clock,
 * or classifies a market.
 *
 * WHY TWO SETS AND NOT ONE. The region row publishes figures about two populations, and
 * for a while this page printed all five under one source line that named only the
 * active one. Widening that line to cover both worked on paper and failed on the
 * screen: at 390 the trace grew to thirteen lines and pushed the section's ask below
 * the fold, which is the defect one rule over. The populations are what differ, so the
 * populations are what split.
 *
 *  - LIVE INVENTORY, the page's answer: median list price, homes for sale, months of
 *    supply. Active single-family listings, one short trace, the months-of-supply
 *    formula and thresholds beneath the figure they govern.
 *  - PACE, its own section: median days to pending and closings in the last 30 days.
 *    refresh_market_pulse() computes median_days_to_pending as the median
 *    list-to-pending time of single-family homes with StandardStatus='Closed' and
 *    CloseDate inside the last 90 days across the Central Oregon cities, at a
 *    five-closing minimum, and sold_count_30d counts the same closed population inside
 *    the last 30 days
 *    (supabase/migrations/20260526140535_refresh_market_pulse_advisory_lock.sql).
 *    Neither is an attribute of an active listing.
 *
 * ONE GUARD PER FIGURE, SHARED WITH ITS CONSUMER. Every figure resolves to a value or
 * to null through the same `!= null && > 0` condition buildMarketFaq applies to the
 * same figure, so an Instrument can never print a number the shared builder declined to
 * answer for and the Dataset carries no variable behind. At a stored 0 that is the
 * difference between "$0 / median list price" as a live door under a live-MLS source
 * line and no figure at all. Because the resolved value is what both the figure and its
 * trace clause read, a clause can never outlive its figure.
 */

import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatPriceExact } from '@/lib/format/money'
import { listingsBrowsePath } from '@/lib/slug'
import { v3Text, type V3ChartProps, type V3InstrumentFigure } from '@/components/site/v3'
import { buildMosSupplyChart } from '@/app/months-of-supply/_v3/mos-chart'
import { buildClosedVolumeChart, buildCompositionChart } from '../../_v3/market-charts'
import {
  buildAllTypeFigures,
  closedMartMissingBody,
  closedMartSource,
  compositionParts,
  pickLatestMartYear,
} from '../../_v3/closed-kpis'
import { CLOSED_SALES_TO_YEAR, HISTORY_PATH } from './region-constants'

/** One Instrument's worth of props: its figures and the trace that covers them. */
export type RegionSection = {
  /** In render order. Empty when nothing in this population was publishable. */
  figures: V3InstrumentFigure[]
  /** The section 0 source line, assembled from the figures above. */
  trace: string
}

export type RegionInstruments = {
  /** Active single-family inventory. The page's level-1 answer. */
  live: RegionSection
  /** Closed single-family sales. The level-2 pace section. */
  pace: RegionSection
  /**
   * The active-listing count, or null when there is none to publish. Returned because
   * the page's FAQ block opens a browse door on the same condition, and two copies of
   * one guard is how a page starts publishing an edge for an answer it did not give.
   */
  activeCount: number | null
  /**
   * MONTHS OF SUPPLY IS TWO NAMED BARS, NEVER A KPI TILE (PUBLIC_UI / DATA_GRAPHICS).
   * The same drawing already shipped on /housing-market and the annual review
   * (buildMosSupplyChart, fed by the identical active-count-over-months-of-supply
   * pace). Undefined when the ratio cannot be drawn (a miss omits, it is never a 0).
   */
  mosChart: V3ChartProps | undefined
}

/**
 * @param hud leftover HUD KPIs for the region. Miss omits.
 * @param mosText months of supply already formatted by the page through
 *   formatMonthsOfSupply, or null. Passed in rather than derived here: the page owns
 *   the single derivation that classifies the RAW value and formats only to display it.
 * @param mosRaw the SAME raw months-of-supply value that produced mosText, passed
 *   through rather than re-derived here (one derivation, page.tsx section 0). Used
 *   only to recover the implied monthly sales pace (active / mosRaw), the other half
 *   of the ratio the verdict headline already states.
 */
export function buildRegionInstruments(
  hud: LeftoverHudKpis,
  mosText: string | null,
  mosRaw: number | null,
): RegionInstruments {
  const medianListPrice = hud.medianList != null && hud.medianList > 0 ? hud.medianList : null
  const activeCount = hud.active != null && hud.active > 0 ? hud.active : null
  const daysToPending =
    hud.daysToPending != null && hud.daysToPending > 0 ? hud.daysToPending : null
  const closedLast30Days = hud.closed30 != null && hud.closed30 > 0 ? hud.closed30 : null

  // ── Live inventory ────────────────────────────────────────────────────────────
  // Every figure is a door where a node behind it shows that figure's window.
  // PUBLIC-PRODUCT-OS calls dead text naming a linkable thing a defect.
  // EACH LEAD FIGURE SAYS WHAT IT MEANS (SITE-41). Same four measures, same order and
  // the same wording as /housing-market/<city>, because a reader who learns them on the
  // region page must not have to learn them again on Bend. Section 0: the sentence
  // explains its own figure and never carries a second number.
  const liveFigures: V3InstrumentFigure[] = []
  if (medianListPrice != null) {
    liveFigures.push({
      value: v3Text(formatPriceExact(medianListPrice)),
      label: v3Text('median list price, single-family'),
      href: listingsBrowsePath(),
      sentence: v3Text(
        'Half the houses for sale across Central Oregon ask more than this, half ask less.',
      ),
    })
  }
  if (activeCount != null) {
    liveFigures.push({
      value: v3Text(activeCount.toLocaleString('en-US')),
      label: v3Text('homes for sale, single-family'),
      href: listingsBrowsePath(),
      sentence: v3Text('Single-family houses on the market across the region right now.'),
    })
  }
  if (hud.pending != null && hud.pending > 0) {
    liveFigures.push({
      value: v3Text(hud.pending.toLocaleString('en-US')),
      label: v3Text('under contract now'),
      sentence: v3Text('Sellers who have accepted an offer and have not closed yet.'),
    })
  }
  // MONTHS OF SUPPLY IS TWO NAMED BARS, NEVER A KPI TILE (PUBLIC_UI / DATA_GRAPHICS).
  // The bare ratio ("4.8 months") never renders as its own value+label tile: it
  // already lives in the verdict headline above and, from here down, in the two
  // named bars a reader can hover (buildMosSupplyChart, the same drawing already
  // shipped on /housing-market and the annual review). The companion FIGURE this
  // section prints instead is the other half of that ratio in the reader's own
  // words — how many homes close in a typical month — sourced from the same
  // active-count-over-months-of-supply pace, never invented.
  const monthOfSales =
    activeCount != null && mosRaw != null && mosRaw > 0
      ? Math.round((activeCount / mosRaw) * 10) / 10
      : null
  if (monthOfSales != null) {
    liveFigures.push({
      value: v3Text(monthOfSales.toFixed(1)),
      label: v3Text('a month of sales'),
      href: '/months-of-supply',
      sentence: v3Text(
        'How many single-family houses close across the region in a typical month, based on recent sales.',
      ),
    })
  }
  const mosChart =
    activeCount != null && monthOfSales != null && mosText != null
      ? buildMosSupplyChart({ homesForSale: activeCount, monthOfSales, mosText })
      : undefined

  const liveClauses = [
    'Oregon Data Share, active single-family houses across the Central Oregon region',
  ]
  // The two canonical clauses append whole, never edited, and only when the figure they
  // govern is on the screen. lib/market/classify.ts owns that wording and
  // ci:market-formula exists because it drifted once already.
  const liveTrace =
    `${liveClauses.join('. ')}.` +
    (mosText != null ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : '')

  // ── Pace ──────────────────────────────────────────────────────────────────────
  // Neither figure carries an href. A figure's door has to be a node that shows that
  // figure's window, and nothing on the site does: /months-of-supply publishes no
  // days-to-pending, and the closed-sales explorer is a calendar-year surface, so
  // pointing a rolling-30-day count at ?year=2024 would name a window the destination
  // does not have. A wrong door is worse than no door.
  // The 2026-09-09 evaluator called this the dullest section on the page: two numbers,
  // two labels, nothing to read and nothing to do. The figures are right, so what was
  // missing is what they mean (SITE-41). Both sentences state the definition the trace
  // below already carries — the 90-day list-to-pending median off the pulse row, and
  // the closings counted inside a 30-day window — in the words a reader uses.
  const paceFigures: V3InstrumentFigure[] = []
  if (daysToPending != null) {
    paceFigures.push({
      value: v3Text(String(daysToPending)),
      label: v3Text('days to an offer, last 90 days'),
      sentence: v3Text(
        'The middle of the wait between a house going on the market and a seller accepting an offer.',
      ),
    })
  }
  if (closedLast30Days != null) {
    paceFigures.push({
      value: v3Text(closedLast30Days.toLocaleString('en-US')),
      label: v3Text('closed in the last 30 days'),
      sentence: v3Text('Sales that finished and changed hands in the last month.'),
    })
  }

  const paceClauses = [
    'Oregon Data Share, closed single-family houses across the Central Oregon region',
  ]
  if (daysToPending != null) {
    paceClauses.push(
      'Median to pending is the 90-day list-to-pending median from the same regional figures',
    )
  }
  if (closedLast30Days != null) {
    paceClauses.push('Closed in the last 30 days counts closings inside that window')
  }
  const paceTrace = `${paceClauses.join('. ')}.`

  return {
    live: { figures: liveFigures, trace: liveTrace },
    pace: { figures: paceFigures, trace: paceTrace },
    activeCount,
    mosChart,
  }
}

export type RegionLead = {
  latest: CoMarketAnnualRow | null
  figures: V3InstrumentFigure[]
  source: string
  historyPath: string
  chart: V3ChartProps | undefined
  chartSecondary: V3ChartProps | undefined
}

/**
 * The level-2 closed-year KPIs: ALL-TYPE volume + composition. Chart is
 * attached by the page.
 *
 * ONE POPULATION, ONE CLOCK (2026-08-27 hero-reorder fix, parity.json
 * market-report-region openDefects items 1-2): this used to also carry months
 * of supply, a live figure on a different clock than `latest.computedAt`. The
 * page's `updated` stamp for this Instrument only agrees when every clock it is
 * handed matches, which is exactly why the hero used to print
 * "$3.931B/5,707... no stamp" while the closed-sales Ledger two sections down,
 * built from the same `latest.computedAt`, printed one. Months of supply now
 * lives on buildRegionInstruments (the live section), where it belongs with its
 * own clock.
 */
export function buildRegionLead(series: readonly CoMarketAnnualRow[]): RegionLead {
  const latest = pickLatestMartYear(series)
  const historyPath = latest ? `${HISTORY_PATH}?year=${latest.year}` : HISTORY_PATH
  const figures: V3InstrumentFigure[] = []
  if (latest) {
    figures.push(
      ...buildAllTypeFigures({
        soldCount: latest.soldCount,
        totalVolume: latest.totalVolume,
        historyHref: historyPath,
      }),
    )
    // NOT buildCompositionFigures (SITE-41 round two). The eight property-type
    // closed counts it would add here had no sentence — a fresh unsentenced
    // KPI-grid tail behind "The same year broken out by property type" that the
    // 2026-09-09 re-score caught. The composition chart just below draws the
    // identical breakdown with its own hover, which is what a share is for; a
    // figure row repeating it said nothing a caption could not already say
    // better. Cut, not captioned — see closed-kpis.ts's own note on this call.
  }
  const sourceBits: string[] = []
  if (latest) sourceBits.push(closedMartSource(latest.year))
  else sourceBits.push(closedMartMissingBody(CLOSED_SALES_TO_YEAR))
  return {
    latest,
    figures,
    source: sourceBits.join(' '),
    historyPath,
    chart: buildClosedVolumeChart(
      series.filter((row) => row.source === 'mart'),
      'ALL-TYPE closed volume by year, Central Oregon',
    ),
    chartSecondary: latest
      ? buildCompositionChart(
          compositionParts(latest.propertyTypeBreakdown),
          `ALL-TYPE composition, ${latest.year}`,
        )
      : undefined,
  }
}
