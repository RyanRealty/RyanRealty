import { describe, expect, it } from 'vitest'
import {
  resolvePlacePricingTarget,
  rowsToPlacePricingStory,
  type PlacePricingListingRow,
} from '@/lib/cma/place-pricing-aggregate'

const AS_OF = '2026-10-06'

function home(over: Partial<PlacePricingListingRow> = {}): PlacePricingListingRow {
  return {
    streetNumber: '12',
    streetName: 'Pine',
    status: 'Active',
    listPrice: 500_000,
    originalListPrice: 500_000,
    closePrice: null,
    closeDate: null,
    listDate: '2026-06-01',
    onMarketDate: '2026-06-01',
    offMarketDate: null,
    concessionsAmount: null,
    daysToPending: null,
    propertySubType: 'Single Family Residence',
    ...over,
  }
}

function story(rows: readonly PlacePricingListingRow[], propertySubType = 'Single Family Residence') {
  return rowsToPlacePricingStory({
    placeName: 'River West',
    placeKind: 'neighborhood',
    propertySubType,
    asOf: AS_OF,
    rows,
  })
}

describe('rowsToPlacePricingStory', () => {
  it('returns null with no rows or no place name', () => {
    expect(story([])).toBeNull()
    expect(
      rowsToPlacePricingStory({
        placeName: '  ',
        placeKind: 'neighborhood',
        propertySubType: 'Single Family Residence',
        asOf: AS_OF,
        rows: [home()],
      }),
    ).toBeNull()
  })

  it('counts one home when the address only differs by case or spacing', () => {
    const result = story([
      home({ streetNumber: '10', streetName: 'Oak' }),
      home({ streetNumber: '10', streetName: '  Oak' }),
      home({ streetNumber: '10', streetName: 'oak' }),
    ])
    expect(result!.listedHomes).toBe(1)
    // A suffix is part of the address. Lane and Ln stay two homes.
    expect(
      story([
        home({ streetNumber: '10', streetName: 'Oak Lane' }),
        home({ streetNumber: '10', streetName: 'Oak Ln' }),
      ])!.listedHomes,
    ).toBe(2)
  })

  it('does not treat a null concession as zero', () => {
    const result = story([
      home({ streetNumber: '1', concessionsAmount: null }),
      home({ streetNumber: '2', concessionsAmount: 0 }),
      home({ streetNumber: '3', concessionsAmount: 10_000, listPrice: 500_000 }),
    ])
    expect(result!.listedHomes).toBe(3)
    expect(result!.gaveConcessions).toBe(1)
    expect(result!.typicalConcessionShare).toBeNull()
  })

  it('withholds a median until five homes', () => {
    const cut = (n: number, days: number): PlacePricingListingRow =>
      home({
        streetNumber: String(n),
        streetName: 'Alder',
        status: 'Closed',
        listPrice: 450_000,
        originalListPrice: 500_000,
        closePrice: 440_000,
        closeDate: '2026-06-01',
        listDate: '2026-04-01',
        daysToPending: days,
        concessionsAmount: 10_000,
      })
    const four = story([8, 12, 16, 20].map((days, i) => cut(i + 1, days)))
    expect(four).toMatchObject({
      droppedPrice: 4,
      typicalCutShare: null,
      gaveConcessions: 4,
      typicalConcessionShare: null,
      cutPriceCount: 4,
      cutPriceMedianDays: null,
    })
    const five = story([8, 12, 16, 20, 24].map((days, i) => cut(i + 1, days)))
    expect(five).toMatchObject({
      droppedPrice: 5,
      typicalCutShare: 0.1,
      gaveConcessions: 5,
      typicalConcessionShare: 10_000 / 450_000,
      cutPriceCount: 5,
      cutPriceMedianDays: 16,
    })
  })

  it('counts a withdrawn home as did not sell, and a closed home as a sale', () => {
    const withdrawn = story([
      home({
        status: 'Withdrawn',
        listDate: '2025-11-01',
        offMarketDate: '2026-03-01',
        closeDate: null,
      }),
    ])
    expect(withdrawn).toMatchObject({ listedHomes: 1, didNotSell: 1 })

    const closed = story([
      home({
        status: 'Closed',
        listDate: '2026-05-01',
        closeDate: '2026-06-01',
        closePrice: 490_000,
      }),
    ])
    expect(closed).toMatchObject({ listedHomes: 1, didNotSell: 0 })

    // Same address later closed. The close in the window is the outcome.
    const relisted = story([
      home({
        streetNumber: '9',
        streetName: 'Pine',
        status: 'Withdrawn',
        listDate: '2026-01-01',
        offMarketDate: '2026-02-01',
      }),
      home({
        streetNumber: '9',
        streetName: 'Pine',
        status: 'Closed',
        listDate: '2026-06-01',
        closeDate: '2026-07-01',
        closePrice: 480_000,
      }),
    ])
    expect(relisted).toMatchObject({ listedHomes: 1, didNotSell: 0 })
  })

  it('uses days_to_pending on closed sales, not list-to-close', () => {
    const held = (n: number, days: number | null) => ({
      ...home({
        streetNumber: String(n),
        streetName: 'Alder',
        status: 'Closed',
        listPrice: 500_000,
        originalListPrice: 500_000,
        closePrice: 495_000,
        closeDate: '2026-06-01',
        listDate: '2026-04-01',
        daysToPending: days,
      }),
      DaysOnMarket: 200,
    })
    const priced = story([10, 20, 30, 40, 50].map((days, i) => held(i + 1, days)))
    expect(priced).toMatchObject({
      heldAskCount: 5,
      heldAskMedianDays: 30,
      cutPriceCount: 0,
      cutPriceMedianDays: null,
    })

    const missing = story([1, 2, 3, 4, 5].map((n) => held(n, null)))
    expect(missing).toMatchObject({ heldAskCount: 0, heldAskMedianDays: null })

    const recordedZero = story([1, 2, 3, 4, 5].map((n) => held(n, 0)))
    expect(recordedZero).toMatchObject({ heldAskCount: 5, heldAskMedianDays: 0 })

    const stillForSale = story([home({ status: 'Active', daysToPending: 4, listDate: '2026-08-01' })])
    expect(stillForSale).toMatchObject({ heldAskCount: 0, cutPriceCount: 0 })
  })

  it('keeps the same subtype and names the window in the source note', () => {
    expect(story([home()], 'Townhouse')).toBeNull()
    const result = story([home({ listDate: '2025-10-06' })])
    expect(result!.listedHomes).toBe(1)
    expect(result!.sourceNote).toBe(
      'River West single-family homes on the market October 6, 2025 through October 6, 2026, 1 home.',
    )
    expect(result!.sourceNote).not.toContain('—')
    // The letter's noun, never the raw MLS value (reader review 2026-10-07).
    expect(result!.sourceNote).not.toContain('Single Family Residence')
    expect(story([home({ listDate: '2025-10-05', onMarketDate: null, offMarketDate: null, closeDate: null })])).toBeNull()
  })
})

