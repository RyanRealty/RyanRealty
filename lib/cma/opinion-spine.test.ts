/**
 * Seller CMA is one price-opinion spine on every path.
 * Numbers come from the pricing unit. This is not a Quince one-off.
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { renderImmersiveCmaHtml } from './immersive'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'
import type { CmaMarketArea } from './market-status'

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

const marketArea: CmaMarketArea = {
  grain: 'subdivision',
  label: 'Heritage Ranch',
  source: 'Oregon Data Share MLS. Heritage Ranch.',
  priceLo: 400000,
  priceHi: 600000,
  selected: {
    key: 'selected',
    label: 'These sales',
    count: 1,
    low: 485000,
    median: 485000,
    high: 485000,
    medianPpsf: 307,
    medianDom: 14,
  },
  active: {
    key: 'active',
    label: 'For sale now',
    count: 2,
    low: 450000,
    median: 469000,
    high: 480000,
    medianPpsf: 290,
    medianDom: 12,
  },
  pending: {
    key: 'pending',
    label: 'Under contract',
    count: 1,
    low: 470000,
    median: 470000,
    high: 470000,
    medianPpsf: 300,
    medianDom: 8,
  },
  expired: {
    key: 'expired',
    label: 'Expired or withdrawn',
    count: 1,
    low: 515000,
    median: 515000,
    high: 515000,
    medianPpsf: 320,
    medianDom: 90,
  },
  closed: {
    key: 'closed',
    label: 'Closed, last 12 months',
    count: 8,
    low: 430000,
    median: 475000,
    high: 520000,
    medianPpsf: 295,
    medianDom: 22,
  },
  sold90: {
    count: 4,
    low: 450000,
    median: 478000,
    high: 510000,
    bedsLabel: '3 bedroom / 2 bath',
    source: 'Closed 3 bedroom 2 bath sales in Heritage Ranch in the last 90 days.',
  },
  listingTrend: [
    { month: '2026-03', newListings: 3, medianAsk: 480000 },
    { month: '2026-04', newListings: 2, medianAsk: 475000 },
    { month: '2026-05', newListings: 4, medianAsk: 490000 },
    { month: '2026-06', newListings: 1, medianAsk: 470000 },
  ],
}

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

function firstPage(html: string): string {
  const start = html.indexOf('class="page')
  const next = html.indexOf('class="page', start + 1)
  return next > 0 ? html.slice(start, next) : html.slice(start)
}

const BANNED = /how we would market|what we would do|not the (whole )?ZIP|High confidence|Moderate confidence|Confidence:|Method 1|Method 2|Method 3|RVM/i

describe('print CMA price-opinion spine', () => {
  it('always renders cover numbers, snapshot, facts, sales/map/matrix, disclosure', () => {
    const { html } = renderCmaHtml(args())
    const cover = firstPage(html)
    expect(cover).toContain('Recommended list')
    expect(cover).toContain('$475,000')
    expect(cover).toContain('List $470,000 to $490,000')
    expect(cover).not.toContain('Expected close')
    expect(html).toContain('<h2 class="section">The house</h2>')
    expect(html).toContain('<h2 class="section">Property facts</h2>')
    expect(html).toContain('The sales that set the number')
    expect(html).toContain('Side by side')
    expect(html).toContain('Comp map')
    expect(html).toContain('12 Pine')
    expect(html).toContain('data-comp="1"')
    expect(html).toContain('<h2 class="section">Disclosure</h2>')
    expect(html).not.toMatch(BANNED)
    const recAt = html.indexOf('$475,000')
    const snapAt = html.indexOf('<h2 class="section">The house</h2>')
    const factsAt = html.indexOf('<h2 class="section">Property facts</h2>')
    const salesAt = html.indexOf('The sales that set the number')
    const discAt = html.indexOf('<h2 class="section">Disclosure</h2>')
    expect(recAt).toBeGreaterThan(0)
    expect(snapAt).toBeGreaterThan(recAt)
    expect(factsAt).toBeGreaterThan(snapAt)
    expect(salesAt).toBeGreaterThan(factsAt)
    expect(discAt).toBeGreaterThan(salesAt)
  })

  it('omits legal, photos, status, 90-day, permits, and seller net when those extras are unknown', () => {
    const { html } = renderCmaHtml(args())
    expect(html).not.toContain('Legal, owner, and flood')
    expect(html).not.toContain('<h2 class="section">Photos</h2>')
    expect(html).not.toContain('Status in this market')
    expect(html).not.toContain('What 3 bedroom / 2 bath homes sold for')
    expect(html).not.toContain('Permits and ownership')
    expect(html).not.toContain('Seller net at list')
  })

  it('renders conditional chapters when extras and sellerNet are provided', () => {
    const { html } = renderCmaHtml(
      args({
        extras: {
          seasonality: null,
          band: null,
          subdivisionPulse: null,
          financing: null,
          photoBench: null,
          marketArea,
          sold90: marketArea.sold90,
          photos: {
            current: ['https://cdn.example/now.jpg'],
            historical: ['https://cdn.example/old.jpg'],
          },
          legal: {
            parcel: '123456',
            taxlot: '151000000',
            owner: 'Pat Lee',
            timeOwned: '8 years',
            vesting: 'tenants by the entirety',
            flood: { zone: 'X', inSFHA: false },
          },
          permits: [{ type: 'Building', permit: 'B-88', status: 'Final' }],
          ownershipHistory: [
            { date: '2018-06-01', owner: 'Pat Lee', event: 'Purchase', price: 320000 },
          ],
        },
        pricing: {
          ...pricing,
          sellerNet: {
            expectedConcessions: 8000,
            predictedSellerNet: 457000,
            knownCount: 3,
            givenCount: 2,
            medianWhenGiven: 10000,
            rate: 0.67,
          },
        },
      }),
    )
    expect(html).toContain('Legal, owner, and flood')
    expect(html).toContain('151000000')
    expect(html).toContain('Zone X. Not a Special Flood Hazard Area.')
    expect(html).toContain('<h2 class="section">Photos</h2>')
    expect(html).toContain('Current listing')
    expect(html).toContain('Earlier listings')
    expect(html).toContain('https://cdn.example/now.jpg')
    expect(html).toContain('Status in this market')
    expect(html).toContain('These sales')
    expect(html).toContain('For sale now')
    expect(html).toContain('What 3 bedroom / 2 bath homes sold for')
    expect(html).toContain('How fast this market is moving')
    expect(html).toContain('New listings and asking prices')
    expect(html).toContain('Permits and ownership')
    expect(html).toContain('B-88')
    expect(html).toContain('Seller net at list')
    expect(html).toContain('Net at recommended list')
    expect(html).toContain('$467,000')
    expect(html).not.toMatch(BANNED)
    const factsAt = html.indexOf('<h2 class="section">Property facts</h2>')
    const legalAt = html.indexOf('Legal, owner, and flood')
    const photosAt = html.indexOf('<h2 class="section">Photos</h2>')
    const statusAt = html.indexOf('Status in this market')
    const soldAt = html.indexOf('What 3 bedroom / 2 bath homes sold for')
    const kpiAt = html.indexOf('How fast this market is moving')
    const trendAt = html.indexOf('New listings and asking prices')
    const salesAt = html.indexOf('The sales that set the number')
    const permitsAt = html.indexOf('Permits and ownership')
    const netAt = html.indexOf('Seller net at list')
    const discAt = html.indexOf('<h2 class="section">Disclosure</h2>')
    expect(legalAt).toBeGreaterThan(factsAt)
    expect(photosAt).toBeGreaterThan(legalAt)
    expect(statusAt).toBeGreaterThan(photosAt)
    expect(soldAt).toBeGreaterThan(statusAt)
    expect(kpiAt).toBeGreaterThan(soldAt)
    expect(trendAt).toBeGreaterThan(kpiAt)
    expect(salesAt).toBeGreaterThan(trendAt)
    expect(permitsAt).toBeGreaterThan(salesAt)
    expect(netAt).toBeGreaterThan(permitsAt)
    expect(discAt).toBeGreaterThan(netAt)
  })
})

describe('immersive CMA price-opinion spine', () => {
  it('uses the same chapters and tap-pin hooks', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    expect(html).toContain('Price opinion · 850 Quince')
    expect(html).toContain('$475,000')
    expect(html).toContain('id="why-this-price"')
    expect(html).toContain('id="competition"')
    expect(html).toContain('123 Heritage')
    expect(html).toContain('id="evidence"')
    expect(html).toContain('data-comp="1"')
    expect(html).toContain('data-pin="1"')
    expect(html).toContain('id="your-street"')
    expect(html).not.toMatch(BANNED)
    expect(html).not.toContain('id="how-we-would-market"')
    expect(html).not.toContain('id="status-grid"')
  })
})
