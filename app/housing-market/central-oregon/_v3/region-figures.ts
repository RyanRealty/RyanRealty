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

import type { MarketPulse } from '@/lib/data'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatPriceExact } from '@/lib/format/money'
import { listingsBrowsePath } from '@/lib/slug'
import { v3Text, type V3ChartProps, type V3InstrumentFigure } from '@/components/site/v3'
import { buildClosedVolumeChart, buildCompositionChart } from '../../_v3/market-charts'
import {
  buildAllTypeFigures,
  buildCompositionFigures,
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
}

/**
 * @param pulse the market_pulse_live region row, or null when it did not return.
 * @param mosText months of supply already formatted by the page through
 *   formatMonthsOfSupply, or null. Passed in rather than derived here: the page owns
 *   the single derivation that classifies the RAW value and formats only to display it.
 */
export function buildRegionInstruments(
  pulse: MarketPulse | null,
  mosText: string | null,
): RegionInstruments {
  const medianListPrice =
    pulse?.medianListPrice != null && pulse.medianListPrice > 0 ? pulse.medianListPrice : null
  const activeCount = pulse != null && pulse.activeCount > 0 ? pulse.activeCount : null
  const daysToPending =
    pulse?.medianDaysToPending != null && pulse.medianDaysToPending > 0
      ? pulse.medianDaysToPending
      : null
  const closedLast30Days =
    pulse != null && pulse.closedLast30Days > 0 ? pulse.closedLast30Days : null

  // ── Live inventory ────────────────────────────────────────────────────────────
  // Every figure is a door where a node behind it shows that figure's window.
  // PUBLIC-PRODUCT-OS calls dead text naming a linkable thing a defect.
  const liveFigures: V3InstrumentFigure[] = []
  if (medianListPrice != null) {
    liveFigures.push({
      value: v3Text(formatPriceExact(medianListPrice)),
      label: v3Text('median list price, single-family'),
      href: listingsBrowsePath(),
    })
  }
  if (activeCount != null) {
    liveFigures.push({
      value: v3Text(activeCount.toLocaleString('en-US')),
      label: v3Text('homes for sale, single-family'),
      href: listingsBrowsePath(),
    })
  }
  if (mosText != null) {
    liveFigures.push({
      value: v3Text(mosText),
      label: v3Text('months of supply, single-family'),
      href: '/months-of-supply',
    })
  }

  const liveClauses = [
    'live MLS through Oregon Data Share, active single-family listings across the Central Oregon region',
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
  const paceFigures: V3InstrumentFigure[] = []
  if (daysToPending != null) {
    paceFigures.push({
      value: v3Text(String(daysToPending)),
      label: v3Text('median days to pending'),
    })
  }
  if (closedLast30Days != null) {
    paceFigures.push({
      value: v3Text(closedLast30Days.toLocaleString('en-US')),
      label: v3Text('closed in the last 30 days'),
    })
  }

  const paceClauses = [
    'live MLS through Oregon Data Share, closed single-family sales across the Central Oregon region',
  ]
  if (daysToPending != null) {
    paceClauses.push(
      'Days to pending is the median list-to-pending time of homes that closed in the last 90 days',
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
 * First-screen ALL-TYPE volume + composition, with SFR months of supply so
 * the verdict stays next to its number. Chart is attached by the page.
 */
export function buildRegionLead(
  series: readonly CoMarketAnnualRow[],
  mosText: string | null,
): RegionLead {
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
    figures.push(
      ...buildCompositionFigures({
        parts: compositionParts(latest.propertyTypeBreakdown),
        historyHref: historyPath,
      }),
    )
  }
  if (mosText) {
    figures.push({
      value: v3Text(mosText),
      label: v3Text('months of supply, single-family'),
      href: '/months-of-supply',
    })
  }
  const sourceBits: string[] = []
  if (latest) sourceBits.push(closedMartSource(latest.year))
  else sourceBits.push(closedMartMissingBody(CLOSED_SALES_TO_YEAR))
  if (mosText) {
    sourceBits.push(
      `Months of supply is live MLS, detached single-family, Central Oregon region. ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}`,
    )
  }
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

export function withoutMosFigures(figures: readonly V3InstrumentFigure[]): V3InstrumentFigure[] {
  return figures.filter((figure) => figure.href !== '/months-of-supply')
}
