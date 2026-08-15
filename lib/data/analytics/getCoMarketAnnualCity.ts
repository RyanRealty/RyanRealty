/**
 * getCoMarketAnnualCity — city-grain closed-sales annual metrics.
 *
 * Reads analytics_mart_market_annual via getCoMarketAnnualAt
 * (geoType city). A missing row is source: 'missing'. No listings scan.
 */
import 'server-only'
import { z } from 'zod'
import { ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'
import {
  getCoMarketAnnualAt,
  type AnalyticsTypeScope,
  type CoMarketAnnualRow,
} from '@/lib/data/analytics/getCoMarketAnnual'

const TypeScopeSchema = z.enum(['all', 'sfr', 'multi', 'land', 'other'])
const CitySlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export type CoMarketAnnualCityRow = CoMarketAnnualRow & {
  geoType: 'city'
  geoSlug: string
}

function missingCity(
  year: number,
  typeScope: AnalyticsTypeScope,
  citySlug: string,
): CoMarketAnnualCityRow {
  return {
    geoType: 'city',
    geoSlug: citySlug,
    year,
    typeScope,
    soldCount: 0,
    totalVolume: 0,
    medianClose: null,
    meanClose: null,
    propertyTypeBreakdown: {},
    methodology: ANALYTICS_METHODOLOGY_V1,
    source: 'missing',
    computedAt: '',
  }
}

export async function getCoMarketAnnualCity(input: {
  year: number
  citySlug: string
  typeScope?: AnalyticsTypeScope
}): Promise<CoMarketAnnualCityRow> {
  const yearParsed = z.number().int().min(1990).max(2100).safeParse(input.year)
  const slugParsed = CitySlugSchema.safeParse(input.citySlug.trim().toLowerCase())
  const typeParsed = TypeScopeSchema.safeParse(input.typeScope ?? 'all')
  if (!yearParsed.success || !slugParsed.success || !typeParsed.success) {
    return missingCity(
      yearParsed.success ? yearParsed.data : 0,
      typeParsed.success ? typeParsed.data : 'all',
      slugParsed.success ? slugParsed.data : input.citySlug.trim().toLowerCase(),
    )
  }
  const row = await getCoMarketAnnualAt({
    year: yearParsed.data,
    typeScope: typeParsed.data,
    geoType: 'city',
    geoSlug: slugParsed.data,
  })
  return { ...row, geoType: 'city', geoSlug: row.geoSlug || slugParsed.data }
}
