/**
 * Craigslist FSBO detector — the Phase 2 source named in lib/fsbo-detector.ts.
 *
 * Endpoint reality (verified live 2026-07-21):
 *   - The RSS feed (`/search/reo?format=rss`) is DEAD — Craigslist returns
 *     HTTP 403 "Your request has been blocked" for the format param. RSS was
 *     deprecated platform-wide.
 *   - The legacy HTML search path `https://bend.craigslist.org/search/reo`
 *     301-redirects to the current canonical
 *     `https://www.craigslist.org/search/area/bend?cat=rea&purveyor=owner`.
 *     We fetch the legacy URL with redirect-follow so either format works.
 *   - The search page is a JS app, BUT it ships a static no-JS fallback:
 *     `<ol class="cl-static-search-results">` with one
 *     `<li class="cl-static-search-result">` per posting (title, detail URL,
 *     price, location). That fallback is what we parse — a tight regex pass,
 *     no cheerio, no headless browser.
 *   - `min_price` is honored server-side and survives the redirect, so the
 *     $500K floor is applied at the source AND re-checked in code (the code
 *     filter remains the source of truth).
 *
 * Coverage: bend.craigslist.org is the regional site for all of Central
 * Oregon, so ONE fetch covers every service-area city (Bend, Redmond,
 * Sisters, Sunriver, Tumalo, La Pine). Out-of-area postings (Prineville,
 * Powell Butte, etc.) appear in the same feed and are filtered out here.
 *
 * Limits of the list view (by design — we never fetch detail pages):
 *   - No street address. Titles occasionally contain one; we extract it when
 *     present, otherwise streetAddress stays '' and the processor skips the
 *     county/skip-trace owner lookup (garbage-in prevention).
 *   - No property type. We reject land-only postings by title heuristic and
 *     pass the rest through with propertyType null.
 *   - No owner contact. The processor's alert email is the sink — Matt gets
 *     the posting URL either way.
 *
 * Rate-limit posture: single fetch per run, browser UA, hard timeout, fail
 * soft on any block/format change (empty result + error string — the
 * pipeline heartbeat covers staleness). Facebook Marketplace was dropped by
 * decision 2026-07-21 (no API, ToS-fragile).
 */

import {
  FSBO_MIN_LIST_PRICE,
  FSBO_SERVICE_AREA_CITIES,
  type FsboListing,
} from '@/lib/fsbo-detector'

/**
 * Legacy alias URL — self-documenting and stable for 20+ years. Craigslist
 * 301s it to the current canonical search URL; fetch() follows.
 */
export const CRAIGSLIST_FSBO_SEARCH_URL = `https://bend.craigslist.org/search/reo?min_price=${FSBO_MIN_LIST_PRICE}`

const FETCH_TIMEOUT_MS = 20_000

/** Hard cap on parsed candidates per run (the page lists ~120 max). */
const MAX_CANDIDATES_PER_RUN = 60

/**
 * A realistic browser UA — Craigslist serves the static fallback to any
 * client but 403s obvious bot fingerprints. Verified working 2026-07-21.
 */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** Raw candidate parsed straight from the static search-results markup. */
export type CraigslistCandidate = {
  title: string
  url: string
  price: number | null
  /** Text of the location div — absent on some postings. */
  location: string | null
}

type ServiceAreaCity = (typeof FSBO_SERVICE_AREA_CITIES)[number]

/**
 * Location-text and URL-slug keys → canonical service-area city. Craigslist
 * location text is free-form ('Bend', 'PRINEVILLE', 'MT Vernon'), and slugs
 * are kebab-case ('la-pine-...').
 */
const CITY_BY_KEY: Record<string, ServiceAreaCity> = {
  'bend': 'Bend',
  'redmond': 'Redmond',
  'sisters': 'Sisters',
  'sunriver': 'Sunriver',
  'tumalo': 'Tumalo',
  'la pine': 'La Pine',
  'la-pine': 'La Pine',
  'lapine': 'La Pine',
}

/** Kebab slugs used for URL-slug prefix matching, longest first. */
const CITY_SLUGS: Array<{ slug: string; city: ServiceAreaCity }> = [
  { slug: 'la-pine', city: 'La Pine' },
  { slug: 'lapine', city: 'La Pine' },
  { slug: 'sunriver', city: 'Sunriver' },
  { slug: 'redmond', city: 'Redmond' },
  { slug: 'sisters', city: 'Sisters' },
  { slug: 'tumalo', city: 'Tumalo' },
  { slug: 'bend', city: 'Bend' },
]

