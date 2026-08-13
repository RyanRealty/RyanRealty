/**
 * Route-local section builders for /housing-market/annual-review.
 *
 * WHY THIS FILE EXISTS: the route crossed the ci:file-size-budget floor (600 LOC)
 * as a NEW file, which is a hard fail, and the gate's own instruction is to split
 * rather than re-baseline. The seam is the honest one — the page owns the reads,
 * the one months-of-supply derivation, the JSON-LD, and the JSX; this module owns
 * the pure turn from a DAL row into barrel-ready props.
 *
 * PURE BY CONSTRUCTION. Nothing here fetches, reads the clock, or classifies
 * anything the page has not already classified. Every function takes rows and
 * returns strings the page hands straight to the barrel, which is what keeps
 * "the number on screen is the number the section's source trace covers"
 * (CLAUDE.md section 0) true through the split.
 *
 * FOUR RULES EVERY BUILDER HERE FOLLOWS:
 *
 *  1. ABSENT IS NOT ZERO. A row that cannot be sourced is returned in the
 *     `missing` list with the reason derived FROM ITS OWN DATA, never rendered as
 *     a zero under a live-MLS source line. The three cases are not the same claim:
 *     no row came back, a row came back with nothing active, or a row came back
 *     active with no published median.
 *  2. THE GUARD IS SHARED WITH THE CONSUMER. Every pulse figure uses
 *     lib/site/market-faq.ts's own `!= null && > 0` condition, so a figure cannot
 *     appear on screen with no answer behind it in the FAQ or the Dataset payload.
 *  3. MONTHS OF SUPPLY IS CLASSIFIED RAW AND ROUNDED ONLY TO DISPLAY, through
 *     marketVerdict() and formatMonthsOfSupply(). Rounding before classifying
 *     walks the verdict across a canonical threshold in both directions.
 *  4. A PERIOD PRINTED ON SCREEN IS THE PERIOD PUBLISHED IN THE MARKUP. The
 *     closed-sales window and the page's Dataset temporalCoverage read the same
 *     two date-only cache columns, so the printed ends format in UTC (periodDate
 *     below). Formatting a date-only column in the brand's Pacific zone renders
 *     UTC midnight as the previous day, which shipped two windows for one set of
 *     figures on a citable page.
 */

import type { MarketDetail, MarketPulse, MarketPulseSnapshot } from '@/lib/data'
import type { ReportCity } from '@/lib/data/geo/report-cities'
import { marketVerdict } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPrice } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { listingsBrowsePath } from '@/lib/slug'
import { v3Text, type V3ChartProps, type V3InstrumentFigure, type V3LedgerFigureRow } from '@/components/site/v3'
import {
  buildMonthlyMedianChart,
  buildRegionMedianChart,
  dropInProgressMonth,
  lastCompleteMonths,
  withChartId,
  type MedianMonth,
} from '../../_v3/market-charts'
import {
  formatCount,
  formatDayDelta,
  formatDays,
  formatPercentDelta,
  formatRatioPct,
  formatWholeDollars,
} from './annual-constants'

export const REGION_REPORT_PATH = '/housing-market/central-oregon'
export const CITY_REPORTS_PATH = '/housing-market/reports'

/** A report city that earned no row, with the reason read off its own data. */
export type MissingCity = { label: string; slug: string; fact: string }

/** A Ledger's rows, the stamp computed from those same rows, and the cities left out. */
export type CityLedger = {
  rows: V3LedgerFigureRow[]
  /** The newest refresh timestamp among the rows that rendered, or undefined. */
  stamp: string | undefined
  missing: MissingCity[]
}

/* -------------------------------------------------------------------------- */
/* Section 1 — the region, right now (market_pulse_live)                       */
/* -------------------------------------------------------------------------- */

