import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/listings/getSimilarListings', () => ({
  getSimilarListings: vi.fn(async () => [
    { listingKey: 'sim-1', listNumber: '1', listPrice: 500_000 },
    { listingKey: 'sim-2', listNumber: '2', listPrice: 510_000 },
  ]),
}))

vi.mock('@/lib/kb/fetch-nearby-tiles', () => ({
  fetchNearbyTiles: vi.fn(async () => [
    { listingKey: 'sim-1', listNumber: '1', listPrice: 500_000 }, // dupe
    { listingKey: 'near-1', listNumber: '9', listPrice: 495_000 },
    { listingKey: 'anchor', listNumber: '0', listPrice: 500_000 }, // should not appear if excluded
  ]),
}))

import { getRelatedListings } from './getRelatedListings'

describe('getRelatedListings', () => {
  it('merges similar first then nearby, dedupes, excludes anchor', async () => {
    const r = await getRelatedListings({
      anchorKey: 'anchor',
      excludeListNumber: '0',
      subjectPrice: 500_000,
      scope: { city: 'Bend' },
      limit: 10,
    })
    expect(r.primary.map((t) => t.listingKey)).toEqual(['sim-1', 'sim-2', 'near-1'])
    expect(r.primary.find((t) => t.listingKey === 'anchor')).toBeUndefined()
    expect(r.similar).toHaveLength(2)
    expect(r.nearby.length).toBeGreaterThan(0)
  })
})
