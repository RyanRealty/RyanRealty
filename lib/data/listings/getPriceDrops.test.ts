import { beforeEach, describe, it, expect, vi } from 'vitest'

// unstable_cache as a pass-through, so a throw inside a fetch reaches
// makeResilientCached's uncached retry and fallback the way it does in a Next
// render (a rejected promise is never cached).
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...args: unknown[]) => unknown) => fn }))
vi.mock('@/lib/data/client', () => ({ supabaseAnon: vi.fn() }))
vi.mock('@/lib/data/listings/getListingTiles', () => ({ getListingTiles: vi.fn() }))

import {
  getPriceDropDigest,
  getPriceDrops,
  tileAndEventToDrop,
  type ActivityEventRow,
} from './getPriceDrops'
import { supabaseAnon } from '@/lib/data/client'
import { getListingTiles } from '@/lib/data/listings/getListingTiles'
import type { ListingTile } from '@/lib/data/types/listing'

/**
 * §0 data-accuracy lock (Matt report 2026-07-12): a price-drop card must never
 * show "was $X, -Y%, now $X". The displayed was → now → % have to be
 * self-consistent, and a listing whose CURRENT price is not below the prior
 * price (recovered / relisted / increased) must be excluded entirely.
 *
 * Regression case: 18575 Century Drive — an event dropped it $299K → $229K, then
 * it went back to $299K, and the old logic (percent from the event's new_price)
 * printed "was $299K, -23.4%" while it was currently listed at $299,000.
 */
const NOW = 1_800_000_000_000

function tile(listPrice: number): ListingTile {
  return {
    listingKey: 'K1',
    listNumber: 'L1',
    streetNumber: '18575',
    streetName: 'Century Drive',
    streetSuffix: null,
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97702',
    subdivisionName: null,
    subdivisionSlug: null,
    lat: null,
    lng: null,
    photoUrl: 'p.jpg',
    beds: 2,
    baths: 2,
    sqft: 1024,
    listPrice,
    priceDropCount: 1,
    addressSlug: null,
    listNumber2: null,
  } as unknown as ListingTile
}

function event(previous: number | null, next: number | null): ActivityEventRow {
  return {
    id: 'e1',
    listing_key: 'K1',
    event_type: 'price_change',
    event_at: new Date(NOW - 86_400_000).toISOString(),
    payload: { previous_price: previous, new_price: next },
  }
}

describe('tileAndEventToDrop — was → now → % consistency (§0)', () => {
  it('excludes a listing whose current price is NOT below the prior price (recovered/relisted)', () => {
    // The regression: event $299K → $229K, but currently back to $299K.
    expect(tileAndEventToDrop(tile(299_000), event(299_000, 229_000), NOW)).toBeNull()
  })

  it('excludes a listing whose price went UP', () => {
    expect(tileAndEventToDrop(tile(400_000), event(350_000, 400_000), NOW)).toBeNull()
  })

  it('excludes when previous_price is missing (unverifiable)', () => {
    expect(tileAndEventToDrop(tile(299_000), event(null, 250_000), NOW)).toBeNull()
  })

  it('computes a consistent drop from previous → current list price', () => {
    const d = tileAndEventToDrop(tile(299_000), event(390_000, 299_000), NOW)
    expect(d).not.toBeNull()
    expect(d!.originalListPrice).toBe(390_000) // "was"
    expect(d!.listPrice).toBe(299_000) // "now"
    expect(d!.lastDropAmount).toBe(91_000)
    expect(d!.lastDropPct).toBeCloseTo((91_000 / 390_000) * 100, 3) // ~23.3%
    // The invariant: was * (1 - pct/100) === now (never "was == now with a %").
    expect(d!.originalListPrice! * (1 - d!.lastDropPct! / 100)).toBeCloseTo(d!.listPrice!, 0)
  })

  it('the percentage always agrees with the displayed was/now prices', () => {
    for (const [prev, now] of [
      [500_000, 450_000],
      [1_250_000, 1_100_000],
      [349_900, 319_900],
    ] as const) {
      const d = tileAndEventToDrop(tile(now), event(prev, now), NOW)!
      expect(d).not.toBeNull()
      const impliedNow = d.originalListPrice! * (1 - d.lastDropPct! / 100)
      expect(impliedNow).toBeCloseTo(d.listPrice!, 0)
      expect(d.lastDropAmount).toBe(prev - now)
    }
  })
})

