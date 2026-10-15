import { describe, expect, it } from 'vitest'
import { BEND_DISTRICTS } from '@/lib/neighborhood-areas'
import { communityNewestListingsHref } from '@/lib/place-links'
import { bendDistrictAlertScope, cityAlertScope, communityAlertScope } from './place-alert-scope'

describe('cityAlertScope', () => {
  it('alerts the city by its address, every type, with the city browse door', () => {
    expect(cityAlertScope({ cityName: 'Bend', citySlug: 'bend' })).toEqual({
      placeName: 'Bend',
      filters: { city: 'Bend' },
      browseHref: '/homes-for-sale/bend',
      geoType: 'city',
      geoSlug: 'bend',
    })
  })

  it('has no scope for a blank city', () => {
    expect(cityAlertScope({ cityName: '  ', citySlug: '' })).toBeNull()
  })
})

describe('bendDistrictAlertScope', () => {
  it('scopes a Bend district to its boundary slug when BEND_DISTRICTS has it', () => {
    const scope = bendDistrictAlertScope({ hoodSlug: 'river-west', hoodLabel: 'River West' })
    expect(scope.filters).toEqual({ neighborhoodSlug: 'bend-river-west' })
    expect(scope.placeName).toBe('River West')
    expect(scope.scopeName).toBeUndefined()
    expect(scope.browseHref).toBe('/homes-for-sale/bend/river-west')
  })

  it('maps every BEND_DISTRICTS row to its own bend-<slug> filter', () => {
    for (const district of BEND_DISTRICTS) {
      const hoodSlug = district.slug.replace(/^bend-/, '')
      const scope = bendDistrictAlertScope({ hoodSlug, hoodLabel: district.label })
      expect(scope.filters).toEqual({ neighborhoodSlug: district.slug })
    }
  })

  it('falls back to the city, named as the scope, when the slug has no district polygon', () => {
    const scope = bendDistrictAlertScope({ hoodSlug: 'not-a-district', hoodLabel: 'Not A District' })
    expect(scope.filters).toEqual({ city: 'Bend' })
    expect(scope.scopeName).toBe('Bend')
    expect(scope.placeName).toBe('Not A District')
    expect(scope.browseHref).toBe('/homes-for-sale/bend')
  })
})

describe('communityAlertScope', () => {
  const tetherow = { city: 'Bend', citySlug: 'bend', subdivision: 'Tetherow', name: 'Tetherow' }

  it('sends the community page\'s own city + subdivision and its newest-listings door', () => {
    const scope = communityAlertScope({ community: tetherow, slug: 'tetherow', placeName: 'Tetherow' })
    expect(scope).toEqual({
      placeName: 'Tetherow',
      filters: { city: 'Bend', subdivision: 'Tetherow' },
      browseHref: communityNewestListingsHref('tetherow'),
      geoType: 'neighborhood',
      geoSlug: 'tetherow',
    })
    expect(scope?.browseHref).toBe('/homes-for-sale/bend/tetherow/new-listings-30')
  })

  it('reads the registry community through a subdivision alias', () => {
    const scope = communityAlertScope({
      community: { ...tetherow, subdivision: 'Tetherow Resort' },
      slug: 'bend-tetherow',
      placeName: 'Tetherow',
    })
    // The registry match is read the way /communities/[slug] reads it, so the
    // door is the community's own newest-listings search, not a city search.
    expect(scope?.browseHref).toBe('/homes-for-sale/bend/tetherow/new-listings-30')
    expect(scope?.filters).toEqual({ city: 'Bend', subdivision: 'Tetherow Resort' })
  })

  it('with no subdivision alerts the whole city and says so', () => {
    const scope = communityAlertScope({
      community: { city: 'Sisters', citySlug: 'sisters', subdivision: '', name: 'Somewhere' },
      slug: 'somewhere',
      placeName: 'Somewhere',
    })
    expect(scope?.filters).toEqual({ city: 'Sisters' })
    expect(scope?.scopeName).toBe('Sisters')
    expect(scope?.browseHref).toMatch(/^\/homes-for-sale\//)
  })

  it('has no scope without a city', () => {
    expect(
      communityAlertScope({
        community: { city: '', citySlug: '', subdivision: 'X', name: 'X' },
        slug: 'x',
        placeName: 'X',
      }),
    ).toBeNull()
  })
})
