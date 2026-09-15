/**
 * 1130 E Canter / Sisters residual after PR #242.
 * These contracts failed on the 2026-09-15 rebuild (inferred Rolling Horse
 * Meadow, widened to Clearpine). Tip Ready is this file + --ship.
 */
import { describe, expect, it } from 'vitest'
import { inferSubdivisionPocket } from '@/lib/pricing/infer-pocket'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

const CANTER = { latitude: 44.2908, longitude: -121.5493, city: 'Sisters', citySlug: 'sisters' }
const asOf = '2026-09-15'

function subject(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ-1130',
    streetAddress: '1130 E Canter',
    city: 'Sisters',
    citySlug: 'sisters',
    subdivision: null,
    subdivisionNorm: null,
    latitude: CANTER.latitude,
    longitude: CANTER.longitude,
    beds: 3,
    baths: 2,
    sqft: 1883,
    lotAcres: 0.2,
    yearBuilt: 2025,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: null,
    newConstruction: true,
    propertySubType: 'New Construction',
    publicRemarks: 'New construction 2025.',
    ...over,
  }
}

let seq = 0
function sale(over: Partial<PricingSale> = {}): PricingSale {
  seq += 1
  return {
    listingKey: over.listingKey ?? `K${seq}`,
    listNumber: over.listNumber ?? null,
    address: over.address ?? `${seq} Comp St`,
    city: 'Sisters',
    citySlug: 'sisters',
    subdivision: 'SaddleStone',
    subdivisionNorm: 'saddlestone',
    latitude: CANTER.latitude,
    longitude: CANTER.longitude,
    beds: 3,
    baths: 2,
    sqft: 1900,
    lotAcres: 0.2,
    yearBuilt: 2008,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 675_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: 685_000,
    lastAsk: 675_000,
    daysToOffer: 18,
    cdom: 32,
    dropCount: 1,
    closePpsf: 355,
    photoUrl: null,
    publicRemarks: null,
    ...over,
  }
}

function atMiles(miles: number): { latitude: number; longitude: number } {
  return { latitude: CANTER.latitude + miles / 69, longitude: CANTER.longitude }
}

const ranch = () =>
  sale({
    listingKey: 'RANCH-1058',
    listNumber: '220218584',
    address: '1058 E Ranch',
    subdivision: 'SaddleStone',
    subdivisionNorm: 'saddlestone',
    ...atMiles(0.16),
    closePrice: 685_000,
    lastAsk: 685_000,
    closePpsf: 360,
    yearBuilt: 2006,
    sqft: 1920,
    closeDate: '2026-05-12',
  })

const horseBackClosed = () =>
  sale({
    listingKey: 'HB-1025',
    listNumber: '220214720',
    address: '1025 E Horse Back',
    subdivision: 'Horse Back',
    subdivisionNorm: 'horse back',
    ...atMiles(0.12),
    closePrice: 675_000,
    lastAsk: 675_000,
    closePpsf: 355,
    yearBuilt: 2008,
    sqft: 1900,
    closeDate: '2026-04-20',
  })

const horseBackPending = () =>
  sale({
    listingKey: 'HB-1035',
    listNumber: '220224488',
    address: '1035 E Horse Back',
    subdivision: 'Horse Back',
    subdivisionNorm: 'horse back',
    ...atMiles(0.13),
    closePrice: 649_000,
    lastAsk: 649_000,
    closePpsf: 342,
    yearBuilt: 2010,
    sqft: 1880,
    closeDate: '2026-08-01',
  })

const rhmNearest = () =>
  sale({
    listingKey: 'RHM-1121',
    address: '1121 Canter Ct',
    subdivision: 'Rolling Horse Meadow',
    subdivisionNorm: 'rolling horse meadow',
    ...atMiles(0.04),
    closePrice: 720_000,
    lastAsk: 720_000,
    yearBuilt: 1998,
    sqft: 2100,
    closeDate: '2024-08-01',
  })

