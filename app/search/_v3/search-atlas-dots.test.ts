import { describe, expect, it } from 'vitest'
import {
  searchAtlasClaim,
  searchAtlasTypes,
  searchListingsToAtlasDots,
} from './search-atlas-dots'

describe('searchListingsToAtlasDots', () => {
  it('plots active homes with a price and skips rows without a pin', () => {
    const dots = searchListingsToAtlasDots(
      [
        {
          ListingKey: 'k1',
          ListNumber: '220000001',
          ListPrice: 625000,
          Latitude: 44.0582,
          Longitude: -121.3153,
          StandardStatus: 'Active',
          PropertyType: 'A',
          PropertySubType: 'Single Family Residence',
          StreetNumber: '1',
          StreetName: 'NW Test',
          City: 'Bend',
        },
        {
          ListingKey: 'k2',
          ListPrice: 400000,
          Latitude: null,
          Longitude: null,
          StandardStatus: 'Active',
        },
      ],
      Date.parse('2026-09-15T00:00:00.000Z'),
    )
    expect(dots).toHaveLength(1)
    expect(dots[0]?.p).toBe(625000)
    expect(dots[0]?.s).toBe('active')
    expect(dots[0]?.t).toBe('house')
  })

  it('claims the plotted set, not a second query', () => {
    const dots = searchListingsToAtlasDots([
      {
        ListingKey: 'a',
        ListPrice: 400000,
        Latitude: 44.05,
        Longitude: -121.3,
        StandardStatus: 'Active',
        PropertyType: 'A',
        PropertySubType: 'Single Family Residence',
      },
      {
        ListingKey: 'b',
        ListPrice: 800000,
        Latitude: 44.06,
        Longitude: -121.31,
        StandardStatus: 'Active',
        PropertyType: 'A',
        PropertySubType: 'Single Family Residence',
      },
    ])
    expect(searchAtlasClaim(dots, 'Bend')).toMatch(/2 homes in Bend/)
    expect(searchAtlasTypes(dots).some((t) => t.key === 'house')).toBe(true)
  })
})
