/**
 * "What we like about this home" + the single-doc fold — render-level rules
 * (Matt 2026-08-05). Pure: renderCmaHtml over a fixed fixture, no DB.
 *
 *  1. The section renders ONLY subject-attribute facts — never the
 *     development/rental highlight prose (first render leaked rental-rule
 *     explainers into the warm read; caught in browser verification).
 *  2. Fewer than two facts → no section (no thin filler).
 *  3. The last-listing review renders from findings; the retired audit-only
 *     pages (services standard, net sheet) never render; the doc label and
 *     title never switch to "Listing Audit".
 *  4. One artifact, two media: the screen CSS hides the per-page print header.
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml } from './render'
import type { RenderCmaArgs } from './render'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'

const baseSubject: CmaSubject = {
  listingKey: null,
  mlsNumber: null,
  streetAddress: '123 Test Way',
  city: 'Bend',
  state: 'OR',
  postalCode: '97701',
  subdivision: null,
  latitude: 44.06,
  longitude: -121.31,
  beds: 3,
  baths: 2,
  sqft: 1800,
  lotAcres: 0.2,
  propertySubType: null,
  yearBuilt: 2005,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: 4200,
  standardStatus: null,
  lastListPrice: null,
  lastListDate: null,
  listingHistoryLine: null,
}

const comp: CmaAdjustedComp = {
  listingKey: 'C1',
  mlsNumber: '220000001',
  address: '456 Comp St',
  city: 'Bend',
  subdivision: null,
  latitude: 44.05,
  longitude: -121.3,
  beds: 3,
  baths: 2,
  sqft: 1850,
  lotAcres: 0.22,
  propertySubType: null,
  yearBuilt: 2006,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: 4300,
  listPrice: 720000,
  closePrice: 712000,
  closeDate: '2026-05-15',
  daysToOffer: 12,
  domTotal: 12,
  selectionTier: 'primary',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 712000,
  ppsfTimeAdjusted: 385,
  sizeAdjustment: -2000,
  adjustedPrice: 710000,
  weight: 1,
}

const pricing: CmaPricing = {
  method1Low: 690000,
  method1Mid: 715000,
  method1High: 740000,
  method2: 718000,
  method3: 712000,
  convergenceSpreadPct: 1.2,
  converged: true,
  conservative: 705000,
  recommended: 715000,
  highEnd: 735000,
  valueLow: 690000,
  valueHigh: 740000,
  confidence: 'High',
  confidenceReason: 'tight comp set',
  needsReview: false,
  reviewReason: null,
  compPpsfCv: 0.04,
  priceOverride: null,
  improvementsValueAdd: null,
  notes: [],
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

function args(subject: Partial<CmaSubject>, extra?: Partial<RenderCmaArgs>): RenderCmaArgs {
  return {
    subject: { ...baseSubject, ...subject },
    comps: [comp],
    market: null,
    pricing,
    broker,
    client: { name: 'Test Seller', email: 'seller@test.invalid', phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-08-05T00:00:00.000Z',
    subjectTrace: 'subject trace',
    compTrace: ['comp trace'],
    excludedOutliers: [],
    sellerImprovementsText: null,
    site: null,
    expiredAudit: null,
    development: null,
    ...extra,
  }
}

describe('what we like about this home', () => {
  it('renders subject facts and nothing else', () => {
    const { html } = renderCmaHtml(
      args({ yearBuilt: 2024, beds: 5, sqft: 3200, lotAcres: 1.2, viewDescription: 'Mountain(s), Pond' }),
    )
    expect(html).toContain('What We Like About This Home')
    expect(html).toContain('Built in 2024')
    expect(html).toContain('5 bedrooms')
    expect(html).toContain('3,200 square feet of living space')
    expect(html).toContain('1.20 acres of ground')
    expect(html).toContain('The view: Mountain(s), Pond')
  })

  it('skips the section when fewer than two facts earn a mention', () => {
    const { html } = renderCmaHtml(args({ yearBuilt: 2024 }))
    expect(html).not.toContain('What We Like About This Home')
  })

  it('never pulls development or rental highlight prose into the warm read', () => {
    const { html } = renderCmaHtml(
      args(
        { yearBuilt: 2024, beds: 5 },
        {
          rental: {
            disclaimer: 'd',
            economicsNote: 'e',
            tenures: [],
            income: [],
            marketingHighlights: [{ headline: 'RENTAL_HIGHLIGHT_SENTINEL', basis: 'sentinel basis' }],
          } as unknown as RenderCmaArgs['rental'],
        },
      ),
    )
    const likeSection = html.split('What We Like About This Home')[1]?.split('<h2')[0] ?? ''
    expect(likeSection).not.toContain('RENTAL_HIGHLIGHT_SENTINEL')
  })
})

describe('the single-doc fold', () => {
  const withReview = args(
    {},
    {
      expiredAudit: {
        findings: [
          { lens: 'pricing', fact: 'Listed at $800,000 against a supported $715,000.', meaning: 'The ask priced past the evidence.' },
        ],
        services: ['SERVICES_SENTINEL'],
        netSheet: { salePrice: 715000, lines: [], totalCosts: 0, estimatedNet: 715000, netConservative: 705000, netHighEnd: 735000, assumptions: ['NET_SHEET_SENTINEL'] },
        feeLine: 'FEE_SENTINEL',
      },
    },
  )

  it('renders the last-listing review, never the retired audit pages', () => {
    const { html } = renderCmaHtml(withReview)
    expect(html).toContain('Your Last Listing')
    expect(html).toContain('Under each one is our take')
    expect(html).not.toContain('What Every Listing Gets')
    expect(html).not.toContain('Estimated Seller Net Sheet')
    expect(html).not.toContain('SERVICES_SENTINEL')
    expect(html).not.toContain('NET_SHEET_SENTINEL')
  })

  it('the doc label and title never switch to audit', () => {
    const { html } = renderCmaHtml(withReview)
    expect(html).toContain('Comparative Market Analysis')
    expect(html).not.toContain('Listing Audit')
    expect(html).toContain('<title>CMA ·')
  })

  it('one artifact, two media: screen hides the print page header', () => {
    const { html } = renderCmaHtml(args({}))
    expect(html).toContain('@media screen { .pg-header { display: none; } }')
    expect(html).toContain('@media print')
  })
})

describe('the failed-ask ceiling (applyFailedAskCap)', () => {
  const recentOff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()
  const staleOff = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString()
  function p(over: Partial<CmaPricing> = {}) {
    return { ...pricing, notes: [] as string[], needsReview: false, reviewReason: null, ...over }
  }

  it('caps every list tier at a recently failed ask and flags review', async () => {
    const { applyFailedAskCap } = await import('./expired-audit')
    const x = p({ conservative: 2100000, recommended: 2275000, highEnd: 2455000 })
    const r = applyFailedAskCap(x, { lastFailedListPrice: 1675000, offMarketDate: recentOff })
    expect(r.applied).toBe(true)
    expect(x.recommended).toBe(1675000)
    expect(x.highEnd).toBe(1675000)
    expect(x.conservative).toBeLessThanOrEqual(1675000)
    expect(x.needsReview).toBe(true)
    expect(x.reviewReason).toContain('$2,275,000')
    expect(x.notes.join(' ')).toContain('will not recommend relisting above')
  })

  it('does nothing when the recommendation already respects the failed ask', async () => {
    const { applyFailedAskCap } = await import('./expired-audit')
    const x = p({ conservative: 590000, recommended: 610000, highEnd: 640000 })
    const r = applyFailedAskCap(x, { lastFailedListPrice: 715000, offMarketDate: recentOff })
    expect(r.applied).toBe(false)
    expect(x.recommended).toBe(610000)
    expect(x.needsReview).toBe(false)
  })

  it('a stale failure (past the recency window) does not bind', async () => {
    const { applyFailedAskCap } = await import('./expired-audit')
    const x = p({ recommended: 800000, highEnd: 830000 })
    const r = applyFailedAskCap(x, { lastFailedListPrice: 600000, offMarketDate: staleOff })
    expect(r.applied).toBe(false)
    expect(x.recommended).toBe(800000)
  })

  it('missing ask or date fails open (no cap, no crash)', async () => {
    const { applyFailedAskCap } = await import('./expired-audit')
    expect(applyFailedAskCap(p(), { lastFailedListPrice: null, offMarketDate: recentOff }).applied).toBe(false)
    expect(applyFailedAskCap(p(), { lastFailedListPrice: 500000, offMarketDate: null }).applied).toBe(false)
  })
})
