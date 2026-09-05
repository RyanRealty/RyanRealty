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
    beds: over.beds ?? 3,
    baths: over.baths ?? 2,
    sqft: over.sqft ?? 1280,
    yearBuilt: over.yearBuilt ?? 1974,
    lotAcres: over.lotAcres ?? 0.16,
    propertySubType: over.propertySubType ?? 'Single Family Residence',
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
  it('keeps the nearest homes, actives and pendings separately, up to the cap', () => {
    const actives = Array.from({ length: 24 }, (_, i) =>
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
    expect(picked.filter((r) => r.status === 'Active')).toHaveLength(24)
    expect(picked.filter((r) => r.status === 'Pending')).toHaveLength(10)
    expect(picked[0]?.address).toBe('100 Active')
  })

  it('caps a huge band so the report cannot print thousands of rows', () => {
    const actives = Array.from({ length: 90 }, (_, i) =>
      rival({
        listingKey: `A${i}`,
        address: `${100 + i} Active`,
        status: 'Active',
        latitude: 44.27 + i * 0.01,
        longitude: -121.17,
      }),
    )
    const picked = pickBandRivals(actives, { latitude: 44.27, longitude: -121.17 })
    expect(picked).toHaveLength(80)
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
    expect(html).toContain('88 Ranch')
    expect(html).toContain('$469,000')
    expect(html).toContain('rival-list')
    expect(html).toContain('rival-row')
    expect(html).not.toContain('rival-grid')
    expect(html).not.toMatch(/Supabase|not the ZIP|confidence/i)
  })

  it('puts house stats next to a thumbnail and measures them against the subject', () => {
    const html = renderBandRivalsHtml({
      city: 'Redmond',
      lo: 353000,
      hi: 431000,
      activeCount: 29,
      pendingCount: 12,
      rivals: [
        rival({
          address: '825 Poplar',
          listPrice: 417250,
          beds: 3,
          baths: 2,
          sqft: 1280,
          yearBuilt: 1974,
          daysOnMarket: 0,
        }),
      ],
      subject: {
        beds: 3,
        baths: 2,
        sqft: 1440,
        yearBuilt: 2004,
        lotAcres: 0.14,
        recommendedList: 392000,
        latitude: 44.27,
        longitude: -121.17,
        photoUrl: 'https://cdn.example/subject.jpg',
      },
    })
    expect(html).toContain('825 Poplar')
    expect(html).toContain('3 bd')
    expect(html).toContain('1,280 sqft')
    expect(html).toContain('$25,250 above this list')
    expect(html).toContain('160 sqft smaller')
    expect(html).toContain('0 days')
    expect(html).toContain('This home')
    expect(html).toContain('1,440 sqft')
    expect(html).toContain('$392,000')
    expect(html).toContain('is-subject')
    expect(html).toContain('https://cdn.example/subject.jpg')
  })

  it('names bed and bath gaps against the subject', () => {
    const html = renderBandRivalsHtml({
      city: 'Redmond',
      lo: 353000,
      hi: 431000,
      activeCount: 1,
      pendingCount: 0,
      rivals: [rival({ address: '12 Pine', beds: 4, baths: 3, listPrice: 417250 })],
      subject: {
        beds: 3,
        baths: 2,
        sqft: 1440,
        yearBuilt: 2004,
        lotAcres: 0.14,
        recommendedList: 392000,
        latitude: 44.27,
        longitude: -121.17,
      },
    })
    expect(html).toContain('1 more bed')
    expect(html).toContain('1 more bath')
  })
})