describe('resolvePlacePricingTarget', () => {
  it('uses a neighborhood or community name, and the parent place of a subdivision', () => {
    expect(
      resolvePlacePricingTarget({
        compArea: { kind: 'neighborhood', names: ['River West'] },
        latitude: 44.08554,
        longitude: -121.325841,
      }),
    ).toEqual({ placeName: 'River West', placeKind: 'neighborhood' })
    expect(
      resolvePlacePricingTarget({
        compArea: { kind: 'community', names: ['Tetherow'] },
        latitude: null,
        longitude: null,
      }),
    ).toEqual({ placeName: 'Tetherow', placeKind: 'community' })
    expect(
      resolvePlacePricingTarget({
        compArea: { kind: 'subdivision', names: ['Northwest Crossing'] },
        latitude: 44.08554,
        longitude: -121.325841,
      }),
    ).toEqual({ placeName: 'Awbrey Butte', placeKind: 'neighborhood' })
    expect(
      resolvePlacePricingTarget({
        compArea: { kind: 'subdivisions', names: ['Northwest Crossing'] },
        latitude: 44.08554,
        longitude: -121.325841,
      }),
    ).toEqual({ placeName: 'Awbrey Butte', placeKind: 'neighborhood' })
  })

  it('returns null for a radius, a city, or a subdivision with no point', () => {
    expect(
      resolvePlacePricingTarget({
        compArea: { kind: 'radius', names: ['1 mile'] },
        latitude: 44.08554,
        longitude: -121.325841,
      }),
    ).toBeNull()
    expect(
      resolvePlacePricingTarget({
        compArea: { kind: 'city', names: ['Bend'] },
        latitude: 44.08554,
        longitude: -121.325841,
      }),
    ).toBeNull()
    expect(
      resolvePlacePricingTarget({
        compArea: { kind: 'subdivision', names: ['Northwest Crossing'] },
        latitude: null,
        longitude: null,
      }),
    ).toBeNull()
    expect(
      resolvePlacePricingTarget({
        compArea: { kind: 'neighborhood', names: ['  '] },
        latitude: null,
        longitude: null,
      }),
    ).toBeNull()
  })
})
