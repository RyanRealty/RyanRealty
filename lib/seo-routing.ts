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

/**
 * True when a search URL's QUERY makes it a different result set from its
 * canonical: a filter, a sort, a page > 1, a page size.
 *
 * CAMERA KEYS DO NOT NOINDEX (gsc-trend-5, visibility audit 2026-09-23).
 * `view` and `bbox` (SEARCH_CANONICAL_STRIP_KEYS) are where the map is looking
 * and which pane is open. `view` has been on this list since at least
 * 2026-06-01; `bbox` joined it on 2026-09-05 (aba181208), a week after the
 * search map began writing `?bbox=` into the URL on its very first settle
 * (bd60d6b34, 2026-08-29: MapSearchView.handleBoundsChanged -> navigateQuery
 * -> router.replace on the slug route, which passes no staticShell). A
 * router.replace on this dynamic route re-runs generateMetadata, so a renderer
 * that waits for the map to settle can end on `<meta name="robots"
 * content="noindex">` for the very page it asked for.
 *
 * Evidence, read 2026-09-23. Search Console URL Inspection for
 * /homes-for-sale/bend (the declared target of the p1 "homes for sale bend
 * oregon" queries): last crawl 2026-09-12, "Excluded by 'noindex' tag",
 * indexingState BLOCKED_BY_META_TAG, user canonical = itself. Its raw server
 * HTML says "index, follow"; /homes-for-sale/bend?bbox=... serves
 * "noindex, follow". Search Analytics: 0 impressions 2026-09-06..09-20, and 33
 * since 2026-06-01 with none after 08-19, so the page was already starved
 * before `bbox` joined the list; this removes the blocker the last crawl
 * recorded, not every cause. /homes-for-sale/redmond and /sisters (crawled
 * 09-20 and 09-19) are "Submitted and indexed", so the noindex lands only
 * when the renderer lets the map settle.
 *
 * The canonical already strips both keys (appendIndexableSearchParams and the
 * slug route's path-only canonical), which is the consolidation signal Google
 * asks for; a noindex on the same URL contradicted it. Owner directive MATT
 * 2026-09-23 covers changing the rule.
 */
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
    // 'view' and 'bbox' are camera state, not a result set: see the note above.
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
