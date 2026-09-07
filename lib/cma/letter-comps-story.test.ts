/**
 * Matt HARD LOCK: letter HTML always carries the four comps-story beats —
 * sales that set the list; expired peers (what happened); live competition;
 * DOM + listing history on each home. No “you overpriced.”
 */
import { describe, expect, it } from 'vitest'
import { renderBandRivalsHtml } from '@/lib/cma/band-rivals'
import { renderCompMatrixHtml } from '@/lib/cma/comp-matrix'
import { renderExpiredPeersHtml } from '@/lib/cma/market-area-chapters'
import { assembleOpinionPages } from '@/lib/cma/opinion-pages'
import { assembleOpinionScenes } from '@/lib/cma/opinion-scenes'
import type { CmaExtras } from '@/lib/cma/extras'
import type { CmaExpiredPeer, CmaMarketArea } from '@/lib/cma/market-status'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject: CmaSubject = {
  listingKey: 'S1',
  mlsNumber: '220159911',
  streetAddress: '15991 Falcon',
  city: 'La Pine',
  state: 'OR',
  postalCode: '97739',
  subdivision: 'Falcon',
  latitude: 43.7,
  longitude: -121.5,
  beds: 3,
  baths: 2,
  sqft: 1450,
  lotAcres: 0.25,
  propertySubType: 'Single Family Residence',
  yearBuilt: 1998,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 525000,
  lastListDate: '2026-03-01',
  listingHistoryLine: 'Asked $549,000, cut to $525,000, came off expired · 97 days on market.',
}

const sold: CmaAdjustedComp = {
  listingKey: 'C1',
  mlsNumber: '1',
  address: '12 Pine',
  city: 'La Pine',
  subdivision: 'Falcon',
  latitude: 43.71,
  longitude: -121.5,
  beds: 3,
  baths: 2,
  sqft: 1400,
  lotAcres: 0.2,
  propertySubType: 'Single Family Residence',
  yearBuilt: 1999,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 510000,
  originalListPrice: 529000,
  closePrice: 497800,
  closeDate: '2026-04-10',
  daysToOffer: 20,
  domTotal: 42,
  onMarketDate: '2026-02-01',
  listingHistoryLine: 'Listed at $529,000, sold at $497,800 · 42 days on market',
  selectionTier: 'same-sub',
  monthsSinceClose: 4,
  timeAdjustment: 0,
  timeAdjustedPrice: 497800,
  ppsfTimeAdjusted: 355,
  sizeAdjustment: 0,
  adjustedPrice: 497800,
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
  photoUrl: null,
}

const pricing = {
  method1Low: 480000,
  method1Mid: 497000,
  method1High: 510000,
  method2: 495000,
  method3: 500000,
  conservative: 485000,
  recommended: 497800,
  highEnd: 510000,
  valueLow: 485000,
  valueHigh: 510000,
  predictedClose: 490000,
  confidence: 'High',
  confidenceReason: 'Tight set.',
  needsReview: false,
  reviewReason: null,
  notes: [],
  priceOverride: null,
  improvementsValueAdd: null,
  convergenceSpreadPct: null,
  converged: true,
  compPpsfCv: 0.05,
} as unknown as CmaPricing

const peer: CmaExpiredPeer = {
  listingKey: 'E1',
  address: '88 Wren',
  listPrice: 519000,
  originalListPrice: 549000,
  status: 'Expired',
  daysOnMarket: 97,
  onMarketDate: '2026-01-15',
  photoUrl: null,
  listingHistoryLine: 'Asked $549,000, cut to $519,000, came off expired · 97 days on market',
  beds: 3,
  baths: 2,
  sqft: 1420,
  yearBuilt: 1997,
  lotAcres: 0.22,
  propertySubType: 'Single Family Residence',
  latitude: 43.705,
  longitude: -121.501,
}

const marketArea: CmaMarketArea = {
  grain: 'city-similar',
  label: '3 bedroom homes in La Pine',
  source: 'test',
  priceLo: 300000,
  priceHi: 700000,
  selected: {
    key: 'selected',
    label: 'Selected comps',
    count: 1,
    low: 497800,
    median: 497800,
    high: 497800,
    medianPpsf: 355,
    medianDom: 42,
  },
  active: null,
  pending: null,
  expired: {
    key: 'expired',
    label: 'Expired or withdrawn',
    count: 1,
    low: 519000,
    median: 519000,
    high: 519000,
    medianPpsf: null,
    medianDom: 97,
  },
  closed: null,
  sold90: null,
  listingTrend: null,
  outcomes: {
    lo: 420000,
    hi: 570000,
    sold: [480000, 497800, 510000],
    unsold: [519000, 540000],
    list: 497800,
    lastAsk: 525000,
    soldShown: 3,
    unsoldShown: 2,
    soldTotal: 3,
    unsoldTotal: 2,
    label: '3 bedroom homes in La Pine',
    source: 'test',
  },
  expiredPeers: [peer],
}

