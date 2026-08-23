/**
 * DAL rows turned into barrel-ready props for /housing-market/[...slug].
 *
 * The page owns the reads, the one months-of-supply derivation, the JSON-LD,
 * and the JSX. This module is the pure turn. Nothing here fetches, reads the
 * clock, or classifies a market.
 *
 * ONE GUARD PER FIGURE, SHARED WITH ITS CONSUMER. Every live figure uses the
 * same `!= null && > 0` condition buildMarketFaq applies, so an Instrument
 * cannot print a number the shared builder declined to answer for.
 *
 * ABSENT IS NOT ZERO. A covered city with no live row is a Quiet footnote,
 * never "0 active" under a live-MLS source line.
 */

import type { BlogPostCard, MarketDetail, MarketPulse, MarketPulseSnapshot } from '@/lib/data'
import type { KbYearSeries } from '@/lib/kb/year-series'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatPrice, formatPriceCompact, formatPriceExact } from '@/lib/format/money'
import { listingsBrowsePath } from '@/lib/slug'
import {
  v3Text,
  type V3ChartPoint,
  type V3ChartProps,
  type V3ChartSeries,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { publishCompleteMonthMedian } from '@/lib/market/publish-complete-month-median'
import { COMPARISON_CITY_LABELS, COMPARISON_CITY_SLUG, HISTORY_PATH } from './geo-constants'

const MONTH_TICK = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export type LiveSection = {
  figures: V3InstrumentFigure[]
  trace: string
}

export type CityFootnote = { label: string; fact: string }

export type CityLedger = {
  rows: V3LedgerFigureRow[]
  stamp: string | undefined
  footnotes: CityFootnote[]
}

/**
 * Active single-family inventory for this geo. Days to pending and 30-day
 * closings are a different population and do not belong on this trace. City
 * scope adds YTD / this-month-or-last-complete / 12-month closed medians via
 * buildCityPeriodFigures, and the monthly median series via Instrument.chart.
 */
export function buildLiveFigures(pulse: MarketPulse | null, mosText: string | null, geoName: string): LiveSection {
  const medianListPrice =
    pulse?.medianListPrice != null && pulse.medianListPrice > 0 ? pulse.medianListPrice : null
  const activeCount = pulse != null && pulse.activeCount != null && pulse.activeCount > 0 ? pulse.activeCount : null

  const figures: V3InstrumentFigure[] = []
  if (medianListPrice != null) {
    figures.push({
      // THE DIGITS THE FAQ PUBLISHES, NOT A SECOND ROUNDING. buildMarketFaq
      // uses formatPriceExact on the same pulse.medianListPrice. formatPrice
      // rounds to the nearest $1,000, so Madras $399,900 printed $400,000 in
      // the Instrument beside $399,900 in the FAQ (fleet:6f45be4c).
      value: v3Text(formatPriceExact(medianListPrice)),
      label: v3Text('median list price'),
      href: listingsBrowsePath(),
    })
  }
  if (activeCount != null) {
    figures.push({
      value: v3Text(activeCount.toLocaleString('en-US')),
      label: v3Text('homes for sale'),
      href: listingsBrowsePath(),
    })
  }
  if (mosText != null) {
    figures.push({
      value: v3Text(mosText),
      label: v3Text('months of supply'),
      href: '/months-of-supply',
    })
  }

  const clauses = [
    `live MLS through Oregon Data Share, active single-family listings in ${geoName}`,
  ]
  const trace =
    `${clauses.join('. ')}.` + (mosText != null ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : '')

  return { figures, trace }
}

/**
 * Closed-sales fields from the monthly market_stats_cache row. Do not print
 * marketHealthLabel. No door: nothing on the site shows this exact monthly
 * closed window, and a wrong door is worse than none.
 */
export function buildClosedFigures(
  detail: MarketDetail | null,
  lastComplete?: MarketDetail | null,
  currentMonthKey?: string,
): V3InstrumentFigure[] {
  if (!detail && !lastComplete) return []
  const figures: V3InstrumentFigure[] = []
  const publishedMonth =
    currentMonthKey != null
      ? publishCompleteMonthMedian({
          monthly: detail,
          lastComplete,
          currentMonthKey,
        })
      : null
  if (publishedMonth) {
    const formatted = formatPrice(publishedMonth.value)
    if (formatted && formatted !== '\u2014') {
      figures.push({
        value: v3Text(formatted),
        label: v3Text(publishedMonth.label),
      })
    }
  } else if (detail?.medianSalePrice != null && detail.medianSalePrice > 0) {
    figures.push({
      value: v3Text(formatPrice(detail.medianSalePrice)),
      label: v3Text('median sale price'),
    })
  }
  if (detail?.soldCount != null && detail.soldCount > 0) {
    figures.push({
      value: v3Text(detail.soldCount.toLocaleString('en-US')),
      label: v3Text('homes sold'),
    })
  }
  if (detail?.avgSaleToListRatio != null && Number.isFinite(detail.avgSaleToListRatio)) {
    figures.push({
      value: v3Text(`${(detail.avgSaleToListRatio * 100).toFixed(1)}%`),
      label: v3Text('sale to list'),
    })
  }
  if (detail?.medianDom != null && detail.medianDom > 0) {
    figures.push({
      value: v3Text(`${Math.round(detail.medianDom)} days`),
      label: v3Text('median days on market'),
    })
  }
  if (detail?.medianPricePerSqft != null && detail.medianPricePerSqft > 0) {
    figures.push({
      value: v3Text(`$${Math.round(detail.medianPricePerSqft).toLocaleString('en-US')} per sq ft`),
      label: v3Text('price per sq ft'),
    })
  }
  if (detail?.totalVolume != null && detail.totalVolume > 0) {
    figures.push({
      value: v3Text(formatPriceExact(detail.totalVolume)),
      label: v3Text('closed volume'),
    })
  }
  return figures
}

export function closedTrace(geoName: string, figures: V3InstrumentFigure[]): string | null {
  if (figures.length === 0) return null
  return `closed single-family sales through Oregon Data Share, most recent monthly market_stats_cache row for ${geoName}`
}

/**
 * Sibling cities. A city earns a row when the live query returned one AND that
 * row carries a median. The current city is excluded. Stamp is the newest
 * updated_at among the returned city rows, not the geo pulse clock.
 */
export function buildCityLedger(snapshots: MarketPulseSnapshot[], currentCitySlug: string): CityLedger {
  const byLabel = new Map(snapshots.map((s) => [s.geo_label, s]))
  const rows: V3LedgerFigureRow[] = []
  const rowed = new Set<string>()

  for (const label of COMPARISON_CITY_LABELS) {
    const slug = COMPARISON_CITY_SLUG[label]
    if (!slug || slug === currentCitySlug) continue
    const snapshot = byLabel.get(label)
    if (!snapshot || snapshot.median_list_price == null || snapshot.active_count == null) continue
    rowed.add(label)
    rows.push({
      href: `/housing-market/${slug}`,
      when: v3Text(`${snapshot.active_count.toLocaleString('en-US')} for sale`),
      what: v3Text(label),
      detail:
        snapshot.median_days_to_pending != null
          ? v3Text(`${snapshot.median_days_to_pending} days to pending`)
          : undefined,
      value: v3Text(formatPriceExact(snapshot.median_list_price)),
      id: slug,
    })
  }

  const footnotes = COMPARISON_CITY_LABELS.filter(
    (label) => COMPARISON_CITY_SLUG[label] !== currentCitySlug && !rowed.has(label),
  ).map((label) => {
    const snapshot = byLabel.get(label)
    if (!snapshot) return { label, fact: `${label} returned no market row in the latest sync` }
    if (snapshot.active_count == null) {
      return { label, fact: `${label} has no published active single-family count` }
    }
    if (snapshot.active_count === 0) {
      return { label, fact: `${label} shows no active single-family listings` }
    }
    return {
      label,
      fact: `${label} shows ${snapshot.active_count.toLocaleString('en-US')} active with no published median`,
    }
  })

  const stamp = snapshots
    .map((s) => s.updated_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1)

  return { rows, stamp, footnotes }
}

export function buildFaqItems(
  faqs: ReadonlyArray<{ question: string; answer: string }>,
  extra: readonly V3QuietItem[],
): V3QuietItem[] {
  if (faqs.length === 0) {
    return [
      {
        kind: 'prose',
        term: 'No answers on this refresh',
        body: 'These answers are read from the live market row, which did not return, so this page is not stating a median, an inventory count, or a verdict in question form either.',
      },
      ...extra,
    ]
  }
  return [
    ...faqs.map((item) => ({
      kind: 'prose' as const,
      term: item.question,
      body: item.answer,
    })),
    ...extra,
  ]
}

export function buildExploreItems(args: {
  valuationHrefValue: string
  citySlug: string
  cityName: string
  communityName: string | null
  footnotes: readonly CityFootnote[]
  posts: readonly BlogPostCard[]
}): V3QuietItem[] {
  const items: V3QuietItem[] = [
    { label: 'Central Oregon housing market hub', href: '/housing-market' },
    { label: 'Central Oregon region report', href: '/housing-market/central-oregon' },
    { label: 'Closed sales explorer', href: HISTORY_PATH },
    { label: 'All Central Oregon cities', href: '/cities' },
    { label: 'Browse homes for sale', href: listingsBrowsePath() },
    { label: 'Value my home', href: args.valuationHrefValue },
    { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
  ]
  if (args.communityName) {
    items.unshift({
      label: `${args.cityName} housing market`,
      href: `/housing-market/${args.citySlug}`,
    })
  }
  for (const post of args.posts) {
    const title = post.title?.trim()
    const slug = post.slug?.trim()
    if (!title || !slug) continue
    items.push({ label: title, href: `/blog/${slug}` })
  }
  if (args.footnotes.length > 0) {
    items.push({
      kind: 'prose',
      term: 'Cities not in the table above',
      body: `${args.footnotes.map((city) => city.fact).join('. ')}.`,
    })
    for (const city of args.footnotes) {
      const slug = COMPARISON_CITY_SLUG[city.label]
      if (!slug) continue
      items.push({ label: `${city.label} market report`, href: `/housing-market/${slug}` })
    }
  }
  return items
}

function compactPricePoint(
  value: number,
  tick: string,
  at: number,
): V3ChartPoint | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const label = formatPriceCompact(value)
  if (!label || label === '\u2014') return null
  if (!tick) return null
  return { value, tick: v3Text(tick), label: v3Text(label), at }
}

function priceFigure(
  value: number | null | undefined,
  label: string,
  href?: string,
): V3InstrumentFigure | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  const formatted = formatPrice(value)
  if (!formatted || formatted === '\u2014') return null
  return {
    value: v3Text(formatted),
    label: v3Text(label),
    ...(href ? { href } : {}),
  }
}

