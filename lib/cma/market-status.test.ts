import { describe, expect, it } from 'vitest'
import { computeMarketArea, marketAreaPriceBand, similarBedRange } from './market-status'
import { listingTrendSvg, medianCloseLineSvg } from './market-charts'
import { immersiveWiderMarketChapters, renderStatusGridHtml } from './market-area-chapters'
import { renderImmersiveCmaHtml } from './immersive'
import type { RenderCmaArgs } from './render'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'
import type { CmaMarketAreaRow as AreaRow } from '@/lib/data/cma/marketAreaReads'

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: '1',
  streetAddress: '56628 Sunstone Loop',
  city: 'Bend',
  state: 'OR',
  postalCode: '97701',
  subdivision: 'Tetherow',
  latitude: null,
  longitude: null,
  beds: 4,
  baths: 3,
  sqft: 3200,
  lotAcres: 0.4,
  propertySubType: null,
  yearBuilt: 2018,
  garageSpaces: 3,
  photoUrl: 'https://cdn.example/sunstone.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Active',
  lastListPrice: 2_100_000,
  lastListDate: null,
  listingHistoryLine: null,
}

const pricing: CmaPricing = {
  method1Low: 2_000_000,
  method1Mid: 2_100_000,
  method1High: 2_200_000,
  method2: 2_080_000,
  method3: 2_120_000,
  convergenceSpreadPct: 3,
  converged: true,
  conservative: 2_000_000,
  recommended: 2_150_000,
  highEnd: 2_250_000,
  valueLow: 2_000_000,
  valueHigh: 2_250_000,
  confidence: 'High',
  confidenceReason: 'tight set',
  needsReview: false,
  reviewReason: null,
  compPpsfCv: 0.04,
  priceOverride: null,
  improvementsValueAdd: null,
  notes: [],
}

function row(over: Partial<AreaRow>): AreaRow {
  return {
    StandardStatus: 'Closed',
    ListPrice: 2_100_000,
    ClosePrice: 2_050_000,
    CloseDate: '2026-07-01',
    ListDate: '2026-05-01',
    OnMarketDate: '2026-05-01',
    TotalLivingAreaSqFt: 3100,
    BedroomsTotal: 4,
    BathroomsTotal: 3,
    DaysOnMarket: 28,
    CumulativeDaysOnMarket: 28,
    status_change_timestamp: '2026-07-01',
    SubdivisionName: 'Tetherow',
    ...over,
  }
}

function comp(over: Partial<CmaAdjustedComp> = {}): CmaAdjustedComp {
  return {
    listingKey: 'C1',
    mlsNumber: '2',
    address: '100 Tetherow',
    city: 'Bend',
    subdivision: 'Tetherow',
    latitude: null,
    longitude: null,
    beds: 4,
    baths: 3,
    sqft: 3000,
    lotAcres: 0.3,
    propertySubType: null,
    yearBuilt: 2017,
    photoUrl: 'https://cdn.example/comp.jpg',
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: 2_080_000,
    closePrice: 2_040_000,
    closeDate: '2026-06-15',
    daysToOffer: 14,
    domTotal: 21,
    selectionTier: 'subdivision',
    proximity: '0.3 miles',
    monthsSinceClose: 2,
    timeAdjustment: 0,
    timeAdjustedPrice: 2_040_000,
    ppsfTimeAdjusted: 680,
    sizeAdjustment: 0,
    adjustedPrice: 2_040_000,
    weight: 1,
    ...over,
  }
}