/**
 * `mosRaw` and `medianListDisplay` are the page's derivations, already guarded.
 * They are passed in rather than re-read off the pulse so this file cannot become
 * a second place the verdict or the published median is computed.
 *
 * medianListDisplay is the figure the page ALSO hands buildMarketFaq, so the
 * Instrument, the visible FAQ sentence, and the Dataset variable are one number
 * (see the page's invariant 6). formatPrice below re-applies the same
 * nearest-$1,000 rounding to an already-rounded figure, which is identity.
 */
export function buildRegionFigures(
  pulse: MarketPulse | null,
  mosRaw: number | null,
  medianListDisplay: number | null,
): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  if (mosRaw != null) {
    figures.push({
      value: v3Text(formatMonthsOfSupply(mosRaw)),
      label: v3Text('months of supply'),
      href: '/months-of-supply',
    })
  }
  if (pulse != null && pulse.activeCount > 0) {
    figures.push({
      value: v3Text(pulse.activeCount.toLocaleString('en-US')),
      label: v3Text('active single-family listings'),
      href: listingsBrowsePath(),
    })
  }
  if (medianListDisplay != null) {
    figures.push({
      value: v3Text(formatPrice(medianListDisplay)),
      label: v3Text('median list price'),
      href: REGION_REPORT_PATH,
    })
  }
  if (pulse?.medianDaysToPending != null && pulse.medianDaysToPending > 0) {
    figures.push({
      value: v3Text(String(pulse.medianDaysToPending)),
      label: v3Text('median days to pending'),
      href: REGION_REPORT_PATH,
    })
  }
  return figures
}

/* -------------------------------------------------------------------------- */
/* Section 2 — live inventory by report city (market_pulse_live)               */
/* -------------------------------------------------------------------------- */

/**
 * D9 leftover: each city is a door into its own report. A line through cities
 * invents a sequence. V3Chart is a trend atom, so this Ledger stays type.
 */
export function buildInventoryLedger(
  cities: readonly ReportCity[],
  snapshots: readonly MarketPulseSnapshot[],
): CityLedger {
  const byLabel = new Map(snapshots.map((s) => [s.geo_label, s]))
  const rows: V3LedgerFigureRow[] = []
  const stamps: string[] = []
  const missing: MissingCity[] = []

  for (const city of cities) {
    const snapshot = byLabel.get(city.label)
    // A city earns a row when the live query returned one AND that row carries a
    // median list price: the Ledger's value column is a figure, and a figure this
    // page cannot source is a figure it does not print.
    if (!snapshot || snapshot.median_list_price == null || snapshot.median_list_price <= 0) {
      missing.push({
        label: city.label,
        slug: city.slug,
        fact: !snapshot
          ? `${city.label} returned no live market row in the latest sync`
          : snapshot.active_count === 0
            ? `${city.label} shows no active single-family listings`
            : `${city.label} shows ${snapshot.active_count.toLocaleString('en-US')} active with no published median list price`,
      })
      continue
    }
    if (snapshot.updated_at) stamps.push(snapshot.updated_at)
    const mos =
      snapshot.months_of_supply != null && snapshot.months_of_supply > 0
        ? snapshot.months_of_supply
        : null
    rows.push({
      href: `/housing-market/${city.slug}`,
      when: v3Text(`${snapshot.active_count.toLocaleString('en-US')} active`),
      what: v3Text(city.label),
      detail:
        mos != null
          ? v3Text(`${formatMonthsOfSupply(mos)} months of supply, a ${marketVerdict(mos).label}`)
          : undefined,
      value: v3Text(formatPrice(snapshot.median_list_price)),
      id: city.slug,
    })
  }

  return { rows, stamp: stamps.sort().at(-1), missing }
}

/* -------------------------------------------------------------------------- */
/* Section 3 — the region, trailing 12 months (market_stats_cache)             */
/* -------------------------------------------------------------------------- */