/**
 * YTD / this month or last complete month / last-12-month closed medians
 * for the city Instrument. These are period snapshots, not a series. The
 * monthly median line is the chart. Do not print marketHealthLabel.
 */
export function buildCityPeriodFigures(args: {
  ytd: MarketDetail | null
  monthly: MarketDetail | null
  lastComplete?: MarketDetail | null
  rolling: MarketDetail | null
  currentMonthKey: string
}): { figures: V3InstrumentFigure[]; trace: string | null } {
  const figures: V3InstrumentFigure[] = []
  const ytdPrice = priceFigure(args.ytd?.medianSalePrice, 'YTD median sale', HISTORY_PATH)
  if (ytdPrice) figures.push(ytdPrice)
  if (args.ytd?.soldCount != null && args.ytd.soldCount > 0) {
    figures.push({
      value: v3Text(args.ytd.soldCount.toLocaleString('en-US')),
      label: v3Text('YTD homes sold'),
      href: HISTORY_PATH,
    })
  }
  const publishedMonth = publishCompleteMonthMedian({
    monthly: args.monthly,
    lastComplete: args.lastComplete,
    currentMonthKey: args.currentMonthKey,
  })
  const monthPrice = publishedMonth
    ? priceFigure(publishedMonth.value, publishedMonth.label)
    : null
  if (monthPrice) figures.push(monthPrice)
  const rollingPrice = priceFigure(args.rolling?.medianSalePrice, '12-month median sale', HISTORY_PATH)
  if (rollingPrice) figures.push(rollingPrice)
  if (figures.length === 0) return { figures, trace: null }
  const monthClause =
    publishedMonth?.grain === 'complete'
      ? publishedMonth.label.replace(/ median sale$/, '')
      : publishedMonth
        ? 'the current month'
        : null
  const closedBits = ['year-to-date', monthClause, 'the last 12 months'].filter(Boolean)
  return {
    figures,
    trace:
      `Closed-sale figures are ${closedBits.join(', ')} from market_stats_cache. They are a different population from the live list-price figures`,
  }
}

