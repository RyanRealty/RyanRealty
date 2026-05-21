/**
 * FSBO (For Sale By Owner) detector — companion to expired-owner-lookup.
 *
 * Scrapes Zillow's For-Sale-By-Owner filter for each of our 6 service-area
 * cities on a recurring basis (hourly via the cron at
 * app/api/cron/detect-fsbo-listings/route.ts).
 *
 * Why Zillow as the Phase 1 source:
 *   - Largest single-aggregator coverage of Central Oregon FSBO inventory.
 *   - URL-filterable FSBO view: /<city>-or/fsbo/
 *   - Apify actor coverage is mature (multiple actors maintained against
 *     Zillow's DOM). We use maxcopell/zillow-scraper since it accepts
 *     search URLs as input and returns structured property records.
 *   - Listings on Zillow's FSBO view include the seller's name + phone +
 *     email on the detail page (per Zillow's "Owner posted" UX), which
 *     gives us a real contact path without skiptracing in many cases.
 *
 * Other candidate sources (Phase 2):
 *   - FSBO.com (lower volume, but the canonical FSBO site)
 *   - ForSaleByOwner.com
 *   - Craigslist Bend real-estate-by-owner RSS
 *   - Facebook Marketplace (no API; not feasible)
 *
 * Service area + price floor — matches the expired-listings cron exactly
 * per Matt's 2026-05-19 directive:
 *   - Cities: Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine
 *   - Price floor: $500,000
 *   - Property type: SFR
 */

const APIFY_BASE = 'https://api.apify.com/v2'

/**
 * Apify actor for Zillow scraping. `maxcopell/zillow-scraper` is the most
 * widely-used Zillow actor (~5M+ runs lifetime, actively maintained against
 * Zillow's anti-bot updates). Accepts `startUrls[]` of Zillow search URLs +
 * returns structured property records. If we ever swap actors, all of the
 * dependent shape parsing lives in `parseZillowItem` below.
 */
const APIFY_ZILLOW_ACTOR_ID = 'maxcopell~zillow-scraper'

/**
 * Service-area cities — must match SERVICE_AREA_CITIES in
 * app/api/cron/detect-expired-listings/route.ts exactly.
 *
 * Zillow URL slugs follow the pattern <city-name>-or (kebab-case, lowercase).
 * Sunriver doesn't have its own FSBO page on Zillow (it's an unincorporated
 * resort community); we capture Sunriver inventory via the Bend feed since
 * Sunriver shares the 97707 ZIP and shows up under nearby Bend queries.
 */
export const FSBO_SERVICE_AREA_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'Tumalo',
  'La Pine',
] as const

const ZILLOW_CITY_URLS: Record<(typeof FSBO_SERVICE_AREA_CITIES)[number], string> = {
  Bend: 'https://www.zillow.com/bend-or/fsbo/',
  Redmond: 'https://www.zillow.com/redmond-or/fsbo/',
  Sisters: 'https://www.zillow.com/sisters-or/fsbo/',
  // Sunriver gets folded into Bend's FSBO query — small population, listings
  // surface there. We tag city='Sunriver' by ZIP/address parse below.
  Sunriver: 'https://www.zillow.com/sunriver-or/fsbo/',
  Tumalo: 'https://www.zillow.com/tumalo-or/fsbo/',
  'La Pine': 'https://www.zillow.com/la-pine-or/fsbo/',
}

export const FSBO_MIN_LIST_PRICE = 500_000

/**
 * Normalized FSBO listing — output of parseZillowItem(). Mirrors the columns
 * in public.fsbo_listings.
 */
export type FsboListing = {
  fsboUrl: string
  fsboUniqueId: string | null  // Zillow zpid
  fsboSource: 'zillow'
  fullAddress: string
  streetAddress: string
  city: string
  state: string
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  listPrice: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  lotSizeSqft: number | null
  propertyType: string | null  // 'SFR' | 'Condo' | 'Land'
  yearBuilt: number | null
  daysListed: number | null
  photoUrl: string | null
  description: string | null
  ownerName: string | null
  contactPhone: string | null
  contactEmail: string | null
}

/**
 * Raw item shape from the Apify Zillow actor. The actor returns slightly
 * different keys across runs; we tolerate camelCase + snake_case + nested
 * objects and pull what we need defensively.
 */
type ZillowRawItem = {
  address?: string | { streetAddress?: string; city?: string; state?: string; zipcode?: string }
  streetAddress?: string
  addressStreet?: string
  city?: string
  state?: string
  zipcode?: string
  postalCode?: string
  detailUrl?: string
  url?: string
  hdpUrl?: string
  zpid?: string | number
  price?: number | string
  unformattedPrice?: number
  listingPrice?: number
  beds?: number
  bedrooms?: number
  baths?: number
  bathrooms?: number
  area?: number
  livingArea?: number
  livingAreaValue?: number
  lotAreaValue?: number
  lotSize?: number | string
  latLong?: { latitude?: number; longitude?: number }
  latitude?: number
  longitude?: number
  homeType?: string
  homeStatus?: string
  propertyType?: string
  yearBuilt?: number
  daysOnZillow?: number
  daysListed?: number
  imgSrc?: string
  photo?: string
  description?: string
  listingProvidedBy?: { name?: string; phoneNumber?: string }
  listing_provided_by?: { name?: string; phone?: string }
  attributionInfo?: {
    agentName?: string
    agentPhoneNumber?: string
    agentEmail?: string
    brokerName?: string
  }
  // Some actors expose contact directly:
  contactName?: string
  contactPhone?: string
  contactEmail?: string
}

