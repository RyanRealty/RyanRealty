/**
 * Seller CMA is a principal-broker letter on cream stock, not a product UI.
 * Capsule chrome (pills, chips, badges) is banned on every seller path.
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { renderImmersiveCmaHtml } from './immersive'
import { cmaStylesheet } from './render-css'
import { immersiveStylesheet } from './immersive-css'
import { assembleCompFlyerPages } from './opinion-flyers'
import { propertyUsePage } from './render-use-of-property'
import { zoningExplainerBlock } from './render-blocks'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'
import type { DevelopmentOpportunities } from './development'

const CAPSULE = /flyer-badge|class="verdict|class="chips"|vb-pill|num-chip|prox-chip/
const PILL_RADIUS = /border-radius:\s*999px/

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

function args(): RenderCmaArgs {
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
  }
}

const development: DevelopmentOpportunities = {
  jurisdiction: 'City of Redmond',
  zone: 'R-2',
  verifiedAsOf: '2026-07-30',
  zoningExplainer: {
    zone: 'R-2',
    zoneName: 'Limited Residential',
    purpose: 'Redmond R-2 holds single-unit homes at a limited density.',
    permittedOutright: ['Single-unit dwelling', 'Accessory dwelling'],
    conditional: ['Day care'],
    dimensional: [{ label: 'Minimum lot', value: '6,000 sqft' }],
    citation: 'RDC 8.135',
    url: 'https://www.codepublishing.com/OR/Redmond/',
  },
  items: [
    {
      topic: 'ADU',
      verdict: 'yes',
      headline: 'An accessory dwelling is allowed on this lot.',
      detail: 'The lot meets the size test.',
      citation: 'RDC 8.141',
      url: 'https://www.codepublishing.com/OR/Redmond/',
    },
  ],
  buyerOptions: [],
  hoa: null,
  marketingHighlights: [],
  disclaimer: 'This is a preliminary read of published code, not a land-use decision.',
  resources: [],
}

describe('CMA letter register — no capsule chrome', () => {
  it('print HTML has no pills, chips, or flyer badges', () => {
    const { html } = renderCmaHtml(args())
    expect(html).not.toMatch(CAPSULE)
    expect(html).not.toMatch(PILL_RADIUS)
  })

  it('immersive HTML has no pills, chips, or flyer badges', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    expect(html).not.toMatch(CAPSULE)
    expect(html).not.toMatch(PILL_RADIUS)
  })

  it('stylesheets do not draw capsules', () => {
    expect(cmaStylesheet('https://ryan-realty.com')).not.toMatch(PILL_RADIUS)
    expect(immersiveStylesheet()).not.toMatch(PILL_RADIUS)
  })

  it('comp flyers use a kicker line, not a badge', () => {
    const [page] = assembleCompFlyerPages([comp])
    expect(page.body).toContain('class="flyer-kicker"')
    expect(page.body).toContain('Closed Jun 2026')
    expect(page.body).not.toMatch(CAPSULE)
  })

  it('use-of-property marks answers in type, not chips', () => {
    const page = propertyUsePage({ streetAddress: '850 Quince', development, rental: null })
    expect(page).not.toBeNull()
    expect(page!.body).toContain('class="status-mark')
    expect(page!.body).toContain('Allowed')
    expect(page!.body).not.toMatch(CAPSULE)
    expect(zoningExplainerBlock(development)).not.toMatch(CAPSULE)
    expect(zoningExplainerBlock(development)).toContain('class="use-list"')
    expect(zoningExplainerBlock(development)).toContain('Single-unit dwelling')
  })
})
