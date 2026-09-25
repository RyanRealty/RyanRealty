// The harness loads Next's server baseline, so it must come before next/cache.
import { staticGenerationHarness } from '@/test/next-fetch-cache-harness'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListingTile } from '@/lib/data/types/listing'

/*
 * The /cities/redmond prerender crash (dpl_57NPHyuPyFiSkL23TpQzyNQ1rV4L,
 * 2026-09-25), end to end on Next 16.1.6's REAL unstable_cache:
 *
 *   1. The first render reads getPlaceOpeningListings (a cache miss, so the
 *      work store queues the write as a pending revalidate) and then degrades
 *      on slow reads that together outlast the entry's 60 s window.
 *   2. runPublishedPageRender (lib/site/degraded-isr.ts) retries the page in
 *      the SAME work store. unstable_cache finds the entry stale, finds the
 *      pending write already queued, and returns that write: undefined.
 *   3. withTimeoutFallback passed the undefined through, and
 *      buildPlaceAlertTypes ran `input.buckets.find(...)` on it:
 *      "TypeError: Cannot read properties of undefined (reading 'find')".
 *
 * Only the listing-tile reads under getPlaceOpeningListings are stubbed; the
 * cache, the retry, the timeout guard and the alert builder are the real ones.
 */

const TILE = {
  listingKey: '220190001',
  listNumber: '220190001',
  streetNumber: '1234',
  streetName: 'SW Canal',
  streetSuffix: 'Blvd',
  city: 'Redmond',
  subdivisionName: null,
  photoUrl: 'https://photos.example/220190001.jpg',
  listPrice: 525_000,
  propertyType: 'A',
  beds: 3,
  baths: 2,
  sqft: 1_650,
} as unknown as ListingTile

vi.mock('@/lib/data/listings/getListingTiles', () => ({
  getListingTiles: vi.fn(async () => [TILE]),
  getListingTilesCount: vi.fn(async () => 7),
}))

import { getPlaceOpeningListings } from '@/lib/data/listings/getPlaceOpeningListings'
import { buildPlaceAlertTypes } from '@/lib/site/place-alerts'
import { runPublishedPageRender } from '@/lib/site/degraded-isr'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'

const savedPhase = process.env.NEXT_PHASE

beforeEach(() => {
  process.env.NEXT_PHASE = 'phase-production-build'
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  if (savedPhase === undefined) delete process.env.NEXT_PHASE
  else process.env.NEXT_PHASE = savedPhase
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

describe('the degraded-ISR retry render of /cities/redmond', () => {
  it('renders the alert types from real buckets on the retry instead of crashing', async () => {
    const h = staticGenerationHarness('/cities/[slug]')
    let renders = 0
    const options = await h.run(() =>
      runPublishedPageRender('city', async () => {
        renders += 1
        const buckets = await withTimeoutFallback(
          getPlaceOpeningListings({ city: 'Redmond' }),
          [],
          3000,
          'city:openingListings',
        )
        await h.flushWrites()
        // The rest of a degraded first render: city:atlas alone waited 18 s
        // and nbh:stock 36 s in that build, so the 60 s entry goes stale.
        h.clock.now += 61_000
        await withTimeoutFallback(sleep(40).then(() => 'dots'), null, 2, 'city:atlas')
        return buildPlaceAlertTypes({
          placeName: 'Redmond',
          scopeName: 'Redmond',
          geoType: 'city',
          geoSlug: 'redmond',
          leftoverHouses30d: 12,
          buckets,
        })
      }),
    )
    expect(renders).toBe(2)
    const houses = options.find((option) => option.key === 'houses')
    expect(houses?.listings.map((listing) => listing.title)).toEqual(['1234 SW Canal Blvd'])
  })
})
