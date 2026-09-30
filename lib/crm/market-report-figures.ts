/**
 * market-report-figures — the §0 trace of every figure a market-report email
 * prints (CLAUDE.md §0, "No trace, no ship").
 *
 * One ReportFigure per printed number: which area, what it is, the raw value,
 * the exact string the reader saw, the source (table and the DAL function that
 * read it), the filter, the date the data is as of, and the sample size. The
 * renderer builds this list in the same pass that prints the numbers, so a
 * figure cannot reach the email without its trace. The sender stores the list
 * on the crm_report_sends row (figures jsonb), where an admin audits any number
 * that went out. None of it is ever rendered into the email itself.
 *
 * Pure: types and string builders only, no I/O.
 */

import type {
  MarketReportAreaBlock,
  MarketReportProvenance,
} from '@/lib/data/crm/getMarketReportData'
import type { MarketTrendPoint } from '@/lib/data/market/getMarketTrend'

/** One printed figure and its trace. Stored as-is in crm_report_sends.figures. */
export type ReportFigure = {
  /** The area slug, or null for a report-level line (the headline). */
  area: string | null
  areaLabel: string | null
  /** What the figure is, in plain words ("median sale price, last 12 months"). */
  label: string
  /** The raw number, unrounded. Null for a derived line that is not one number. */
  value: number | null
  /** Exactly what the reader saw. */
  display: string
  /** The table and the DAL function that read it. */
  source: string
  /** The filter that selects the row(s). */
  filter: string
  /** The date the data is as of (complete-through, period end, or refresh time). */
  as_of: string | null
  /** The sample the figure rests on, when it has one. */
  n: number | null
}

/** Admin preview shape kept for the settings-page preview dialog. */
export type EmailFigureTrace = { figure: string; source: string }

/** The legacy one-line traces, derived from the structured figures. */
export function figuresToTraces(figures: readonly ReportFigure[]): EmailFigureTrace[] {
  return figures.map((f) => ({
    figure: [f.areaLabel, f.label, f.display].filter((s) => s && String(s).trim()).join(' ').trim(),
    source: [f.source, f.filter, f.as_of ? `as of ${f.as_of}` : null, f.n != null ? `n=${f.n}` : null]
      .filter(Boolean)
      .join(' · '),
  }))
}

type Area = Pick<MarketReportAreaBlock, 'slug' | 'areaLabel' | 'geoType'>

function areaFilter(area: Area): string {
  return `geo_type=${area.geoType} geo_slug=${area.slug}`
}

function prov(area: MarketReportAreaBlock): MarketReportProvenance | null {
  return area.provenance ?? null
}

/** The trailing-twelve-month cells (median, closed count, YoY). */
export function twelveMonthTrace(
  area: MarketReportAreaBlock,
  stat: 'median_close' | 'closed_count' | 'yoy_median_price',
): { source: string; filter: string; as_of: string | null; n: number | null } {
  if (area.twelveMonthSource === 'market-truth') {
    const cells = prov(area)?.twelveMonth ?? null
    const cell =
      stat === 'median_close' ? cells?.medianClose : stat === 'closed_count' ? cells?.closedCount : cells?.yoyMedian
    return {
      source: 'market_metric via getPublicDetachedPace (Market Truth leftover, segment detached)',
      filter: `stat_id=${stat} ${areaFilter(area)} window_months=12${cell?.definitionId ? ` definition_id=${cell.definitionId}` : ''}`,
      as_of: cell?.completeThrough || null,
      n: cell && Number.isFinite(cell.sampleN) ? cell.sampleN : null,
    }
  }
  const column =
    stat === 'median_close' ? 'median_sale_price' : stat === 'closed_count' ? 'sold_count' : 'yoy_median_price_delta_pct'
  const cache = prov(area)?.cache ?? null
  return {
    source: 'market_stats_cache via getCityMarketDetail',
    filter: `${areaFilter(area)} period_type=rolling_365d column=${column}`,
    as_of: cache?.periodEnd ?? cache?.updatedAt ?? null,
    n: cache?.soldCount ?? null,
  }
}

