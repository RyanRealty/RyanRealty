import { describe, expect, it } from 'vitest'
import { bareCityPlaceSlug, cityPlaceGrain, isNeighborhoodGrain } from './city-place-grain'

describe('cityPlaceGrain — Community ≠ Neighborhood', () => {
  it('classifies designated Bend districts as neighborhood grain', () => {
    expect(cityPlaceGrain({ name: 'Awbrey Butte', slug: 'bend-awbrey-butte', citySlug: 'bend' })).toBe(
      'neighborhood',
    )
    expect(cityPlaceGrain({ name: 'Old Bend', slug: 'old-bend', citySlug: 'bend' })).toBe('neighborhood')
    expect(isNeighborhoodGrain('Summit West', 'summit-west', 'bend')).toBe(true)
  })

  it('classifies registry / resort communities as community grain', () => {
    expect(cityPlaceGrain({ name: 'Tetherow', slug: 'tetherow', isResort: true, citySlug: 'bend' })).toBe(
      'community',
    )
    expect(cityPlaceGrain({ name: 'Broken Top', slug: 'broken-top', citySlug: 'bend' })).toBe('community')
    expect(cityPlaceGrain({ name: 'NorthWest Crossing', slug: 'northwest-crossing', citySlug: 'bend' })).toBe(
      'community',
    )
    expect(cityPlaceGrain({ name: 'Juniper Preserve', slug: 'pronghorn', citySlug: 'bend' })).toBe(
      'community',
    )
  })

  it('classifies MLS plats and phases as plat grain', () => {
    expect(
      cityPlaceGrain({ name: 'Parkside Place Phase 1', slug: 'bend-parkside-place-phase-1', citySlug: 'bend' }),
    ).toBe('plat')
    expect(
      cityPlaceGrain({
        name: 'Discovery West Phase 4',
        slug: 'bend-discovery-west-phase-4',
        citySlug: 'bend',
      }),
    ).toBe('plat')
    expect(cityPlaceGrain({ name: 'Petrosa', slug: 'bend-petrosa', citySlug: 'bend' })).toBe('plat')
  })

  it('does not treat Northwest Crossing as a Bend NA district', () => {
    expect(isNeighborhoodGrain('NorthWest Crossing', 'northwest-crossing', 'bend')).toBe(false)
  })

  it('strips a city prefix from index slugs', () => {
    expect(bareCityPlaceSlug('bend-awbrey-butte', 'bend')).toBe('awbrey-butte')
    expect(bareCityPlaceSlug('tetherow', 'bend')).toBe('tetherow')
  })
})
