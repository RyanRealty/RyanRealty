/**
 * Tests for the Craigslist FSBO parser + normalizer.
 *
 * The fixture (fsbo-craigslist.fixture.html.gz, next to this file) is a REAL
 * page capture: https://bend.craigslist.org/search/reo?min_price=500000
 * fetched 2026-07-21 (final URL after Craigslist's 301:
 * https://www.craigslist.org/search/area/bend?cat=rea&min_price=500000&purveyor=owner).
 * It is gzipped because Tailwind v4's content scanner reads every
 * non-gitignored TEXT file in the repo and raw HTML dumps have broken the
 * dev build before (memory: reference_tailwind_scans_scratch_html.md).
 *
 * That capture had 14 static results. In-scope after normalization: 4
 * (Bend x2, Sisters x1, Redmond x1 via URL-slug fallback). The rest are out
 * of area (Powell Butte, Riley, Fossil, Mt Vernon, Prineville x2, Crooked
 * River Ranch, Silver Lake) or land-only titles (2 Bend postings).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import {
  CRAIGSLIST_FSBO_SEARCH_URL,
  parseCraigslistSearchHtml,
  craigslistCandidateToListing,
  resolveCraigslistCity,
  extractStreetAddress,
  isLandOnlyTitle,
  type CraigslistCandidate,
} from './fsbo-craigslist'
import { FSBO_MIN_LIST_PRICE } from './fsbo-detector'

const FIXTURE_HTML = gunzipSync(
  readFileSync(new URL('./fsbo-craigslist.fixture.html.gz', import.meta.url)),
).toString('utf8')

const mk = (o: Partial<CraigslistCandidate>): CraigslistCandidate => ({
  title: 'Home for sale',
  url: 'https://www.craigslist.org/view/d/bend-home-for-sale/abc123def456',
  price: 600_000,
  location: 'Bend',
  ...o,
})

describe('parseCraigslistSearchHtml (live fixture)', () => {
  it('parses all 14 static results out of the real page capture', () => {
    const candidates = parseCraigslistSearchHtml(FIXTURE_HTML)
    expect(candidates).toHaveLength(14)
    for (const c of candidates) {
      expect(c.title.length).toBeGreaterThan(0)
      expect(c.url).toMatch(/^https:\/\/(www\.)?craigslist\.org\//)
    }
  })

  it('extracts title, price, and location on a known item', () => {
    const first = parseCraigslistSearchHtml(FIXTURE_HTML)[0]
    expect(first.title).toBe('Live Where you Play!')
    expect(first.price).toBe(519_000)
    expect(first.location).toBe('Bend')
    expect(first.url).toContain('/view/d/bend-live-where-you-play/')
  })

  it('tolerates items with no location div (present in the live capture)', () => {
    const candidates = parseCraigslistSearchHtml(FIXTURE_HTML)
    const noLocation = candidates.filter((c) => c.location == null)
    expect(noLocation.length).toBeGreaterThan(0)
  })

  it('returns [] on pages without the static block (block page, format change)', () => {
    expect(parseCraigslistSearchHtml('')).toEqual([])
    expect(parseCraigslistSearchHtml('<html><body>Your request has been blocked.</body></html>')).toEqual([])
    expect(parseCraigslistSearchHtml('<ol class="cl-static-search-results"></ol>')).toEqual([])
  })
})

describe('fixture end-to-end normalization', () => {
  const listings = parseCraigslistSearchHtml(FIXTURE_HTML)
    .map(craigslistCandidateToListing)
    .filter((l): l is NonNullable<typeof l> => l != null)

  it('keeps exactly the 4 in-scope postings (6-city + floor + land filter)', () => {
    expect(listings).toHaveLength(4)
    expect(listings.map((l) => l.city).sort()).toEqual(['Bend', 'Bend', 'Redmond', 'Sisters'])
    for (const l of listings) {
      expect(l.fsboSource).toBe('craigslist')
      expect(l.listPrice).toBeGreaterThanOrEqual(FSBO_MIN_LIST_PRICE)
      expect(l.fsboUniqueId).toBeTruthy()
      expect(l.fullAddress).toContain(', OR')
    }
  })

  it('recovers Redmond via URL slug when the location div is missing', () => {
    const redmond = listings.find((l) => l.city === 'Redmond')
    expect(redmond).toBeDefined()
    expect(redmond?.listPrice).toBe(605_000)
    expect(redmond?.fsboUrl).toContain('/view/d/redmond-home-for-sale-by-owner/')
  })

  it('pulls beds + sqft from the Craigslist title prefix (5br - 4200ft2)', () => {
    const sisters = listings.find((l) => l.city === 'Sisters')
    expect(sisters?.bedrooms).toBe(5)
    expect(sisters?.sqft).toBe(4200)
  })

  it('rejects the land-only Bend postings even above the floor', () => {
    const titles = listings.map((l) => l.description)
    expect(titles).not.toContain('Fully developed lot')
    expect(titles.some((t) => t?.startsWith('Land-Prime'))).toBe(false)
  })
})

describe('craigslistCandidateToListing scope checks', () => {
  it('rejects below the $500K floor and unknown prices', () => {
    expect(craigslistCandidateToListing(mk({ price: 499_999 }))).toBeNull()
    expect(craigslistCandidateToListing(mk({ price: null }))).toBeNull()
    expect(craigslistCandidateToListing(mk({ price: 500_000 }))).not.toBeNull()
  })

  it('rejects out-of-area and non-craigslist URLs', () => {
    expect(craigslistCandidateToListing(mk({ location: 'Prineville' }))).toBeNull()
    expect(craigslistCandidateToListing(mk({ url: 'https://evil.example.com/view/d/bend-x/abc123def456' }))).toBeNull()
  })

  it('a stated out-of-area location wins over an in-area slug (no slug fallback)', () => {
    // Real pattern from the capture: slug says powell-butte, location says Prineville.
    expect(
      craigslistCandidateToListing(
        mk({ location: 'Powell Butte', url: 'https://www.craigslist.org/view/d/bend-ranch/abc123def456' }),
      ),
    ).toBeNull()
  })

  it('canonicalizes the URL and derives the unique id (current + legacy formats)', () => {
    const current = craigslistCandidateToListing(
      mk({ url: 'https://www.craigslist.org/view/d/bend-home/4JsMDyVrbNFSXjWpRUVZxY?utm=x#top' }),
    )
    expect(current?.fsboUrl).toBe('https://www.craigslist.org/view/d/bend-home/4JsMDyVrbNFSXjWpRUVZxY')
    expect(current?.fsboUniqueId).toBe('4JsMDyVrbNFSXjWpRUVZxY')

    const legacy = craigslistCandidateToListing(
      mk({ url: 'https://bend.craigslist.org/reo/d/bend-cute-home/7712345678.html' }),
    )
    expect(legacy?.fsboUniqueId).toBe('7712345678')
  })

  it('extracts a street address from the title when one exists', () => {
    const withStreet = craigslistCandidateToListing(mk({ title: 'FSBO 20355 NW Murphy Rd, move-in ready' }))
    expect(withStreet?.streetAddress).toBe('20355 NW Murphy Rd')
    expect(withStreet?.fullAddress).toBe('20355 NW Murphy Rd, Bend, OR')

    const noStreet = craigslistCandidateToListing(mk({ title: 'Beautiful westside home' }))
    expect(noStreet?.streetAddress).toBe('')
    expect(noStreet?.fullAddress).toBe('Beautiful westside home (Bend, OR)')
  })
})

describe('resolveCraigslistCity', () => {
  it('normalizes location casing and OR suffixes', () => {
    const url = 'https://www.craigslist.org/view/d/x-y/abc123def456'
    expect(resolveCraigslistCity('BEND', url)).toBe('Bend')
    expect(resolveCraigslistCity('la pine, OR', url)).toBe('La Pine')
    expect(resolveCraigslistCity('Sunriver', url)).toBe('Sunriver')
    expect(resolveCraigslistCity('MT Vernon', url)).toBeNull()
  })

  it('falls back to the URL slug only when no location is stated', () => {
    expect(resolveCraigslistCity(null, 'https://www.craigslist.org/view/d/la-pine-cabin-getaway/abc123def456')).toBe('La Pine')
    expect(resolveCraigslistCity(null, 'https://www.craigslist.org/view/d/bendbroadband-tower/abc123def456')).toBeNull()
    expect(resolveCraigslistCity(null, 'https://www.craigslist.org/view/d/fossil-home-for-sale/abc123def456')).toBeNull()
  })
})

describe('title heuristics', () => {
  it('flags land-only titles, spares dwellings', () => {
    expect(isLandOnlyTitle('Fully developed lot')).toBe(true)
    expect(isLandOnlyTitle('Land-Prime Highway 97 Frontage')).toBe(true)
    expect(isLandOnlyTitle('Vacant land with views')).toBe(true)
    expect(isLandOnlyTitle('Home on 1 ac lot at builders cost')).toBe(false)
    expect(isLandOnlyTitle('79 acres, 2 homes, indoor and outdoor arenas')).toBe(false)
    expect(isLandOnlyTitle('5br - 4200ft2 - Multi Structure Resort Complex')).toBe(false)
  })

  it('street extraction ignores acreage/sqft numbers', () => {
    expect(extractStreetAddress('320 acre ranch property for sale outside Bend')).toBeNull()
    expect(extractStreetAddress('5br - 4200ft2 - Multi Structure Resort Complex')).toBeNull()
    expect(extractStreetAddress('61545 Tall Tree Ct near the river')).toBe('61545 Tall Tree Ct')
  })
})

describe('search URL', () => {
  it('carries the shared price floor as min_price', () => {
    expect(CRAIGSLIST_FSBO_SEARCH_URL).toBe(`https://bend.craigslist.org/search/reo?min_price=${FSBO_MIN_LIST_PRICE}`)
  })
})
