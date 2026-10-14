import type { PriceDropFieldItem } from './drops-field-items'

export type PriceDropCatalogFilters = {
  /** Empty string means every city on the page. */
  city: string
  /** Inclusive ceiling on current ask. Null means any price. */
  priceMax: number | null
  /** Inclusive floor on bedrooms. Null means any bed count. */
  bedsMin: number | null
}

export const PRICE_DROP_CATALOG_PAGE_SIZE = 24

export const PRICE_DROP_PRICE_FILTERS: ReadonlyArray<{ key: string; label: string; max: number | null }> = [
  { key: 'any', label: 'Any price', max: null },
  { key: '500', label: 'Under $500K', max: 500_000 },
  { key: '750', label: 'Under $750K', max: 750_000 },
  { key: '1000', label: 'Under $1M', max: 1_000_000 },
  { key: '1500', label: 'Under $1.5M', max: 1_500_000 },
]

export const PRICE_DROP_BED_FILTERS: ReadonlyArray<{ key: string; label: string; min: number | null }> = [
  { key: 'any', label: 'Any beds', min: null },
  { key: '2', label: '2+ beds', min: 2 },
  { key: '3', label: '3+ beds', min: 3 },
  { key: '4', label: '4+ beds', min: 4 },
]

export function filterPriceDropCatalog(
  items: readonly PriceDropFieldItem[],
  filters: PriceDropCatalogFilters,
): PriceDropFieldItem[] {
  const city = filters.city.trim().toLowerCase()
  return items.filter((item) => {
    if (city && (item.city?.trim().toLowerCase() ?? '') !== city) return false
    if (filters.priceMax != null) {
      const price = item.listPrice
      if (price == null || !Number.isFinite(price) || price > filters.priceMax) return false
    }
    if (filters.bedsMin != null) {
      const beds = item.beds
      if (beds == null || !Number.isFinite(beds) || beds < filters.bedsMin) return false
    }
    return true
  })
}

export function catalogCityOptions(items: readonly PriceDropFieldItem[]): string[] {
  const names = new Set<string>()
  for (const item of items) {
    const city = item.city?.trim()
    if (city) names.add(city)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}
