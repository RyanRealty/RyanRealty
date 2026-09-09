import { describe, expect, it } from 'vitest'
import legacyRedirects from '@/data/legacy-redirects.json'
import { getPlaceLinks } from '@/lib/place-links'
import {
  isPlaceFilteredSearchHref,
  publishPlaceBrowseHref,
  publishPlaceHeroCta,
  redirectsAwayFromSearch,
} from './publish-place-browse-href'

describe('publishPlaceBrowseHref', () => {
  it('keeps a city / plat / neighborhood listings path', () => {
    expect(publishPlaceBrowseHref('/homes-for-sale/redmond/ridge-at-eagle-crest')).toBe(
      '/homes-for-sale/redmond/ridge-at-eagle-crest',
    )
    expect(publishPlaceBrowseHref('/homes-for-sale/bend')).toBe('/homes-for-sale/bend')
    expect(publishPlaceBrowseHref('/homes-for-sale/bend/awbrey-butte')).toBe(
      '/homes-for-sale/bend/awbrey-butte',
    )
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
    const awbrey = getPlaceLinks({ type: 'neighborhood', slug: 'awbrey-butte', citySlug: 'bend' })
    expect(publishPlaceBrowseHref(awbrey.browseUrl)).toBe('/homes-for-sale/bend/awbrey-butte')
  })

  it('redirectsAwayFromSearch ignores a self-map, the way middleware does', () => {
    expect(redirectsAwayFromSearch('/homes-for-sale/bend/tetherow')).toBe(true)
    expect(redirectsAwayFromSearch('/homes-for-sale/bend')).toBe(false)
    expect(redirectsAwayFromSearch('/homes-for-sale/redmond/ridge-at-eagle-crest')).toBe(false)
  })

  it('is the only /homes-for-sale key in the legacy map — a second one changes this rule', () => {
    const keys = Object.keys(legacyRedirects as Record<string, string>).filter((k) =>
      k.startsWith('/homes-for-sale'),
    )
    expect(keys).toEqual(['/homes-for-sale/bend/tetherow'])
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
