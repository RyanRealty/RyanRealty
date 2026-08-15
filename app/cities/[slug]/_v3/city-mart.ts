/**
 * Shape mart year figures for place Instruments. Nothing here fetches.
 *
 * Pulse stays the live HUD (single-family). Mart is the calendar-year cut.
 * A missing mart row is omitted, never printed as zero.
 */
import { v3Text, type V3ChartProps, type V3InstrumentFigure } from '@/components/site/v3'
import { ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import { CLOSED_SALES_YEAR } from '@/app/housing-market/_v3/hub-constants'
import { closedMartRow, compositionParts, volumeCompact } from '@/app/housing-market/_v3/closed-kpis'
import { buildCompositionChart } from '@/app/housing-market/_v3/market-charts'

export const PLACE_MART_YEAR = CLOSED_SALES_YEAR

export type PlaceMartGrain = 'city' | 'region'

export type PlaceMartFigure = CoMarketAnnualRow & { grain: PlaceMartGrain }

/** Present mart year only. Absent is not zero. */
export function presentPlaceMart(
  row: CoMarketAnnualRow | null | undefined,
  grain: PlaceMartGrain,
): PlaceMartFigure | null {
  const present = closedMartRow(row)
  return present ? { ...present, grain } : null
}

/** City grain wins. Region is context when the city cell is missing. */
export function pickPlaceMart(
  cityRow: CoMarketAnnualRow | null | undefined,
  regionRow: CoMarketAnnualRow | null | undefined,
): PlaceMartFigure | null {
  return presentPlaceMart(cityRow, 'city') ?? presentPlaceMart(regionRow, 'region')
}

export function placeMartYearLabel(grain: PlaceMartGrain, year: number): string {
  return grain === 'city'
    ? `all property types, ${year}`
    : `Central Oregon ${year}, all types`
}

export function placeMartFigures(
  mart: PlaceMartFigure | null,
  href: string,
): V3InstrumentFigure[] {
  if (!mart) return []
  const volume = volumeCompact(mart.totalVolume)
  if (!volume) return []
  return [
    {
      value: v3Text(volume),
      label: v3Text(placeMartYearLabel(mart.grain, mart.year)),
      href,
    },
  ]
}

export function placeMartTrace(mart: PlaceMartFigure, cityName: string): string {
  if (mart.grain === 'city') {
    return (
      `closed MLS sales through Oregon Data Share, ${cityName}, all property types, ` +
      `calendar year ${mart.year}, analytics_mart_market_annual city row. Not active inventory. ` +
      ANALYTICS_METHODOLOGY_V1
    )
  }
  return (
    `closed MLS sales through Oregon Data Share, Central Oregon service-area cities, ` +
    `all property types, calendar year ${mart.year}, analytics_mart_market_annual region row. ` +
    `Not ${cityName} city volume. Not active inventory. ${ANALYTICS_METHODOLOGY_V1}`
  )
}

/** One source line when pulse and mart share an Instrument. */
export function cityInstrumentSource(pulseTrace: string, mart: PlaceMartFigure | null, cityName: string): string {
  if (!mart) return pulseTrace
  return `${pulseTrace} ${placeMartTrace(mart, cityName)}`
}

/** Neighborhood grain is not in the mart. Region year volume is context only. */
export function regionMartContextTrace(mart: PlaceMartFigure): string {
  return (
    `Calendar-year dollar volume is Central Oregon ${mart.year}, all property types, ` +
    `analytics_mart_market_annual region row, not this neighborhood.`
  )
}

export function placeMartCompositionChart(mart: PlaceMartFigure | null): V3ChartProps | undefined {
  if (!mart) return undefined
  return buildCompositionChart(
    compositionParts(mart.propertyTypeBreakdown),
    `Closed sales by type, ${mart.year}`,
  )
}