// ─── The read behind /price-drops (WP2, 2026-09-24) ───────────────────────

const sbMock = supabaseAnon as unknown as ReturnType<typeof vi.fn>
const tilesMock = getListingTiles as unknown as ReturnType<typeof vi.fn>

/** PostgREST answers at most this many rows per request, whatever .limit() asks. */
const POSTGREST_MAX_ROWS = 1000

type EventsResponse = { data: ActivityEventRow[] | null; error: { message: string } | null }

/**
 * A thenable activity_events builder that answers the way PostgREST does: a
 * `.range(from, to)` read gets that slice, any other read gets at most the
 * first 1,000 rows. With `failAt`, a read starting at or past that row errors.
 */
function eventsClient(rows: ActivityEventRow[], opts: { failAt?: number } = {}) {
  const ranges: Array<[number, number]> = []
  const orders: string[] = []
  const client = {
    from: (table: string) => {
      if (table !== 'activity_events') throw new Error(`unexpected table ${table}`)
      let from = 0
      let to = POSTGREST_MAX_ROWS - 1
      const builder = {
        select: () => builder,
        eq: () => builder,
        gte: () => builder,
        order: (column: string, o?: { ascending?: boolean }) => {
          orders.push(`${column} ${o?.ascending === false ? 'desc' : 'asc'}`)
          return builder
        },
        limit: (n: number) => {
          to = Math.min(n, POSTGREST_MAX_ROWS) - 1
          return builder
        },
        range: (a: number, b: number) => {
          ranges.push([a, b])
          from = a
          to = Math.min(b, a + POSTGREST_MAX_ROWS - 1)
          return builder
        },
        then: (resolve: (value: EventsResponse) => void) =>
          resolve(
            opts.failAt != null && from >= opts.failAt
              ? { data: null, error: { message: 'canceling statement due to statement timeout' } }
              : { data: rows.slice(from, to + 1), error: null },
          ),
      }
      return builder
    },
  }
  return { client, ranges, orders }
}

const NOW_MS = Date.now()

/** One price_drop event per key, newest first; `was` is the prior ask. */
function dropEvents(keys: readonly string[], was: (i: number) => number = () => 550_000): ActivityEventRow[] {
  return keys.map((key, i) => ({
    id: `e-${key}`,
    listing_key: key,
    event_type: 'price_drop',
    event_at: new Date(NOW_MS - (i + 1) * 60_000).toISOString(),
    payload: { ListNumber: `L-${key}`, previous_price: was(i), new_price: 500_000 },
  }))
}

/** An active, photographed single-family tile in Bend at $500,000. */
function sfrTile(key: string, over: Partial<ListingTile> = {}): ListingTile {
  return {
    listingKey: key,
    listNumber: `L-${key}`,
    status: 'Active',
    listPrice: 500_000,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: '100',
    streetName: 'Pine',
    streetSuffix: 'Ln',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: null,
    subdivisionSlug: null,
    lat: 44.05,
    lng: -121.3,
    photoUrl: 'https://photos.example/1.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: null,
    lotSizeAcres: null,
    yearBuilt: null,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 12,
    priceDropCount: 1,
    addressSlug: null,
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...over,
  }
}

