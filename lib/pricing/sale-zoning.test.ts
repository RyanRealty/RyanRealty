import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/cma/sale-zone-cache', () => ({
  getSaleZoneCache: async () => new Map(),
  upsertSaleZoneCache: async () => undefined,
}))
vi.mock('@/lib/cma/county', () => ({ lookupCountyZone: async () => null }))

import { resolveSaleZones, MAX_ZONE_LOOKUPS } from './sale-zoning'

describe('resolveSaleZones — cache, then the MLS zone, then the county GIS, bounded', () => {
  it('serves the cache, keeps a usable MLS zone, queries the rest nearest-first and caps live lookups', async () => {
    const puts: unknown[][] = []
    const lookups: string[] = []
    const sales = [
      { listingKey: 'CACHED', latitude: 44, longitude: -121 },
      { listingKey: 'MLS', latitude: 44, longitude: -121, mlsZoning: 'RR10' },
      { listingKey: 'SENTINEL', latitude: 44, longitude: -121, mlsZoning: '********' },
      ...Array.from({ length: MAX_ZONE_LOOKUPS + 3 }, (_, i) => ({ listingKey: `GIS${i}`, latitude: 44 + i * 0.001, longitude: -121 })),
      { listingKey: 'NOPOINT', latitude: null, longitude: null },
    ]
    const zones = await resolveSaleZones(sales, {
      cache: {
        get: async () => new Map([['CACHED', { listingKey: 'CACHED', lat: 44, lng: -121, zone: 'EFU', zoneType: null, source: 'deschutes-gis' }]]),
        put: async (rows) => { puts.push([...rows]) },
      },
      lookup: async (lat) => { lookups.push(String(lat)); return { zone: 'MUA10', zoneType: 'Rural' } },
    })
    expect(zones.get('CACHED')).toBe('EFU')
    expect(zones.get('MLS')).toBe('RR10')
    expect(zones.get('SENTINEL')).toBe('MUA10') // the sentinel is no zone; the GIS answered
    expect(zones.has('NOPOINT')).toBe(false)
    // SENTINEL plus the GIS rows, capped at MAX_ZONE_LOOKUPS live queries.
    expect(lookups.length).toBe(MAX_ZONE_LOOKUPS)
    expect(zones.has(`GIS${MAX_ZONE_LOOKUPS + 2}`)).toBe(false)
    // One put for the MLS-sourced row, one for the GIS batch.
    expect(puts.length).toBe(2)
  })

  it('a failed query leaves the sale unknown and writes nothing', async () => {
    const puts: unknown[] = []
    const zones = await resolveSaleZones([{ listingKey: 'X', latitude: 44, longitude: -121 }], {
      cache: { get: async () => new Map(), put: async (rows) => { puts.push(rows) } },
      lookup: async () => null,
    })
    expect(zones.has('X')).toBe(false)
    expect(puts.length).toBe(0)
  })
})
