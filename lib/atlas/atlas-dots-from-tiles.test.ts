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
})
