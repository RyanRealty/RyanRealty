import { describe, expect, it } from 'vitest'
import { parentCompetitionSet, type CmaBandRival } from '@/lib/cma/band-rivals'
import { finishRecommendedAfterActives, rivalsThatMayNudgeTheList } from '@/lib/cma/finish-recommended'
import { competitionBodyMatrixHtml } from '@/lib/cma/opinion-pages'
import { parentPlaceArea } from '@/lib/pricing/comp-area'
import type { OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CompArea } from '@/lib/pricing/comp-area'

/**
 * 2531 Locke. Copperstone has nothing listed in the band. The buyer looking
 * at this price is also looking at the homes for sale in Awbrey Butte.
 * Those homes do not set the price, and a resort plat does not compete.
 */

const copperstone: CompArea = {
  kind: 'subdivision',
  names: ['Copperstone'],
  radiusMiles: null,
  centre: { lat: 44.076219, lng: -121.352101 },
  source: 'test',
  sentence: 'Copperstone, your own subdivision.',
}

const awbrey: CompArea = {
  kind: 'neighborhood',
  names: ['Awbrey Butte'],
  radiusMiles: null,
  centre: { lat: 44.076219, lng: -121.352101 },
  source: 'parent of an empty sales subdivision',
  sentence: 'Awbrey Butte, the neighborhood around your home.',
}

const subject = {
  listingKey: 'S',
  mlsNumber: '220217987',
  streetAddress: '2531 Locke',
  city: 'Bend',
  state: 'OR',
  postalCode: '97703',
  subdivision: 'Copperstone',
  latitude: 44.076219,
  longitude: -121.352101,
  beds: 3,
  baths: 3,
  sqft: 2275,
  lotAcres: 0.12,
  propertySubType: 'Townhouse',
  yearBuilt: 2002,
  photoUrl: null,
  standardStatus: 'Expired',
  lastListPrice: 698_000,
} as CmaSubject

const pricing = {
  recommended: 687_000,
  valueLow: 599_350,
  valueHigh: 724_343,
  notes: [],
} as unknown as CmaPricing

function home(over: Partial<CmaBandRival>): CmaBandRival {
  return {
    listingKey: over.listingKey ?? 'K',
    address: over.address ?? '1 Test',
    listPrice: over.listPrice ?? 650_000,
    status: over.status ?? 'Active',
    daysOnMarket: 10,
    photoUrl: null,
    latitude: over.latitude ?? 44.076219,
    longitude: over.longitude ?? -121.352101,
    beds: over.beds ?? 3,
    baths: 3,
    sqft: over.sqft ?? 2000,
    yearBuilt: 2004,
    lotAcres: 0.15,
    propertySubType: over.propertySubType ?? 'Single Family Residence',
    subdivision: over.subdivision ?? 'Awbrey Woods',
  }
}

