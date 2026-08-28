/**
 * City Stage type-and-go. Reuses parseSearchQuery / searchHrefForQuery so
 * the city template does not grow a second suggestions engine. The Type
 * control is the one property-type door on this page — not nine H2s.
 */
import { parseSearchQuery, searchHrefForQuery } from '@/lib/parse-search-query'
import { homesForSalePath } from '@/lib/slug'

export const CITY_TYPE_KEYS = ['any', 'homes', 'townhome', 'condo', 'land', 'new'] as const
export type CityTypeKey = (typeof CITY_TYPE_KEYS)[number]

export const CITY_TYPE_OPTIONS: readonly { key: CityTypeKey; label: string }[] = [
  { key: 'any', label: 'Any type' },
  { key: 'homes', label: 'Homes' },
  { key: 'townhome', label: 'Townhomes' },
  { key: 'condo', label: 'Condos' },
  { key: 'land', label: 'Land' },
  { key: 'new', label: 'New construction' },
]

export function isCityTypeKey(value: string): value is CityTypeKey {
  return (CITY_TYPE_KEYS as readonly string[]).includes(value)
}

/** New-construction floor: built in the last two full years, current year inclusive. */
export function cityNewConstructionYear(now: Date = new Date()): number {
  return now.getUTCFullYear() - 2
}

export function cityTypeParams(
  type: CityTypeKey,
  now: Date = new Date(),
): Record<string, string> {
  if (type === 'townhome') return { propertySubTypes: 'Townhouse' }
  if (type === 'condo') return { propertySubTypes: 'Condominium' }
  if (type === 'land') return { propertyType: 'Land' }
  if (type === 'new') return { yearBuiltMin: String(cityNewConstructionYear(now)) }
  return {}
}

export function mergeSearchHref(base: string, extra: Record<string, string>): string {
  const qIndex = base.indexOf('?')
  const path = qIndex === -1 ? base : base.slice(0, qIndex)
  const params = new URLSearchParams(qIndex === -1 ? '' : base.slice(qIndex + 1))
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/**
 * Empty query stays on this city's browse with the Type filter.
 * A query that already names a city or community keeps that destination.
 * Anything else stays in this city.
 */
export function citySearchHref(input: {
  query: string
  cityName: string
  type: CityTypeKey
  now?: Date
}): string {
  const typeParams = cityTypeParams(input.type, input.now)
  const text = input.query.trim()
  const cityPath = homesForSalePath(input.cityName)
  if (!text) return mergeSearchHref(cityPath, typeParams)

  const parsed = parseSearchQuery(text)
  const href = searchHrefForQuery(text)
  if (parsed.city || parsed.subdivision) return mergeSearchHref(href, typeParams)

  const qIndex = href.indexOf('?')
  const rest = qIndex === -1 ? {} : Object.fromEntries(new URLSearchParams(href.slice(qIndex + 1)))
  return mergeSearchHref(cityPath, { ...rest, ...typeParams })
}
