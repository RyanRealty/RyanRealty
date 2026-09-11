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

import type { MarketDetail, MarketPulseSnapshot } from '@/lib/data'
import type { ReportCity } from '@/lib/data/geo/report-cities'
import type { PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE } from '@/lib/market/classify'
import { namePulseCityRemainder, pulseCityHrefSlug } from '@/lib/market/pulse-city-remainder'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { listingsBrowsePath } from '@/lib/slug'
import { v3Text, type V3ChartProps, type V3InstrumentFigure, type V3LedgerFigureRow } from '@/components/site/v3'
import { buildMosSupplyChart } from '@/app/months-of-supply/_v3/mos-chart'
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
 * Monthly pace implied by leftover MOS: active / months of supply.
 * Miss omits. This is the other bar of the two-bar drawing, not a MOS tile.
 * Homes are whole counts — round to a whole home for display (SITE-101).
 * MOS digits themselves still go through formatMonthsOfSupply on the chart claim.
 */
export function monthlyPaceFromMos(
  active: number | null | undefined,
  mosRaw: number | null,
): number | null {
  if (active == null || !(active > 0) || mosRaw == null || !(mosRaw > 0)) return null
  const pace = Math.round(active / mosRaw)
  return pace > 0 ? pace : null
}

function formatMonthlyPace(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/**
 * MOS as two named bars (DATA_GRAPHICS / catalog house-mos). Omit when either
 * count is absent — never a 3.9 KPI tile, never a synthesized zero.
 */
export function buildAnnualMosChart(
  active: number | null | undefined,
  mosRaw: number | null,
): V3ChartProps | undefined {
  const monthOfSales = monthlyPaceFromMos(active, mosRaw)
  const mosText = mosRaw != null && mosRaw > 0 ? formatMonthsOfSupply(mosRaw) : null
  if (active == null || !(active > 0) || monthOfSales == null || !mosText) return undefined
  return withChartId(
    buildMosSupplyChart({
      homesForSale: active,
      monthOfSales,
      mosText,
    }),
    'region-mos',
  )
}

/** Props for V3MosBars on the annual opening (SITE-101 / house-mos hover reveal). */
export type AnnualPlaceMos = {
  caption: string
  plainLabel: string
  homesName: string
  homesLabel: string
  homesValue: number
  salesName: string
  salesLabel: string
  salesValue: number
  source: string
  asOf: string | null
  tooltip: { homes: string; sales: string; source: string }
}

/**
 * Annual fold MOS drawing. Whole-home sales face; hover/tap reveals both counts
 * and the section-0 source (V3MosBars). Prefer this over the range chart on the
 * opening so mos-hover is a real reveal.
 */
export function buildAnnualPlaceMos(
  active: number | null | undefined,
  mosRaw: number | null,
  asOf: string | null,
): AnnualPlaceMos | null {
  const monthOfSales = monthlyPaceFromMos(active, mosRaw)
  const mosText = mosRaw != null && mosRaw > 0 ? formatMonthsOfSupply(mosRaw) : null
  if (active == null || !(active > 0) || monthOfSales == null || !mosText) return null
  const homesLabel = active.toLocaleString('en-US')
  const salesLabel = formatMonthlyPace(monthOfSales)
  const tipSource = asOf
    ? `Oregon Data Share · single-family · as of ${asOf}`
    : 'Oregon Data Share · single-family'
  return {
    caption: `About ${mosText} months of homes on the market.`,
    plainLabel: 'Homes for sale vs a month of sales',
    homesName: 'Homes for sale',
    homesLabel,
    homesValue: active,
    salesName: 'A month of sales',
    salesLabel,
    salesValue: monthOfSales,
    source: `Oregon Data Share MLS. ${homesLabel} homes for sale vs ${salesLabel} sales a month.`,
    asOf,
    tooltip: {
      homes: homesLabel,
      sales: salesLabel,
      source: `${tipSource}. ${MOS_METHODOLOGY_CLAUSE}`,
    },
  }
}

/**
 * `mosRaw` and `medianListDisplay` are the page's derivations, already guarded.
 * They are passed in rather than re-read off the pulse so this file cannot become
 * a second place the verdict or the published median is computed.
 *
 * medianListDisplay is the figure the page ALSO hands buildMarketFaq, so the
 * Instrument, the visible FAQ sentence, and the Dataset variable are one number
 * (see the page's invariant 6). formatPriceExact prints those digits, not a
 * second thousand-round of an already-shared figure.
 *
 * SITE-101: when the MOS two-bar drawing publishes, omit the homes / month-of-
 * sales tiles so the fold does not restate the bars as a four-up. MOS digits
 * stay on the drawing; list price and wait remain the lead figures.
 */
export function buildRegionFigures(
  hud: { active: number | null; daysToPending: number | null } | null,
  mosRaw: number | null,
  medianListDisplay: number | null,
  options?: { omitMosTiles?: boolean },
): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  const monthOfSales = monthlyPaceFromMos(hud?.active, mosRaw)
  const omitMosTiles = options?.omitMosTiles === true
  if (!omitMosTiles && hud != null && hud.active != null && hud.active > 0) {
    figures.push({
      value: v3Text(hud.active.toLocaleString('en-US')),
      label: v3Text('homes for sale, single-family'),
      href: listingsBrowsePath(),
      sentence: v3Text(
        'Every single-family house for sale right now across the Central Oregon service area.',
      ),
    })
  }
  if (!omitMosTiles && monthOfSales != null) {
    figures.push({
      value: v3Text(formatMonthlyPace(monthOfSales)),
      label: v3Text('a month of sales'),
      href: '/months-of-supply',
      sentence: v3Text(
        'Homes that typically close in one month, the pace the listings on the market are measured against.',
      ),
    })
  }
  if (medianListDisplay != null) {
    figures.push({
      value: v3Text(formatPriceExact(medianListDisplay)),
      label: v3Text('median list price'),
      href: REGION_REPORT_PATH,
      sentence: v3Text(
        'The middle of what sellers are asking. Half the houses on the market ask more than this, half ask less.',
      ),
    })
  }
  if (hud?.daysToPending != null && hud.daysToPending > 0) {
    figures.push({
      value: v3Text(String(hud.daysToPending)),
      label: v3Text('days to an offer, last 90 days'),
      href: REGION_REPORT_PATH,
      sentence: v3Text(
        'The typical wait between a house going on the market and going under contract.',
      ),
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
  options?: { regionActive?: number | null },
): CityLedger {
  const byLabel = new Map(snapshots.map((s) => [s.geo_label, s]))
  const rows: V3LedgerFigureRow[] = []
  // Parallel to `rows`: bar length encodes active inventory (the heading's claim),
  // as a share of THIS list's own max active. Median stays the printed `value`.
  const actives: number[] = []
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
          : snapshot.active_count == null
            ? `${city.label} has no published active single-family count`
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
    if (snapshot.active_count == null || !(snapshot.active_count > 0)) {
      missing.push({
        label: city.label,
        slug: city.slug,
        fact:
          snapshot.active_count == null
            ? `${city.label} has no published active single-family count`
            : `${city.label} shows no active single-family listings`,
      })
      continue
    }
    rows.push({
      href: `/housing-market/${city.slug}`,
      when: v3Text(`${snapshot.active_count.toLocaleString('en-US')} active`),
      what: v3Text(city.label),
      detail:
        mos != null
          ? v3Text(`${formatMonthsOfSupply(mos)} mo · ${marketVerdict(mos).label}`)
          : undefined,
      value: v3Text(formatPriceExact(snapshot.median_list_price)),
      id: city.slug,
    })
    actives.push(snapshot.active_count)
  }
  const maxActive = actives.length > 0 ? Math.max(...actives) : 0
  if (maxActive > 0) {
    rows.forEach((row, i) => {
      row.weight = actives[i]! / maxActive
    })
  }

  const remainder = namePulseCityRemainder({
    regionActive: options?.regionActive,
    displayedLabels: cities.map((c) => c.label),
    allCities: snapshots.map((s) => ({
      label: s.geo_label,
      active: s.active_count,
      slug: pulseCityHrefSlug(s.geo_slug || s.geo_label),
    })),
  })
  for (const city of remainder.omitted) {
    missing.push({
      label: city.label,
      slug: city.slug,
      fact: `${city.label} has ${city.active.toLocaleString('en-US')} active single-family listings not in the table above`,
    })
  }
  for (const fact of remainder.facts.filter((line) => !line.startsWith('Also in the leftover regional count'))) {
    missing.push({ label: 'Outside city rows', slug: '', fact })
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

  // EACH FIGURE SAYS WHAT IT MEANS (SITE-41), and each sentence describes the MEASURE
  // rather than the population, because this instrument carries two: the median and
  // the count come from the Market Truth detached rows the page overlays, the other
  // three from the region cache row. The section's own note and trace name both. A
  // sentence that claimed one population for all five would be the thing section 0
  // forbids — a narrative overriding the data underneath it.
  //
  // The wait figure and the ratio are both stated from their VERIFIED definitions in
  // compute_and_cache_period_stats (2026-04-25 rewrite, the live body):
  // median_dom is percentile_cont over `days_to_pending`, which
  // docs/DATABASE_FOR_AI_AGENTS.md defines as OnMarketDate to pending — list to
  // OFFER, not list to close, and not the raw feed days-on-market column CLAUDE.md
  // section 7 warns against publishing as DOM. avg_sale_to_list_ratio averages
  // ClosePrice / OriginalListPrice, so it is measured against the FIRST asking price,
  // which is what the label now says.
  const figures: V3InstrumentFigure[] = []
  if (median) {
    figures.push({
      value: v3Text(median),
      label: v3Text(yoyPrice ? `median sale price, ${yoyPrice}` : 'median sale price'),
      href: REGION_REPORT_PATH,
      sentence: v3Text('Half the homes that sold closed above this, half below.'),
    })
  }
  if (sold) {
    figures.push({
      value: v3Text(sold),
      label: v3Text('single-family homes sold'),
      href: CITY_REPORTS_PATH,
      sentence: v3Text('Sales the MLS recorded closing inside the window named below.'),
    })
  }
  if (dom) {
    figures.push({
      value: v3Text(dom),
      label: v3Text(yoyDom ? `median days on market, ${yoyDom}` : 'median days on market'),
      href: REGION_REPORT_PATH,
      sentence: v3Text(
        'The middle of the wait between a home going on the market and an offer being accepted.',
      ),
    })
  }
  if (ratio) {
    figures.push({
      value: v3Text(ratio),
      label: v3Text('average sale price against the first asking price'),
      href: REGION_REPORT_PATH,
      sentence: v3Text(
        'Each sale measured against the price its seller asked on day one, then averaged.',
      ),
    })
  }
  if (ppsf) {
    figures.push({
      value: v3Text(ppsf),
      label: v3Text(
        yoyPpsf ? `median price per square foot, ${yoyPpsf}` : 'median price per square foot',
      ),
      href: REGION_REPORT_PATH,
      sentence: v3Text('The middle of what a square foot of finished living space sold for.'),
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
/* Section 4 — trailing 12 months by report city (leftover overlay)            */
/* -------------------------------------------------------------------------- */

type YearLeftover = Pick<PublicPaceRow, 'medianClose' | 'closedCount' | 'yoyMedian'>

function leftoverClosedFields(leftover: YearLeftover | null | undefined): Pick<
  MarketDetail,
  'medianSalePrice' | 'soldCount' | 'yoyMedianPriceDeltaPct'
> {
  return {
    medianSalePrice: leftover?.medianClose ?? null,
    soldCount: leftover?.closedCount ?? null,
    yoyMedianPriceDeltaPct: leftover?.yoyMedian != null ? leftover.yoyMedian * 100 : null,
  }
}

function leftoverClosedHasFigure(leftover: YearLeftover | null | undefined): boolean {
  return leftover?.medianClose != null || leftover?.closedCount != null || leftover?.yoyMedian != null
}

/** Cache-shaped stub so leftover-only cities can still print a year-ledger row. */
function emptyCityYearDetail(city?: Pick<ReportCity, 'slug' | 'label'>): MarketDetail {
  return {
    geoType: 'city',
    geoSlug: city?.slug ?? '',
    geoLabel: city?.label ?? null,
    periodType: 'rolling_365d',
    periodStart: null,
    periodEnd: null,
    medianSalePrice: null,
    avgSalePrice: null,
    totalVolume: null,
    soldCount: null,
    medianDom: null,
    medianPricePerSqft: null,
    avgSaleToListRatio: null,
    yoyMedianPriceDeltaPct: null,
    yoyPpsfChangePct: null,
    yoyDomChange: null,
    marketHealthLabel: null,
    marketHealthScore: null,
    endOfPeriodInventory: null,
    cashPurchasePct: null,
    medianConcessionsAmount: null,
    updatedAt: null,
    methodologyVersion: null,
  }
}

/**
 * City year-ledger median / sold / YoY from leftover Market Truth. Miss omits
 * those three (never cache fill). Cache medianDom stays. Leftover-only still
 * returns a printable row when any of the three is publishable.
 */
export function overlayYearDetailWithLeftover(
  detail: MarketDetail | null,
  leftover: YearLeftover | null | undefined,
  city?: Pick<ReportCity, 'slug' | 'label'>,
): MarketDetail | null {
  const closed = leftoverClosedFields(leftover)
  if (detail) return { ...detail, ...closed }
  if (!leftoverClosedHasFigure(leftover)) return null
  return { ...emptyCityYearDetail(city), ...closed }
}

/**
 * D9 leftover: each city is a door into its own report. Year-over-year change
 * already rides the row. A line through cities invents a sequence.
 */
export function buildYearLedger(
  cities: readonly ReportCity[],
  details: readonly (MarketDetail | null)[],
): CityLedger {
  const rows: V3LedgerFigureRow[] = []
  // Parallel to `rows` — see buildInventoryLedger's own comment on the same pattern.
  const medians: number[] = []
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
    medians.push(detail.medianSalePrice ?? 0)
  })
  const maxMedian = medians.length > 0 ? Math.max(...medians) : 0
  if (maxMedian > 0) {
    rows.forEach((row, i) => {
      row.weight = medians[i]! / maxMedian
    })
  }

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
  leftoverUsed = false,
): { region: V3ChartProps | undefined; trailing: V3ChartProps | undefined } {
  const complete = dropInProgressMonth(monthly, currentMonthKey)
  return {
    region: withChartId(buildRegionMedianChart(complete, leftoverUsed), 'region-median'),
    trailing: withChartId(
      buildMonthlyMedianChart(
        lastCompleteMonths(complete, 12),
        leftoverUsed
          ? 'Median sale price, single-family, last 12 completed months'
          : 'Median sale price, last 12 completed months',
      ),
      'trailing-median',
    ),
  }
}
