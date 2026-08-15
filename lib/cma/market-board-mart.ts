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

export const CMA_MART_YEAR = 2024
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
  const year = input.year ?? CMA_MART_YEAR
  const citySlug = citySlugForMart(input.city)
  if (!citySlug) return null

  const [cityRow, regionRow] = await Promise.all([
    getCoMarketAnnualCity({ year, citySlug, typeScope: 'all' }),
    getCoMarketAnnual({ year, typeScope: 'all' }),
  ])

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
