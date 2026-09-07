import { describe, expect, it } from 'vitest'
import {
  collapseExpiredPeerCycles,
  computeMarketArea,
  marketAreaPriceBand,
  pickExpiredPeers,
  similarBedRange,
  type CmaExpiredPeer,
} from './market-status'
import { daysToOfferSvg, medianCloseLineSvg } from './market-charts'
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
    expect(html).toContain('Used for the recommend')
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

  it('plots closed sale prices against last asks that never sold, in the list band', () => {
    const area = computeMarketArea({
      subject: { ...subject, lastListPrice: 2_400_000 },
      comps: [comp()],
      pricing,
      asOf: new Date('2026-08-17T00:00:00Z'),
      rows: [
        row({ ClosePrice: 2_000_000 }),
        row({ ClosePrice: 2_050_000, CloseDate: '2026-06-01' }),
        row({ ClosePrice: 2_100_000, CloseDate: '2026-05-01' }),
        row({ ClosePrice: 2_080_000, CloseDate: '2026-04-01' }),
        row({
          StandardStatus: 'Expired',
          ListPrice: 2_300_000,
          ClosePrice: 9_999_000,
          CloseDate: null,
        }),
        row({
          StandardStatus: 'Withdrawn',
          ListPrice: 2_350_000,
          ClosePrice: null,
          CloseDate: null,
        }),
        row({
          StandardStatus: 'Expired',
          ListPrice: 5_200_000,
          ClosePrice: null,
          CloseDate: null,
        }),
      ],
    })
    const o = area!.outcomes
    expect(o).not.toBeNull()
    expect(o!.sold).toEqual(expect.arrayContaining([2_000_000, 2_050_000, 2_100_000, 2_080_000]))
    expect(o!.unsold).toEqual(expect.arrayContaining([2_300_000, 2_350_000]))
    expect(o!.unsold).not.toContain(9_999_000)
    expect(o!.unsold).not.toContain(5_200_000)
    expect(o!.list).toBe(2_150_000)
    expect(o!.lastAsk).toBe(2_400_000)
    expect(o!.hi).toBeGreaterThanOrEqual(2_400_000)
    expect(o!.source).toMatch(/Closed = sale price/)
    expect(o!.source).toMatch(/last ask/)
  })

  it('omits the outcomes strip when nothing in the band failed to sell', () => {
    const area = computeMarketArea({
      subject,
      comps: [comp()],
      pricing,
      asOf: new Date('2026-08-17T00:00:00Z'),
      rows: [
        row({ ClosePrice: 2_000_000 }),
        row({ ClosePrice: 2_100_000, CloseDate: '2026-06-01' }),
        row({ ClosePrice: 2_200_000, CloseDate: '2026-05-01' }),
      ],
    })
    expect(area!.outcomes).toBeNull()
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


describe('pickExpiredPeers', () => {
  const subj = {
    beds: 3,
    sqft: 1450,
    latitude: 43.7,
    longitude: -121.5,
    listingKey: 'FALCON-15991',
    mlsNumber: '220123456',
    streetAddress: '15991 Falcon',
  }

  it('excludes the subject by listing key and by address (U1)', () => {
    const peers = pickExpiredPeers(
      [
        row({
          ListingKey: 'FALCON-15991',
          StreetNumber: '15991',
          StreetName: 'Falcon',
          StandardStatus: 'Canceled',
          ListPrice: 575_000,
          ClosePrice: null,
          CloseDate: null,
          DaysOnMarket: 137,
          CumulativeDaysOnMarket: 137,
          BedroomsTotal: 3,
          TotalLivingAreaSqFt: 1450,
        }),
        row({
          ListingKey: 'OTHER-1',
          StreetNumber: '88',
          StreetName: 'Wren',
          StandardStatus: 'Expired',
          ListPrice: 519_000,
          ClosePrice: null,
          CloseDate: null,
          DaysOnMarket: 97,
          CumulativeDaysOnMarket: 97,
          BedroomsTotal: 3,
          TotalLivingAreaSqFt: 1420,
        }),
        row({
          ListingKey: 'ADDR-DUP',
          StreetNumber: '15991',
          StreetName: 'Falcon Ln',
          StandardStatus: 'Expired',
          ListPrice: 560_000,
          ClosePrice: null,
          CloseDate: null,
          DaysOnMarket: 40,
          CumulativeDaysOnMarket: 40,
          BedroomsTotal: 3,
          TotalLivingAreaSqFt: 1450,
        }),
      ],
      subj,
    )
    expect(peers.map((p) => p.address)).toEqual(['88 Wren'])
    expect(peers.every((p) => p.listingKey !== 'FALCON-15991')).toBe(true)
  })

  it('collapses same-address cycles into one peer with both histories (U2)', () => {
    const peers = pickExpiredPeers(
      [
        row({
          ListingKey: 'W-JAN',
          StreetNumber: '15935',
          StreetName: 'Woodchip',
          StandardStatus: 'Expired',
          ListPrice: 475_000,
          OriginalListPrice: 475_000,
          ClosePrice: null,
          CloseDate: null,
          OnMarketDate: '2026-01-10',
          ListDate: '2026-01-10',
          status_change_timestamp: '2026-03-31',
          DaysOnMarket: 80,
          CumulativeDaysOnMarket: 80,
          BedroomsTotal: 3,
          TotalLivingAreaSqFt: 1400,
        }),
        row({
          ListingKey: 'W-JUN',
          StreetNumber: '15935',
          StreetName: 'Woodchip',
          StandardStatus: 'Canceled',
          ListPrice: 450_000,
          OriginalListPrice: 450_000,
          ClosePrice: null,
          CloseDate: null,
          OnMarketDate: '2026-06-01',
          ListDate: '2026-06-01',
          status_change_timestamp: '2026-07-11',
          DaysOnMarket: 40,
          CumulativeDaysOnMarket: 40,
          BedroomsTotal: 3,
          TotalLivingAreaSqFt: 1400,
          Latitude: 43.701,
          Longitude: -121.501,
        }),
      ],
      subj,
    )
    expect(peers).toHaveLength(1)
    expect(peers[0]!.address).toBe('15935 Woodchip')
    expect(peers[0]!.listingHistoryLine).toMatch(/came off/i)
    expect(peers[0]!.listingHistoryLine).toMatch(/\d+ days on market/i)
    // Both cycles retained in history
    expect(peers[0]!.listingHistoryLine).toMatch(/450,000/)
    expect(peers[0]!.listingHistoryLine).toMatch(/475,000/)
  })

  it('populates peer DOM from MLS or on→off dates and finishes history (U3)', () => {
    const peers = pickExpiredPeers(
      [
        row({
          ListingKey: 'DOM-MLS',
          StreetNumber: '12',
          StreetName: 'Pine',
          StandardStatus: 'Expired',
          ListPrice: 500_000,
          ClosePrice: null,
          CloseDate: null,
          OnMarketDate: '2026-01-01',
          DaysOnMarket: 0,
          CumulativeDaysOnMarket: 0,
          status_change_timestamp: '2026-04-11',
          BedroomsTotal: 3,
          TotalLivingAreaSqFt: 1400,
        }),
      ],
      subj,
    )
    expect(peers).toHaveLength(1)
    expect(peers[0]!.daysOnMarket).toBe(100)
    expect(peers[0]!.listingHistoryLine).toMatch(/came off expired · 100 days on market/)
  })

  it('collapseExpiredPeerCycles merges duplicate addresses without dropping DOM', () => {
    const a: CmaExpiredPeer = {
      listingKey: 'A1',
      address: '15935 Woodchip',
      listPrice: 475000,
      originalListPrice: null,
      status: 'Expired',
      daysOnMarket: 80,
      onMarketDate: '2026-01-10',
      photoUrl: null,
      listingHistoryLine: 'Listed Jan at $475,000, came off expired · 80 days on market',
      beds: 3,
      baths: 2,
      sqft: 1400,
      yearBuilt: 1990,
      lotAcres: 0.2,
      propertySubType: 'Single Family Residence',
      latitude: null,
      longitude: null,
    }
    const b: CmaExpiredPeer = {
      ...a,
      listingKey: 'A2',
      listPrice: 450000,
      daysOnMarket: 40,
      onMarketDate: '2026-06-01',
      listingHistoryLine: 'Listed Jun at $450,000, came off canceled · 40 days on market',
    }
    const out = collapseExpiredPeerCycles([a, b])
    expect(out).toHaveLength(1)
    expect(out[0]!.daysOnMarket).toBe(40) // newest cycle primary
    expect(out[0]!.listingHistoryLine).toContain('80 days on market')
    expect(out[0]!.listingHistoryLine).toContain('40 days on market')
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
    expect(svg).toContain('Median close')
    expect(svg).not.toContain('<rect')
  })

  // The new-listing month ledger was deleted 2026-09-07 (P4, Matt): one to
  // three listings a month and a row of dashes told a seller nothing. What
  // replaced it is the days-to-offer strip — every kept sale on one days axis
  // against the subject's own listing, which never got an offer at all.
  it('draws every kept sale and the subject on one days axis', () => {
    const svg = daysToOfferSvg(
      [
        { label: '1. 730 Quince', days: 1, subject: false, valueLabel: '1 day' },
        { label: '2. 840 Quince', days: 4, subject: false, valueLabel: '4 days' },
        { label: '3. 735 Oak', days: 51, subject: false, valueLabel: '51 days' },
        { label: '2465 7th', days: 192, subject: true, valueLabel: '192 days, no offer' },
      ],
      'How fast homes like yours went',
    )
    expect(svg).toContain('730 Quince')
    expect(svg).toContain('192 days, no offer')
    // Every bar is directly labelled, so an axis tick would only repeat one.
    expect(svg.match(/192 days/g)).toHaveLength(1)
    expect(svg).not.toContain('month-ledger')
  })

  it('says nothing rather than draw two sales as a chart', () => {
    const svg = daysToOfferSvg(
      [
        { label: '1. 730 Quince', days: 1, subject: false, valueLabel: '1 day' },
        { label: '2465 7th', days: 192, subject: true, valueLabel: '192 days, no offer' },
      ],
      'How fast homes like yours went',
    )
    expect(svg).toBe('')
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
    comps: Array.from({ length: 5 }, (_, i) =>
      comp({
        keepTier: 'strong',
        keepReason: 'Same community and living area',
        address: `${i + 1} Peer Ave`,
        listingKey: `C${i + 1}`,
        adjustedPrice: 2_000_000 + i * 10_000,
      }),
    ),
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
  it('puts why and the three sales before the wider-market chapter', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    const why = html.indexOf('id="what-its-worth"')
    const market = html.indexOf('id="this-market"')
    const sold = html.indexOf('id="sold-90"')
    expect(why).toBeGreaterThan(0)
    expect(market).toBeGreaterThan(why)
    expect(sold).toBeGreaterThan(market)
    // P4: the month ledger is gone; the days-to-offer strip took its place.
    expect(html).not.toContain('id="listing-trend"')
    expect(html).not.toContain('id="status-grid"')
    expect(html).not.toContain('id="photo-set"')
    expect(html).toContain('Sale price today')
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

  it('leads the wider market with the sold hero, then the inventory board', () => {
    const html = immersiveWiderMarketChapters(args())
    expect(html).not.toContain('status-hero')
    expect(html).not.toContain('status-tiles')
    expect(html).not.toContain('compare-board')
    expect(html).toContain('sold-hero')
    expect(html).toContain('id="sold-90"')
    // ONE register: cream throughout, navy on the cover and the closing only.
    expect(html).not.toContain('sc-navy')
    expect(html).not.toContain('id="listing-trend"')
    expect(html).toContain('id="inventory"')
    // F7: the board is one stat row, months of supply first with its verdict
    // under it. The 42px hero over a stacked list is gone.
    expect(html).toContain('<div class="stat-strip is-4">')
    expect(html).not.toContain('inv-hero')
    expect(html).not.toContain('photo-lead')
    expect(html).not.toMatch(/>0 days</)
    expect(html).not.toMatch(/bedroom sales in \d+ to \d+ bedroom homes/)
  })

  it('keeps the inventory supply punch when the listing trend data is absent', () => {
    const base = args()
    const area = base.extras?.marketArea
    const html = immersiveWiderMarketChapters(
      args({
        extras: base.extras && area
          ? { ...base.extras, marketArea: { ...area, listingTrend: null } }
          : null,
      }),
    )
    expect(html).toContain('sold-hero')
    expect(html).toContain('id="sold-90"')
    expect(html).toContain('id="inventory"')
    expect(html).toMatch(/Seller(&#39;|')s market/)
    expect(html).toContain('<div class="stat-strip is-4">')
    expect(html).toContain('months of supply')
  })
})
