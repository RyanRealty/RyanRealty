import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/data', () => ({ getAtlasTiles: vi.fn() }))

const NOW = Date.parse('2026-09-18T12:00:00Z')

describe('atlasDotsFromTiles', () => {
  it('carries ask, street, photo, and beds onto the pin payload', async () => {
    const { atlasDotsFromTiles } = await import('./build-place-atlas')
    const dots = atlasDotsFromTiles(
      [
        {
          listingKey: 'k1',
          listNumber: '220000001',
          status: 'Active',
          listPrice: 735_000,
          closePrice: null,
          closeDate: null,
          onMarketDate: '2026-09-01T00:00:00Z',
          modifiedAt: null,
          lat: 44.06,
          lng: -121.31,
          city: 'Bend',
          subdivisionName: 'Larkspur',
          propertyType: 'A',
          propertySubType: 'Single Family Residence',
          streetNumber: '123',
          streetName: 'Larkspur',
          streetSuffix: 'Drive',
          photoUrl: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/abc.jpg',
          beds: 3,
          baths: 2.5,
          sqft: 1840,
          boundaryCity: 'Bend',
          boundaryNeighborhood: 'larkspur',
        },
      ],
      NOW,
    )
    expect(dots).toHaveLength(1)
    expect(dots[0]?.p).toBe(735_000)
    expect(dots[0]?.street).toMatch(/123 Larkspur Drive/)
    expect(dots[0]?.beds).toBe(3)
    expect(dots[0]?.baths).toBe(2.5)
    expect(dots[0]?.sqft).toBe(1840)
    expect(dots[0]?.photo).toContain('800x600')
  })

  it('drops a commercial lease (PropertyType G) — its ListPrice is rent, not a sale', async () => {
    // Real case, verified 2026-09-23: three Active 'G' rows at 671 Greenwood
    // Avenue, Bend (list_price 1.3, 1.4, 1.4) drew as map dots and inflated
    // the Atlas's "N for sale" claim before this guard.
    const { atlasDotsFromTiles } = await import('./build-place-atlas')
    const dots = atlasDotsFromTiles(
      [
        {
          listingKey: 'lease-1',
          listNumber: '220999001',
          status: 'Active',
          listPrice: 1.3,
          closePrice: null,
          closeDate: null,
          onMarketDate: '2026-09-01T00:00:00Z',
          modifiedAt: null,
          lat: 44.06,
          lng: -121.31,
          city: 'Bend',
          subdivisionName: 'Center Addition to Bend',
          propertyType: 'G',
          propertySubType: null,
          streetNumber: '671',
          streetName: 'Greenwood',
          streetSuffix: 'Avenue',
          photoUrl: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/lease.jpg',
          beds: null,
          baths: null,
          sqft: 2400,
          boundaryCity: 'Bend',
          boundaryNeighborhood: null,
        },
      ],
      NOW,
    )
    expect(dots).toHaveLength(0)
  })
})

describe('atlasLeaseKeysFromTiles', () => {
  const base = {
    listNumber: '220999001',
    listPrice: 1.3,
    closePrice: null,
    closeDate: null,
    onMarketDate: '2026-09-01T00:00:00Z',
    modifiedAt: null,
    lat: 44.06,
    lng: -121.3,
    city: 'Bend',
    subdivisionName: null,
    propertySubType: null,
    streetNumber: '671',
    streetName: 'Greenwood',
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
  }

  it('hands over the active leases in scope, each once, and nothing else', async () => {
    // 671 Greenwood Avenue, Bend: two of its three leases carry no subdivision
    // name, so a plat page finds them only inside its recorded footprint.
    const { atlasLeaseKeysFromTiles, atlasDotsFromTiles } = await import('./build-place-atlas')
    const tiles = [
      { ...base, listingKey: 'lease-1', status: 'Active', propertyType: 'G' },
      { ...base, listingKey: 'lease-2', status: 'Active Under Contract', propertyType: 'G' },
      { ...base, listingKey: 'lease-1', status: 'Active', propertyType: 'G' },
      { ...base, listingKey: 'lease-closed', status: 'Closed', propertyType: 'G', closeDate: '2026-09-10' },
      { ...base, listingKey: 'lease-pending', status: 'Pending', propertyType: 'G' },
      { ...base, listingKey: 'house-1', status: 'Active', propertyType: 'A', listPrice: 650_000 },
    ] as Parameters<typeof atlasLeaseKeysFromTiles>[0]
    expect(atlasLeaseKeysFromTiles(tiles)).toEqual(['lease-1', 'lease-2'])
    // ...and the map still draws none of them.
    expect(atlasDotsFromTiles(tiles, NOW).map((d) => d.k)).toEqual(['house-1'])
  })
})