/**
 * One chronological monthly median line. Used for the community 12-month
 * trend and as the city fallback when a year overlay cannot plot.
 */
export function buildMonthlyMedianChart(
  monthly: readonly { periodStart: string; medianSalePrice: number | null }[],
  caption: string,
): V3ChartProps | undefined {
  const points: V3ChartPoint[] = []
  for (const row of monthly) {
    if (row.medianSalePrice == null) continue
    const d = new Date(row.periodStart)
    if (Number.isNaN(d.getTime())) continue
    const month = MONTH_TICK[d.getUTCMonth()]
    if (!month) continue
    const point = compactPricePoint(row.medianSalePrice, `${month} ${d.getUTCFullYear()}`, d.getTime())
    if (point) points.push(point)
  }
  if (points.length < 2) return undefined
  return {
    caption: v3Text(caption),
    series: [{ name: v3Text('Median sale'), points }],
  }
}

/**
 * City year overlay: newest three calendar years that each have two or more
 * finite months, sharing a Jan-Dec axis. The atom distinguishes three series.
 * Falls back to one chronological monthly line when the overlay cannot plot.
 */
export function buildCityMedianChart(
  years: readonly KbYearSeries[],
  monthly: readonly { periodStart: string; medianSalePrice: number | null }[],
): V3ChartProps | undefined {
  const overlay: V3ChartSeries[] = []
  for (const year of years.slice(-3)) {
    const points: V3ChartPoint[] = []
    for (const row of year.points) {
      const tick = MONTH_TICK[row.m - 1]
      if (!tick) continue
      const point = compactPricePoint(row.value, tick, row.m)
      if (point) points.push(point)
    }
    if (points.length < 2) continue
    overlay.push({ name: v3Text(String(year.year)), points })
  }
  if (overlay.length > 0) {
    return {
      caption: v3Text('Median sale price by month, recent years'),
      series: overlay,
    }
  }
  return buildMonthlyMedianChart(monthly, 'Median sale price, completed months')
}