describe('market status grain', () => {
  it('drops a $59k lot and a $5M house from a $2.15M subject band', () => {
    const band = marketAreaPriceBand(2_150_000)!
    expect(band.lo).toBeGreaterThan(59_000)
    expect(band.hi).toBeLessThan(5_000_000)
    const area = computeMarketArea({
      subject,
      comps: [comp()],
      pricing,
      asOf: new Date('2026-08-17T00:00:00Z'),
      rows: [
        row({ ClosePrice: 59_000, ListPrice: 59_000, BedroomsTotal: 0, SubdivisionName: 'Other' }),
        row({ ClosePrice: 5_200_000, ListPrice: 5_200_000, BedroomsTotal: 6, SubdivisionName: 'Other' }),
        row({ ClosePrice: 2_000_000 }),
        row({ ClosePrice: 2_100_000, CloseDate: '2026-06-01' }),
        row({ ClosePrice: 2_200_000, CloseDate: '2026-05-01' }),
        row({ ClosePrice: 1_980_000, CloseDate: '2026-04-01' }),
        row({ ClosePrice: 2_050_000, CloseDate: '2026-03-01' }),
        row({ StandardStatus: 'Active', ListPrice: 2_175_000, ClosePrice: null, CloseDate: null }),
      ],
    })
    expect(area).not.toBeNull()
    expect(area!.grain).toBe('subdivision')
    expect(area!.closed?.count).toBe(5)
    expect(area!.closed?.low).toBeGreaterThan(100_000)
    expect(area!.closed?.high).toBeLessThan(3_000_000)
    expect(JSON.stringify(area)).not.toContain('2420000')
    expect(JSON.stringify(area)).not.toContain('2.42')
  })

  it('falls back to city + similar beds when the street is thin', () => {
    const thin: CmaSubject = { ...subject, subdivision: 'Unknown Court' }
    const area = computeMarketArea({
      subject: thin,
      comps: [comp()],
      pricing,
      asOf: new Date('2026-08-17T00:00:00Z'),
      rows: [
        row({ SubdivisionName: 'Westside', ClosePrice: 2_000_000, BedroomsTotal: 4 }),
        row({ SubdivisionName: 'Westside', ClosePrice: 2_100_000, BedroomsTotal: 3 }),
        row({ SubdivisionName: 'Westside', ClosePrice: 1_900_000, BedroomsTotal: 5 }),
        row({ StandardStatus: 'Expired', ListPrice: 2_250_000, ClosePrice: null, CloseDate: null, BedroomsTotal: 4 }),
      ],
    })
    expect(area!.grain).toBe('city-similar')
    expect(area!.label).toMatch(/Bend/)
    expect(area!.expired?.count).toBe(1)
  })

  it('omits an empty expired column and never prints N/A', () => {
    const area = computeMarketArea({
      subject,
      comps: [comp()],
      pricing,
      asOf: new Date('2026-08-17T00:00:00Z'),
      rows: [
        row({ ClosePrice: 2_000_000 }),
        row({ ClosePrice: 2_100_000, CloseDate: '2026-06-01' }),
        row({ ClosePrice: 2_200_000, CloseDate: '2026-05-01' }),
        row({ ClosePrice: 1_980_000, CloseDate: '2026-04-01' }),
        row({ ClosePrice: 2_050_000, CloseDate: '2026-03-01' }),
      ],
    })
    expect(area!.expired).toBeNull()
    const html = renderStatusGridHtml(area)
    expect(html).not.toMatch(/\bN\/A\b/)
    expect(html).toContain('These sales')
    expect(html).not.toContain('Expired or withdrawn')
  })

  it('builds a 90-day sold band for similar beds', () => {
    const area = computeMarketArea({
      subject,
      comps: [comp()],
      pricing,
      asOf: new Date('2026-08-17T00:00:00Z'),
      rows: [
        row({ CloseDate: '2026-07-20', ClosePrice: 2_000_000 }),
        row({ CloseDate: '2026-06-20', ClosePrice: 2_100_000 }),
        row({ CloseDate: '2026-06-01', ClosePrice: 2_200_000 }),
        row({ CloseDate: '2025-10-01', ClosePrice: 1_800_000 }),
        row({ CloseDate: '2026-01-01', ClosePrice: 2_050_000 }),
      ],
    })
    expect(area!.sold90?.count).toBe(3)
    expect(similarBedRange(4)).toEqual({ lo: 3, hi: 5 })
    expect(area!.sold90?.source).toMatch(/Closed 3 to 5 bedroom sales in Tetherow/)
    expect(area!.sold90?.source).not.toMatch(/bedroom sales in 3 to 5 bedroom homes/)
    expect(area!.source).toMatch(/Tetherow, priced/)
    expect(area!.source).not.toMatch(/Single-family homes in 3 to 5 bedroom homes/)
  })

  it('treats a zero days-on-market as missing on market-area rows', () => {
    const area = computeMarketArea({
      subject,
      comps: [comp({ domTotal: 32 })],
      pricing,
      asOf: new Date('2026-08-17T00:00:00Z'),
      rows: [
        row({ StandardStatus: 'Active', ListPrice: 2_175_000, ClosePrice: null, CloseDate: null, DaysOnMarket: 0, CumulativeDaysOnMarket: 0 }),
        row({ ClosePrice: 2_000_000, DaysOnMarket: 0, CumulativeDaysOnMarket: 0 }),
        row({ ClosePrice: 2_100_000, CloseDate: '2026-06-01', DaysOnMarket: 0, CumulativeDaysOnMarket: 0 }),
        row({ ClosePrice: 2_200_000, CloseDate: '2026-05-01', DaysOnMarket: 0, CumulativeDaysOnMarket: 0 }),
        row({ ClosePrice: 1_980_000, CloseDate: '2026-04-01', DaysOnMarket: 0, CumulativeDaysOnMarket: 0 }),
        row({ ClosePrice: 2_050_000, CloseDate: '2026-03-01', DaysOnMarket: 0, CumulativeDaysOnMarket: 0 }),
      ],
    })
    expect(area!.active?.medianDom).toBeNull()
    expect(area!.closed?.medianDom).toBeNull()
    expect(area!.selected.medianDom).toBe(32)
  })
})

