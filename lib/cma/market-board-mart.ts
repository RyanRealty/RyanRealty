/**
 * CMA market-board year figure from analytics_mart_market_annual.
 *
 * City grain first (getCoMarketAnnualCity). Region if the city cell is missing.
 * Neighborhood / community grain is not in this mart. A missing row is omitted.
 * No listings scan.
 */
import { getCoMarketAnnual, type CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import { getCoMarketAnnualCity } from '@/lib/data/analytics/getCoMarketAnnualCity'
import { ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

function presentMart(row: CoMarketAnnualRow | null | undefined): CoMarketAnnualRow | null {
  if (!row || row.source !== 'mart') return null
  if (!(row.year > 0 && row.soldCount > 0 && row.totalVolume > 0)) return null
  return row
}

/**
 * How far back to look for a complete year before giving up.
 *
 * This replaces a hardcoded `CMA_MART_YEAR = 2024`. The mart holds 2025 and
 * 2026 for Redmond, but every CMA built after 2024 still published the 2024
 * figure — a number carried from a prior deliverable and never re-verified,
 * which is the first thing CLAUDE.md §0 forbids. Caught by building a real CMA
 * for 833 Maple in August 2026 and reading "Redmond closed sales, 2024" off the
 * rendered page.
 *
 * The search starts at LAST year, never the current one: a year in progress is
 * a partial count and would understate volume badly (Redmond had 575 sales by
 * August 2026 against 1,083 for a full year), and printing that next to a year
 * label reads as a collapse in the market rather than a calendar artifact.
 */
export const CMA_MART_MAX_LOOKBACK_YEARS = 4
export const CMA_MART_TABLE = 'analytics_mart_market_annual' as const

export type CmaMartYearFigure = {
  year: number
  geoType: 'city' | 'region'
  geoSlug: string
  geoLabel: string
  typeScope: 'all'
  soldCount: number
  totalVolume: number
  medianClose: number | null
  source: 'mart'
  table: typeof CMA_MART_TABLE
  computedAt: string
  methodology: string
  typeLabel: string
}

/** The most recent year that is over. See CMA_MART_MAX_LOOKBACK_YEARS. */
export function lastCompleteYear(now: Date = new Date()): number {
  return now.getUTCFullYear() - 1
}

export function citySlugForMart(city: string): string {
  return city.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function martYearTypeLabel(geoType: 'city' | 'region', year: number): string {
  return geoType === 'city'
    ? `all property types, ${year}`
    : `Central Oregon ${year}, all types`
}

export async function getCmaMarketBoardYear(input: {
  city: string
  year?: number
}): Promise<CmaMartYearFigure | null> {
  const citySlug = citySlugForMart(input.city)
  if (!citySlug) return null

  // An explicit year is honoured as-is (callers asking for one mean it).
  // Otherwise walk back from the last COMPLETE year to the first that presents.
  const candidates = input.year != null
    ? [input.year]
    : Array.from({ length: CMA_MART_MAX_LOOKBACK_YEARS }, (_, i) => lastCompleteYear() - i)

  let cityRow: CoMarketAnnualRow | null = null
  let regionRow: CoMarketAnnualRow | null = null
  for (const y of candidates) {
    const [c, r] = await Promise.all([
      getCoMarketAnnualCity({ year: y, citySlug, typeScope: 'all' }),
      getCoMarketAnnual({ year: y, typeScope: 'all' }),
    ])
    cityRow = c
    regionRow = r
    // City grain is the goal; stop as soon as either grain has a real row so a
    // city with a thin year still falls through to the region for that year
    // rather than silently reaching further back than the region would.
    if (presentMart(c) || presentMart(r)) break
  }

  const city = presentMart(cityRow)
  if (city) {
    return {
      year: city.year,
      geoType: 'city',
      geoSlug: citySlug,
      geoLabel: input.city.trim(),
      typeScope: 'all',
      soldCount: city.soldCount,
      totalVolume: city.totalVolume,
      medianClose: city.medianClose,
      source: 'mart',
      table: CMA_MART_TABLE,
      computedAt: city.computedAt,
      methodology: city.methodology || ANALYTICS_METHODOLOGY_V1,
      typeLabel: martYearTypeLabel('city', city.year),
    }
  }

  const region = presentMart(regionRow)
  if (region) {
    return {
      year: region.year,
      geoType: 'region',
      geoSlug: 'central-oregon',
      geoLabel: 'Central Oregon',
      typeScope: 'all',
      soldCount: region.soldCount,
      totalVolume: region.totalVolume,
      medianClose: region.medianClose,
      source: 'mart',
      table: CMA_MART_TABLE,
      computedAt: region.computedAt,
      methodology: region.methodology || ANALYTICS_METHODOLOGY_V1,
      typeLabel: martYearTypeLabel('region', region.year),
    }
  }

  return null
}

export function yearMartCite(yearMart: CmaMartYearFigure | null | undefined) {
  if (!yearMart) return { source: 'none' as const }
  return {
    source: 'analytics_mart_market_annual' as const,
    geo_type: yearMart.geoType,
    geo_slug: yearMart.geoSlug,
    year: yearMart.year,
    type_scope: 'all' as const,
    sold_count: yearMart.soldCount,
    total_volume: yearMart.totalVolume,
    computed_at: yearMart.computedAt,
  }
}
