import { describe, expect, it } from 'vitest'
import { assembleOpinionPages, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: '220126000',
  streetAddress: '2465 7th',
  city: 'Redmond',
  state: 'OR',
  postalCode: '97756',
  subdivision: 'Diamond Bar Ranch',
  latitude: 44.27,
  longitude: -121.17,
  beds: 3,
  baths: 2,
  sqft: 1440,
  lotAcres: 0.14,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2004,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Withdrawn',
  lastListPrice: 460000,
  lastListDate: '2026-02-01',
  listingHistoryLine: 'Last on market Feb 2026 at $460,000 (withdrawn).',
  levelsRaw: 'One',
}

const comp: CmaAdjustedComp = {
  listingKey: 'C1',
  mlsNumber: '220222218',
  address: '840 Quince',
  city: 'Redmond',
  subdivision: 'Diamond Bar Ranch',
  latitude: 44.27,
  longitude: -121.17,
  beds: 3,
  baths: 2,
  sqft: 1400,
  lotAcres: 0.14,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2004,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 410000,
  closePrice: 410500,
  closeDate: '2026-06-10',
  daysToOffer: 6,
  domTotal: 10,
  selectionTier: 'subdivision',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 410500,
  ppsfTimeAdjusted: 293,
  sizeAdjustment: 0,
  adjustedPrice: 420000,
  weight: 1,
}

const pricing = {
  method1Low: 417000,
  method1Mid: 429000,
  method1High: 444000,
  method2: 429000,
  method3: 429000,
  conservative: 417000,
  recommended: 429000,
  highEnd: 444000,
  valueLow: 417000,
  valueHigh: 444000,
  predictedClose: 420000,
  confidence: 'High',
  confidenceReason: 'Tight set.',
  needsReview: false,
  reviewReason: null,
  notes: [],
} as unknown as CmaPricing

function args(): OpinionPageArgs {
  return {
    subject,
    comps: [comp],
    market: null,
    pricing,
    extras: {
      seasonality: null,
      band: {
        lo: 386000,
        hi: 472000,
        activeCount: 46,
        pendingCount: 17,
        activeMedianAsk: 429000,
        activeMedianDom: 20,
        source: 'test',
        rivals: [
          {
            listingKey: 'R1',
            address: '825 Poplar',
            listPrice: 417250,
            status: 'Active',
            daysOnMarket: 10,
            photoUrl: null,
            latitude: 44.27,
            longitude: -121.17,
            beds: 3,
            baths: 2,
            sqft: 1500,
            yearBuilt: 2011,
            lotAcres: 0.18,
          },
        ],
      },
      subdivisionPulse: null,
      financing: null,
      photoBench: null,
      legal: {
        parcel: '245217',
        taxlot: '151303BD02800',
        flood: { zone: 'X', inSFHA: false },
      },
      propertyFacts: { propertyType: 'Detached house', stories: 'One', fireplaces: 1 },
    },
    mapDataUri: 'data:image/png;base64,aaa',
    generatedAtIso: '2026-09-05T00:00:00.000Z',
    excludedOutliers: [],
  }
}