/** Minimal HTML entity decode for the handful Craigslist emits in titles. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * Parse the static no-JS search results out of a Craigslist search page.
 * Conservative by construction: anchors on the `cl-static-search-result`
 * items only, tolerates missing price/location, returns [] on any page that
 * lacks the static block (blocked page, layout change, empty results).
 */
export function parseCraigslistSearchHtml(html: string): CraigslistCandidate[] {
  const start = html.indexOf('cl-static-search-results')
  if (start === -1) return []

  // The class name also appears in an inline <style> block before the <ol>;
  // scanning from the first occurrence is fine because the split below only
  // matches real <li> items.
  const region = html.slice(start)
  const chunks = region.split('<li class="cl-static-search-result"').slice(1)

  const out: CraigslistCandidate[] = []
  for (const chunk of chunks) {
    if (out.length >= MAX_CANDIDATES_PER_RUN) break
    // Stop at the </li> so a malformed page can't bleed items together.
    const item = chunk.slice(0, chunk.indexOf('</li>') === -1 ? undefined : chunk.indexOf('</li>'))

    const href = /href="([^"]+)"/.exec(item)?.[1]
    if (!href) continue

    const titleAttr = /^[^>]*title="([^"]*)"/.exec(item)?.[1]
    const titleDiv = /<div class="title">([\s\S]*?)<\/div>/.exec(item)?.[1]
    const title = decodeEntities((titleAttr ?? titleDiv ?? '').trim())
    if (!title) continue

    const priceRaw = /<div class="price">\s*\$?\s*([\d,.]+)\s*<\/div>/.exec(item)?.[1] ?? null
    const price = priceRaw ? Number(priceRaw.replace(/[^0-9.]/g, '')) : null

    const locationRaw = /<div class="location">\s*([\s\S]*?)\s*<\/div>/.exec(item)?.[1] ?? null
    const location = locationRaw ? decodeEntities(locationRaw.replace(/\s+/g, ' ').trim()) || null : null

    out.push({
      title,
      url: decodeEntities(href),
      price: price != null && Number.isFinite(price) ? price : null,
      location,
    })
  }
  return out
}

