/**
 * Print CMA must be one map, no empty letter sheets, no contents filler.
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { salesAndMapPage, subdivisionChapterPage } from './opinion-pages'
import { printWiderMarketPages } from './market-area-chapters'
import { cmaStylesheet } from './render-css'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'
import type { SubdivisionStory } from './subdivision-story'

const subject = {
  streetAddress: '648 SE Douglas Street',
  city: 'Bend',
  subdivision: 'Clear Sky Estates',
  postalCode: '97702',
  state: 'OR',
  beds: 3,
  baths: 1,
  sqft: 1056,
  latitude: 44.052,
  longitude: -121.291,
} as CmaSubject

const comp = {
  listingKey: 'C1',
  mlsNumber: '1',
  address: '947 SE 6th Street',
  city: 'Bend',
  subdivision: 'Clear Sky Estates',
  latitude: 44.05,
  longitude: -121.29,
  beds: 3,
  baths: 1,
  sqft: 1036,
  closePrice: 495000,
  adjustedPrice: 465744,
  timeAdjustment: 0,
  sizeAdjustment: 0,
  weight: 1,
  closeDate: '2026-06-10',
  photoUrl: 'https://cdn.example/6th.jpg',
  selectionTier: 'subdivision',
} as CmaAdjustedComp

const pricing = {
  conservative: 465000,
  recommended: 472000,
  highEnd: 495000,
  valueLow: 448000,
  valueHigh: 480000,
  predictedClose: 452000,
  method3: 464000,
  notes: [],
} as unknown as CmaPricing

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

const story: SubdivisionStory = {
  facts: {
    name: 'Clear Sky Estates',
    totalSales: 12,
    years: [{ year: 2025, count: 4, medianClose: 480000, medianPpsf: 450 }],
    recordHigh: { price: 495000, address: '947 6th', date: '2026-06-10' },
    recordLow: { price: 390000, address: '600 Douglas', date: '2023-01-01' },
    medianDomRecent: 12,
    saleToListRecentPct: 98,
    subjectSqftPercentile: 40,
    vintageSpan: { min: 1976, max: 1980 },
    source: 'fixture',
  },
  sections: [{ heading: 'A tight street', body: 'Sales cluster.' }],
  notableSales: [],
  model: 'x',
  costUsd: 0,
  photoSalesReviewed: 0,
}

function args(): RenderCmaArgs {
  return {
    subject,
    comps: [comp],
    market: null,
    pricing,
    broker,
    client: { name: 'Pat', email: null, phone: null, notes: null },
    mapDataUri: 'data:image/png;base64,aaa',
    generatedAtIso: '2026-08-18T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    subdivisionStory: story,
  }
}

describe('print CMA layout', () => {
  it('keeps one map on the sales chapter, not a pin map plus a second static map', () => {
    const page = salesAndMapPage({
      subject,
      comps: [comp],
      market: null,
      pricing,
      mapDataUri: 'data:image/png;base64,aaa',
      generatedAtIso: '2026-08-18T00:00:00.000Z',
      excludedOutliers: [],
    })
    expect(page.body).toContain('pin-map')
    expect(page.body).toContain('data:image/png;base64,aaa')
    expect(page.body).not.toContain('class="map-img"')
    expect(page.body).not.toContain('<svg')
    expect(page.body).toContain('comp-matrix')
    expect(page.body).toContain('Side by side')
    expect(page.body).toContain('Sale price / sqft')
    expect(page.body).toContain('Lot sqft')
  })

  it('does not reprint the same static map on the subdivision chapter', () => {
    const page = subdivisionChapterPage({
      subject,
      comps: [comp],
      market: null,
      pricing,
      mapDataUri: 'data:image/png;base64,aaa',
      generatedAtIso: '2026-08-18T00:00:00.000Z',
      excludedOutliers: [],
      subdivisionStory: story,
    })
    expect(page).not.toBeNull()
    expect(page!.body).not.toContain('class="map-img"')
  })

  it('does not insert a contents sheet', () => {
    const { html } = renderCmaHtml(args())
    expect(html).not.toContain('>Contents<')
    expect(html).not.toContain('class="toc"')
  })

  it('does not force every inner sheet to 11 inches of empty cream', () => {
    const css = cmaStylesheet('https://ryan-realty.com')
    expect(css).not.toMatch(/@media screen \{[^}]*\.page \{[^}]*min-height:\s*11in/)
    expect(css).toMatch(/\.page-flyer/)
  })

  it('keeps the wider market on one sheet', () => {
    const pages = printWiderMarketPages({
      subject,
      comps: [comp],
      market: {
        geoSlug: 'bend',
        geoLabel: 'Bend',
        periodStart: '2025-08-18',
        periodEnd: '2026-08-18',
        soldCount365: 1200,
        medianSalePrice: 650000,
        medianDom: 28,
        medianPpsf: 380,
        saleToListRatio: 0.98,
        yoyMedianPriceDeltaPct: 2,
        activeCount: 400,
        pendingCount: 80,
        monthsOfSupply: 3.2,
        mosFormula: 'active / (closed_6mo / 6)',
        marketVerdict: 'seller',
        methodologyVersion: 'v3-2026-05-07',
        computedAt: '2026-08-18T00:00:00.000Z',
        pulseUpdatedAt: '2026-08-18T00:00:00.000Z',
      },
      extras: {
        marketArea: {
          grain: 'city-similar',
          label: 'Bend',
          source: 'Closed sales in this market area over the last 90 days.',
          priceLo: 400000,
          priceHi: 900000,
          selected: {
            key: 'selected',
            label: 'Selected',
            count: 3,
            low: 448000,
            median: 465000,
            high: 480000,
            medianPpsf: 440,
            medianDom: 12,
          },
          active: null,
          pending: null,
          expired: null,
          closed: null,
          sold90: {
            count: 40,
            median: 640000,
            low: 420000,
            high: 890000,
            bedsLabel: '2 to 4 bedroom',
            source: 'Closed sales in this market area over the last 90 days.',
          },
          listingTrend: null,
        },
      },
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].body).toContain('What 2 to 4 bedroom homes sold for')
    expect(pages[0].body).toContain('How fast this market is moving')
  })
})
