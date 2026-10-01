import { describe, expect, it, vi } from 'vitest'
import { currentPriceDrop, parseActivityPriceDrop } from './attachListingCardExtras'

describe('parseActivityPriceDrop', () => {
  it('keeps a current cut with a date', () => {
    expect(
      parseActivityPriceDrop(
        { previous_price: 850000, new_price: 825000 },
        '2026-08-20T17:00:00.000Z',
      ),
    ).toEqual({
      previousPrice: 850000,
      newPrice: 825000,
      at: '2026-08-20T17:00:00.000Z',
    })
  })

  it('drops a recovered / relisted raise', () => {
    expect(
      parseActivityPriceDrop(
        { previous_price: 229000, new_price: 299000 },
        '2026-08-20T17:00:00.000Z',
      ),
    ).toBeNull()
  })

  it('drops an undated payload', () => {
    expect(parseActivityPriceDrop({ previous_price: 850000, new_price: 825000 }, '')).toBeNull()
  })
})

describe('attachListingCardExtras when one of its two reads fails', () => {
  /** A thenable builder: every chained method returns itself, awaiting it gives `result`. */
  function builder(result: { data: unknown; error: unknown }) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'in', 'eq', 'order', 'limit', 'gte']) b[m] = () => b
    b.then = (resolve: (v: unknown) => unknown) => resolve(result)
    return b
  }

  it('keeps the price drops when the listings read fails, and says so in the log', async () => {
    vi.resetModules()
    vi.doMock('@/lib/data/client', () => ({
      supabaseAnon: () => ({
        from: (table: string) =>
          table === 'listings'
            ? builder({ data: null, error: { message: 'column listings.x does not exist' } })
            : builder({
                data: [{ listing_key: 'K1', event_at: '2026-09-28T17:00:00.000Z', payload: { previous_price: 900000, new_price: 850000 } }],
                error: null,
              }),
      }),
    }))
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { attachListingCardExtras } = await import('./attachListingCardExtras')
    const out = await attachListingCardExtras(['K1', 'K2'])
    expect(out.get('K1')).toEqual({
      originalListPrice: null,
      tourUrl: null,
      listOfficeName: null,
      photoUrls: [],
      priceDrop: { previousPrice: 900000, newPrice: 850000, at: '2026-09-28T17:00:00.000Z' },
    })
    expect(out.has('K2')).toBe(false)
    expect(logged).toHaveBeenCalledWith('[attachListingCardExtras] listings read failed', 'column listings.x does not exist')
    logged.mockRestore()
    vi.doUnmock('@/lib/data/client')
  })

  it('reads the photo list from the Photos projection, sized for the card', async () => {
    vi.resetModules()
    vi.doMock('@/lib/data/client', () => ({
      supabaseAnon: () => ({
        from: (table: string) =>
          table === 'listings'
            ? builder({
                data: [
                  {
                    ListingKey: 'K1',
                    OriginalListPrice: '925000',
                    virtual_tour_url: ' https://tour.example/k1 ',
                    ListOfficeName: 'Ryan Realty',
                    PhotoURL: null,
                    Photos: [{ Uri1600: 'https://cdn.example/a-1600.jpg' }, { Uri800: 'https://cdn.example/b-800.jpg' }],
                  },
                ],
                error: null,
              })
            : builder({ data: [], error: null }),
      }),
    }))
    const { attachListingCardExtras } = await import('./attachListingCardExtras')
    const out = await attachListingCardExtras(['K1'])
    const k1 = out.get('K1')
    expect(k1?.originalListPrice).toBe(925000)
    expect(k1?.tourUrl).toBe('https://tour.example/k1')
    expect(k1?.listOfficeName).toBe('Ryan Realty')
    expect(k1?.photoUrls).toHaveLength(2)
    expect(k1?.priceDrop).toBeNull()
    vi.doUnmock('@/lib/data/client')
  })
})

describe('loadRecentPriceDropEvents pages the price_drop events (SITE-212 review)', () => {
  it('reads past 1,000 rows in (event_at, id) order, keeps only drops, newest per listing', async () => {
    // 1,500 events, newest first: K0..K1399 each dropped once; K5 also has an
    // older drop; K7's newest event is a raise logged as price_drop.
    const rows: Array<{ listing_key: string; event_at: string; payload: unknown }> = []
    for (let i = 0; i < 1400; i += 1) {
      const at = new Date(Date.UTC(2026, 8, 30) - i * 60_000).toISOString()
      rows.push(
        i === 7
          ? { listing_key: 'K7', event_at: at, payload: { previous_price: 500000, new_price: 525000 } }
          : { listing_key: `K${i}`, event_at: at, payload: { previous_price: 500000, new_price: 480000 } },
      )
    }
    for (let i = 0; i < 100; i += 1) {
      const at = new Date(Date.UTC(2026, 8, 20) - i * 60_000).toISOString()
      rows.push({ listing_key: i === 0 ? 'K5' : `OLD${i}`, event_at: at, payload: { previous_price: 600000, new_price: 590000 } })
    }
    const calls: Array<{ orders: string[]; range: [number, number] }> = []
    vi.resetModules()
    vi.doMock('@/lib/data/client', () => ({
      supabaseAnon: () => ({
        from: () => {
          const call = { orders: [] as string[], range: [0, 0] as [number, number] }
          const b: Record<string, unknown> = {}
          for (const m of ['select', 'eq', 'gte']) b[m] = () => b
          b.order = (column: string) => {
            call.orders.push(column)
            return b
          }
          b.range = (from: number, to: number) => {
            call.range = [from, to]
            calls.push(call)
            return { then: (resolve: (v: unknown) => unknown) => resolve({ data: rows.slice(from, to + 1), error: null }) }
          }
          return b
        },
      }),
    }))
    const { loadRecentPriceDropEvents } = await import('./attachListingCardExtras')
    const drops = await loadRecentPriceDropEvents(30)
    expect(calls.map((c) => c.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    expect(calls.every((c) => c.orders.join(',') === 'event_at,id')).toBe(true)
    expect(drops.has('K1399')).toBe(true) // only on the second page
    expect(drops.has('OLD99')).toBe(true)
    expect(drops.has('K7')).toBe(false) // a raise is not a drop
    expect(drops.get('K5')?.newPrice).toBe(480000) // the newest drop wins
    expect(drops.size).toBe(1399 + 99)
    vi.doUnmock('@/lib/data/client')
  })
})

describe('currentPriceDrop (the badge shows a drop only while it is current)', () => {
  const drop = { previousPrice: 500000, newPrice: 480000, at: '2026-09-20T17:00:00.000Z' }

  it('keeps a drop while the ask is still below the previous price', () => {
    expect(currentPriceDrop(drop, 480000)).toBe(drop)
    expect(currentPriceDrop(drop, '475000')).toBe(drop)
  })

  it('drops it once the ask was raised back to or above the previous price', () => {
    // A cut followed by a raise: deltaSync writes the raise as price_increase,
    // which the drop read never sees, so the ask is the only witness.
    expect(currentPriceDrop(drop, 520000)).toBeNull()
    expect(currentPriceDrop(drop, 500000)).toBeNull()
  })

  it('says nothing without a drop or a usable ask', () => {
    expect(currentPriceDrop(undefined, 480000)).toBeNull()
    expect(currentPriceDrop(drop, null)).toBeNull()
    expect(currentPriceDrop(drop, 'call for price')).toBeNull()
    expect(currentPriceDrop(drop, 0)).toBeNull()
  })
})
