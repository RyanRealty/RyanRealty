import { describe, expect, it } from 'vitest'
import legacyRedirects from '@/data/legacy-redirects.json'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { isSelfCityCommunity } from '@/lib/communities/self-city-community'
import { redirectsAwayFromSearch } from '@/lib/search/publish-place-browse-href'
import { communityNewestListingsHref, getPlaceLinks } from './place-links'

const LEGACY = legacyRedirects as Record<string, string>

describe('getPlaceLinks community browse door (SITE-183 / SITE-182)', () => {
  it('never hands a registry community a browse door that 301s back onto its page', () => {
    for (const entry of getAllResortCommunities()) {
      const links = getPlaceLinks({ type: 'community', slug: entry.slug })
      expect(redirectsAwayFromSearch(links.browseUrl), `${entry.slug} -> ${links.browseUrl}`).toBe(false)
      // The area twin itself is in the map, pointed at the community's live URL.
      expect(LEGACY[`/homes-for-sale/${entry.city_slug}/${entry.slug}`]).toBe(links.placeUrl)
      // A self-city browses its own city search; every other community its registry city's.
      expect(links.browseUrl).toBe(
        isSelfCityCommunity(entry.slug) ? `/homes-for-sale/${entry.slug}` : `/homes-for-sale/${entry.city_slug}`,
      )
    }
  })

  it('Broken Top and Tetherow browse Bend; Black Butte Ranch browses itself', () => {
    expect(getPlaceLinks({ type: 'community', slug: 'broken-top' }).browseUrl).toBe('/homes-for-sale/bend')
    expect(getPlaceLinks({ type: 'community', slug: 'tetherow' }).browseUrl).toBe('/homes-for-sale/bend')
    expect(getPlaceLinks({ type: 'community', slug: 'black-butte-ranch' }).browseUrl).toBe(
      '/homes-for-sale/black-butte-ranch',
    )
    expect(getPlaceLinks({ type: 'community', slug: 'pronghorn' }).placeUrl).toBe('/communities/juniper-preserve')
  })

  it('links a community market report only when that report publishes', () => {
    expect(getPlaceLinks({ type: 'community', slug: 'black-butte-ranch' }).marketUrl).toBe(
      '/housing-market/sisters/black-butte-ranch',
    )
    expect(getPlaceLinks({ type: 'community', slug: 'eagle-crest' }).marketUrl).toBe(
      '/housing-market/redmond/eagle-crest',
    )
    expect(getPlaceLinks({ type: 'community', slug: 'tetherow' }).marketUrl).toBe('/housing-market/bend')
    expect(getPlaceLinks({ type: 'community', slug: 'crooked-river-ranch' }).marketUrl).toBe(
      '/housing-market/terrebonne',
    )
    expect(getPlaceLinks({ type: 'neighborhood', slug: 'awbrey-butte', citySlug: 'bend' }).marketUrl).toBe(
      '/housing-market/bend',
    )
    // Resorts whose report publishes keep the two-segment report (production 2026-10-08).
    expect(getPlaceLinks({ type: 'community', slug: 'broken-top' }).marketUrl).toBe('/housing-market/bend/broken-top')
    expect(getPlaceLinks({ type: 'community', slug: 'northwest-crossing' }).marketUrl).toBe(
      '/housing-market/bend/northwest-crossing',
    )
    expect(getPlaceLinks({ type: 'community', slug: 'sunriver' }).marketUrl).toBe('/housing-market/sunriver')
    // A resort with no published report links the city report.
    expect(getPlaceLinks({ type: 'community', slug: 'vandevert-ranch' }).marketUrl).toBe('/housing-market/bend')
  })

  it('keeps the area-filtered path for a compound slug outside the registry', () => {
    const links = getPlaceLinks({ type: 'community', slug: 'bend-some-plat', citySlug: 'bend' })
    expect(links.browseUrl).toBe('/homes-for-sale/bend/bend-some-plat')
  })
})

describe('communityNewestListingsHref', () => {
  it('uses the area x preset search for a community whose twin 301s home', () => {
    expect(communityNewestListingsHref('broken-top')).toBe('/homes-for-sale/bend/broken-top/new-listings-30')
    expect(communityNewestListingsHref('tetherow')).toBe('/homes-for-sale/bend/tetherow/new-listings-30')
    expect(communityNewestListingsHref('bend-tetherow')).toBe('/homes-for-sale/bend/tetherow/new-listings-30')
    expect(communityNewestListingsHref('juniper-preserve')).toBe('/homes-for-sale/bend/pronghorn/new-listings-30')
  })

  it('uses the self-city search for a community that is its own city', () => {
    expect(communityNewestListingsHref('black-butte-ranch')).toBe('/homes-for-sale/black-butte-ranch')
    expect(communityNewestListingsHref('sunriver')).toBe('/homes-for-sale/sunriver')
  })

  it('never returns a path middleware would 301, and null outside the registry', () => {
    for (const entry of getAllResortCommunities()) {
      const href = communityNewestListingsHref(entry.slug)
      expect(href, entry.slug).not.toBeNull()
      expect(redirectsAwayFromSearch(href!), `${entry.slug} -> ${href}`).toBe(false)
    }
    expect(communityNewestListingsHref('not-a-community')).toBeNull()
  })
})
