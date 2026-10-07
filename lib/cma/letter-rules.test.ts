import { describe, expect, it } from 'vitest'
import { askExposureSentence } from '@/lib/cma/ask-story'
import { activeRivalsFor, matrixSetsFromArgs, unsoldPeersFor } from '@/lib/cma/matrix-sets'
import { competitionPage, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CmaBandRival } from '@/lib/cma/band-rivals'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import { pricePathFromFinalCycle } from '@/lib/cma/price-path'
import { didNotSellLeadSentence } from '@/lib/cma/did-not-sell'
import { buildCompArea, resolveCompetitionArea } from '@/lib/pricing/comp-area'
import { letterPlaceChecks } from '@/lib/cma/letter-consistency'

function rival(over: Partial<CmaBandRival>): CmaBandRival {
  return {
    listingKey: over.listingKey ?? 'K',
    address: over.address ?? '1 Main',
    listPrice: 500000,
    status: 'Active',
    daysOnMarket: 10,
    photoUrl: null,
    latitude: 44.05,
    longitude: -121.31,
    propertySubType: 'Single Family Residence',
    ...over,
  }
}

function peer(over: Partial<CmaExpiredPeer>): CmaExpiredPeer {
  return {
    listingKey: over.listingKey ?? 'P',
    address: over.address ?? '2 Main',
    listPrice: 480000,
    originalListPrice: 490000,
    status: 'Expired',
    daysOnMarket: 40,
    onMarketDate: '2026-01-01',
    photoUrl: null,
    listingHistoryLine: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    yearBuilt: 1990,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    latitude: 44.05,
    longitude: -121.31,
    ...over,
  }
}

