/**
 * Which market (city) a page view was about, read from the page address.
 *
 * Pure: no I/O. The site puts the city in the URL for every market page:
 *   /homes-for-sale/<city>                         homes for sale in a city
 *   /homes-for-sale/<city>/<subdivision>           homes for sale in a subdivision
 *   /homes-for-sale/<city>/[<subdivision>/]<street>-<mls>   a listing
 *   /homes-for-sale?city=<City>                    the search page filtered to a city
 *   /open-houses/<city>                            open houses in a city
 *   /cities/<city>[/...]                           the city page and its sub-pages
 *   /oregon/<city>                                 a city outside the service area
 * /homes-for-sale/<preset> (luxury, under-500k, ...) is a filter across every
 * city, not a place, so it has no market (lib/search-presets.ts isPresetSlug).
 * Community and subdivision pages (/communities/..., /subdivisions/...) do not
 * carry their city; /admin/reports/place-popularity ranks those.
 *
 * Listing pages are recognised the same way page_type does it
 * (lib/analytics/page-type.ts listingMlsFromPath).
 */
import { listingMlsFromPath } from '@/lib/analytics/page-type'
import { isPresetSlug } from '@/lib/search-presets'
import { citySlugForScope, isCentralOregonCity } from '@/lib/central-oregon'

export type MarketView = {
  /** City slug as it appears in the URL ("la-pine"). */
  citySlug: string
  /** listing = a listing page; search = homes-for-sale / open houses; place = a city page. */
  kind: 'listing' | 'search' | 'place'
}

function pathAndQuery(pageUrl: string): { path: string; query: URLSearchParams } | null {
  const raw = (pageUrl ?? '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw, 'https://ryan-realty.com')
    return { path: u.pathname.toLowerCase(), query: u.searchParams }
  } catch {
    return null
  }
}

function decodeSeg(s: string): string {
  try {
    return decodeURIComponent(s).toLowerCase()
  } catch {
    return s.toLowerCase()
  }
}

export function marketFromUrl(pageUrl: string): MarketView | null {
  const parsed = pathAndQuery(pageUrl)
  if (!parsed) return null
  const segs = parsed.path.split('/').filter(Boolean).map(decodeSeg)
  const head = segs[0]
  if (head === 'homes-for-sale') {
    if (segs.length === 1) {
      const city = parsed.query.get('city')
      const slug = city ? citySlugForScope(city) : ''
      return slug ? { citySlug: slug, kind: 'search' } : null
    }
    const city = segs[1]
    if (segs.length === 2 && isPresetSlug(city)) return null
    return { citySlug: city, kind: listingMlsFromPath(parsed.path) ? 'listing' : 'search' }
  }
  if (head === 'open-houses' && segs.length >= 2) return { citySlug: segs[1], kind: 'search' }
  if ((head === 'cities' || head === 'oregon') && segs.length >= 2) return { citySlug: segs[1], kind: 'place' }
  return null
}

/** "la-pine" → "La Pine". */
export function cityNameFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** True when the market is inside Ryan Realty's Central Oregon service area. */
export function isLocalMarket(citySlug: string): boolean {
  return isCentralOregonCity(citySlug)
}

/**
 * A readable name for a listing from its page address, for when the event
 * row carries no street (listing details are not stored for visitors who said
 * no to analytics cookies): "/homes-for-sale/bend/larkspur/20606-daisy-220227756"
 * → "20606 Daisy, Bend". Null when the address is not a listing page.
 */
export function listingLabelFromUrl(pageUrl: string): string | null {
  const parsed = pathAndQuery(pageUrl)
  if (!parsed) return null
  const mls = listingMlsFromPath(parsed.path)
  if (!mls) return null
  const segs = parsed.path.split('/').filter(Boolean).map(decodeSeg)
  if (segs[0] !== 'homes-for-sale' || segs.length < 3) return null
  const last = segs[segs.length - 1]
  const street = last.replace(new RegExp(`-?${mls}$`), '')
  const streetLabel = cityNameFromSlug(street)
  const city = cityNameFromSlug(segs[1])
  return streetLabel ? `${streetLabel}, ${city}` : city
}
