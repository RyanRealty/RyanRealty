/**
 * Critiquito re-check tip d2e9a363 residuals (C1/C3/C4/C9 + peers/history).
 * Letter path: one comps path on screen, ≤2 charts, one comps map, no flyers.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { renderImmersiveCmaHtml } from './immersive'
import { assembleOpinionPages } from './opinion-pages'
import { assembleOpinionScenes } from './opinion-scenes'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'
import type { CmaExtras } from './extras'
import type { CmaMarketArea } from './market-status'
import { listingHistoryLine } from './listing-history-line'

const subject: CmaSubject = {
  listingKey: 'S1',
  mlsNumber: '220159911',
  streetAddress: '15991 Falcon',
  city: 'La Pine',
  state: 'OR',
  postalCode: '97739',
  subdivision: 'Tall Pines',
  latitude: 43.7,
  longitude: -121.5,
  beds: 3,
  baths: 2,
  sqft: 1600,
  lotAcres: 0.25,
  propertySubType: 'Single Family Residence',
  yearBuilt: 1998,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/falcon.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 525000,
  lastListDate: '2026-03-01',
  listingHistoryLine: 'Listed Mar 1, 2026 at $549,000, cut to $525,000, came off expired · 97 days on market',
}

const comp: CmaAdjustedComp = {
  listingKey: 'C1',
  mlsNumber: '1',
  address: '12 Pine',
  city: 'La Pine',
  subdivision: 'Tall Pines',
  latitude: 43.71,
  longitude: -121.51,
  beds: 3,
  baths: 2,
  sqft: 1580,
  lotAcres: 0.22,
  propertySubType: null,
  yearBuilt: 1999,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 510000,
  originalListPrice: 529000,
  closePrice: 500000,
  closeDate: '2026-06-01',
  daysToOffer: 10,
  domTotal: 20,
  onMarketDate: '2026-05-01',
  listingHistoryLine:
    'Listed May 1, 2026 at $529,000, cut to $510,000, sold Jun 1, 2026 at $500,000 · 20 days on market',
  selectionTier: 'subdivision',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 500000,
  ppsfTimeAdjusted: 316,
  sizeAdjustment: 0,
  adjustedPrice: 500000,
  weight: 1,
}

function fiveSales(seed: CmaAdjustedComp): CmaAdjustedComp[] {
  return Array.from({ length: 5 }, (_, i) => ({
    ...seed,
    listingKey: `C${i + 1}`,
    address: i === 0 ? seed.address : `${10 + i} Pine`,
    adjustedPrice: seed.adjustedPrice + i * 1000,
  }))
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
  confidence: 'High',
  confidenceReason: 'Tight set.',
  needsReview: false,
  reviewReason: null,
  notes: [],
  priceOverride: null,
  predictedClose: 490000,
} as unknown as CmaPricing

const marketArea: CmaMarketArea = {
  grain: 'city-similar',
  label: '3 bedroom homes in La Pine',
  source: 'test',
  priceLo: 300000,
  priceHi: 700000,
  selected: {
    key: 'selected',
    label: 'Selected',
    count: 3,
    low: 480000,
    median: 500000,
    high: 520000,
    medianPpsf: 310,
    medianDom: 20,
  },
  active: null,
  pending: null,
  expired: null,
  closed: null,
  sold90: {
    count: 12,
    median: 495000,
    low: 400000,
    high: 600000,
    bedsLabel: '3 bedroom / 2 bath',
    source: 'test',
  },
  listingTrend: [
    { month: '2026-01', newListings: 10, medianAsk: 520000 },
    { month: '2026-02', newListings: 8, medianAsk: 515000 },
    { month: '2026-03', newListings: 12, medianAsk: 510000 },
    { month: '2026-04', newListings: 9, medianAsk: 505000 },
    { month: '2026-05', newListings: 11, medianAsk: 500000 },
    { month: '2026-06', newListings: 7, medianAsk: 498000 },
  ],
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
  expiredPeers: [
    {
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
    },
  ],
}

const extras = {
  seasonality: null,
  band: { lo: 450000, hi: 550000, activeCount: 2, pendingCount: 1, rivals: [] },
  subdivisionPulse: null,
  financing: null,
  photoBench: null,
  marketArea,
  sold90: null,
  photos: null,
  legal: null,
  permits: null,
  ownershipHistory: null,
  propertyFacts: null,
} as unknown as CmaExtras

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  return {
    subject,
    comps: fiveSales(comp),
    market: {
      geoLabel: 'La Pine',
      medianSalePrice: 450000,
      medianDom: 40,
      saleToListRatio: 0.98,
      monthsOfSupply: 4.2,
      trend: [
        { month: '2026-01', medianClose: 440000 },
        { month: '2026-02', medianClose: 450000 },
        { month: '2026-03', medianClose: 455000 },
      ],
    } as unknown as RenderCmaArgs['market'],
    pricing,
    broker,
    client: { name: 'Owner', email: null, phone: null, notes: null },
    mapDataUri: 'data:image/png;base64,COMPSMAP',
    subjectMapDataUri: 'data:image/png;base64,SUBJECTMAP',
    generatedAtIso: '2026-09-06T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    extras,
    tiersUsed: ['subdivision'],
    ...over,
  }
}

describe('Falcon letter residuals (C1/C3/C4/C9)', () => {
  it('C1: one sales path — summary stack on screen markup, matrix for print, no flyer/strip/Subject·Sale dump', () => {
    const { html } = renderCmaHtml(args())
    const immersive = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    for (const doc of [html, immersive]) {
      expect(doc).toContain('The sales that set this price')
      expect(doc).toContain('comp-stack-card')
      expect(doc).toContain('Sale price today')
      expect(doc).not.toContain('class="flyer-title"')
      expect(doc).not.toContain('class="comp-strip"')
      expect(doc).not.toContain('comp-stack-cols')
      expect(doc).not.toContain('>Subject</span><span class="h c">Sale</')
      expect(doc).not.toContain('Marker key')
    }
    expect(html).toContain('comp-matrix')
    const salesHits = (html.match(/The sales that set this price/g) ?? []).length
    expect(salesHits).toBe(1)
  })

  it('C9: exactly one comps pin-map when mapDataUri exists; never subject-only; cover keeps photo', () => {
    const { html } = renderCmaHtml(args())
    const immersive = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    for (const doc of [html, immersive]) {
      const pins = doc.match(/class="pin-map"/g) ?? []
      expect(pins.length).toBe(1)
      expect(doc).toContain('COMPSMAP')
      expect(doc).not.toContain('SUBJECTMAP')
      expect(doc).toContain('Where those sales are')
    }
    expect(html).toContain('cdn.example/falcon.jpg')
    expect(html).not.toContain('<h2 class="section">THE HOUSE</h2>')
  })

  // C3 counted charts because the letter had grown a chart dump. P4 (Matt
  // 2026-09-07) replaced the counting rule with a question rule: every chart
  // answers one seller question and no two answer the same one. The month
  // ledger of new listings answered none, so it is gone.
  it('P4: no month ledger of new listings anywhere', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    expect(html).not.toContain('month-ledger')
    expect(html).not.toContain('New listings and asking prices')
    expect(html).not.toContain('id="listing-trend"')
  })

  it('C4: screen stylesheet stacks comps without Subject·Sale 3-col dump; print restores matrix', () => {
    const css = readFileSync(join(process.cwd(), 'lib/cma/render-css-sections.ts'), 'utf8')
    const immersive = readFileSync(join(process.cwd(), 'lib/cma/immersive-css.ts'), 'utf8')
    // F2 (Matt 2026-09-07): ONE matrix with thumbnails is the comps view at
    // reading width on both documents. The stack is the phone fallback only.
    expect(css).toMatch(/\.comp-stack \{ display: none;/)
    expect(css).toMatch(/\.comp-matrix-wrap \{ display: block;/)
    expect(css).toMatch(/@media screen and \(max-width: 700px\) \{[\s\S]{0,200}\.comp-stack \{ display: block;/)
    expect(css).toMatch(/@media print \{[\s\S]*\.comp-matrix-wrap \{[^}]*display:\s*block/)
    expect(css).not.toContain('comp-stack-cols')
    expect(css).not.toContain('grid-template-columns: 1.1fr 1fr 1fr')
    expect(immersive).not.toContain('comp-stack-cols')
    expect(immersive).toContain('overflow-wrap:anywhere')
  })

  it('expired peers beat is visible in Matt voice', () => {
    const pages = assembleOpinionPages({
      subject,
      comps: fiveSales(comp),
      market: null,
      pricing,
      extras,
      mapDataUri: 'data:image/png;base64,COMPSMAP',
      generatedAtIso: '2026-09-06T00:00:00.000Z',
      excludedOutliers: [],
    })
    const body = pages.map((p) => p.body).join('\n')
    expect(body).toContain('Near you, these asked and did not sell')
    expect(body).toContain('88 Wren')
    expect(body.toLowerCase()).not.toContain('overprice')
  })

  it('thickens sold listing/price history when dates exist', () => {
    const line = listingHistoryLine({
      listPrice: 510000,
      originalListPrice: 529000,
      closePrice: 500000,
      status: 'Closed',
      onMarketDate: '2026-05-01',
      closeDate: '2026-06-01',
      daysOnMarket: 20,
    })
    expect(line).toMatch(/Listed .+ at \$529,000/)
    expect(line).toContain('cut to $510,000')
    expect(line).toMatch(/sold .+ at \$500,000/)
    expect(line).toContain('20 days on market')
  })

  it('immersive story order: unsold peers → the sales that set the price → competition', () => {
    const html = assembleOpinionScenes({
      subject,
      comps: fiveSales(comp),
      market: null,
      pricing,
      extras,
      mapDataUri: 'data:image/png;base64,COMPSMAP',
      broker,
      generatedAtIso: '2026-09-06T00:00:00.000Z',
    })
    // CMA_REIMAGINED_2026-09-07.md reordered this: the unsold listings are
    // chapter 2's evidence that priced high sits, so they come BEFORE the
    // number they explain, and competition follows the number.
    const salesAt = html.indexOf('The sales that set this price')
    const peersAt = html.indexOf('Near you, these asked and did not sell')
    const competitionAt = html.indexOf('id="competition"')
    expect(peersAt).toBeGreaterThan(0)
    expect(salesAt).toBeGreaterThan(peersAt)
    expect(competitionAt).toBeGreaterThan(salesAt)
  })
})
