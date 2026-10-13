/**
 * Saved-search filters for the /buy/alerts form. The capture action already
 * accepts city, cities[], minPrice, maxPrice, beds, and propertyType. Central
 * Oregon is the wide match (property type A, no city), the same shape the
 * existing /buy sheet uses.
 */
import { V3_PRICE_STOPS } from '@/components/site/v3/V3Range.logic'
import { CENTRAL_OREGON_ID } from './buy-alerts-constants'

export const BUY_ALERT_PROPERTY_TYPE = 'A'

export type BuyAlertFilterInput = {
  towns: readonly string[]
  minPrice?: number | null
  maxPrice?: number | null
  beds?: number | null
}

export function parseOptionalBound(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function buildBuyAlertFilters(input: BuyAlertFilterInput): Record<string, unknown> {
  const filters: Record<string, unknown> = { propertyType: BUY_ALERT_PROPERTY_TYPE }
  const towns = [...new Set(input.towns.map((t) => t.trim()).filter(Boolean))]
  const wide = towns.includes(CENTRAL_OREGON_ID)
  const cities = towns.filter((t) => t !== CENTRAL_OREGON_ID)
  if (!wide) {
    if (cities.length === 1) filters.city = cities[0]
    else if (cities.length > 1) filters.cities = cities
  }

  const lastStop = V3_PRICE_STOPS[V3_PRICE_STOPS.length - 1] ?? 0
  let min = input.minPrice != null && Number.isFinite(input.minPrice) && input.minPrice > 0 ? input.minPrice : null
  let max = input.maxPrice != null && Number.isFinite(input.maxPrice) && input.maxPrice > 0 ? input.maxPrice : null
  if (max != null && max >= lastStop) max = null
  if (min != null && max != null && min > max) {
    min = null
    max = null
  }
  if (min != null) filters.minPrice = min
  if (max != null) filters.maxPrice = max
  if (input.beds != null && Number.isFinite(input.beds) && input.beds > 0) filters.beds = input.beds
  return filters
}