/** getListingTiles answering a keyed read from a fixed set, as the MV would. */
function serveTiles(tiles: readonly ListingTile[]) {
  const byKey = new Map(tiles.map((t) => [t.listingKey, t]))
  tilesMock.mockImplementation(async ({ listingKeys }: { listingKeys: string[] }) =>
    listingKeys.map((key) => byKey.get(key)).filter((t): t is ListingTile => t != null),
  )
}

const keysOf = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(4, '0')}`)

beforeEach(() => {
  sbMock.mockReset()
  tilesMock.mockReset()
})

describe('getPriceDrops: single-family is the sub type, not the Residential bucket (§0, MARKET_TRUTH D1)', () => {
  it('keeps condos, townhomes and manufactured homes filed under property type A off the list', async () => {
    sbMock.mockReturnValue(eventsClient(dropEvents(['sfr', 'condo', 'town', 'mfg', 'nosub'])).client)
    serveTiles([
      sfrTile('sfr'),
      sfrTile('condo', { propertySubType: 'Condominium' }),
      sfrTile('town', { propertySubType: 'Townhouse' }),
      sfrTile('mfg', { propertySubType: 'Manufactured On Land' }),
      sfrTile('nosub', { propertySubType: null }),
    ])

    const result = await getPriceDrops({ limit: 48, days: 7 })

    expect(result.degraded).toBe(false)
    expect(result.drops.map((d) => d.listingKey)).toEqual(['sfr'])
    expect(result.total).toBe(1)
  })

  it('keeps a Single Family Residence sub type filed outside property type A off too', async () => {
    sbMock.mockReturnValue(eventsClient(dropEvents(['sfr', 'farm'])).client)
    serveTiles([sfrTile('sfr'), sfrTile('farm', { propertyType: 'E' })])

    const result = await getPriceDrops({ limit: 48, days: 7 })

    expect(result.drops.map((d) => d.listingKey)).toEqual(['sfr'])
  })
})

describe("getPriceDrops: the event read pages past PostgREST's 1,000-row response", () => {
  it('counts every home in a 1,250-event window, not the first 1,000', async () => {
    const keys = keysOf('k', 1250)
    const db = eventsClient(dropEvents(keys))
    sbMock.mockReturnValue(db.client)
    serveTiles(keys.map((key) => sfrTile(key)))

    const result = await getPriceDrops({ limit: 48, days: 7 })

    expect(result.total).toBe(1250)
    expect(result.drops).toHaveLength(48)
    expect(tilesMock.mock.calls[0]![0].listingKeys).toHaveLength(1250)
    expect(db.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    // A stable total order on every page, or range paging repeats and skips rows.
    expect(db.orders.slice(0, 3)).toEqual(['event_at desc', 'listing_key asc', 'id asc'])
  })

  it('treats a failed later page as a failed read, not a shorter window', async () => {
    const keys = keysOf('k', 1200)
    sbMock.mockReturnValue(eventsClient(dropEvents(keys), { failAt: 1000 }).client)
    serveTiles(keys.map((key) => sfrTile(key)))

    const result = await getPriceDrops({ limit: 48, days: 7 })

    expect(result.degraded).toBe(true)
    expect(result.drops).toEqual([])
  })
})

describe('getPriceDrops: a read that did not answer is not an empty week', () => {
  it('throws past an empty tile read for real keys, so the fallback says degraded and nothing is cached', async () => {
    sbMock.mockReturnValue(eventsClient(dropEvents(['a', 'b', 'c'])).client)
    // getListingTiles never throws: after its own retry it resolves to [].
    tilesMock.mockResolvedValue([])

    const result = await getPriceDrops({ limit: 48, days: 7 })

    expect(result).toMatchObject({ drops: [], total: 0, degraded: true })
    // The cached attempt threw, the uncached retry threw, then the fallback.
    expect(tilesMock).toHaveBeenCalledTimes(2)
  })

  it('degrades when the event read errors', async () => {
    sbMock.mockReturnValue(eventsClient(dropEvents(['a']), { failAt: 0 }).client)

    const result = await getPriceDrops({ limit: 48, days: 7 })

    expect(result.degraded).toBe(true)
    expect(tilesMock).not.toHaveBeenCalled()
  })

  it('degrades when there is no database client to read with', async () => {
    sbMock.mockReturnValue(null)

    const result = await getPriceDrops({ limit: 48, days: 7 })

    expect(result.degraded).toBe(true)
  })

  it('answers a quiet window as a real empty: degraded false, total 0', async () => {
    sbMock.mockReturnValue(eventsClient([]).client)

    const result = await getPriceDrops({ limit: 48, days: 7 })

    expect(result).toMatchObject({ drops: [], total: 0, degraded: false })
    expect(tilesMock).not.toHaveBeenCalled()
  })

  it('answers a window whose homes all fail the filters as a real empty too', async () => {
    sbMock.mockReturnValue(eventsClient(dropEvents(['condo'])).client)
    serveTiles([sfrTile('condo', { propertySubType: 'Condominium' })])

    const result = await getPriceDrops({ limit: 48, days: 7 })

    expect(result).toMatchObject({ drops: [], total: 0, degraded: false })
  })
})

describe('getPriceDrops: total is the population, the list is cut at the cap it reports', () => {
  it('region: 70 cuts in the window, 48 on the list, cap 48', async () => {
    const keys = keysOf('r', 70)
    sbMock.mockReturnValue(eventsClient(dropEvents(keys)).client)
    serveTiles(keys.map((key, i) => sfrTile(key, { city: i % 2 === 0 ? 'Bend' : 'Redmond' })))

    const result = await getPriceDrops({ limit: 48, days: 7 })

    expect(result.total).toBe(70)
    expect(result.cap).toBe(48)
    expect(result.drops).toHaveLength(48)
  })

  it('city: the list holds the limit the page asked for, and the count stays the city population', async () => {
    const keys = keysOf('c', 60)
    sbMock.mockReturnValue(eventsClient(dropEvents(keys)).client)
    serveTiles(keys.map((key, i) => sfrTile(key, { city: i < 50 ? 'Bend' : 'Redmond' })))

    const result = await getPriceDrops({ city: 'Bend', limit: 48, days: 7 })

    expect(result.total).toBe(50)
    expect(result.cap).toBe(48)
    expect(result.drops).toHaveLength(48)
    expect(result.drops.every((d) => d.city === 'Bend')).toBe(true)
  })

  it('the cap keeps the deepest cuts', async () => {
    const keys = keysOf('p', 5)
    // Prior asks 510K..550K over a $500K ask: the last key is the deepest cut.
    sbMock.mockReturnValue(eventsClient(dropEvents(keys, (i) => 510_000 + i * 10_000)).client)
    serveTiles(keys.map((key) => sfrTile(key)))

    const result = await getPriceDrops({ limit: 2, days: 7 })

    expect(result.total).toBe(5)
    expect(result.cap).toBe(2)
    expect(result.drops.map((d) => d.listingKey)).toEqual(['p0004', 'p0003'])
  })
})

describe('getPriceDropDigest: count is every cut in the window, not a capped list', () => {
  it('counts and sums all 70 region cuts', async () => {
    const keys = keysOf('d', 70)
    sbMock.mockReturnValue(eventsClient(dropEvents(keys)).client)
    serveTiles(keys.map((key) => sfrTile(key)))

    const digest = await getPriceDropDigest('central-oregon', 7)

    expect(digest.count).toBe(70)
    expect(digest.totalReduced).toBe(70 * 50_000)
    expect(digest.degraded).toBe(false)
  })

  it('degrades instead of passing off a zero count when the read fails', async () => {
    sbMock.mockReturnValue(eventsClient(dropEvents(['a']), { failAt: 0 }).client)

    const digest = await getPriceDropDigest('central-oregon', 7)

    expect(digest).toMatchObject({ count: 0, degraded: true })
  })
})