describe('letter rules that cannot be skipped', () => {
  it('drops a townhome rival and a townhome expired against a detached house', () => {
    const subject = { propertySubType: 'Single Family Residence', listingKey: 'S', mlsNumber: '1', streetAddress: '9 Subject' }
    const rivals = activeRivalsFor(
      [
        rival({ listingKey: 'house', address: '10 House' }),
        rival({ listingKey: 'town', address: '19350 Laurelhurst', propertySubType: 'Townhouse' }),
        rival({ listingKey: 'condo', address: '4 Condo', propertySubType: 'Condominium' }),
      ],
      subject,
    )
    expect(rivals.map((r) => r.address)).toEqual(['10 House'])
    const peers = unsoldPeersFor({
      subject,
      peers: [
        peer({ listingKey: 'e1', address: '11 Expired' }),
        peer({ listingKey: 'e2', address: '12 Townhome', propertySubType: 'Townhouse', status: 'Canceled' }),
      ],
    })
    expect(peers.map((p) => p.address)).toEqual(['11 Expired'])
  })

  it('does not widen competition past the subdivision the sales used', () => {
    const subject = { latitude: 44.06, longitude: -121.31, subdivision: 'Awbrey Glen', city: 'Bend' }
    const compArea = buildCompArea({
      subject,
      rungs: [{ key: 'subdivision-12mo', kept: 4, added: 4 }],
      keptComps: [
        { subdivision: 'Awbrey Glen', selectionTier: 'subdivision-12mo', latitude: 44.06, longitude: -121.31 },
        { subdivision: 'Awbrey Glen', selectionTier: 'subdivision-12mo', latitude: 44.061, longitude: -121.31 },
      ],
    })!
    const rings = resolveCompetitionArea({
      compArea,
      subject: { latitude: subject.latitude, longitude: subject.longitude, city: 'Bend' },
      keptComps: [
        { subdivision: 'Awbrey Glen', selectionTier: 'subdivision-12mo', latitude: 44.2, longitude: -121.31 },
      ],
    })
    expect(rings).toHaveLength(1)
    expect(rings[0]!.kind).toBe('subdivision')
    expect(rings.some((r) => r.kind === 'radius')).toBe(false)
    expect(rings.some((r) => r.radiusMiles === 0.5 || r.radiusMiles === 1 || r.radiusMiles === 2 || r.radiusMiles === 5)).toBe(false)
    expect(
      didNotSellLeadSentence({
        market: null,
        city: 'Bend',
        compArea,
      }),
    ).toBe('')
  })

  it('drops an expired home stored outside the sales plats even when it names a subdivision (Matt 2026-10-07)', () => {
    const area = {
      kind: 'subdivisions' as const,
      names: ['Hampton Park', 'Deer Pointe Village'],
      radiusMiles: null,
      centre: { lat: 44.075, lng: -121.294 },
      source: 'test',
      sentence: 'Hampton Park and the one subdivision next to it.',
    }
    const subject = {
      propertySubType: 'Single Family Residence',
      listingKey: 'S',
      mlsNumber: '1',
      streetAddress: '2566 Keats',
    }
    const peers = unsoldPeersFor({
      subject,
      area,
      peers: [
        peer({ listingKey: 'near', address: '2515 Keats', subdivision: 'Hampton Park' }),
        peer({ listingKey: 'rum', address: '1482 Rumgay', subdivision: 'Quiet Canyon' }),
        peer({ listingKey: 'maker', address: '1816 Maker', subdivision: 'Village Wiestoria' }),
        peer({
          listingKey: 'blank',
          address: '9 Nowhere',
          subdivision: null,
          latitude: 45.2,
          longitude: -120.1,
        }),
      ],
    })
    expect(peers.map((p) => p.address)).toEqual(['2515 Keats'])
  })

  it('drops an old-row rival outside the sales area even when bandRivals.area is a wider polygon (Matt 2026-10-07)', () => {
    const compArea = {
      kind: 'subdivisions' as const,
      names: ['Rooster Rock', 'Madison Park'],
      radiusMiles: null,
      centre: { lat: 44.03, lng: -121.27 },
      source: 'test',
      sentence: 'Rooster Rock and the one subdivision next to it.',
    }
    const mountainView = {
      kind: 'neighborhood' as const,
      names: ['Mountain View'],
      radiusMiles: null,
      centre: { lat: 44.03, lng: -121.27 },
      source: 'old row, widened 2026-10-06',
      sentence: 'Mountain View, the neighborhood around your home.',
    }
    const sets = matrixSetsFromArgs({
      subject: {
        listingKey: 'S',
        mlsNumber: '1',
        streetAddress: '3177 Coho',
        propertySubType: 'Single Family Residence',
      },
      compArea,
      bandRivals: {
        area: mountainView,
        rivals: [
          rival({ listingKey: 'ald', address: '2820 Aldrich', subdivision: 'Rooster Rock', latitude: 44.03, longitude: -121.27 }),
          rival({ listingKey: 'hp', address: '20 High Pointe', subdivision: 'High Pointe', latitude: 44.03, longitude: -121.27 }),
        ],
      },
    })
    expect(sets.active.map((r) => r.address)).toEqual(['2820 Aldrich'])

    // The chapter then counts the set it draws, not the stored "nearest four"
    // written over the wider polygon (rule 17).
    const page = competitionPage({
      subject: {
        listingKey: 'S',
        mlsNumber: '1',
        streetAddress: '3177 Coho',
        city: 'Bend',
        subdivision: 'Rooster Rock',
        propertySubType: 'Single Family Residence',
        beds: 3,
        baths: 2,
        sqft: 1458,
        yearBuilt: 2018,
        latitude: 44.03,
        longitude: -121.27,
      },
      comps: [],
      pricing: { recommended: 549_000, valueLow: 513_000, valueHigh: 564_000, notes: [] },
      compArea,
      bandRivals: {
        area: mountainView,
        lo: 494_000,
        hi: 604_000,
        activeCount: 9,
        pendingCount: 0,
        rivals: [
          rival({ listingKey: 'ald', address: '2820 Aldrich', subdivision: 'Rooster Rock', latitude: 44.03, longitude: -121.27 }),
          rival({ listingKey: 'hp', address: '20 High Pointe', subdivision: 'High Pointe', latitude: 44.03, longitude: -121.27 }),
        ],
        sentence:
          'The nearest two like yours are for sale in Mountain View between $494,000 and $604,000. None are under contract right now.',
        source: 'test',
        widenedFrom: null,
        ringsTried: [],
      },
      generatedAtIso: '2026-10-07T00:00:00.000Z',
    } as unknown as OpinionPageArgs)
    expect(page?.body).toContain('1 home is for sale between $494,000 and $604,000.')
    expect(page?.body).not.toContain('nearest two')
    expect(page?.body).not.toContain('Mountain View between')
    expect(page?.body).not.toContain('20 High Pointe')
  })

  it('drops a detached rival that sits outside the sales plat', () => {
    const area = {
      kind: 'subdivision' as const,
      names: ['Awbrey Glen'],
      radiusMiles: null,
      centre: { lat: 44.06, lng: -121.31 },
      source: 'test',
      sentence: 'In Awbrey Glen.',
    }
    const kept = activeRivalsFor(
      [
        rival({ listingKey: 'in', address: '1 Glen', subdivision: 'Awbrey Glen' }),
        rival({ listingKey: 'out', address: '19350 Laurelhurst', subdivision: 'Laurelhurst' }),
      ],
      { propertySubType: 'Single Family Residence' },
      area,
    )
    expect(kept.map((r) => r.address)).toEqual(['1 Glen'])
  })

  it('does not give a price change under 1 percent its own era', () => {
    const path = pricePathFromFinalCycle(
      {
        listDate: '2026-01-01',
        initialAsk: 500000,
        cuts: [
          { date: '2026-02-01', ask: 498000 },
          { date: '2026-03-01', ask: 470000 },
        ],
        cutsDated: true,
        finalAsk: 470000,
        offMarketDate: '2026-04-01',
        status: 'Expired',
        days: 90,
      },
      '9 Subject',
    )!
    expect(path.cuts).toEqual([{ date: '2026-03-01', price: 470000 }])
    expect(
      askExposureSentence([
        { ask: 500000, days: 30 },
        { ask: 498000, days: 10 },
        { ask: 470000, days: 20 },
      ]),
    ).toBe('You asked $500,000 for 40 days, then $470,000 for 20.')
  })

  it('refuses a townhouse letter that still uses a mile ring, a citywide count, or a single-family chart', () => {
    const bad = letterPlaceChecks(
      'Within two miles of your home. Came off unsold 803 listings. Single-family homes in Bend.',
      {
        compArea: { kind: 'subdivision', sentence: 'Copperstone, your own subdivision.' },
        propertySubType: 'Townhouse',
        listingMarket: { place: 'Copperstone', productNoun: 'townhouse' },
        citywideListingCounts: [803, 1201, 1008],
      },
    )
    expect(bad.filter((c) => !c.pass).map((c) => c.id)).toEqual([
      'sales-place-not-a-mile-ring',
      'sales-place-sentence',
      'no-citywide-count',
      'chart-matches-product',
      'listing-chart-place',
      'listing-chart-product',
    ])
    const good = letterPlaceChecks(
      'Copperstone, your own subdivision. While your home was listed, the median townhouse sale in Copperstone fell. Townhouses in Copperstone.',
      {
        compArea: { kind: 'subdivision', sentence: 'Copperstone, your own subdivision.' },
        propertySubType: 'Townhouse',
        listingMarket: { place: 'Copperstone', productNoun: 'townhouse' },
        citywideListingCounts: [803, 1201, 1008],
      },
    )
    expect(good.every((c) => c.pass)).toBe(true)
  })

  it('refuses a competition sentence that counts a mile ring while the sales sit in named plats, and still refuses a bare ring caption (Matt 2026-10-07)', () => {
    // cma-711-georgia, 2026-10-07: the sales caption named Deschutes and Park
    // Addition; the competition, short inside those plats, widened to a mile
    // and said so in its own sentence. Since rule 24 that sentence cannot be
    // written inside a named place; the caption naming the ring that found a
    // plat is still not the sales sitting in a ring.
    const compArea = { kind: 'subdivisions' as const, sentence: 'Deschutes, and Park Addition within one mile of your home.' }
    const place = {
      compArea,
      propertySubType: 'Single Family Residence',
      listingMarket: { place: 'Deschutes', productNoun: 'home' },
      citywideListingCounts: [803, 1201, 1008],
    }
    const mixed = letterPlaceChecks(
      '<p class="small">Deschutes, and Park Addition within one mile of your home.</p><p>6 homes are for sale within one mile of your home between $623,000 and $1,038,000. 3 are under contract.</p><p class="source">Homes for sale and under contract within one mile of your home between $623,000 and $1,038,000, from the Oregon Data Share MLS as of Oct 7, 2026.</p>',
      place,
    )
    expect(mixed.find((c) => c.id === 'competition-not-a-mile-ring')?.pass).toBe(false)
    expect(mixed.find((c) => c.id === 'sales-place-sentence')?.pass).toBe(true)
    const bare = letterPlaceChecks(
      '<p class="small">Within one mile of your home. Every pin below sits inside it.</p><p>Deschutes, and Park Addition within one mile of your home.</p>',
      place,
    )
    expect(bare.find((c) => c.id === 'sales-place-not-a-mile-ring')?.pass).toBe(false)
    const captionOnly = letterPlaceChecks(
      '<p class="small">Deschutes, and Park Addition within one mile of your home.</p><p>No home like yours in Deschutes or Park Addition is for sale between $623,000 and $1,038,000, and none is under contract.</p>',
      place,
    )
    expect(captionOnly.find((c) => c.id === 'competition-not-a-mile-ring')?.pass).toBe(true)
    expect(captionOnly.find((c) => c.id === 'sales-place-not-a-mile-ring')?.pass).toBe(true)
    const expiredRing = letterPlaceChecks(
      '<p class="small">Deschutes, and Park Addition within one mile of your home.</p><p>Three homes within one mile of your home came off the market without selling in the last 12 months.</p>',
      place,
    )
    expect(expiredRing.find((c) => c.id === 'competition-not-a-mile-ring')?.pass).toBe(false)
  })

  it('passes a letter whose chapters stay inside the sales plats (Matt 2026-10-07, 3177 Coho)', () => {
    const checks = letterPlaceChecks(
      '<p class="small">Rooster Rock and the one subdivision next to it.</p><p>2 homes like yours are for sale in Rooster Rock and Madison Park between $494,000 and $604,000. 1 is under contract.</p><p>No home in Rooster Rock or Madison Park came off the market without selling in the last 12 months.</p>',
      {
        compArea: { kind: 'subdivisions', sentence: 'Rooster Rock and the one subdivision next to it.' },
        propertySubType: 'Single Family Residence',
        listingMarket: { place: 'Rooster Rock', productNoun: 'home' },
        citywideListingCounts: [803, 1201, 1008],
      },
    )
    expect(checks.map((c) => c.id)).toContain('competition-not-a-mile-ring')
    expect(checks.every((c) => c.pass)).toBe(true)
  })
})
