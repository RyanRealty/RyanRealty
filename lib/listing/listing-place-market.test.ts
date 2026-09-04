import { describe, expect, it } from 'vitest'
import {
  leftoverListingGrains,
  listingAtlasFrameIntent,
  listingAtlasHeadline,
  resolveListingPlaceAndMarket,
} from './listing-place-market'

const listing = {
  city: 'Bend',
  citySlug: 'bend',
  subdivisionName: 'Bear Creek Estates',
  subdivisionSlug: 'bear-creek-estates',
  neighborhoodName: 'Larkspur',
  neighborhoodSlug: 'larkspur',
}

describe('leftoverListingGrains', () => {
  it('does not treat a plat slug as leftover neighborhood', () => {
    const { marketGeo } = resolveListingPlaceAndMarket(listing)
    expect(marketGeo?.geoType).toBe('community')
    expect(marketGeo?.geoSlug).toBe('bear-creek-estates')
    expect(leftoverListingGrains(listing, marketGeo)).toEqual([
      {
        geoType: 'neighborhood',
        geoSlug: 'larkspur',
        name: 'Larkspur',
        hubHref: '/cities/bend/larkspur',
      },
      {
        geoType: 'city',
        geoSlug: 'bend',
        name: 'Bend',
        hubHref: '/cities/bend',
      },
    ])
  })

  it('frames the listing atlas on a curated community, not the city', () => {
    expect(
      listingAtlasFrameIntent({
        city: 'Bend',
        citySlug: 'bend',
        cityName: 'Bend',
        neighborhoodSlug: null,
        neighborhoodName: null,
        communitySlug: 'northwest-crossing',
        communityName: 'NorthWest Crossing',
      }),
    ).toEqual({
      grain: 'community',
      slug: 'northwest-crossing',
      name: 'NorthWest Crossing',
    })
    expect(listingAtlasHeadline('NorthWest Crossing')).toBe(
      "Here's what else is selling in NorthWest Crossing",
    )
  })

  it('tries curated community as leftover neighborhood when no neighborhood slug', () => {
    const tetherow = {
      city: 'Bend',
      citySlug: 'bend',
      subdivisionName: 'Tetherow',
      subdivisionSlug: 'tetherow',
      neighborhoodName: null,
      neighborhoodSlug: null,
    }
    const { marketGeo } = resolveListingPlaceAndMarket(tetherow)
    expect(leftoverListingGrains(tetherow, marketGeo)[0]).toEqual({
      geoType: 'neighborhood',
      geoSlug: 'tetherow',
      name: 'Tetherow',
      hubHref: '/communities/tetherow',
    })
  })
})
