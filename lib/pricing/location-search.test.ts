import { describe, expect, it } from 'vitest'
import { compTierLadder } from '@/lib/cma/comp-tiers'
import { pricingTierLadder } from '@/lib/pricing/ladder'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

function subject(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '1 Test St',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Kenwood',
    subdivisionNorm: 'kenwood',
    subdivisionSlug: 'kenwood',
    latitude: 44.06,
    longitude: -121.3,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    yearBuilt: 1998,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: 'bend-river-west',
    adjacentSubdivisionSlugs: ['next-plat'],
    ...over,
  }
}

let saleSeq = 0
function sale(over: Partial<PricingSale> = {}): PricingSale {
  saleSeq += 1
  const sqft = over.sqft ?? 1980
  const closePrice = over.closePrice ?? 700_000
  return {
    listingKey: over.listingKey ?? `K${saleSeq}`,
    listNumber: null,
    address: over.address ?? `${saleSeq} Comp St`,
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Kenwood',
    subdivisionNorm: 'kenwood',
    subdivisionSlug: 'kenwood',
    latitude: 44.061,
    longitude: -121.301,
    beds: 3,
    baths: 2,
    sqft,
    lotAcres: 0.18,
    yearBuilt: 1996,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: 725_000,
    lastAsk: 710_000,
    daysToOffer: 18,
    cdom: 32,
    dropCount: 1,
    closePpsf: closePrice / sqft,
    photoUrl: null,
    publicRemarks: null,
    marketArea: 'bend-river-west',
    ...over,
  }
}

describe('location search', () => {
  it('stays in the subdivision, then adjacent, then the neighborhood, and widens dates when short of 3, and does not jump to same-zip while a closer place still has sales', () => {
    const asOf = '2026-08-01'
    const pool = [
      // Twenty months old and 30% larger. The tight 25% band misses it.
      // Widening the plat's dates and the 35% cutoff has to take it before any zip sale.
      sale({
        listingKey: 'OLD_WIDE',
        address: '20 Kenwood',
        closeDate: '2024-12-01',
        sqft: 2600,
        closePrice: 700_000,
      }),
      sale({
        listingKey: 'OLD_TIGHT',
        address: '21 Kenwood',
        closeDate: '2024-12-15',
        sqft: 2000,
        closePrice: 705_000,
      }),
      sale({
        listingKey: 'ADJ',
        address: '1 Next',
        closeDate: '2026-07-01',
        subdivision: 'Next Plat',
        subdivisionNorm: 'next plat',
        subdivisionSlug: 'next-plat',
        latitude: 44.066,
      }),
      sale({
        listingKey: 'NEI',
        address: '1 Other',
        closeDate: '2026-07-02',
        subdivision: 'Other Plat',
        subdivisionNorm: 'other plat',
        subdivisionSlug: 'other-plat',
        latitude: 44.068,
      }),
      sale({
        listingKey: 'NEI2',
        address: '2 Other',
        closeDate: '2026-07-03',
        subdivision: 'Other Plat',
        subdivisionNorm: 'other plat',
        subdivisionSlug: 'other-plat',
        latitude: 44.069,
      }),
      sale({
        listingKey: 'ZIP1',
        address: '1 Far',
        closeDate: '2026-07-10',
        subdivision: 'Far Plat',
        subdivisionNorm: 'far plat',
        subdivisionSlug: 'far-plat',
        marketArea: 'bend-southeast',
        latitude: 44.02,
        longitude: -121.25,
      }),
      sale({
        listingKey: 'ZIP2',
        address: '2 Far',
        closeDate: '2026-07-11',
        subdivision: 'Far Plat',
        subdivisionNorm: 'far plat',
        subdivisionSlug: 'far-plat',
        marketArea: 'bend-southeast',
        latitude: 44.021,
        longitude: -121.25,
      }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).toContain('OLD_WIDE')
    expect(keys).toContain('OLD_TIGHT')
    expect(keys).toContain('ADJ')
    expect(keys).not.toContain('NEI')
    expect(keys).not.toContain('NEI2')
    expect(keys).not.toContain('ZIP1')
    expect(keys).not.toContain('ZIP2')

    const added = out.rungs.filter((r) => r.added > 0).map((r) => r.tier)
    const adjAt = added.findIndex((t) => t.startsWith('adjacent-'))
    const oldSubAt = added.findIndex((t) => t === 'subdivision-18mo' || t === 'subdivision-24mo' || t === 'subdivision-24mo-wide')
    expect(adjAt).toBeGreaterThanOrEqual(0)
    expect(oldSubAt).toBeGreaterThanOrEqual(0)
    expect(oldSubAt).toBeLessThan(adjAt)
    expect(added.some((t) => /^(city-|similar-sub|beyond-|citywide-|competing-area-|nearby-|pocket-|community-)/.test(t))).toBe(false)

    const facts = pricingTierLadder().map((t) => t.name)
    expect(facts.indexOf('subdivision-24mo-wide')).toBeLessThan(facts.indexOf('adjacent-sub-3mo'))
    expect(facts.indexOf('adjacent-sub-24mo')).toBeLessThan(facts.indexOf('closer-sub-3mo'))
    expect(facts.indexOf('closer-sub-24mo')).toBeLessThan(facts.indexOf('pocket-3mo'))
    expect(facts.indexOf('community-24mo')).toBeLessThan(facts.indexOf('nearby-0.25mi-3mo'))

    const listings = compTierLadder('Kenwood').map((t) => t.name)
    expect(listings.indexOf('subdivision-24mo')).toBeLessThan(listings.indexOf('adjacent-subdivision-6mo'))
    expect(listings).not.toContain('neighborhood-12mo')
    expect(listings).not.toContain('pocket-6mo')
    expect(listings).not.toContain('nearby-0.25mi-6mo')
    const unplatted = compTierLadder(null).map((t) => t.name)
    expect(unplatted.indexOf('nearby-0.25mi-6mo')).toBeLessThan(unplatted.indexOf('nearby-1mi-6mo'))
    expect(unplatted[0]).toBe('subdivision-6mo')
  })
})
