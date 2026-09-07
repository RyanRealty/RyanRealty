/**
 * Cos C9 + Matt lock: letter embeds at most one map image even when both
 * mapDataUri and subjectMapDataUri would otherwise exist. Place CTAs carry
 * doc UTM for the analytics pipe (rr-doc-tracker + utm).
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { resolveCmaPlaceLinks } from './cma-place-links'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'

const subject: CmaSubject = {
  listingKey: null,
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
  propertySubType: null,
  yearBuilt: 1998,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/falcon.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 525000,
  lastListDate: '2026-03-01',
  listingHistoryLine: null,
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
  closePrice: 500000,
  closeDate: '2026-06-01',
  daysToOffer: 10,
  domTotal: 20,
  selectionTier: 'subdivision',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 500000,
  ppsfTimeAdjusted: 316,
  sizeAdjustment: 0,
  adjustedPrice: 500000,
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
} as unknown as CmaPricing

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  return {
    subject,
    comps: [comp],
    market: null,
    pricing,
    broker,
    client: { name: 'Owner', email: null, phone: null, notes: null },
    mapDataUri: 'data:image/png;base64,COMPSMAP',
    subjectMapDataUri: 'data:image/png;base64,SUBJECTMAP',
    generatedAtIso: '2026-09-06T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    ...over,
  }
}

describe('CMA letter — one map (C9)', () => {
  it('renders at most one pin-map img when both map URIs exist', () => {
    const { html } = renderCmaHtml(args())
    const pinImgs = html.match(/<img class="pin-map"[^>]*>/g) ?? []
    expect(pinImgs.length).toBeLessThanOrEqual(1)
    expect(html).toContain('data:image/png;base64,COMPSMAP')
    expect(html).not.toContain('data:image/png;base64,SUBJECTMAP')
    // Cover hero uses MLS photo, not the subject map.
    expect(html).toContain('cdn.example/falcon.jpg')
    expect(html).not.toMatch(/class="hero-photo"[^>]*SUBJECTMAP/)
  })

  it('keeps comps map full-width via pin-map-wrap, not a tiny decorative second map', () => {
    const { html } = renderCmaHtml(args())
    expect(html).toContain('pin-map-wrap')
    expect(html).toContain('pin-map-wrap')
    expect(html).toContain('comp-stack')
  })
})

describe('CMA letter — tracked place links', () => {
  it('stamps doc UTM on public place hrefs', () => {
    const links = resolveCmaPlaceLinks({ city: 'Bend', subdivisionName: 'Awbrey Glen' })
    expect(links.length).toBeGreaterThan(0)
    for (const l of links) {
      expect(l.href).toMatch(/utm_source=crm/)
      expect(l.href).toMatch(/utm_medium=doc/)
      expect(l.href).toMatch(/utm_campaign=cma-letter/)
    }
  })
})