describe('assembleOpinionPages format', () => {
  it('carries only the blueprint chapters — no facts table, no lots, no permits', () => {
    const tocs = assembleOpinionPages(args()).map((p) => p.toc)
    // CUT by CMA_REIMAGINED_2026-09-07.md: they answer none of the three
    // questions a seller opens a failed listing's report to answer.
    for (const cut of [
      'Home location',
      'Property facts',
      'Legal, owner, and flood',
      'The land',
      'Permits and ownership',
      'Photos',
    ]) {
      expect(tocs, `${cut} is cut`).not.toContain(cut)
    }
  })

  it('keeps the ONE map on the price chapter (C9)', () => {
    const pages = assembleOpinionPages({
      ...args(),
      subjectMapDataUri: 'data:image/png;base64,subjmap',
      mapDataUri: 'data:image/png;base64,compsmap',
    })
    const price = pages.find((p) => p.toc === 'How we got the price')
    expect(price?.body).toContain('data:image/png;base64,compsmap')
    expect(price?.body).toContain('pin-map')
    expect(pages.map((p) => p.body).join('')).not.toContain('data:image/png;base64,subjmap')
  })

  it('puts competition next to the price, before the market chapter', () => {
    const tocs = assembleOpinionPages(args()).map((p) => p.toc)
    const price = tocs.indexOf('How we got the price')
    const competition = tocs.indexOf('Who you are competing with at this price')
    expect(price).toBeGreaterThanOrEqual(0)
    expect(competition).toBe(price + 1)
  })

  it('draws sold vs unsold before the number and before live competition', () => {
    const pages = assembleOpinionPages({
      ...args(),
      extras: {
        ...args().extras!,
        marketArea: {
          grain: 'subdivision',
          label: 'Diamond Bar Ranch',
          source: 'test',
          priceLo: 365000,
          priceHi: 494000,
          selected: {
            key: 'selected',
            label: 'Used for the recommend',
            count: 3,
            low: 390000,
            median: 410000,
            high: 420000,
            medianPpsf: 280,
            medianDom: 12,
          },
          active: null,
          pending: null,
          expired: null,
          closed: null,
          sold90: null,
          listingTrend: null,
          expiredPeers: [
            {
              listingKey: 'U1',
              address: '2527 5th',
              listPrice: 430000,
              status: 'Canceled',
              daysOnMarket: 36,
              onMarketDate: '2025-12-15',
              photoUrl: null,
              latitude: 44.29,
              longitude: -121.16,
              beds: 2,
              baths: 1,
              sqft: 789,
              lotAcres: 0.14,
              yearBuilt: 2008,
              propertySubType: 'Single Family Residence',
              originalListPrice: 430000,
              listingHistoryLine: null,
            },
          ],
        },
      },
    })
    const tocs = pages.map((p) => p.toc)
    const competition = tocs.indexOf('Who you are competing with at this price')
    // Chapter 2 now carries the unsold story, and it sits BEFORE the number.
    const outcomes = tocs.indexOf('Priced right sells. Priced high sits.')
    expect(outcomes).toBeGreaterThanOrEqual(0)
    expect(competition).toBeGreaterThan(outcomes)
    const body = pages[outcomes]!.body
    // Chapter 2 argues the claim from local numbers, not from a ruler of dots.
    expect(body).toContain('Near you, these asked and did not sell')
    expect(body).toContain('2527 5th')
    expect(body).not.toContain("Didn't sell")
    expect(body).not.toContain('Recommended $')
    expect(body).not.toContain('ruler-wide')
  })

  it('omits a citywide 90-day median that does not describe this house', () => {
    const pages = assembleOpinionPages({
      ...args(),
      extras: {
        ...args().extras!,
        sold90: {
          count: 76,
          low: 390000,
          median: 477450,
          high: 1350000,
          bedsLabel: '3 bedroom / 2 bath',
          source: 'test',
        },
      },
    })
    expect(pages.map((p) => p.toc).join(' ')).not.toMatch(/What 3 bedroom/)
  })

  it('does not print a citywide dollar-volume leftover page', () => {
    const pages = assembleOpinionPages({
      ...args(),
      market: {
        geoLabel: 'Redmond',
        monthsOfSupply: 4,
        saleToListRatio: 0.978,
        medianDom: 21,
        medianSalePrice: 532311,
        yearMart: {
          source: 'mart',
          geoType: 'city',
          geoLabel: 'Redmond',
          geoSlug: 'redmond',
          year: 2025,
          soldCount: 1029,
          totalVolume: 589287488,
          computedAt: '2026-09-06',
        },
      } as never,
    })
    expect(pages.map((p) => p.toc).join(' ')).not.toMatch(/closed sales, 2025/i)
  })
})
