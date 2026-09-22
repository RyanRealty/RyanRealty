/**
 * SITE-179 — one indexable Bend new-construction URL.
 *
 * `/new-construction` is the document. `/homes-for-sale/bend/new-construction`
 * is the same document as a search-area preset. A page-body redirect cannot
 * emit 3xx under `app/loading.tsx` (ci:streamed-redirect), so the hop is
 * resolved here and applied in middleware. generateMetadata still
 * noindexes + canonicals the twin in case a 200 leaks.
 *
 * Faceted URLs that add price/beds/etc. are a different document and must
 * not hop. Same-document camera/sort/page variants still hop.
 */
import type { QueryParams } from '@/lib/seo-routing'

export const BEND_NEW_CONSTRUCTION_CANONICAL_PATH = '/new-construction'
export const BEND_NEW_CONSTRUCTION_SEARCH_TWIN_PATH = '/homes-for-sale/bend/new-construction'

/**
 * Query keys that change inventory. Presence of any one keeps the search
 * page (already noindex via shouldNoIndexSearchVariant) instead of folding
 * it into the Bend new-construction market page.
 */
export const BEND_NEW_CONSTRUCTION_TWIN_FACET_KEYS = [
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
  'includeClosed',
  'subdivision',
  'neighborhood',
  'shapes',
] as const

function decodeSeg(raw: string | undefined): string {
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function firstParam(value: string | string[] | undefined | null): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  if (value == null) return null
  return value
}

/** Pathname only — trailing slash, encoding, and case folded. */
export function normalizePublicPathname(pathname: string): string {
  const raw = pathname.split('?')[0]?.split('#')[0] ?? ''
  const decoded = decodeSeg(raw).replace(/\/+/g, '/')
  const trimmed = decoded.replace(/\/+$/, '')
  return (trimmed || '/').toLowerCase()
}

export function isBendNewConstructionSearchTwinPath(pathname: string): boolean {
  return normalizePublicPathname(pathname) === BEND_NEW_CONSTRUCTION_SEARCH_TWIN_PATH
}

export function hasBendNewConstructionSearchFacet(
  searchParams: QueryParams | URLSearchParams | undefined,
): boolean {
  if (!searchParams) return false
  for (const key of BEND_NEW_CONSTRUCTION_TWIN_FACET_KEYS) {
    const raw =
      searchParams instanceof URLSearchParams
        ? searchParams.get(key)
        : firstParam(searchParams[key])
    if (raw != null && raw !== '') return true
  }
  return false
}

export function isBendNewConstructionSearchTwinSlug(
  slug: readonly string[] | null | undefined,
  searchParams?: QueryParams | URLSearchParams,
): boolean {
  if (!slug || slug.length !== 2) return false
  const city = decodeSeg(slug[0]).toLowerCase()
  const preset = decodeSeg(slug[1]).toLowerCase()
  if (city !== 'bend' || preset !== 'new-construction') return false
  return !hasBendNewConstructionSearchFacet(searchParams)
}

export function isBendNewConstructionSearchTwin(
  pathname: string,
  searchParams?: QueryParams | URLSearchParams,
): boolean {
  return (
    isBendNewConstructionSearchTwinPath(pathname) &&
    !hasBendNewConstructionSearchFacet(searchParams)
  )
}

/**
 * Destination for middleware. Null when this request is not the Bend
 * new-construction search twin (including faceted variants).
 */
export function resolveBendNewConstructionSearchTwinHop(
  pathname: string,
  searchParams?: QueryParams | URLSearchParams,
): string | null {
  if (!isBendNewConstructionSearchTwin(pathname, searchParams)) return null
  return BEND_NEW_CONSTRUCTION_CANONICAL_PATH
}
