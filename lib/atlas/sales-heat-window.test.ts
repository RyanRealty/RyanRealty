import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListingStatus } from '@/lib/data/types/listing'
import { ATLAS_HEAT_WINDOW_DAYS, ATLAS_PULSE_WINDOW_DAYS } from './sales-heat'

const getAtlasTiles = vi.fn()

vi.mock('@/lib/data', () => ({ getAtlasTiles: (args: unknown) => getAtlasTiles(args) }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

const NOW = Date.parse('2026-09-02T12:00:00Z')

function isoDaysAgo(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString()
}

function tile(over: {
  listingKey: string
  status: ListingStatus
  closeDate?: string | null
  lat?: number
  lng?: number
}) {
  return {
    listingKey: over.listingKey,
    listNumber: over.listingKey,
    status: over.status,
    listPrice: 500_000,
    closePrice: over.status === 'Closed' ? 500_000 : null,
    closeDate: over.closeDate ?? null,
    onMarketDate: isoDaysAgo(40),
    modifiedAt: isoDaysAgo(2),
    lat: over.lat ?? 44.05,
    lng: over.lng ?? -121.32,
    city: 'Bend',
    subdivisionName: 'Tetherow',
    propertyType: 'Residential',
    propertySubType: 'Single Family Residence',
    streetNumber: '1',
    streetName: 'Main',
  }
}

describe('atlas heat window', () => {
  beforeEach(() => {
    vi.resetModules()
    getAtlasTiles.mockReset()
  })

  it('reads closes back through the 90-day heat window, not only 30', async () => {
    const { readAtlasTiles } = await import('./build-place-atlas')
    getAtlasTiles.mockResolvedValue([])
    await readAtlasTiles(['Bend'], NOW)
    expect(getAtlasTiles).toHaveBeenCalledTimes(1)
    const arg = getAtlasTiles.mock.calls[0]![0] as { closedFromDate: string }
    const want = new Date(NOW - ATLAS_HEAT_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
    expect(arg.closedFromDate).toBe(want)
    expect(ATLAS_HEAT_WINDOW_DAYS).toBe(90)
  })

  it('keeps a 60-day close for heat and drops a 100-day close', async () => {
    const { atlasDotsFromTiles } = await import('./build-place-atlas')
    const dots = atlasDotsFromTiles(
      [
        tile({ listingKey: 'a', status: 'Active' }),
        tile({ listingKey: 'p', status: 'Pending' }),
        tile({ listingKey: 's10', status: 'Closed', closeDate: isoDaysAgo(10) }),
        tile({ listingKey: 's60', status: 'Closed', closeDate: isoDaysAgo(60) }),
        tile({ listingKey: 's100', status: 'Closed', closeDate: isoDaysAgo(100) }),
      ],
      NOW,
    )
    const sold = dots.filter((d) => d.s === 'sold')
    expect(sold.map((d) => d.k).sort()).toEqual(['s10', 's60'])
    expect(dots.some((d) => d.k === 's100')).toBe(false)
    expect(dots.some((d) => d.s === 'active')).toBe(true)
    expect(dots.some((d) => d.s === 'pending')).toBe(true)
  })

  it('counts sold as the 30-day pulse window, not the 90-day heat window', async () => {
    const { atlasDotsFromTiles, buildPlaceAtlas } = await import('./build-place-atlas')
    const tiles = [
      tile({ listingKey: 'a', status: 'Active' }),
      tile({ listingKey: 's10', status: 'Closed', closeDate: isoDaysAgo(10) }),
      tile({ listingKey: 's60', status: 'Closed', closeDate: isoDaysAgo(60) }),
    ]
    const dots = atlasDotsFromTiles(tiles, NOW)
    const pulse = dots.filter((d) => d.s === 'sold' && d.soldAgo != null && d.soldAgo <= ATLAS_PULSE_WINDOW_DAYS)
    expect(pulse).toHaveLength(1)
    expect(dots.filter((d) => d.s === 'sold')).toHaveLength(2)

    getAtlasTiles.mockResolvedValue(tiles)
    const pop = await buildPlaceAtlas({ cities: ['Bend'], label: 'Bend' }, NOW)
    expect(pop.counts.sold).toBe(1)
    expect(pop.counts.forSale).toBe(1)
    expect(pop.source).toContain('last 90 days')
    expect(pop.source).toContain('last 30 days')
    expect(pop.source).toMatch(/wash is sales density/i)
    expect(pop.source).not.toMatch(/last 12 months/)
  })
})
