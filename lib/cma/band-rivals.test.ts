import { describe, expect, it } from 'vitest'
import {
  bandAroundList,
  buildBandRivalSet,
  competitorCutLine,
  pickBandRivals,
  renderBandRivalsHtml,
  rivalAddress,
  type CmaBandRival,
} from '@/lib/cma/band-rivals'
import type { CompArea } from '@/lib/pricing/comp-area'

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
    originalListPrice: over.originalListPrice ?? null,
    onMarketDate: over.onMarketDate ?? null,
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
    expect(picked.filter((r) => r.status === 'Active')).toHaveLength(4)
    expect(picked.filter((r) => r.status === 'Pending')).toHaveLength(4)
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
    expect(picked).toHaveLength(4)
  })

  it('keeps similar beds and size ahead of a nearer mismatch', () => {
    const picked = pickBandRivals(
      [
        rival({
          listingKey: 'NEAR',
          address: '1 Near',
          beds: 2,
          sqft: 880,
          latitude: 44.2701,
          longitude: -121.17,
        }),
        rival({
          listingKey: 'FIT',
          address: '9 Fit',
          beds: 3,
          sqft: 1440,
          latitude: 44.275,
          longitude: -121.17,
        }),
      ],
      { latitude: 44.27, longitude: -121.17, beds: 3, sqft: 1440 },
    )
    expect(picked.map((r) => r.address)).toEqual(['9 Fit'])
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
    expect(html).toContain('Who you would compete with at')
    expect(html).toContain('123 Heritage')
    expect(html).toContain('88 Ranch')
    expect(html).toContain('$469,000')
    // Cards, four and four (CMA_REIMAGINED_2026-09-07.md chapter 4).
    expect(html).toContain('rival-grid')
    expect(html).toContain('rival-card')
    expect(html).not.toContain('rival-row')
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
    // "$25,250 above, 160 sqft smaller, 30 years older" — the referent is the
    // chapter title, which names the price.
    expect(html).toContain('$25,250 above, 160 sqft smaller, 30 years older')
    expect(html).toContain('0 days on market')
    // The seller's own row is gone: the delta line on each card is the
    // comparison, and repeating their home as a row was a third statement of
    // facts chapters 1 and 3 already carry.
    expect(html).not.toContain('This home')
    expect(html).not.toContain('is-subject')
    expect(html).toContain('$392,000')
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

describe('who has already come down', () => {
  // Delta 1: "Every active and pending row carries its price history line and
  // days on market too, so the reader sees which competitors have already cut.
  // Sentence: how many have cut, median cut."
  const listed = (over: Partial<CmaBandRival>) =>
    rival({ onMarketDate: '2026-06-01', ...over })

  it('counts the cuts over the homes this chapter prints, and states the median', () => {
    const line = competitorCutLine([
      listed({ listingKey: 'A', originalListPrice: 500000, listPrice: 470000 }),
      listed({ listingKey: 'B', originalListPrice: 480000, listPrice: 470000 }),
      listed({ listingKey: 'C', originalListPrice: 460000, listPrice: 460000 }),
      listed({ listingKey: 'D', originalListPrice: 455000, listPrice: 455000 }),
    ])
    expect(line).toBe('2 of the 4 homes below have already come down, a median cut of $20,000, or 4.0 percent.')
  })

  it('says so plainly when nothing has come down', () => {
    expect(
      competitorCutLine([
        listed({ listingKey: 'A', originalListPrice: 470000, listPrice: 470000 }),
        listed({ listingKey: 'B', originalListPrice: 460000, listPrice: 460000 }),
      ]),
    ).toBe('None of the 2 homes below has come down from its opening price.')
  })

  it('leaves out a home whose opening ask is not on the record rather than assuming it never cut', () => {
    const line = competitorCutLine([
      listed({ listingKey: 'A', originalListPrice: 500000, listPrice: 470000 }),
      listed({ listingKey: 'B', originalListPrice: null, listPrice: 470000 }),
    ])
    expect(line).toBe('The one home below has already come down, a median cut of $30,000, or 6.0 percent.')
    expect(competitorCutLine([listed({ originalListPrice: null })])).toBeNull()
  })

  it('draws each competitor its own price path on the card', () => {
    const html = renderBandRivalsHtml({
      city: 'Redmond',
      lo: 400000,
      hi: 480000,
      activeCount: 12,
      pendingCount: 3,
      recommendedList: 440000,
      rivals: [listed({ listingKey: 'A', originalListPrice: 500000, listPrice: 470000 })],
    })
    expect(html).toContain('class="pp-wrap is-compact"')
    expect(html).toContain('data-path="rival-A"')
    // The opening ask and the ask today are both on the drawing, so the cut
    // sentence above it can be checked against the picture.
    expect(html).toContain('$500K')
    // The card prints the ask today in 24px type right above the drawing, so
    // the drawing does not repeat it — the reading does, for a screen reader.
    expect(html).toContain('later asked $470K, date not recorded, still for sale')
    expect(html).toContain('already come down')
  })
})

describe('buildBandRivalSet — the competition is the neighborhood, never the city', () => {
  const OLD_BEND: CompArea = {
    kind: 'neighborhood',
    names: ['Old Bend'],
    radiusMiles: null,
    centre: { lat: 44.0554, lng: -121.3153 },
    source: 'test',
    sentence: 'Old Bend, the neighborhood around your home.',
  }
  const CIRCLE: CompArea = {
    kind: 'radius',
    names: [],
    radiusMiles: 1,
    centre: { lat: 44.2726, lng: -121.1739 },
    source: 'test',
    sentence: 'Within one mile of your home.',
  }

  it('names the area in the sentence and carries the area on the set', () => {
    const set = buildBandRivalSet({
      area: OLD_BEND,
      lo: 350_000,
      hi: 428_000,
      activeCount: 27,
      pendingCount: 14,
      rivals: [
        rival({ listingKey: 'A1', address: '10 Aspen', status: 'Active' }),
        rival({ listingKey: 'A2', address: '20 Birch', status: 'Active' }),
        rival({ listingKey: 'P1', address: '30 Cedar', status: 'Pending' }),
      ],
      subject: { latitude: 44.0554, longitude: -121.3153, beds: 3, sqft: 1280 },
    })
    expect(set.area).toBe(OLD_BEND)
    expect(set.sentence).toBe(
      '27 homes are for sale in Old Bend between $350,000 and $428,000. 14 are under contract. The nearest three like yours are below.',
    )
    expect(set.rivals.map((r) => r.address)).toEqual(['10 Aspen', '20 Birch', '30 Cedar'])
  })

  it('says the radius when the subject sits outside every boundary', () => {
    const set = buildBandRivalSet({
      area: CIRCLE,
      lo: 400_000,
      hi: 480_000,
      activeCount: 4,
      pendingCount: 0,
      rivals: [rival({ listingKey: 'A1', address: '10 Aspen', status: 'Active' })],
      subject: { latitude: 44.2726, longitude: -121.1739, beds: 3, sqft: 1280 },
    })
    expect(set.sentence).toContain('for sale within one mile of your home between $400,000 and $480,000')
    expect(set.sentence).toContain('None are under contract right now.')
  })

  it('says plainly when nothing in the area is for sale in the band', () => {
    const set = buildBandRivalSet({
      area: OLD_BEND,
      lo: 350_000,
      hi: 428_000,
      activeCount: 0,
      pendingCount: 0,
      rivals: [],
      subject: null,
    })
    expect(set.rivals).toEqual([])
    expect(set.sentence).toBe(
      'No home in Old Bend is for sale between $350,000 and $428,000, and none is under contract.',
    )
  })

  it('carries a source line naming the area, the band and the day', () => {
    const set = buildBandRivalSet({
      area: OLD_BEND,
      lo: 350_000,
      hi: 428_000,
      activeCount: 27,
      pendingCount: 14,
      rivals: [],
      subject: null,
      asOfIso: '2026-09-08T12:00:00.000Z',
    })
    expect(set.source).toContain('Old Bend')
    expect(set.source).toContain('$350,000')
    expect(set.source).toContain('Oregon Data Share MLS')
  })
})

describe('bandAroundList', () => {
  it('is the same ten percent either side the competition chapter has always used', () => {
    expect(bandAroundList(475_000)).toEqual({ lo: 428_000, hi: 523_000 })
    expect(bandAroundList(0)).toBeNull()
  })
})