function getApifyToken(): string | null {
  return process.env.APIFY_API_TOKEN?.trim() ?? null
}

function toNumber(v: number | string | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const cleaned = v.replace(/[^0-9.\-]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function toInt(v: number | string | null | undefined): number | null {
  const n = toNumber(v)
  return n == null ? null : Math.round(n)
}

/**
 * Normalize a Zillow homeType / homeStatus / propertyType string into our
 * internal vocabulary. Anything other than single-family + townhouse is
 * filtered out by the cron (FSBO Condos + Lots are intentionally out of
 * scope per the SFR-only convention).
 */
function classifyPropertyType(raw: string | undefined | null): string | null {
  if (!raw) return null
  const norm = raw.toLowerCase().replace(/[_-]+/g, ' ')
  if (/single.?family|sfr|sfh/.test(norm)) return 'SFR'
  if (/townhouse|townhome/.test(norm)) return 'Townhouse'
  if (/condo|condominium/.test(norm)) return 'Condo'
  if (/multi.?family|duplex|triplex|fourplex/.test(norm)) return 'Multifamily'
  if (/manufactured|mobile/.test(norm)) return 'Manufactured'
  if (/lot|land|vacant/.test(norm)) return 'Land'
  return raw
}

/**
 * Pull a stable detail URL out of a Zillow item, with the slug-trailing-slash
 * stripped so dedupe by URL is invariant to format differences.
 */
function canonicalUrl(item: ZillowRawItem): string | null {
  const raw = item.detailUrl ?? item.url ?? item.hdpUrl ?? null
  if (!raw) return null
  let abs = raw
  if (raw.startsWith('/')) abs = 'https://www.zillow.com' + raw
  // Drop trailing slash + drop tracking query strings (Zillow attaches a
  // gigantic ?utm=... blob to most internal links).
  abs = abs.replace(/\?.*$/, '').replace(/\/$/, '')
  return abs
}

/**
 * Parse address — Zillow returns either a flat `streetAddress` + `city` +
 * `state` + `zipcode` set or an object under `address`. Tolerate both.
 */
function parseAddress(item: ZillowRawItem): {
  streetAddress: string
  city: string
  state: string
  postalCode: string | null
  fullAddress: string
} | null {
  let street = ''
  let city = ''
  let state = ''
  let zip: string | null = null

  if (typeof item.address === 'string') {
    // Format: "123 Main St, Bend, OR 97701"
    const parts = item.address.split(',').map((p) => p.trim())
    if (parts.length >= 3) {
      street = parts[0] ?? ''
      city = parts[1] ?? ''
      const stateZip = (parts[2] ?? '').split(/\s+/)
      state = stateZip[0] ?? ''
      zip = stateZip[1] ?? null
    } else {
      return null
    }
  } else if (item.address && typeof item.address === 'object') {
    street = item.address.streetAddress ?? ''
    city = item.address.city ?? ''
    state = item.address.state ?? ''
    zip = item.address.zipcode ?? null
  } else {
    street = item.streetAddress ?? item.addressStreet ?? ''
    city = item.city ?? ''
    state = item.state ?? ''
    zip = item.zipcode ?? item.postalCode ?? null
  }

  street = street.trim()
  city = city.trim()
  state = (state || 'OR').trim()
  if (!street || !city) return null

  return {
    streetAddress: street,
    city,
    state,
    postalCode: zip,
    fullAddress: `${street}, ${city}, ${state}${zip ? ` ${zip}` : ''}`,
  }
}

/**
 * Normalize Sunriver as a city. Listings inside the Sunriver resort
 * community are typically posted under city='Sunriver' but occasionally
 * surface as 'Bend' with ZIP 97707. Re-tag the 97707 cases.
 */
function normalizeCity(city: string, postalCode: string | null): string {
  if (postalCode === '97707') return 'Sunriver'
  return city
}

/**
 * Best-effort parse of one Apify Zillow item into our normalized shape.
 * Returns null if the listing fails our floor checks (price, type, address).
 */
export function parseZillowItem(item: ZillowRawItem): FsboListing | null {
  const url = canonicalUrl(item)
  if (!url) return null

  const addr = parseAddress(item)
  if (!addr) return null

  const city = normalizeCity(addr.city, addr.postalCode)
  if (!FSBO_SERVICE_AREA_CITIES.includes(city as (typeof FSBO_SERVICE_AREA_CITIES)[number])) {
    return null  // out of service area
  }

  const propertyType = classifyPropertyType(
    item.homeType ?? item.propertyType ?? item.homeStatus ?? null,
  )
  // SFR + Townhouse + Manufactured count. Reject Land + Condo + Multifamily.
  if (propertyType && !['SFR', 'Townhouse', 'Manufactured'].includes(propertyType)) {
    return null
  }

  const price = toNumber(item.unformattedPrice ?? item.listingPrice ?? item.price)
  if (price == null || price < FSBO_MIN_LIST_PRICE) return null

  const zpid = item.zpid != null ? String(item.zpid) : null

  const beds = toNumber(item.beds ?? item.bedrooms)
  const baths = toNumber(item.baths ?? item.bathrooms)
  const sqft = toInt(item.area ?? item.livingArea ?? item.livingAreaValue)
  const lot = toInt(item.lotAreaValue ?? item.lotSize)
  const lat = toNumber(item.latLong?.latitude ?? item.latitude)
  const lon = toNumber(item.latLong?.longitude ?? item.longitude)
  const yearBuilt = toInt(item.yearBuilt)
  const daysListed = toInt(item.daysOnZillow ?? item.daysListed)

  // Owner contact extraction — Zillow's FSBO listings often include the
  // poster's name + phone under `listingProvidedBy` or `attributionInfo`.
  // Fall through every shape we've seen.
  const ownerName =
    item.listingProvidedBy?.name ??
    item.listing_provided_by?.name ??
    item.attributionInfo?.agentName ??
    item.contactName ??
    null
  const contactPhone =
    item.listingProvidedBy?.phoneNumber ??
    item.listing_provided_by?.phone ??
    item.attributionInfo?.agentPhoneNumber ??
    item.contactPhone ??
    null
  const contactEmail = item.attributionInfo?.agentEmail ?? item.contactEmail ?? null

  return {
    fsboUrl: url,
    fsboUniqueId: zpid,
    fsboSource: 'zillow',
    fullAddress: addr.fullAddress,
    streetAddress: addr.streetAddress,
    city,
    state: addr.state,
    postalCode: addr.postalCode,
    latitude: lat,
    longitude: lon,
    listPrice: price,
    bedrooms: beds,
    bathrooms: baths,
    sqft,
    lotSizeSqft: lot,
    propertyType,
    yearBuilt,
    daysListed,
    photoUrl: item.imgSrc ?? item.photo ?? null,
    description: item.description ?? null,
    ownerName,
    contactPhone: contactPhone ? contactPhone.replace(/\D/g, '') : null,
    contactEmail,
  }
}

/**
 * Run the Apify Zillow scraper for one city URL and return parsed listings.
 *
 * Uses run-sync-get-dataset-items for predictability — the cron runs hourly
 * and is bounded by Vercel's 300s maxDuration anyway, so we don't need the
 * full poll-and-fetch dance. If the actor is slow on one city we still
 * collect the others.
 */
async function scrapeZillowCity(cityUrl: string, signal?: AbortSignal): Promise<FsboListing[]> {
  const token = getApifyToken()
  if (!token) {
    console.warn('[fsbo-detector] APIFY_API_TOKEN missing — Zillow scrape unavailable')
    return []
  }

  const input = {
    // maxcopell/zillow-scraper accepts a list of Zillow search/listing URLs.
    searchUrls: [{ url: cityUrl }],
    extractionMethod: 'PAGINATION_WITH_ZOOM_IN',
    maxItems: 100,
  }

  try {
    const res = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent(APIFY_ZILLOW_ACTOR_ID)}/run-sync-get-dataset-items?token=${token}&timeout=180`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
        cache: 'no-store',
      },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[fsbo-detector] Apify Zillow run failed (${res.status}) for ${cityUrl}: ${body.slice(0, 200)}`)
      return []
    }
    const items = (await res.json()) as ZillowRawItem[]
    if (!Array.isArray(items)) return []

    const parsed: FsboListing[] = []
    for (const item of items) {
      const norm = parseZillowItem(item)
      if (norm) parsed.push(norm)
    }
    return parsed
  } catch (err) {
    console.warn(`[fsbo-detector] scrapeZillowCity error for ${cityUrl}:`, err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Run the Zillow scrape across every service-area city, dedupe across the
 * full set by fsbo_url, and return the combined list.
 *
 * Cities are scraped sequentially (not in parallel) — Apify charges per
 * actor run, not per concurrent slot, and running 6 in parallel just burns
 * the same budget while increasing the chance Zillow's anti-bot trips one.
 */
export async function detectFsboListings(): Promise<{
  listings: FsboListing[]
  byCity: Record<string, number>
  errors: string[]
}> {
  const seen = new Set<string>()
  const all: FsboListing[] = []
  const byCity: Record<string, number> = {}
  const errors: string[] = []

  for (const city of FSBO_SERVICE_AREA_CITIES) {
    const url = ZILLOW_CITY_URLS[city]
    try {
      const listings = await scrapeZillowCity(url)
      let added = 0
      for (const l of listings) {
        if (seen.has(l.fsboUrl)) continue
        seen.add(l.fsboUrl)
        all.push(l)
        added++
      }
      byCity[city] = added
    } catch (e) {
      errors.push(`${city}: ${e instanceof Error ? e.message : String(e)}`)
      byCity[city] = 0
    }
  }

  return { listings: all, byCity, errors }
}