function upmarket(name: string, miles: number, price: number): PricingSale {
  return sale({
    listingKey: `UP-${name.replace(/\s+/g, '')}`,
    address: `191 ${name} Dr`,
    subdivision: name,
    subdivisionNorm: name.toLowerCase(),
    ...atMiles(miles),
    yearBuilt: 2024,
    sqft: 2000,
    closePrice: price,
    lastAsk: price,
    closePpsf: price / 2000,
    closeDate: '2026-07-01',
    publicRemarks: 'Custom built modern home. New construction.',
    newConstruction: true,
  })
}

const decoys = () => [
  upmarket('Clearpine', 2.1, 890_000),
  upmarket('Forest Edge', 2.4, 860_000),
  upmarket('Grand Peaks', 2.6, 840_000),
  upmarket('McKenzie Meadow', 2.8, 820_000),
  upmarket('Sunset Meadows', 2.3, 800_000),
]

describe('1130 E Canter Sisters pocket residual', () => {
  it('contract: blank-subdiv-infers-saddlestone-cluster', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: null,
      streetAddress: '1130 E Canter',
      ...CANTER,
      neighbors: [rhmNearest(), ranch(), horseBackClosed(), sale({
        address: '1 SaddleStone Ln',
        subdivision: 'SaddleStone',
        subdivisionNorm: 'saddlestone',
        ...atMiles(0.15),
      })],
    })
    expect(pocket.subdivision).not.toBe('Rolling Horse Meadow')
    expect(['SaddleStone', 'Horse Back', 'Ranch']).toContain(pocket.subdivision)
    expect(pocket.source).toBe('street-cluster')
  })

  it('contract: exclusive-while-tight-closed-pending', () => {
    const out = walkPricingLadder(subject(), [rhmNearest(), ranch(), horseBackClosed(), ...decoys()], {
      asOf,
      pendingPool: [horseBackPending()],
    })
    const names = out.comps.map((c) => (c.subdivision ?? '').toLowerCase())
    expect(names.some((n) => /clearpine|forest edge|grand peaks|mckenzie meadow|sunset meadows/.test(n))).toBe(
      false,
    )
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-Clearpine')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-ForestEdge')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-GrandPeaks')
    expect(out.tiersUsed.some((t) => t.startsWith('nearby-') || t.startsWith('similar-sub') || t.startsWith('city-'))).toBe(
      false,
    )
  })

  it('contract: ranch-and-horse-back-in-clearpine-out', () => {
    const out = walkPricingLadder(subject(), [rhmNearest(), ranch(), horseBackClosed(), ...decoys()], {
      asOf,
      pendingPool: [horseBackPending()],
    })
    const keys = out.comps.map((c) => c.listingKey)
    const numbers = out.comps.map((c) => c.listNumber)
    expect(keys).toContain('RANCH-1058')
    expect(keys).toContain('HB-1025')
    expect(numbers).toContain('220218584')
    expect(numbers).toContain('220214720')
    expect(keys).not.toContain('UP-Clearpine')
    expect(keys).not.toContain('UP-ForestEdge')
  })

  it('contract: year-quality-does-not-outrank-until-starved-below-5', () => {
    const out = walkPricingLadder(subject(), [rhmNearest(), ranch(), horseBackClosed(), ...decoys()], {
      asOf,
      pendingPool: [horseBackPending()],
    })
    expect(out.exclusiveCount).toBeGreaterThanOrEqual(2)
    expect(out.exclusiveCount).toBeLessThan(5)
    expect(out.pocketStarved).toBe(true)
    expect(out.comps.map((c) => c.listingKey)).toContain('RANCH-1058')
    expect(out.comps.map((c) => c.listingKey)).toContain('HB-1025')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-Clearpine')
    expect(out.comps.every((c) => !/clearpine|forest edge/i.test(c.subdivision ?? ''))).toBe(true)
  })
})
