import { describe, expect, it } from 'vitest'
import {
  BEND_NEIGHBORHOOD_DISTRICTS,
  bendNeighborhoodCanonicalHref,
  medianListPrice,
  neighborhoodGeoSlug,
  rollupNeighborhoodPublicInventory,
} from './neighborhood-public-inventory'

describe('neighborhood public inventory rollup', () => {
  it('uses bend-{slug} geo slugs for every designated district', () => {
    expect(neighborhoodGeoSlug('bend', 'awbrey-butte')).toBe('bend-awbrey-butte')
    expect(BEND_NEIGHBORHOOD_DISTRICTS).toHaveLength(13)
    expect(BEND_NEIGHBORHOOD_DISTRICTS.map((d) => d.slug)).toContain('awbrey-butte')
  })

  it('counts SFR rows per district and medians the same priced set', () => {
    const rows = rollupNeighborhoodPublicInventory([
      { geo_slug: 'bend-awbrey-butte', listing_key: 'a', list_price: 1_000_000 },
      { geo_slug: 'bend-awbrey-butte', listing_key: 'b', list_price: 1_200_000 },
      { geo_slug: 'bend-awbrey-butte', listing_key: 'c', list_price: 1_400_000 },
      { geo_slug: 'bend-old-bend', listing_key: 'd', list_price: null },
    ])
    const awbrey = rows.find((r) => r.slug === 'awbrey-butte')
    const oldBend = rows.find((r) => r.slug === 'old-bend')
    const larkspur = rows.find((r) => r.slug === 'larkspur')
    expect(awbrey?.activeCount).toBe(3)
    expect(awbrey?.medianListPrice).toBe(1_200_000)
    expect(awbrey?.listingKeys).toEqual(['a', 'b', 'c'])
    expect(awbrey?.href).toBe('/cities/bend/awbrey-butte')
    expect(oldBend?.activeCount).toBe(1)
    expect(oldBend?.medianListPrice).toBeNull()
    expect(larkspur?.activeCount).toBe(0)
    expect(larkspur?.listingKeys).toEqual([])
  })

  it('does not mix a second district into Awbrey Butte', () => {
    const rows = rollupNeighborhoodPublicInventory([
      { geo_slug: 'bend-southern-crossing', listing_key: 'x', list_price: 500_000 },
      { geo_slug: 'bend-awbrey-butte', listing_key: 'y', list_price: 900_000 },
    ])
    expect(rows.find((r) => r.slug === 'awbrey-butte')?.activeCount).toBe(1)
    expect(rows.find((r) => r.slug === 'southern-crossing')?.activeCount).toBe(1)
  })

  it('maps a Bend district slug to the city-nested report', () => {
    expect(bendNeighborhoodCanonicalHref('awbrey-butte')).toBe('/cities/bend/awbrey-butte')
    expect(bendNeighborhoodCanonicalHref('tetherow')).toBeNull()
  })

  it('median is the lower-middle neighbor on an even set', () => {
    expect(medianListPrice([100, 200, 300, 400])).toBe(250)
    expect(medianListPrice([100])).toBe(100)
    expect(medianListPrice([])).toBeNull()
  })
})