describe('empty subdivision competition', () => {
  it('names the empty subdivision and prints the neighborhood homes at this price', () => {
    const html = competitionBodyMatrixHtml({
      subject,
      comps: [],
      pricing,
      generatedAtIso: '2026-10-04T21:29:43.448Z',
      compArea: copperstone,
      bandRivals: {
        area: awbrey,
        lo: 618_000,
        hi: 756_000,
        activeCount: 2,
        pendingCount: 0,
        emptyPlace: 'Copperstone',
        productWidened: true,
        rivals: [
          home({ listingKey: 'debron', address: '2337 Debron', listPrice: 625_000, beds: 4, sqft: 2064, subdivision: 'Awbrey Woods' }),
          home({
            listingKey: 'awbrey',
            address: '2526 Awbrey',
            listPrice: 675_000,
            beds: 3,
            sqft: 1789,
            subdivision: 'Awbrey Point',
          }),
        ],
        sentence: 'stored sentence must not be the one that prints',
        source: 'Homes for sale and under contract in Awbrey Butte between $618,000 and $756,000, from the Oregon Data Share MLS as of Oct 4, 2026.',
        widenedFrom: null,
        ringsTried: [],
      },
    } as unknown as OpinionPageArgs)

    expect(html).toContain(
      'No home in Copperstone is for sale between $618,000 and $756,000, and none is under contract.',
    )
    expect(html).toContain('2 homes are for sale in Awbrey Butte between $618,000 and $756,000.')
    expect(html).toContain('None are under contract right now.')
    expect(html).toContain('2337 Debron')
    expect(html).toContain('2526 Awbrey')
    expect(html).toContain('No townhouse is listed in Awbrey Butte in this range, so these are the other homes for sale there.')
    expect(html).not.toContain('stored sentence must not be the one that prints')
  })

  it('uses the parent neighborhood, drops a resort, and keeps a townhouse ahead of a house', () => {
    const parent = parentPlaceArea({ latitude: 44.076219, longitude: -121.352101 })
    expect(parent?.kind).toBe('neighborhood')
    expect(parent?.names).toEqual(['Awbrey Butte'])
    expect(parent?.radiusMiles).toBeNull()

    const debron = home({
      listingKey: 'debron',
      address: '2337 Debron',
      listPrice: 625_000,
      beds: 4,
      sqft: 2064,
      latitude: 44.078,
      longitude: -121.352,
      subdivision: 'Awbrey Woods',
    })
    const awbrey = home({
      listingKey: 'awbrey',
      address: '2526 Awbrey',
      listPrice: 675_000,
      status: 'Active',
      latitude: 44.09,
      longitude: -121.34,
      subdivision: 'Awbrey Point',
    })
    const fairway = home({
      listingKey: 'fairway',
      address: '2879 Fairway Heights',
      listPrice: 650_000,
      status: 'Pending',
      latitude: 44.08,
      longitude: -121.33,
      subdivision: 'Rivers Edge Village',
    })
    const widened = parentCompetitionSet({
      parent: parent!,
      emptyPlace: 'Copperstone',
      lo: 618_000,
      hi: 756_000,
      sameType: [],
      anyResidential: [fairway, awbrey, debron],
      subjectSubdivision: 'Copperstone',
      subject: { latitude: 44.076219, longitude: -121.352101, beds: 3, sqft: 2275 },
    })
    expect(widened?.productWidened).toBe(true)
    expect(widened?.rivals.map((r) => r.address)).toEqual(['2337 Debron', '2526 Awbrey'])
    expect(widened?.sentence).toContain('No home in Copperstone is for sale between $618,000 and $756,000')
    expect(widened?.sentence).toContain('2 homes are for sale in Awbrey Butte')
    expect(widened?.sentence).not.toContain('Fairway')

    const townhouse = home({
      listingKey: 'th',
      address: '10 Townhouse',
      propertySubType: 'Townhouse',
      subdivision: 'Awbrey Woods',
      latitude: 44.09,
    })
    const sameKind = parentCompetitionSet({
      parent: parent!,
      emptyPlace: 'Copperstone',
      lo: 618_000,
      hi: 756_000,
      sameType: [townhouse],
      anyResidential: [debron, townhouse],
      subjectSubdivision: 'Copperstone',
      subject: { latitude: 44.076219, longitude: -121.352101, beds: 3, sqft: 2275 },
    })
    expect(sameKind?.productWidened).toBe(false)
    expect(sameKind?.rivals.map((r) => r.address)).toEqual(['10 Townhouse'])

    const riverCamp = home({
      listingKey: 'camp',
      address: '19737 River Camp',
      beds: 2,
      sqft: 1200,
      latitude: 44.0763,
      longitude: -121.352,
      subdivision: 'Awbrey Woods',
    })
    expect(
      parentCompetitionSet({
        parent: parent!,
        emptyPlace: 'Copperstone',
        lo: 618_000,
        hi: 756_000,
        sameType: [],
        anyResidential: [riverCamp],
        subjectSubdivision: 'Copperstone',
        subject: { latitude: 44.076219, longitude: -121.352101, beds: 4, sqft: 2554 },
      }),
    ).toBeNull()
  })

  it('does not let a home outside the sales place pull the recommended price', () => {
    const debron = { status: 'Active', listPrice: 625_000, daysOnMarket: 118 }
    const pricing = {
      recommended: 687_000,
      conservative: 599_000,
      highEnd: 724_000,
      valueLow: 599_350,
      valueHigh: 724_343,
      notes: [],
    }
    expect(
      rivalsThatMayNudgeTheList({
        emptyPlace: 'Copperstone',
        productWidened: true,
        rivals: [debron],
      }),
    ).toEqual([])
    const stayed = finishRecommendedAfterActives(pricing, {
      actives: rivalsThatMayNudgeTheList({
        emptyPlace: 'Copperstone',
        productWidened: true,
        rivals: [debron],
      }),
      pocketClosedSupport: 599_350,
      ask: 698_000,
    })
    expect(stayed.recommended).toBe(687_000)
    const pulled = finishRecommendedAfterActives(pricing, {
      actives: [debron],
      pocketClosedSupport: 599_350,
      ask: 698_000,
    })
    expect(pulled.recommended).toBe(666_000)
  })
})
