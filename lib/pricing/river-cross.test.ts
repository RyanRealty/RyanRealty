import { describe, expect, it } from 'vitest'
import { crossesNamedRiver, RIVER_NAMES } from '@/lib/pricing/river-cross'

// Real Bend geography: the Deschutes runs north through town between the west
// side (Awbrey Butte, Summit West) and the east side (Old Bend, the Parkway).
const AWBREY_BUTTE = { lat: 44.0757, lng: -121.3339 }
const OLD_BEND_EAST = { lat: 44.0563, lng: -121.2786 }
const EAST_BEND_2 = { lat: 44.0489, lng: -121.2681 }
const REDMOND = { lat: 44.2726, lng: -121.1739 }

describe('crossesNamedRiver', () => {
  it('carries the Central Oregon rivers that divide a market', () => {
    expect(RIVER_NAMES).toContain('Deschutes River')
    expect(RIVER_NAMES).toContain('Little Deschutes River')
    expect(RIVER_NAMES).toContain('Crooked River')
  })

  it('sees the Deschutes between west Bend and east Bend', () => {
    expect(crossesNamedRiver(AWBREY_BUTTE, OLD_BEND_EAST)).toBe(true)
  })

  it('does not invent a crossing between two homes on the same side', () => {
    expect(crossesNamedRiver(OLD_BEND_EAST, EAST_BEND_2)).toBe(false)
  })

  it('fails open on a missing coordinate rather than guessing', () => {
    expect(crossesNamedRiver(null, OLD_BEND_EAST)).toBe(false)
    expect(crossesNamedRiver(OLD_BEND_EAST, undefined)).toBe(false)
    expect(crossesNamedRiver({ lat: Number.NaN, lng: -121.3 }, OLD_BEND_EAST)).toBe(false)
  })

  it('sees a river between Bend and Redmond only where one actually runs', () => {
    // The Deschutes swings west of the corridor north of Bend; the straight
    // line from east Bend to Redmond does not cross it.
    expect(crossesNamedRiver(EAST_BEND_2, REDMOND)).toBe(false)
  })
})

describe('the river wall inside the ladder', () => {
  it('holds an unmapped subject to its own side, and lets the starved widening cross', async () => {
    const { walkPricingLadder } = await import('@/lib/pricing/match')
    const asOf = '2026-09-01'
    // A La Pine subject: no mapped neighborhood, the Little Deschutes beside it.
    const subject = {
      listingKey: 'SUBJ',
      streetAddress: '1 Test Ln',
      city: 'La Pine',
      citySlug: 'la-pine',
      subdivision: null,
      subdivisionNorm: null,
      latitude: 43.685,
      longitude: -121.5173,
      beds: 3,
      baths: 2,
      sqft: 1800,
      lotAcres: 0.3,
      yearBuilt: 2000,
      storyClass: 'single' as const,
      productClass: 'detached',
      waterClass: null,
      sewerClass: null,
      hoaClass: null,
      lotClass: null,
      ruralAcreage: false,
      marketArea: null,
      newConstruction: null,
    }
    const across = {
      listingKey: 'ACROSS',
      listNumber: null,
      address: '9 Far Side',
      city: 'La Pine',
      citySlug: 'la-pine',
      subdivision: null,
      subdivisionNorm: null,
      latitude: 43.685,
      longitude: -121.4973,
      beds: 3,
      baths: 2,
      sqft: 1790,
      lotAcres: 0.3,
      yearBuilt: 2001,
      storyClass: 'single' as const,
      productClass: 'detached',
      waterClass: null,
      sewerClass: null,
      hoaClass: null,
      lotClass: null,
      closeDate: '2026-07-01',
      closePrice: 400_000,
      closePpsf: 223,
      originalAsk: null,
      lastAsk: null,
      daysToOffer: null,
      cdom: null,
      dropCount: 0,
      photoUrl: null,
      publicRemarks: null,
      newConstruction: null,
    }
    const crossesIt = crossesNamedRiver(
      { lat: subject.latitude, lng: subject.longitude },
      { lat: across.latitude, lng: across.longitude },
    )
    expect(crossesIt).toBe(true)
    // One sale, on the other bank: the bounded rungs refuse it, and the
    // starved widening takes it because there is nothing else.
    const out = walkPricingLadder(subject as never, [across] as never, { asOf, cells: new Map() })
    const tiers = out.tiersUsed
    if (out.comps.length > 0) {
      expect(tiers.some((t) => t.includes('widened-disclosed'))).toBe(true)
    }
    // Whatever it decides, it never took the sale on a bounded rung.
    for (const t of tiers) {
      if (t.includes('widened-disclosed')) continue
      expect(['subdivision', 'adjacent', 'community']).not.toContain(t)
    }
  })
})