describe('market charts', () => {
  it('draws a line through six priced months, not a lone dead bar', () => {
    const svg = medianCloseLineSvg(
      [1, 2, 3, 4, 5, 6].map((m) => ({
        periodStart: `2026-0${m}-01`,
        medianSalePrice: 2_000_000 + m * 10_000,
        soldCount: 8,
      })),
    )
    expect(svg).toContain('<path')
    expect(svg).toContain('M')
    expect(svg).not.toContain('<rect')
  })

  it('draws new-listing motion when four months have activity', () => {
    const svg = listingTrendSvg([
      { month: '2025-09', newListings: 2, medianAsk: 2_000_000 },
      { month: '2025-10', newListings: 4, medianAsk: 2_050_000 },
      { month: '2025-11', newListings: 3, medianAsk: 2_100_000 },
      { month: '2025-12', newListings: 5, medianAsk: 2_080_000 },
    ])
    expect(svg).toContain('<path')
    expect(svg).toContain('NEW LISTINGS')
    expect(svg).toContain('MEDIAN ASK')
    expect((svg.match(/<svg/g) ?? []).length).toBe(1)
  })

  it('keeps empty months and does not plot listing count on the asking-price scale', () => {
    // Diamond Bar 2465: Oct and Jan had no new lists. Filtering them out, then
    // independently scaling count (0–5) and ask ($395k–$420k) onto one axis,
    // is the same lie as plotting sale-count on a median-close chart.
    const svg = listingTrendSvg([
      { month: '2025-09', newListings: 2, medianAsk: 400_000 },
      { month: '2025-10', newListings: 0, medianAsk: null },
      { month: '2025-11', newListings: 4, medianAsk: 410_000 },
      { month: '2025-12', newListings: 3, medianAsk: 405_000 },
      { month: '2026-01', newListings: 0, medianAsk: null },
      { month: '2026-02', newListings: 1, medianAsk: 395_000 },
      { month: '2026-03', newListings: 2, medianAsk: 398_000 },
      { month: '2026-04', newListings: 5, medianAsk: 420_000 },
    ])
    expect(svg).toContain('Oct')
    expect(svg).toContain('Jan')
    expect(svg).toContain('$395K')
    expect(svg).toContain('$420K')
    expect(svg).toContain('>0</text>')
    expect(svg).toContain('>5</text>')
    expect(svg).not.toContain('stroke-dasharray')
    expect(svg).not.toContain('Solid line is new listings')
    expect(svg).toContain('NEW LISTINGS')
    expect(svg).toContain('MEDIAN ASK')
    expect((svg.match(/<svg/g) ?? []).length).toBe(1)
    expect(svg).not.toContain('rx="2"')
  })
})

