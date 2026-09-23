/**
 * One route classifier for Search Console pages (visibility audit 2026-09-22,
 * gsc-trend-1). The full-fidelity GSC store (gsc_page_daily,
 * gsc_query_page_daily), the per-class trend in the scoreboard, the Learn
 * step and the ranking seeder all bucket URLs through this file, so "the
 * community class lost 30% of its impressions" means the same set of pages
 * everywhere.
 *
 * Pure: no I/O. Safe to import from a route, a CLI (tsx) and a test.
 *
 * scripts/_gsc-by-class.mjs is the older ad-hoc read (route-pattern names such
 * as '/cities/[slug]'); it is a read-only probe and stays as it is. New readers
 * use these class names.
 */
import { CENTRAL_OREGON_CITY_SLUGS, isCentralOregonCommunitySlug } from '@/lib/central-oregon'
import { isPresetSlug } from '@/lib/search-presets'

/**
 * central-oregon: the URL itself says the page is in the service area.
 * out-of-market: the URL names a city the site routes away from (/oregon/*, a
 *   non-service-area city slug). Intended pruning lives here.
 * unknown: the URL carries no city (subdivision slugs, /homes-for-sale/listing/<key>,
 *   the outside-boundaries sentinel, which also holds Central Oregon rural homes).
 */
export type GscMarket = 'central-oregon' | 'out-of-market' | 'unknown'

export const GSC_PAGE_CLASSES = [
  'home',
  'city',
  'neighborhood',
  'city-type',
  'community',
  'community-type',
  'subdivision',
  'place-index',
  'homes-for-sale-hub',
  'homes-for-sale-city',
  'homes-for-sale-type',
  'homes-for-sale-place',
  'listing',
  'oregon-city',
  'central-oregon',
  'blog',
  'housing-market',
  'schools',
  'parks',
  'zip',
  'open-houses',
  'price-drops',
  'new-construction',
  'brand',
  'sell',
  'buy',
  'lp',
  'tools',
  'guides',
  'other',
] as const

export type GscPageClass = (typeof GSC_PAGE_CLASSES)[number]

/**
 * The classes that sell a place or a search: the ones whose ranking slip is a
 * business loss (gsc-trend-1: community, city, homes-for-sale city/type,
 * subdivision, home). homes-for-sale-place is the same search template one level
 * down (/homes-for-sale/bend/northwest-crossing), so it counts with city/type.
 */
export const GSC_MONEY_CLASSES: ReadonlySet<GscPageClass> = new Set<GscPageClass>([
  'home',
  'community',
  'city',
  'homes-for-sale-city',
  'homes-for-sale-type',
  'homes-for-sale-place',
  'subdivision',
])

export type GscPageClassification = { pageClass: GscPageClass; market: GscMarket }

const SITE_HOST_RE = /^https?:\/\/(?:www\.)?ryan-realty\.com/i

/**
 * A GSC page key, a ledger surface or a stored path, reduced to one comparable
 * form: origin, query string, hash and trailing slash removed, lower case.
 * "https://www.ryan-realty.com/Blog/x/?utm=1" and "/blog/x" are the same page.
 * Returns '' for input that is not a path on this site.
 */
export function normalizeGscPath(input: string | null | undefined): string {
  let s = String(input ?? '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) {
    if (!SITE_HOST_RE.test(s)) return ''
    s = s.replace(SITE_HOST_RE, '')
  }
  s = s.split('#')[0] ?? ''
  s = s.split('?')[0] ?? ''
  if (!s.startsWith('/')) s = `/${s}`
  s = s.replace(/\/{2,}/g, '/')
  if (s.length > 1) s = s.replace(/\/+$/, '')
  return s.toLowerCase() || '/'
}

/** The next.config listing rewrites: a slug ending -<5+ digits>, or an address slug with ~. */
function isListingSlug(segment: string): boolean {
  return /-[0-9]{5,}$/.test(segment) || segment.includes('~')
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment).toLowerCase()
  } catch {
    return segment.toLowerCase()
  }
}

function cityMarket(citySlug: string): GscMarket {
  const s = decode(citySlug)
  if (CENTRAL_OREGON_CITY_SLUGS.has(s)) return 'central-oregon'
  if (s === 'outside-boundaries') return 'unknown'
  return 'out-of-market'
}

function homesForSale(parts: string[]): GscPageClassification {
  // parts[0] === 'homes-for-sale'
  const rest = parts.slice(1)
  if (rest.length === 0) return { pageClass: 'homes-for-sale-hub', market: 'central-oregon' }
  if (rest[0] === 'listing') return { pageClass: 'listing', market: 'unknown' }
  const first = decode(rest[0] ?? '')
  const last = rest[rest.length - 1] ?? ''
  if (rest.length >= 2 && isListingSlug(last)) return { pageClass: 'listing', market: cityMarket(first) }
  if (rest.length === 1) {
    // A preset is a filter across the whole service area, never a place.
    if (isPresetSlug(first)) return { pageClass: 'homes-for-sale-type', market: 'central-oregon' }
    if (CENTRAL_OREGON_CITY_SLUGS.has(first)) return { pageClass: 'homes-for-sale-city', market: 'central-oregon' }
    // middleware sends a community slug to /communities/<slug>; the old URL is still in market.
    if (isCentralOregonCommunitySlug(first)) return { pageClass: 'homes-for-sale-city', market: 'central-oregon' }
    return { pageClass: 'homes-for-sale-city', market: cityMarket(first) }
  }
  const market = cityMarket(first)
  if (isPresetSlug(decode(last))) return { pageClass: 'homes-for-sale-type', market }
  return { pageClass: 'homes-for-sale-place', market }
}