/** The live inventory figure ("Homes for sale"). */
export function activeTrace(area: MarketReportAreaBlock): {
  source: string
  filter: string
  as_of: string | null
  n: number | null
} {
  const live = prov(area)?.live ?? null
  if (area.source === 'market_pulse_live' && live?.table === 'market_metric') {
    return {
      source: 'market_metric via getDetachedMarkets (Market Truth, segment detached)',
      filter: `stat_id=active_count ${areaFilter(area)}`,
      as_of: live.computedAt ?? live.completeThrough ?? null,
      n: null,
    }
  }
  if (area.source === 'market_pulse_live') {
    return {
      source: 'market_pulse_live via getMarketPulse',
      filter: `${areaFilter(area)} column=active_count`,
      as_of: live?.computedAt ?? area.refreshedAt ?? null,
      n: null,
    }
  }
  const cache = prov(area)?.cache ?? null
  return {
    source: 'market_stats_cache via getCityMarketDetail',
    filter: `${areaFilter(area)} period_type=rolling_365d column=end_of_period_inventory`,
    as_of: cache?.periodEnd ?? cache?.updatedAt ?? null,
    n: null,
  }
}

/** Months of supply: the live figure, or the trailing-12-month fallback. */
export function mosTrace(area: MarketReportAreaBlock): {
  source: string
  filter: string
  as_of: string | null
  n: number | null
} {
  const live = prov(area)?.live ?? null
  const cache = prov(area)?.cache ?? null
  if (area.monthsOfSupplySource === 'computed-12mo') {
    return {
      source: 'computed: homes for sale / (market_stats_cache rolling_365d sold_count / 12)',
      filter: `${areaFilter(area)} active=${area.activeListings ?? 'n/a'} sold_count=${cache?.soldCount ?? 'n/a'}`,
      as_of: cache?.periodEnd ?? cache?.updatedAt ?? null,
      n: cache?.soldCount ?? null,
    }
  }
  if (live?.table === 'market_metric') {
    return {
      source: 'market_metric via getDetachedMarkets (Market Truth, segment detached, six-month absorption)',
      filter: `stat_id=months_of_supply ${areaFilter(area)}`,
      as_of: live.computedAt ?? live.completeThrough ?? null,
      n: null,
    }
  }
  return {
    source: 'market_pulse_live via getMarketPulse (six-month absorption)',
    filter: `${areaFilter(area)} column=months_of_supply`,
    as_of: live?.computedAt ?? area.refreshedAt ?? null,
    n: null,
  }
}

/** Median days on market: always the rolling_365d cache row (D17 carve-out). */
export function domTrace(area: MarketReportAreaBlock): {
  source: string
  filter: string
  as_of: string | null
  n: number | null
} {
  const cache = prov(area)?.cache ?? null
  return {
    source: 'market_stats_cache via getCityMarketDetail',
    filter: `${areaFilter(area)} period_type=rolling_365d column=median_dom${cache?.methodologyVersion ? ` methodology=${cache.methodologyVersion}` : ''}`,
    as_of: cache?.periodEnd ?? cache?.updatedAt ?? null,
    n: cache?.soldCount ?? null,
  }
}

/** The last calendar day of a monthly period ("2026-06-01" -> "2026-06-30"): the date its data is as of. */
export function monthEnd(periodStart: string): string {
  const key = periodStart.slice(0, 7)
  const [y, m] = key.split('-').map(Number)
  if (!Number.isInteger(y) || !Number.isInteger(m)) return periodStart.slice(0, 10)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

/** One completed month from the monthly cache series. */
export function monthlyTrace(
  area: Area,
  point: MarketTrendPoint,
  column: 'median_sale_price',
): { source: string; filter: string; as_of: string | null; n: number | null } {
  return {
    source: 'market_stats_cache via getMarketTrend',
    filter: `${areaFilter(area)} period_type=monthly period_start=${point.periodStart.slice(0, 10)} column=${column}`,
    as_of: monthEnd(point.periodStart),
    n: point.soldCount ?? null,
  }
}