export type ClosedInstrument = {
  figures: V3InstrumentFigure[]
  headline: string
  source: string
  /**
   * What the section says INSTEAD of the Instrument when the row published no
   * figure. V3Instrument types `figures` as a non-empty tuple, so a figureless
   * section cannot render as an Instrument; without this the whole section would
   * vanish and two Ledgers would land adjacent, which the rhythm rule forbids.
   * The two cases are different claims and are never merged: the row did not
   * return, or the row returned carrying nothing this section can publish.
   */
  absence: { term: string; body: string }
}

/**
 * A date-only cache column ('2026-08-12') parses as UTC midnight, so formatting
 * it in the brand's America/Los_Angeles zone prints the PREVIOUS day. The window
 * printed here and the `temporalCoverage` the page publishes off the identical
 * two fields are the same window, so this one formats in UTC — the repo's
 * convention for these period columns (lib/kb/place-sections.ts monthLabel,
 * lib/data/crm/getMarketReportData.ts).
 */
function periodDate(value: string): string {
  return formatDate(value, { timeZone: 'UTC' })
}

/**
 * Whole dollars, not formatPrice, for the median sale price: the page publishes
 * `Math.round(medianSalePrice)` as a Dataset variable, and formatPrice rounds to
 * the nearest $1,000, so a $652,450 median would read $652,000 on screen beside
 * $652,450 in the markup. One number per fact, on the page and in the payload.
 *
 * Year-over-year change rides in each figure's LABEL rather than becoming its own
 * figure, because the change is a property of the number above it, not a second
 * measurement.
 */
export function buildClosedInstrument(detail: MarketDetail | null): ClosedInstrument {
  const median = formatWholeDollars(detail?.medianSalePrice)
  // Rule 2, shared with buildMarketFaq's own soldCount12mo condition: a stored 0
  // would otherwise print "0 / single-family homes sold" under a live closed-sales
  // trace with no FAQ answer and no Dataset variable behind it.
  const sold = detail?.soldCount != null && detail.soldCount > 0 ? formatCount(detail.soldCount) : null
  const dom = formatDays(detail?.medianDom)
  const ratio = formatRatioPct(detail?.avgSaleToListRatio)
  const ppsf = formatWholeDollars(detail?.medianPricePerSqft)
  const yoyPrice = formatPercentDelta(detail?.yoyMedianPriceDeltaPct)
  const yoyDom = formatDayDelta(detail?.yoyDomChange)
  const yoyPpsf = formatPercentDelta(detail?.yoyPpsfChangePct)

  const figures: V3InstrumentFigure[] = []
  if (median) {
    figures.push({
      value: v3Text(median),
      label: v3Text(yoyPrice ? `median sale price, ${yoyPrice}` : 'median sale price'),
      href: REGION_REPORT_PATH,
    })
  }
  if (sold) {
    figures.push({
      value: v3Text(sold),
      label: v3Text('single-family homes sold'),
      href: CITY_REPORTS_PATH,
    })
  }
  if (dom) {
    figures.push({
      value: v3Text(dom),
      label: v3Text(yoyDom ? `median days on market, ${yoyDom}` : 'median days on market'),
      href: REGION_REPORT_PATH,
    })
  }
  if (ratio) {
    figures.push({
      value: v3Text(ratio),
      label: v3Text('average sale price to list price'),
      href: REGION_REPORT_PATH,
    })
  }
  if (ppsf) {
    figures.push({
      value: v3Text(ppsf),
      label: v3Text(
        yoyPpsf ? `median price per square foot, ${yoyPpsf}` : 'median price per square foot',
      ),
      href: REGION_REPORT_PATH,
    })
  }

  // The window comes off the cache row itself, so the trace states the period the
  // figures were computed over rather than a period this page assumed.
  const window =
    detail?.periodStart && detail.periodEnd
      ? ` (${periodDate(detail.periodStart)} to ${periodDate(detail.periodEnd)})`
      : ''

  // Read off the row, never assumed: a row that never arrived and a row that
  // arrived with nothing published are two different facts about the world.
  const absence = !detail
    ? {
        term: 'No trailing-12-month figures right now',
        body:
          'The Central Oregon closed-sales row did not return on this refresh, so this section is ' +
          'not printing a median sale price, a sold count, or a year-over-year change for the region. ' +
          'The city rows below read the same cache one row at a time and carry their own timestamp.',
      }
    : {
        term: 'No trailing-12-month figures right now',
        body:
          'The Central Oregon closed-sales row returned on this refresh carrying no published median ' +
          'sale price, sold count, days on market, sale-to-list ratio, or price per square foot, so ' +
          'this section prints no figure rather than a zero. The city rows below read the same cache ' +
          'one row at a time and carry their own timestamp.',
      }

  return {
    figures,
    headline: median
      ? `Central Oregon sold at a median of ${median} over the trailing 12 months`
      : sold
        ? `Central Oregon closed ${sold} single-family sales over the trailing 12 months`
        : 'Central Oregon closed sales, trailing 12 months',
    source:
      'closed MLS sales through Oregon Data Share, single-family homes across the Central Oregon region, ' +
      `the trailing 12 months${window} against the same 12-month window one year earlier, ` +
      'both windows computed by the same cache job. Not active inventory.',
    absence,
  }
}

