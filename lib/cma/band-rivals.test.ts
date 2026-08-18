import { describe, expect, it } from 'vitest'
import {
  pickBandRivals,
  renderBandRivalsHtml,
  rivalAddress,
  type CmaBandRival,
} from '@/lib/cma/band-rivals'

function rival(over: Partial<CmaBandRival> = {}): CmaBandRival {
  return {
    listingKey: over.listingKey ?? 'K1',
    address: over.address ?? '12 Pine',
    listPrice: over.listPrice ?? 470000,
    status: over.status ?? 'Active',
    daysOnMarket: over.daysOnMarket ?? 12,
    photoUrl: over.photoUrl ?? null,
    latitude: over.latitude ?? 44.27,
    longitude: over.longitude ?? -121.17,
    beds: over.beds,
    baths: over.baths,
  }
}

describe('rivalAddress', () => {
  it('joins number and name and drops blanks', () => {
    expect(rivalAddress({ StreetNumber: '850', StreetName: 'Quince' })).toBe('850 Quince')
    expect(rivalAddress({ StreetNumber: '850', StreetName: null })).toBe('850')
    expect(rivalAddress({ StreetNumber: null, StreetName: null })).toBe('')
  })
})

describe('pickBandRivals', () => {
  it('keeps eight actives, nearest first, and drops pendings', () => {
    const actives = Array.from({ length: 12 }, (_, i) =>
      rival({
        listingKey: `A${i}`,
        address: `${100 + i} Active`,
        status: 'Active',
        latitude: 44.27 + i * 0.01,
        longitude: -121.17,
      }),
    )
    const pendings = Array.from({ length: 10 }, (_, i) =>
      rival({
        listingKey: `P${i}`,
        address: `${200 + i} Pending`,
        status: 'Pending',
        latitude: 44.27 + i * 0.02,
        longitude: -121.17,
      }),
    )
    const picked = pickBandRivals([...actives, ...pendings], { latitude: 44.27, longitude: -121.17 })
    expect(picked.filter((r) => r.status === 'Active')).toHaveLength(8)
    expect(picked.filter((r) => r.status === 'Pending')).toHaveLength(0)
    expect(picked[0]?.address).toBe('100 Active')
  })

  it('drops unnamed rows', () => {
    expect(pickBandRivals([rival({ address: '  ' })])).toEqual([])
  })
})

describe('renderBandRivalsHtml', () => {
  it('names the houses in the band', () => {
    const html = renderBandRivalsHtml({
      city: 'Redmond',
      lo: 427000,
      hi: 522000,
      activeCount: 2,
      pendingCount: 1,
      rivals: [
        rival({ address: '123 Heritage', listPrice: 469000, status: 'Active' }),
        rival({ listingKey: 'P1', address: '88 Ranch', listPrice: 479000, status: 'Pending' }),
      ],
    })
    expect(html).toContain('Who you are competing with at this price')
    expect(html).toContain('123 Heritage')
    expect(html).not.toContain('88 Ranch')
    expect(html).toContain('$469,000')
    expect(html).not.toMatch(/Supabase|not the ZIP|confidence/i)
    expect(html).not.toContain('Under contract')
  })

  it('names the same pricing search, not a 2-to-4 bedroom dump', () => {
    const html = renderBandRivalsHtml({
      city: 'Bend',
      lo: 400000,
      hi: 480000,
      activeCount: 1,
      pendingCount: 0,
      productLabel: 'same 2-mile search as the sales that set the number',
      rivals: [rival({ address: '648 Douglas', listPrice: 438000, beds: 3, baths: 1 })],
    })
    expect(html).toContain('same 2-mile search as the sales that set the number')
    expect(html).toContain('3 bed · 1 bath')
    expect(html).not.toMatch(/2 to 4 bedroom/)
    expect(html).not.toMatch(/3-bedroom, 1-bath set/)
  })
})
