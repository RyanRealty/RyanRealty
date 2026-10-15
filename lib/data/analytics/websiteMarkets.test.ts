import { describe, expect, it } from 'vitest'
import { cityNameFromSlug, isLocalMarket, listingLabelFromUrl, marketFromUrl } from './websiteMarkets'

describe('marketFromUrl — which town a page was about', () => {
  it('reads homes for sale in a town, a subdivision, and a listing', () => {
    expect(marketFromUrl('https://ryan-realty.com/homes-for-sale/bend')).toEqual({ citySlug: 'bend', kind: 'search' })
    expect(marketFromUrl('https://ryan-realty.com/homes-for-sale/bend/larkspur?sort=newest')).toEqual({
      citySlug: 'bend',
      kind: 'search',
    })
    expect(marketFromUrl('https://ryan-realty.com/homes-for-sale/bend/larkspur/20606-daisy-220227756')).toEqual({
      citySlug: 'bend',
      kind: 'listing',
    })
    expect(marketFromUrl('https://ryan-realty.com/homes-for-sale/grants-pass/238-grandview-220224615')).toEqual({
      citySlug: 'grants-pass',
      kind: 'listing',
    })
  })

  it('reads the city filter on the search page', () => {
    expect(marketFromUrl('https://ryan-realty.com/homes-for-sale?subdivision=Caldera%20Springs&city=Sunriver')).toEqual({
      citySlug: 'sunriver',
      kind: 'search',
    })
    expect(marketFromUrl('/homes-for-sale?city=La%20Pine')).toEqual({ citySlug: 'la-pine', kind: 'search' })
    expect(marketFromUrl('/homes-for-sale')).toBeNull()
  })

  it('a preset is a filter across every town, not a place', () => {
    expect(marketFromUrl('/homes-for-sale/luxury')).toBeNull()
  })

  it('reads town pages, open houses and out-of-area town pages', () => {
    expect(marketFromUrl('/cities/redmond')).toEqual({ citySlug: 'redmond', kind: 'place' })
    expect(marketFromUrl('/cities/bend/northwest-crossing')).toEqual({ citySlug: 'bend', kind: 'place' })
    expect(marketFromUrl('/open-houses/sisters')).toEqual({ citySlug: 'sisters', kind: 'search' })
    expect(marketFromUrl('/oregon/medford')).toEqual({ citySlug: 'medford', kind: 'place' })
  })

  it('pages that name no town have no market', () => {
    for (const u of ['/', '/blog/well-water-testing', '/subdivisions/skyline-phase-3', '/communities/tetherow', '/contact', '']) {
      expect(marketFromUrl(u)).toBeNull()
    }
  })
})

describe('names', () => {
  it('turns a slug into a town name', () => {
    expect(cityNameFromSlug('la-pine')).toBe('La Pine')
    expect(cityNameFromSlug('crooked-river-ranch')).toBe('Crooked River Ranch')
  })

  it('knows the service area', () => {
    expect(isLocalMarket('bend')).toBe(true)
    expect(isLocalMarket('la-pine')).toBe(true)
    expect(isLocalMarket('medford')).toBe(false)
  })

  it('names a listing from its address in the URL', () => {
    expect(listingLabelFromUrl('https://ryan-realty.com/homes-for-sale/bend/larkspur/20606-daisy-220227756')).toBe(
      '20606 Daisy, Bend',
    )
    expect(listingLabelFromUrl('/homes-for-sale/grants-pass/238-grandview-220224615')).toBe('238 Grandview, Grants Pass')
    expect(listingLabelFromUrl('/homes-for-sale/bend')).toBeNull()
    expect(listingLabelFromUrl('/blog/x')).toBeNull()
  })
})
