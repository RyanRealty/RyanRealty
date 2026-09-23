import { describe, expect, it } from 'vitest'
import legacyRedirects from '@/data/legacy-redirects.json'
import { getPlaceLinks } from '@/lib/place-links'
import {
  isCommunityPlaceHref,
  isPlaceFilteredSearchHref,
  publishPlaceBrowseHref,
  publishPlaceHeroCta,
  redirectsAwayFromSearch,
} from './publish-place-browse-href'

describe('publishPlaceBrowseHref', () => {
  it('keeps a city / plat listings path that does not 301 away', () => {
    expect(publishPlaceBrowseHref('/homes-for-sale/redmond/ridge-at-eagle-crest')).toBe(
      '/homes-for-sale/redmond/ridge-at-eagle-crest',
    )
    expect(publishPlaceBrowseHref('/homes-for-sale/bend')).toBe('/homes-for-sale/bend')
  })

  it('withholds the regional inventory door', () => {
    expect(publishPlaceBrowseHref('/homes-for-sale')).toBeNull()
    expect(publishPlaceBrowseHref('/homes-for-sale?view=list')).toBeNull()
    expect(publishPlaceBrowseHref('/homes-for-sale/')).toBeNull()
    expect(isPlaceFilteredSearchHref('/homes-for-sale?view=list')).toBe(false)
  })

  it('withholds on-page jumps and empty hrefs', () => {
    expect(publishPlaceBrowseHref('#homes')).toBeNull()
    expect(publishPlaceBrowseHref('')).toBeNull()
    expect(publishPlaceBrowseHref(null)).toBeNull()
  })

  it('withholds a path middleware 301s away — Tetherow bounces back to its own page', () => {
    // getPlaceLinks returns this exact path for the Tetherow community, and
    // data/legacy-redirects.json maps it to /communities/tetherow, which
    // middleware.ts applies before any route resolves. A door built from it
    // would take a visitor on /communities/tetherow back to where they stand.
    const tetherow = getPlaceLinks({ type: 'community', slug: 'tetherow' })
    expect(tetherow.browseUrl).toBe('/homes-for-sale/bend/tetherow')
    expect((legacyRedirects as Record<string, string>)['/homes-for-sale/bend/tetherow']).toBe(
      '/communities/tetherow',
    )
    expect(publishPlaceBrowseHref(tetherow.browseUrl)).toBeNull()
    expect(publishPlaceBrowseHref('/homes-for-sale/bend/tetherow')).toBeNull()
    expect(publishPlaceHeroCta('/homes-for-sale/bend/tetherow', 'See Tetherow homes')).toBeNull()
    // Normalised the way middleware normalises: trailing slash and case.
    expect(publishPlaceBrowseHref('/homes-for-sale/bend/tetherow/')).toBeNull()
    expect(publishPlaceBrowseHref('/Homes-For-Sale/Bend/Tetherow')).toBeNull()
  })

  it('still publishes the places that do not redirect', () => {
    const bend = getPlaceLinks({ type: 'city', slug: 'bend' })
    expect(publishPlaceBrowseHref(bend.browseUrl)).toBe('/homes-for-sale/bend')
    const ridge = getPlaceLinks({
      type: 'neighborhood',
      slug: 'ridge-at-eagle-crest',
      citySlug: 'redmond',
    })
    expect(publishPlaceBrowseHref(ridge.browseUrl)).toBe(
      '/homes-for-sale/redmond/ridge-at-eagle-crest',
    )
  })

  it('SITE-171 withholds leftover area-search URLs that 301 onto the place page', () => {
    const awbrey = getPlaceLinks({ type: 'neighborhood', slug: 'awbrey-butte', citySlug: 'bend' })
    expect(awbrey.browseUrl).toBe('/homes-for-sale/bend/awbrey-butte')
    expect(publishPlaceBrowseHref(awbrey.browseUrl)).toBeNull()
    expect(publishPlaceBrowseHref('/homes-for-sale/bend/northwest-crossing')).toBeNull()
    expect(publishPlaceBrowseHref('/homes-for-sale/bend/stevens-ranch')).toBeNull()
    expect(
      (legacyRedirects as Record<string, string>)['/homes-for-sale/bend/awbrey-butte'],
    ).toBe('/cities/bend/awbrey-butte')
    expect(
      (legacyRedirects as Record<string, string>)['/homes-for-sale/bend/northwest-crossing'],
    ).toBe('/communities/northwest-crossing')
    expect(
      (legacyRedirects as Record<string, string>)['/homes-for-sale/bend/stevens-ranch'],
    ).toBe('/subdivisions/stevens-ranch')
    expect(
      (legacyRedirects as Record<string, string>)['/housing-market/bend/tetherow'],
    ).toBe('/communities/tetherow')
    expect(redirectsAwayFromSearch('/housing-market/bend/tetherow')).toBe(true)
  })

  it('redirectsAwayFromSearch ignores a self-map, the way middleware does', () => {
    expect(redirectsAwayFromSearch('/homes-for-sale/bend/tetherow')).toBe(true)
    expect(redirectsAwayFromSearch('/homes-for-sale/bend')).toBe(false)
    expect(redirectsAwayFromSearch('/homes-for-sale/redmond/ridge-at-eagle-crest')).toBe(false)
  })

  it('maps leftover area-search URLs and keeps the Tetherow hop', () => {
    const keys = Object.keys(legacyRedirects as Record<string, string>).filter((k) =>
      k.startsWith('/homes-for-sale'),
    )
    expect(keys).toEqual([
      '/homes-for-sale/bend/awbrey-butte',
      '/homes-for-sale/bend/northwest-crossing',
      '/homes-for-sale/bend/stevens-ranch',
      '/homes-for-sale/bend/tetherow',
      '/homes-for-sale/sunriver/sunriver',
    ])
  })

  it('SITE-187 keeps a self-city community page as the plain inventory door', () => {
    // Sunriver is its own city; /communities/sunriver is the one winner for
    // "Sunriver homes for sale", so the city page's plain door lands there.
    expect(isCommunityPlaceHref('/communities/sunriver')).toBe(true)
    expect(publishPlaceBrowseHref('/communities/sunriver')).toBe('/communities/sunriver')
    expect(publishPlaceBrowseHref('/communities/sunriver/')).toBe('/communities/sunriver')
    expect(publishPlaceHeroCta('/communities/sunriver', 'See Sunriver homes')).toEqual({
      href: '/communities/sunriver',
      label: 'See Sunriver homes',
    })
    // Not a browse door: the index, a typed page, a compound slug with a query.
    expect(isCommunityPlaceHref('/communities')).toBe(false)
    expect(publishPlaceBrowseHref('/communities')).toBeNull()
    expect(publishPlaceBrowseHref('/communities/sunriver/types/single-family')).toBeNull()
    // The Sunriver area twin now 301s home, so it is withheld like Tetherow's.
    const sunriver = getPlaceLinks({ type: 'community', slug: 'sunriver' })
    expect(sunriver.browseUrl).toBe('/homes-for-sale/sunriver')
    expect((legacyRedirects as Record<string, string>)['/homes-for-sale/sunriver/sunriver']).toBe(
      '/communities/sunriver',
    )
    expect(publishPlaceBrowseHref('/homes-for-sale/sunriver/sunriver')).toBeNull()
  })
})

describe('publishPlaceHeroCta', () => {
  it('keeps a plat listings path', () => {
    expect(
      publishPlaceHeroCta('/homes-for-sale/redmond/ridge-at-eagle-crest', 'See Ridge at Eagle Crest homes'),
    ).toEqual({
      href: '/homes-for-sale/redmond/ridge-at-eagle-crest',
      label: 'See Ridge at Eagle Crest homes',
    })
  })

  it('withholds the regional inventory door so KbHero cannot default to it', () => {
    expect(publishPlaceHeroCta('/homes-for-sale?view=list', 'See homes')).toBeNull()
    expect(publishPlaceHeroCta('/homes-for-sale', 'See homes')).toBeNull()
  })
})
