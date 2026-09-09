/**
 * URL over defaults (SITE-29).
 *
 * A static place page renders its split view with default filters; the URL's
 * query applies after mount. This is the one merge: every filter key the
 * split view understands, read from the live query, laid over the server's
 * defaults. Geo keys stay locked on a place page: the page IS the place, and
 * `?city=Redmond` on /cities/bend must not re-pin the list.
 *
 * Pure. Returns `base` itself when the query changes nothing, so memoized
 * consumers keep their identity.
 */
import { ALL_SEARCH_URL_PARAMS } from '@/lib/search/field-registry'
import { GEO_SCOPE_KEYS } from '@/components/search/geo-scope'

/** SearchFiltersInitial's non-geo keys, by name. Registry params ride along. */
export const BASE_SEARCH_URL_KEYS = [
  'propertyType',
  'propertySubTypes',
  'minPrice',
  'maxPrice',
  'beds',
  'baths',
  'maxBeds',
  'maxBaths',
  'status',
  'sort',
  'view',
  'minSqFt',
  'maxSqFt',
  'lotAcresMin',
  'lotAcresMax',
  'yearBuiltMin',
  'yearBuiltMax',
  'hasPool',
  'hasView',
  'hasWaterfront',
  'hasFireplace',
  'hasGolfCourse',
  'garageMin',
  'daysOnMarket',
  'keywords',
] as const

type ParamsReader = { get(key: string): string | null }

export function urlSearchFilterKeys(options: { lockPlace?: boolean } = {}): readonly string[] {
  const keys = new Set<string>([...BASE_SEARCH_URL_KEYS, ...ALL_SEARCH_URL_PARAMS])
  if (!options.lockPlace) for (const key of GEO_SCOPE_KEYS) keys.add(key)
  return [...keys]
}

export function mergeUrlSearchFilters<T extends Record<string, string | undefined>>(
  base: T,
  params: ParamsReader | null | undefined,
  options: { lockPlace?: boolean } = {},
): T {
  if (!params) return base
  let out: Record<string, string | undefined> | null = null
  for (const key of urlSearchFilterKeys(options)) {
    const raw = params.get(key)
    if (raw == null) continue
    const value = raw.trim()
    if (value === '') continue
    if (base[key] === value) continue
    out ??= { ...base }
    out[key] = value
  }
  return (out ?? base) as T
}