const SIMPLE: Array<[RegExp, GscPageClass, GscMarket]> = [
  [/^\/(communities|cities|subdivisions|neighborhoods|area-guides|areas)$/, 'place-index', 'central-oregon'],
  [/^\/central-oregon(\/|$)/, 'central-oregon', 'central-oregon'],
  [/^\/blog(\/|$)/, 'blog', 'central-oregon'],
  [/^\/(housing-market|reports|pulse|months-of-supply)(\/|$)/, 'housing-market', 'central-oregon'],
  [/^\/schools(\/|$)/, 'schools', 'unknown'],
  [/^\/parks(\/|$)/, 'parks', 'unknown'],
  [/^\/zip(\/|$)/, 'zip', 'unknown'],
  [/^\/open-houses(\/|$)/, 'open-houses', 'central-oregon'],
  [/^\/(price-drops|motivated-sellers)(\/|$)/, 'price-drops', 'central-oregon'],
  [/^\/(new-construction|builders)(\/|$)/, 'new-construction', 'central-oregon'],
  [/^\/(team|about|reviews|join|contact|our-homes|refer-a-client)(\/|$)/, 'brand', 'central-oregon'],
  [/^\/(sell|home-valuation|cma|bpo)(\/|$)/, 'sell', 'central-oregon'],
  [/^\/(buy|invest)(\/|$)/, 'buy', 'central-oregon'],
  [/^\/lp(\/|$)/, 'lp', 'central-oregon'],
  [/^\/tools(\/|$)/, 'tools', 'central-oregon'],
  [/^\/(faq|resources|how-we-get-our-numbers|site-index|llms\.txt)(\/|$)/, 'guides', 'central-oregon'],
]

/** Bucket one page (full URL or path) into its route class and market. */
export function classifyGscPage(urlOrPath: string): GscPageClassification {
  const path = normalizeGscPath(urlOrPath)
  if (!path) return { pageClass: 'other', market: 'unknown' }
  if (path === '/') return { pageClass: 'home', market: 'central-oregon' }
  const parts = path.split('/').filter(Boolean)
  const head = parts[0] ?? ''

  if (head === 'homes-for-sale' || head === 'search') return homesForSale(['homes-for-sale', ...parts.slice(1)])
  if (head === 'listing') {
    // /listing/by-address/<city>/... carries the city; /listing/by-key/<key> does not.
    if (parts[1] === 'by-address' && parts[2]) return { pageClass: 'listing', market: cityMarket(parts[2]) }
    return { pageClass: 'listing', market: 'unknown' }
  }
  if (head === 'cities' && parts[1]) {
    const market = cityMarket(parts[1])
    if (parts.length === 2) return { pageClass: 'city', market }
    if (parts[2] === 'types') return { pageClass: 'city-type', market }
    return { pageClass: 'neighborhood', market }
  }
  if (head === 'communities' && parts[1]) {
    if (parts[2] === 'types') return { pageClass: 'community-type', market: 'central-oregon' }
    return { pageClass: 'community', market: 'central-oregon' }
  }
  if (head === 'subdivisions' && parts[1]) return { pageClass: 'subdivision', market: 'unknown' }
  if (head === 'oregon' && parts[1]) return { pageClass: 'oregon-city', market: 'out-of-market' }

  for (const [re, pageClass, market] of SIMPLE) if (re.test(path)) return { pageClass, market }
  return { pageClass: 'other', market: 'unknown' }
}

/** A money class inside (or not provably outside) the service area. */
export function isCentralOregonMoneyClass(pageClass: string, market: string): boolean {
  return GSC_MONEY_CLASSES.has(pageClass as GscPageClass) && market !== 'out-of-market'
}

const OPERATOR_RE =
  /(^|\s)-?(site|inurl|intitle|intext|allintitle|allinurl|allintext|inanchor|allinanchor|filetype|ext|related|cache|info|link|before|after|source|loc|location):/i

/**
 * A query a person typed, as opposed to a rank tracker's probe. Quoted or
 * bracketed queries and search operators are excluded (gsc-trend-1 probe13:
 * all 153 benchmark rows in 28 days were quoted/bracketed, ~3 impressions a
 * day for 85 to 111 consecutive days, 0 clicks). They stay in the store,
 * flagged, so a tracker view can still read them.
 */
export function isTrackableQuery(query: string | null | undefined): boolean {
  const s = String(query ?? '').trim()
  if (!s) return false
  if (/["“”[\]{}]/.test(s)) return false
  if (OPERATOR_RE.test(s)) return false
  return true
}

/** GSC queries arrive lower case; stored and matched that way. */
export function normalizeGscQuery(query: string | null | undefined): string {
  return String(query ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}
