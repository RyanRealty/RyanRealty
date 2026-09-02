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
import { formatPrice, formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { publishDaysFigure } from '@/lib/market/publish-days-figure'
import { marketVerdict } from '@/lib/market/classify'
import type { SchemaInput } from '@/lib/site/json-ld'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
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
  hud: LeftoverHudKpis | null,
): V3InstrumentFigure[] {
  if (!hud) return []
  const figures: V3InstrumentFigure[] = []
  if (hud.medianList != null && hud.medianList > 0) {
    figures.push({
      value: v3Text(formatPriceExact(hud.medianList)),
      label: v3Text('median list price'),
      href: '/housing-market',
    })
  }
  if (hud.active != null && hud.active > 0) {
    figures.push({
      value: v3Text(hud.active.toLocaleString('en-US')),
      label: v3Text('homes for sale'),
      href: '/homes-for-sale?view=list',
    })
  }
  if (hud.pending != null && hud.pending > 0) {
    figures.push({
      value: v3Text(hud.pending.toLocaleString('en-US')),
      label: v3Text('pending · now'),
    })
  }
  const mosRaw = hud.monthsSupply != null && hud.monthsSupply > 0 ? hud.monthsSupply : null
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
  const daysToPending = publishDaysFigure(hud.daysToPending)
  if (daysToPending) {
    figures.push({
      value: v3Text(daysToPending),
      label: v3Text('median to pending · 90 days'),
      href: '/housing-market',
    })
  }
  return figures
}

export function buildCityLedgerRows(snapshots: CityReportSnapshot[]): V3LedgerFigureRow[] {
  const rows: V3LedgerFigureRow[] = []
  for (const s of snapshots) {
    const listPrice = s.live?.medianListPrice
    // trailing12mo median/sold are leftover-overlaid on getCityReportSnapshots.
    const salePrice = s.trailing12mo?.medianSalePrice
    const price = listPrice != null && listPrice > 0 ? listPrice : salePrice
    if (price == null || price <= 0) continue
    const usingLiveList = listPrice != null && listPrice > 0
    const active = s.live?.activeCount
    rows.push({
      href: `/cities/${s.urlSlug}`,
      when: v3Text(
        active != null && active > 0
          ? `${active.toLocaleString('en-US')} for sale`
          : 'trailing 12 months',
      ),
      what: v3Text(s.cityLabel),
      value: v3Text(usingLiveList ? formatPriceExact(price) : formatPrice(price)),
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
    if ((r.sales12mo ?? 0) > 0) {
      datasetVariables.push({
        name: `${r.city} 12-month closed sales`,
        value: r.sales12mo as number,
      })
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
      'Includes closed sales, 12-month leftover closed sales, median sale price, median days on market, and active listings. ' +
      'Sourced from Oregon Data Share via Ryan Realty. 12-month closed sales cover the region beyond the city rows.',
    url: `${siteUrl}${CANONICAL_PATH}`,
    temporalCoverage: `${periodStart}/${periodEnd}`,
    spatialCoverageName: 'Central Oregon, OR',
    variableMeasured: datasetVariables,
  }
}