const extras: CmaExtras = {
  seasonality: null,
  band: {
    lo: 450000,
    hi: 550000,
    activeCount: 1,
    pendingCount: 0,
    activeMedianAsk: 505000,
    activeMedianDom: 28,
    source: 'test',
    rivals: [
      {
        listingKey: 'R1',
        address: '44 Hawk',
        listPrice: 505000,
        status: 'Active',
        daysOnMarket: 28,
        photoUrl: null,
        latitude: 43.702,
        longitude: -121.5,
        beds: 3,
        baths: 2,
        sqft: 1460,
        yearBuilt: 2000,
        lotAcres: 0.24,
        propertySubType: 'Single Family Residence',
        originalListPrice: 525000,
        onMarketDate: '2026-08-01',
        listingHistoryLine: 'Listed at $525,000, now $505,000 · 28 days on market',
      },
    ],
  },
  subdivisionPulse: null,
  financing: null,
  photoBench: null,
  marketArea,
}


function fiveSales(seed: CmaAdjustedComp): CmaAdjustedComp[] {
  return Array.from({ length: 5 }, (_, i) => ({
    ...seed,
    listingKey: `C${i + 1}`,
    address: i === 0 ? seed.address : `${20 + i} Peer`,
    adjustedPrice: (seed.adjustedPrice ?? seed.closePrice) + i * 1000,
  }))
}

describe('Matt HARD LOCK — comps story beats in letter HTML', () => {
  it('matrix carries sales that set the list with DOM + listing history on subject and comps', () => {
    const html = renderCompMatrixHtml(subject, fiveSales(sold))
    expect(html).toContain('The sales that set this price')
    expect(html).toContain('Days on market')
    expect(html).toContain('Listing history')
    expect(html).toContain('42')
    expect(html).toContain('Listed at $529,000, sold at $497,800 · 42 days on market')
    expect(html).toContain('Asked $549,000, cut to $525,000, came off expired · 97 days on market')
  })

  it('expired peers name homes and show what happened without saying overpriced', () => {
    const html = renderExpiredPeersHtml(subject, [peer])
    expect(html).toContain('Near you, these asked and did not sell')
    expect(html).toContain('88 Wren')
    expect(html).toContain('comp-matrix')
    expect(html).toContain('Last ask')
    expect(html).toContain('Days on market')
    expect(html).toContain('Listing history')
    expect(html).toContain('Asked $549,000, cut to $519,000, came off expired · 97 days on market')
    expect(html.toLowerCase()).not.toContain('overprice')
  })

  it('competition shows active rivals with DOM + price history', () => {
    const html = renderBandRivalsHtml({
      city: 'La Pine',
      lo: 450000,
      hi: 550000,
      activeCount: 1,
      pendingCount: 0,
      rivals: extras.band!.rivals!,
      subject: {
        beds: 3,
        baths: 2,
        sqft: 1450,
        yearBuilt: 1998,
        lotAcres: 0.25,
        recommendedList: 497800,
        latitude: 43.7,
        longitude: -121.5,
        listingHistoryLine: subject.listingHistoryLine,
        daysOnMarket: 97,
      },
    })
    expect(html).toContain('Who you are competing with at this price')
    expect(html).toContain('44 Hawk')
    expect(html).toContain('Listed at $525,000, now $505,000 · 28 days on market')
    // P5, Matt 2026-09-07: the subject's own listing history belongs to Home
    // location and, on an expired document, to Your last listing. Stating it a
    // third time inside the competition rows is the duplication he called out.
    expect(html).not.toContain('97 days on market')
  })

  it('print spine orders comps → expired peers → competition', () => {
    const pages = assembleOpinionPages({
      subject,
      comps: fiveSales(sold),
      market: null,
      pricing,
      extras,
      generatedAtIso: '2026-09-06T12:00:00.000Z',
      mapDataUri: null,
      excludedOutliers: [],
    })
    const bodies = pages.map((p) => p.body).join('\n')
    const salesIdx = bodies.indexOf('The sales that set this price')
    const expiredIdx = bodies.indexOf('Near you, these asked and did not sell')
    const compIdx = bodies.indexOf('Who you are competing with at this price')
    expect(salesIdx).toBeGreaterThan(-1)
    expect(expiredIdx).toBeGreaterThan(salesIdx)
    expect(compIdx).toBeGreaterThan(expiredIdx)
  })

  it('immersive spine carries the same four beats', () => {
    const html = assembleOpinionScenes({
      subject,
      comps: fiveSales(sold),
      market: null,
      pricing,
      extras,
      broker,
      generatedAtIso: '2026-09-06T12:00:00.000Z',
      mapDataUri: null,
    })
    expect(html).toContain('The sales that set this price')
    expect(html).toContain('Near you, these asked and did not sell')
    expect(html).toContain('id="competition"')
    expect(html).toContain('days on market')
    expect(html.toLowerCase()).not.toContain('overprice')
  })
})
