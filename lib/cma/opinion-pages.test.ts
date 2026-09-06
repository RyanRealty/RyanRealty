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
  it('puts house facts and legal on the subject page instead of empty follow-on sheets', () => {
    const pages = assembleOpinionPages(args())
    const tocs = pages.map((p) => p.toc)
    expect(tocs).toContain('Home location')
    expect(tocs).not.toContain('Property facts')
    expect(tocs).not.toContain('Legal, owner, and flood')
    const house = pages.find((p) => p.toc === 'Home location')
    expect(house?.body).toContain('Garage')
    expect(house?.body).toContain('2 spaces')
    expect(house?.body).toContain('Parcel')
    expect(house?.body).toContain('245217')
    expect(house?.body).toContain('Detached house')
    expect(house?.body).not.toContain('Single Family Residence')
  })

  it('puts competition next to the price, before the market chapters', () => {
    const tocs = assembleOpinionPages(args()).map((p) => p.toc)
    const price = tocs.indexOf('How we got the price')
    const competition = tocs.indexOf('Who you are competing with at this price')
    expect(price).toBeGreaterThanOrEqual(0)
    expect(competition).toBe(price + 1)
  })

  it('draws sold vs unsold in the list band right after competition', () => {
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
            label: 'These sales',
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
          outcomes: {
            lo: 365000,
            hi: 460000,
            sold: [380000, 390000, 400000, 410000],
            unsold: [430000, 450000, 460000],
            list: 401000,
            lastAsk: 460000,
            soldShown: 4,
            unsoldShown: 3,
            soldTotal: 4,
            unsoldTotal: 3,
            label: 'Diamond Bar Ranch',
            source: 'Closed = sale price. Expired, withdrawn, and canceled = last ask.',
          },
        },
      },
    })
    const tocs = pages.map((p) => p.toc)
    const competition = tocs.indexOf('Who you are competing with at this price')
    const outcomes = tocs.indexOf('Sold and unsold in this band')
    expect(outcomes).toBe(competition + 1)
    const body = pages[outcomes]!.body
    expect(body).toContain('4 closed')
    expect(body).toContain('came off without a sale')
    expect(body).toContain("Didn't sell")
    expect(body).toContain('$460K')
    expect(body).toContain('Closed = sale price')
  })
})
