/**
 * Pure builders for /housing-market/reports.
 *
 * The page owns the reads, JSON-LD, and JSX. This module turns DAL rows into
 * barrel-ready props so the hub stays under the 600-line floor. Nothing here
 * fetches, reads the clock, or classifies a market.
 *
 * D9: each city is a door into /cities/<slug>. A line through cities invents a
 * sequence, so the city block is a Ledger, not a chart. The range table
 * (ReportsByCityView) stays an island rather than flattening that series.
 */
import { MARKET_REPORT_DEFAULT_CITIES } from '@/lib/data/geo/report-cities'
import { parseRangePeriod, type RangePeriod, type CityRangeReport } from '@/lib/market/range-periods'
import type { CityReportSnapshot } from '@/lib/data/market/getCityReportSnapshot'
import { formatPrice } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { publishDaysFigure } from '@/lib/market/publish-days-figure'
import { marketVerdict } from '@/lib/market/classify'
import type { MarketPulse } from '@/lib/data/types/market'
import type { SchemaInput } from '@/lib/site/json-ld'
import { v3Text, type V3InstrumentFigure, type V3LedgerFigureRow } from '@/components/site/v3'
import { CANONICAL_PATH, siteUrl } from './hub-constants'

export function parseReportsParams(params: { [key: string]: string | string[] | undefined } | null): {
  cities: string[]
  period: RangePeriod
} {
  const citiesParam = params?.cities
  const cities =
    typeof citiesParam === 'string' && citiesParam.trim()
      ? citiesParam.split(',').map((c) => c.trim()).filter(Boolean)
      : [...MARKET_REPORT_DEFAULT_CITIES]
  return { cities, period: parseRangePeriod(params?.range) }
}

export function buildRegionFigures(
  pulse: MarketPulse | null,
): V3InstrumentFigure[] {
  if (!pulse) return []
  const figures: V3InstrumentFigure[] = []
  if (pulse.medianListPrice != null && pulse.medianListPrice > 0) {
    figures.push({
      value: v3Text(formatPrice(pulse.medianListPrice)),
      label: v3Text('median list price'),
      href: '/housing-market',
    })
  }
  if (pulse.activeCount > 0) {
    figures.push({
      value: v3Text(pulse.activeCount.toLocaleString('en-US')),
      label: v3Text('homes for sale'),
      href: '/homes-for-sale',
    })
  }
  const mosRaw =
    pulse.monthsOfSupply != null && pulse.monthsOfSupply > 0 ? pulse.monthsOfSupply : null
  if (mosRaw != null) {
    const verdict = marketVerdict(mosRaw)
    figures.push({
      value: v3Text(formatMonthsOfSupply(mosRaw)),
      label: v3Text(
        verdict.kind === 'unknown' ? 'months of supply' : `months of supply, ${verdict.label}`,
      ),
      href: '/months-of-supply',
    })
  }
  const daysToPending = publishDaysFigure(pulse.medianDaysToPending)
  if (daysToPending) {
    figures.push({
      value: v3Text(daysToPending),
      label: v3Text('median days to pending'),
      href: '/housing-market',
    })
  }
  return figures
}

export function buildCityLedgerRows(snapshots: CityReportSnapshot[]): V3LedgerFigureRow[] {
  const rows: V3LedgerFigureRow[] = []
  for (const s of snapshots) {
    const price = s.live?.medianListPrice ?? s.trailing12mo?.medianSalePrice
    if (price == null || price <= 0) continue
    const active = s.live?.activeCount
    rows.push({
      href: `/cities/${s.urlSlug}`,
      when: v3Text(
        active != null && active > 0
          ? `${active.toLocaleString('en-US')} for sale`
          : 'trailing 12 months',
      ),
      what: v3Text(s.cityLabel),
      value: v3Text(formatPrice(price)),
      id: s.urlSlug,
    })
  }
  rows.sort((a, b) => String(a.what).localeCompare(String(b.what)))
  return rows
}

export function buildRangeDataset(reportData: CityRangeReport): SchemaInput | null {
  const datasetVariables: Array<{ name: string; value: string | number; unitText?: string }> = []
  for (const r of reportData.rows) {
    if ((r.soldCount ?? 0) > 0) {
      datasetVariables.push({ name: `${r.city} closed sales`, value: r.soldCount as number })
    }
    if (r.medianSalePrice != null && r.medianSalePrice > 0) {
      datasetVariables.push({
        name: `${r.city} median sale price`,
        value: Math.round(r.medianSalePrice),
        unitText: 'USD',
      })
    }
    if (r.medianDom != null && r.medianDom >= 0) {
      datasetVariables.push({
        name: `${r.city} median days on market`,
        value: r.medianDom,
        unitText: 'days',
      })
    }
    if ((r.activeCount ?? 0) > 0) {
      datasetVariables.push({ name: `${r.city} active listings`, value: r.activeCount as number })
    }
  }
  const { periodStart, periodEnd } = reportData
  if (datasetVariables.length === 0 || !periodStart || !periodEnd) return null
  return {
    type: 'dataset',
    name: `Central Oregon real estate market report, ${periodStart} to ${periodEnd}`,
    description:
      'Single-family home sales and inventory data for Central Oregon cities. ' +
      'Includes closed sales, median sale price, median days on market, and active listings. ' +
      'Sourced from Oregon Data Share via Ryan Realty.',
    url: `${siteUrl}${CANONICAL_PATH}`,
    temporalCoverage: `${periodStart}/${periodEnd}`,
    spatialCoverageName: 'Central Oregon, OR',
    variableMeasured: datasetVariables,
  }
}