/** Canonical posting URL: https only, craigslist.org host, no query/hash/trailing slash. */
function canonicalCraigslistUrl(raw: string): string | null {
  const abs = raw.trim()
  if (!/^https:\/\/([a-z0-9-]+\.)?craigslist\.org\//i.test(abs)) return null
  return abs.replace(/[?#].*$/, '').replace(/\/$/, '')
}

/**
 * Stable unique id from the posting URL.
 *   Current: /view/d/<slug>/<token>          → token
 *   Legacy:  /reo/d/<slug>/<postid>.html     → postid
 */
function craigslistUniqueId(canonicalUrl: string): string | null {
  const last = canonicalUrl.split('/').filter(Boolean).pop() ?? ''
  const id = last.replace(/\.html$/i, '')
  return id.length >= 6 ? id : null
}

/**
 * Resolve the service-area city. The location div wins when present
 * (postings sometimes carry a slug city that differs from the stated
 * location); the URL slug is the fallback for postings with no location div.
 * Returns null for anything outside the six service-area cities.
 */
export function resolveCraigslistCity(location: string | null, url: string): ServiceAreaCity | null {
  if (location) {
    const key = location
      .toLowerCase()
      .replace(/,\s*(or|oregon)\.?$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
    const hit = CITY_BY_KEY[key]
    if (hit) return hit
    // A stated location that we can read but that is NOT one of our cities
    // is authoritative — do not fall through to the slug.
    return null
  }

  const slugMatch = /\/d\/([a-z0-9-]+)\/[^/]+\/?$/i.exec(url)
  const slug = slugMatch?.[1]?.toLowerCase() ?? ''
  for (const { slug: citySlug, city } of CITY_SLUGS) {
    if (slug === citySlug || slug.startsWith(`${citySlug}-`)) return city
  }
  return null
}

/**
 * Land-only title heuristic. Craigslist's owner category mixes homes with
 * bare land; a posting that reads land-only AND never mentions a dwelling is
 * rejected (mirrors the Zillow path's rejection of propertyType 'Land').
 */
const LAND_ONLY_RE =
  /^land\b|\b(?:vacant|bare|buildable)\s+(?:land|lots?|acreage)\b|\bdeveloped\s+lots?\b|\bland\s+only\b|\bacreage\s+only\b|\blots?\s+for\s+sale\b/i
const DWELLING_RE =
  /\b(?:home|house|cabin|cottage|townhome|townhouse|condo|manufactured|\d+\s*(?:br|bed|bedroom)s?)\b/i

export function isLandOnlyTitle(title: string): boolean {
  return LAND_ONLY_RE.test(title) && !DWELLING_RE.test(title)
}

/**
 * Best-effort street address out of a posting title (most titles are
 * marketing text with no address — that is fine, the extraction is a bonus).
 */
const STREET_SUFFIX =
  'Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Loop|Way|Boulevard|Blvd|Circle|Cir|Terrace|Ter|Trail|Trl|Highway|Hwy'
const STREET_RE = new RegExp(
  `\\b(\\d{2,6}\\s+(?:[NSEW]{1,2}\\.?\\s+)?[A-Za-z][A-Za-z0-9'. ]{1,40}?\\s(?:${STREET_SUFFIX})\\b\\.?)`,
  'i',
)

export function extractStreetAddress(title: string): string | null {
  const m = STREET_RE.exec(title)
  return m ? m[1].replace(/\s+/g, ' ').replace(/\.$/, '').trim() : null
}

/** Beds from Craigslist's '5br - ...' title prefix. */
function extractBedrooms(title: string): number | null {
  const m = /\b(\d{1,2})\s*br\b/i.exec(title)
  return m ? Number(m[1]) : null
}

/** Sqft from '4200ft2' / '2,700 sq ft' style title fragments. */
function extractSqft(title: string): number | null {
  const m = /\b([\d,]{3,6})\s*(?:ft2|sq\.?\s*ft\.?|sqft)\b/i.exec(title)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) && n >= 100 && n <= 50_000 ? n : null
}

/**
 * Normalize one parsed candidate into the shared FsboListing shape the
 * processor consumes. Returns null when the posting fails scope checks
 * (out of area, below the $500K floor, land-only, unusable URL).
 */
export function craigslistCandidateToListing(c: CraigslistCandidate): FsboListing | null {
  const url = canonicalCraigslistUrl(c.url)
  if (!url) return null

  const city = resolveCraigslistCity(c.location, url)
  if (!city) return null

  if (c.price == null || c.price < FSBO_MIN_LIST_PRICE) return null

  if (isLandOnlyTitle(c.title)) return null

  const street = extractStreetAddress(c.title)
  const titleShort = c.title.length > 90 ? `${c.title.slice(0, 87)}...` : c.title

  return {
    fsboUrl: url,
    fsboUniqueId: craigslistUniqueId(url),
    fsboSource: 'craigslist',
    fullAddress: street ? `${street}, ${city}, OR` : `${titleShort} (${city}, OR)`,
    streetAddress: street ?? '',
    city,
    state: 'OR',
    postalCode: null,
    latitude: null,
    longitude: null,
    listPrice: c.price,
    bedrooms: extractBedrooms(c.title),
    bathrooms: null,
    sqft: extractSqft(c.title),
    lotSizeSqft: null,
    propertyType: null, // unknown from the list view; land filtered by title above
    yearBuilt: null,
    daysListed: null,
    photoUrl: null,
    description: c.title,
    ownerName: null,
    contactPhone: null,
    contactEmail: null,
  }
}

/**
 * Fetch + parse + normalize the Craigslist FSBO feed. Single fetch per run.
 * Never throws — every failure mode returns an empty list plus an error
 * string (the fsbo cron's heartbeat covers staleness).
 */
export async function detectCraigslistFsboListings(): Promise<{
  listings: FsboListing[]
  errors: string[]
}> {
  let html: string
  try {
    const res = await fetch(CRAIGSLIST_FSBO_SEARCH_URL, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`[fsbo-craigslist] fetch failed: HTTP ${res.status}`)
      return { listings: [], errors: [`craigslist: HTTP ${res.status}`] }
    }
    html = await res.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[fsbo-craigslist] fetch error:', msg)
    return { listings: [], errors: [`craigslist: ${msg}`] }
  }

  const candidates = parseCraigslistSearchHtml(html)
  if (candidates.length === 0 && !html.includes('cl-static-search-results')) {
    // Page came back 200 but without the static block — soft block or a
    // layout change. Fail soft and say so.
    return {
      listings: [],
      errors: ['craigslist: static results markup missing (blocked or page format changed)'],
    }
  }

  const seen = new Set<string>()
  const listings: FsboListing[] = []
  for (const c of candidates) {
    const listing = craigslistCandidateToListing(c)
    if (!listing) continue
    if (seen.has(listing.fsboUrl)) continue
    seen.add(listing.fsboUrl)
    listings.push(listing)
  }
  return { listings, errors: [] }
}
