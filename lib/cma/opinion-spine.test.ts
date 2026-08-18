/**
 * Seller CMA is one price-opinion spine on every path.
 * Numbers come from the pricing unit. This is not a Quince one-off.
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { renderImmersiveCmaHtml } from './immersive'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: '220000850',
  streetAddress: '850 Quince',
  city: 'Redmond',
  state: 'OR',
  postalCode: '97756',
  subdivision: 'Heritage Ranch',
  latitude: 44.272,
  longitude: -121.174,
  beds: 3,
  baths: 2,
  sqft: 1600,
  lotAcres: 0.18,
  propertySubType: null,
  yearBuilt: 1998,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 515000,
  lastListDate: '2026-03-01',
  listingHistoryLine: null,
}

const comp: CmaAdjustedComp = {
  listingKey: 'C1',
  mlsNumber: '1',
  address: '12 Pine',
  city: 'Redmond',
  subdivision: 'Heritage Ranch',
  latitude: 44.273,
  longitude: -121.175,
  beds: 3,
  baths: 2,
  sqft: 1580,
  lotAcres: 0.17,
  propertySubType: null,
  yearBuilt: 1999,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 490000,
  closePrice: 485000,
  closeDate: '2026-06-10',
  daysToOffer: 8,
  domTotal: 14,
  selectionTier: 'subdivision',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 485000,
  ppsfTimeAdjusted: 307,
  sizeAdjustment: 2000,
  adjustedPrice: 487000,
  weight: 1,
}

const broker: CmaBroker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/ryan-matt.png',
}

const pricing = {
  method1Low: 470000,
  method1Mid: 480000,
  method1High: 490000,
  method2: 478000,
  method3: 482000,
  conservative: 470000,
  recommended: 475000,
  highEnd: 490000,
  valueLow: 470000,
  valueHigh: 490000,
  predictedClose: 465000,
  confidence: 'High',
  confidenceReason: 'Tight set.',
  needsReview: false,
  reviewReason: null,
  notes: [],
} as unknown as CmaPricing

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  return {
    subject,
    comps: [comp],
    market: {
      geoSlug: 'redmond',
      geoLabel: 'Redmond',
      periodStart: '2025-08-17',
      periodEnd: '2026-08-17',
      soldCount365: 188,
      medianSalePrice: 475000,
      medianDom: 28,
      medianPpsf: 290,
      saleToListRatio: 0.98,
      yoyMedianPriceDeltaPct: 1.2,
      activeCount: 40,
      pendingCount: 12,
      monthsOfSupply: 3.2,
      mosFormula: 'pulse',
      marketVerdict: 'seller',
      methodologyVersion: 'v3-2026-05-07',
      computedAt: '2026-08-17',
      pulseUpdatedAt: '2026-08-17',
      trend: [],
    },
    pricing,
    broker,
    client: { name: 'Pat', email: null, phone: null, notes: null },
    mapDataUri: 'data:image/png;base64,aaa',
    generatedAtIso: '2026-08-17T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    extras: {
      seasonality: null,
      band: {
        lo: 427000,
        hi: 522000,
        activeCount: 2,
        pendingCount: 1,
        activeMedianAsk: 469000,
        activeMedianDom: 12,
        source: 'band fixture',
        rivals: [
          {
            listingKey: 'A1',
            address: '123 Heritage',
            listPrice: 469000,
            status: 'Active',
            daysOnMarket: 11,
            photoUrl: null,
            latitude: 44.27,
            longitude: -121.17,
          },
        ],
      },
      subdivisionPulse: null,
      financing: null,
      photoBench: null,
      marketArea: null,
      zillow: {
        zestimate: 474100,
        rangeLow: 450000,
        rangeHigh: 498000,
        ourList: 475000,
        gapToList: -900,
        stickerMean: 472300,
        grades: [],
        usableCount: 2,
        dirtyCount: 0,
        verdict: 'supports' as const,
        heading: "Zillow's number sits in this range",
        lede: 'Zillow prints $474,100. The list on this report is $475,000.',
        reasons: ['Two of the houses they showed are closed sales that match this home.'],
        source: 'Zillow home details page, 2026-08-17. Each printed sale checked against Oregon Datashare MLS.',
        url: 'https://www.zillow.com/homedetails/test/1_zpid/',
        fetchedAt: '2026-08-17',
      },
      ownerNotes: ['Interior and exterior repainted', 'Bathroom remodel'],
      parcel: {
        taxAccount: '129007',
        currentOwner: 'JONES, PAT',
        ownedSince: '2021-07-29',
        acquiredAt: 445000,
        sales: [
          {
            date: '2021-07-29',
            seller: 'SMITH, ANN',
            buyer: 'JONES, PAT',
            amount: 445000,
            instrument: '2021-123',
          },
        ],
        permits: [{ type: 'Building', permit: '247-B12345' }],
        source: 'Deschutes County DIAL account 129007',
        agentNotes: ['Owner of record: JONES, PAT.'],
      },
    },
    subdivisionStory: {
      facts: {
        name: 'Heritage Ranch',
        totalSales: 40,
        years: [{ year: 2025, count: 8, medianClose: 470000, medianPpsf: 295 }],
        recordHigh: { price: 520000, address: '1 Ranch', date: '2025-06-01' },
        recordLow: { price: 390000, address: '2 Ranch', date: '2023-01-01' },
        medianDomRecent: 22,
        saleToListRecentPct: 98.1,
        subjectSqftPercentile: 40,
        vintageSpan: { min: 1994, max: 2004 },
        source: 'subdivision fixture',
      },
      sections: [{ heading: 'A ranch street', body: 'Sales here cluster in a tight band.' }],
      notableSales: [],
      model: 'x',
      costUsd: 0,
      photoSalesReviewed: 0,
    },
    ...over,
  }
}

const BANNED = /how we would market|what we would do|not the (whole )?ZIP|High confidence|Moderate confidence|Confidence:/i

describe('print CMA price-opinion spine', () => {
  it('leads with the number, then why, rivals, sales, subdivision', () => {
    const { html } = renderCmaHtml(args())
    expect(html).toContain('$465,000')
    expect(html).toContain('Expected sale')
    expect(html).toContain('Who you are competing with at this price')
    expect(html).toContain('123 Heritage')
    expect(html).toContain('The sales that set the number')
    expect(html).toContain('12 Pine')
    expect(html).toContain('data-comp="1"')
    expect(html).toContain('Heritage Ranch')
    expect(html).toContain('What Zillow says')
    expect(html).toContain('Zillow&#39;s number sits in this range')
    expect(html).toContain('Who has owned this house')
    expect(html).toContain('What you have done to this house')
    expect(html).toContain('Interior and exterior repainted')
    expect(html).toContain('What you would net')
    expect(html).toContain('247-B12345')
    expect(html).not.toMatch(BANNED)
    const priceAt = html.indexOf('$465,000')
    const whyAt = html.indexOf('Why $')
    const zillowAt = html.indexOf('What Zillow says')
    const rivalAt = html.indexOf('Who you are competing with at this price')
    const salesAt = html.indexOf('The sales that set the number')
    const subAt = html.indexOf('This subdivision, Heritage Ranch')
    const ownAt = html.indexOf('Who has owned this house')
    const notesAt = html.indexOf('What you have done to this house')
    const netAt = html.indexOf('What you would net')
    expect(priceAt).toBeGreaterThan(0)
    expect(whyAt).toBeGreaterThan(priceAt)
    expect(zillowAt).toBeGreaterThan(whyAt)
    expect(rivalAt).toBeGreaterThan(zillowAt)
    expect(salesAt).toBeGreaterThan(rivalAt)
    expect(subAt).toBeGreaterThan(salesAt)
    expect(ownAt).toBeGreaterThan(subAt)
    expect(notesAt).toBeGreaterThan(ownAt)
    expect(netAt).toBeGreaterThan(notesAt)
  })
})

describe('immersive CMA price-opinion spine', () => {
  it('uses the same chapters and tap-pin hooks', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    expect(html).toContain('Price opinion · 850 Quince')
    expect(html).toContain('$465,000')
    expect(html).toContain('id="why-this-price"')
    expect(html).toContain('id="zillow"')
    expect(html).toContain('id="owner-notes"')
    expect(html).toContain('id="competition"')
    expect(html).toContain('123 Heritage')
    expect(html).toContain('id="evidence"')
    expect(html).toContain('data-comp="1"')
    expect(html).toContain('data-pin="1"')
    expect(html).toContain('id="your-street"')
    expect(html).toContain('id="ownership"')
    expect(html).toContain('id="net"')
    expect(html).toContain('id="proceeds-seed"')
    expect(html).not.toMatch(BANNED)
    expect(html).not.toContain('id="how-we-would-market"')
    expect(html).not.toContain('id="status-grid"')
  })
})
