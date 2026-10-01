import { describe, expect, it, vi } from 'vitest'
import { parseActivityPriceDrop } from './attachListingCardExtras'

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
