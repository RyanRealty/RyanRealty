export type QueryParams = Record<string, string | string[] | undefined>

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** Camera/UI state. Never copy onto a search canonical (crawl trap). */
export const SEARCH_CANONICAL_STRIP_KEYS = ['view', 'bbox'] as const

/**
 * Copy indexable query keys onto a search canonical URL. Drops `view` and
 * `bbox` so `/homes-for-sale?view=list` and map pans do not mint a new URL.
 */
export function appendIndexableSearchParams(
  url: URL,
  searchParams: QueryParams | undefined,
): void {
  if (!searchParams) return
  const strip = new Set<string>(SEARCH_CANONICAL_STRIP_KEYS)
  for (const [key, value] of Object.entries(searchParams)) {
    if (strip.has(key)) continue
    const raw = firstParam(value)
    if (raw != null && raw !== '') url.searchParams.set(key, raw)
  }
}

export function shouldNoIndexSearchVariant(searchParams: QueryParams | undefined): boolean {
  if (!searchParams) return false
  const page = Number(firstParam(searchParams.page) ?? '1')
  if (Number.isFinite(page) && page > 1) return true

  const blockedKeys = [
    'minPrice',
    'maxPrice',
    'beds',
    'baths',
    'minSqFt',
    'maxSqFt',
    'maxBeds',
    'maxBaths',
    'yearBuiltMin',
    'yearBuiltMax',
    'lotAcresMin',
    'lotAcresMax',
    'postalCode',
    'propertyType',
    'propertySubType',
    'statusFilter',
    'keywords',
    'hasOpenHouse',
    'garageMin',
    'hasPool',
    'hasView',
    'hasWaterfront',
    'newListingsDays',
    'sort',
    'includeClosed',
    'view',
    'bbox',
    'perPage',
  ]
  return blockedKeys.some((key) => {
    const raw = firstParam(searchParams[key])
    return raw != null && raw !== ''
  })
}

export function shouldNoIndexBlogIndex(params: { category?: string; page?: string } | undefined): boolean {
  if (!params) return false
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const hasCategory = Boolean(params.category && params.category !== 'All')
  return page > 1 || hasCategory
}