const broker: CmaBroker = {
  id: null,
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201212071',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: null,
}

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  const area = computeMarketArea({
    subject,
    comps: [comp()],
    pricing,
    asOf: new Date('2026-08-17T00:00:00Z'),
    rows: [
      row({ ClosePrice: 2_000_000, CloseDate: '2026-07-20' }),
      row({ ClosePrice: 2_100_000, CloseDate: '2026-06-20' }),
      row({ ClosePrice: 2_200_000, CloseDate: '2026-06-01' }),
      row({ ClosePrice: 1_980_000, CloseDate: '2026-04-01' }),
      row({ ClosePrice: 2_050_000, CloseDate: '2026-03-01' }),
      row({ StandardStatus: 'Active', ListPrice: 2_175_000, ClosePrice: null, CloseDate: null }),
    ],
  })
  return {
    subject,
    comps: [comp({ keepTier: 'strong', keepReason: 'Same community and living area' })],
    market: {
      geoSlug: 'bend',
      geoLabel: 'Bend',
      periodStart: '2025-08-17',
      periodEnd: '2026-08-17',
      soldCount365: 40,
      medianSalePrice: 2_050_000,
      medianDom: 32,
      medianPpsf: 680,
      saleToListRatio: 0.98,
      yoyMedianPriceDeltaPct: 2.1,
      activeCount: 12,
      pendingCount: 3,
      monthsOfSupply: 3.8,
      mosFormula: 'pulse',
      marketVerdict: 'seller',
      methodologyVersion: 'v3-2026-05-07',
      computedAt: '2026-08-17',
      pulseUpdatedAt: '2026-08-17',
      trend: [1, 2, 3, 4, 5, 6].map((m) => ({
        periodStart: `2026-0${m}-01`,
        medianSalePrice: 2_000_000 + m * 8_000,
        soldCount: 6,
        endOfPeriodInventory: 20,
      })),
    },
    pricing,
    broker,
    client: { name: 'Pat', email: null, phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-08-17T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    extras: {
      seasonality: null,
      band: null,
      subdivisionPulse: null,
      financing: null,
      photoBench: null,
      marketArea: area,
    },
    site: null,
    ...over,
  }
}

describe('chapter order', () => {
  it('puts why and the three sales before the wider-market charts', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    const why = html.indexOf('id="why-this-price"')
    const evidence = html.indexOf('id="evidence"')
    const sold = html.indexOf('id="sold-90"')
    const inv = html.indexOf('id="inventory"')
    expect(why).toBeGreaterThan(0)
    expect(evidence).toBeGreaterThan(why)
    expect(sold).toBeGreaterThan(evidence)
    expect(inv).toBeGreaterThan(sold)
    expect(html).not.toContain('id="status-grid"')
    expect(html).not.toContain('id="photo-set"')
    expect(html).toContain('Same community and living area')
    expect(html).not.toMatch(/\bN\/A\b/)
    expect(html).not.toContain('2,420,000')
    expect(html).toMatch(/\.page-num,\.pg-num/)
  })

  it('omits empty chapter HTML when extras are missing', () => {
    const html = immersiveWiderMarketChapters(args({ extras: null }))
    expect(html).not.toContain('id="status-grid"')
    expect(html).toContain('id="inventory"')
    expect(html).not.toContain('id="photo-set"')
  })

  it('leads the wider market with a sold hero and a supply punch, not a status dump', () => {
    const html = immersiveWiderMarketChapters(args())
    expect(html).not.toContain('status-hero')
    expect(html).not.toContain('status-tiles')
    expect(html).not.toContain('compare-board')
    expect(html).toContain('sold-hero')
    expect(html).toContain('id="sold-90"')
    expect(html).toContain('sc-navy')
    expect(html).toMatch(/Seller(&#39;|')s market/)
    expect(html).toContain('inv-hero')
    expect(html).not.toContain('photo-lead')
    expect(html).not.toMatch(/>0 days</)
    expect(html).not.toMatch(/bedroom sales in \d+ to \d+ bedroom homes/)
  })
})
