import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ListingTile } from '@/lib/data'

const data = vi.hoisted(() => ({ getListingTiles: vi.fn() }))
vi.mock('@/lib/data', () => ({ getListingTiles: data.getListingTiles }))
vi.mock('next/navigation', () => ({ unstable_rethrow: () => {} }))

import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'

function tiles(from: number, count: number): ListingTile[] {
  return Array.from({ length: count }, (_, i) => ({ listingKey: `k${from + i}` }) as ListingTile)
}

afterEach(() => {
  data.getListingTiles.mockReset()
  vi.restoreAllMocks()
})

describe('fetchAllCityActiveSfr', () => {
  it('pages past the 1,000-row cap and dedupes by listing key', async () => {
    data.getListingTiles
      .mockResolvedValueOnce(tiles(0, 1000))
      // Inventory shifted between pages: k999 repeats on page two.
      .mockResolvedValueOnce([...tiles(999, 1), ...tiles(1000, 44)])
    const rows = await fetchAllCityActiveSfr('Bend')
    expect(rows).toHaveLength(1044)
    expect(data.getListingTiles).toHaveBeenCalledTimes(2)
    expect(data.getListingTiles.mock.calls[1]?.[0]).toMatchObject({ city: 'Bend', offset: 1000, limit: 1000 })
  })

  it('names a failed page read instead of throwing "not iterable"', async () => {
    // What the 2026-09-25 build got on its degraded-ISR retry: the tile read
    // resolved undefined (see lib/data/cache/resilient.ts, the phantom).
    data.getListingTiles.mockResolvedValueOnce(undefined)
    await expect(fetchAllCityActiveSfr('Redmond')).rejects.toThrow(
      '[fetchAllCityActiveSfr] Redmond: active SFR page at offset 0 came back undefined, not rows',
    )
  })

  it('also names a null page, and one that fails after the first page', async () => {
    data.getListingTiles.mockResolvedValueOnce(tiles(0, 1000)).mockResolvedValueOnce(null)
    await expect(fetchAllCityActiveSfr('Bend')).rejects.toThrow(
      '[fetchAllCityActiveSfr] Bend: active SFR page at offset 1000 came back null, not rows',
    )
  })

  it("reports ok:false with that message through the city page's guard", async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    data.getListingTiles.mockResolvedValueOnce(undefined)
    const read = await withTimeoutFallbackResult(fetchAllCityActiveSfr('Redmond'), [], 6000, 'city:resortTiles')
    expect(read).toEqual({ value: [], ok: false })
    expect(logged).toHaveBeenCalledTimes(1)
    const [label, err] = logged.mock.calls[0] ?? []
    expect(label).toBe('[withTimeoutFallback:city:resortTiles]')
    expect(String(err)).toContain('came back undefined, not rows')
    expect(String(err)).not.toContain('not iterable')
  })
})