/* -------------------------------------------------------------------------- */
/* Section 4 — trailing 12 months by report city (market_stats_cache)          */
/* -------------------------------------------------------------------------- */

/**
 * D9 leftover: each city is a door into its own report. Year-over-year change
 * already rides the row. A line through cities invents a sequence.
 */
export function buildYearLedger(
  cities: readonly ReportCity[],
  details: readonly (MarketDetail | null)[],
): CityLedger {
  const rows: V3LedgerFigureRow[] = []
  const stamps: string[] = []
  const missing: MissingCity[] = []

  cities.forEach((city, i) => {
    const detail = details[i] ?? null
    const median = formatWholeDollars(detail?.medianSalePrice)
    if (!detail || !median) {
      missing.push({
        label: city.label,
        slug: city.slug,
        fact: !detail
          ? `${city.label} returned no trailing-12-month closed-sales row`
          : `${city.label} returned a closed-sales row with no published median sale price`,
      })
      return
    }
    if (detail.updatedAt) stamps.push(detail.updatedAt)
    const sold = formatCount(detail.soldCount)
    const domLabel = formatDays(detail.medianDom)
    const parts = [
      formatPercentDelta(detail.yoyMedianPriceDeltaPct),
      domLabel ? `median ${domLabel} on market` : null,
      formatDayDelta(detail.yoyDomChange),
    ].filter((p): p is string => typeof p === 'string' && p.length > 0)

    rows.push({
      href: `/housing-market/${city.slug}`,
      when: v3Text(sold ? `${sold} sold` : 'trailing 12 months'),
      what: v3Text(city.label),
      detail: parts.length > 0 ? v3Text(parts.join(' · ')) : undefined,
      value: v3Text(median),
      id: city.slug,
    })
  })

  return { rows, stamp: stamps.sort().at(-1), missing }
}

/**
 * Region overlay on the live Instrument, last-12-month line on the trailing
 * Instrument. Two charts share the page, so each carries a figure id. The
 * page drops the in-progress month (zonedDateKey) before calling. Labels
 * are already through formatPriceCompact.
 */
export function buildAnnualCharts(
  monthly: readonly MedianMonth[],
  currentMonthKey: string,
): { region: V3ChartProps | undefined; trailing: V3ChartProps | undefined } {
  const complete = dropInProgressMonth(monthly, currentMonthKey)
  return {
    region: withChartId(buildRegionMedianChart(complete), 'region-median'),
    trailing: withChartId(
      buildMonthlyMedianChart(
        lastCompleteMonths(complete, 12),
        'Median sale price, last 12 completed months',
      ),
      'trailing-median',
    ),
  }
}
