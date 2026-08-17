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
    expect(html).toContain('What This Home Has')
    expect(html).toContain('Built in 2024')
    expect(html).toContain('5 bedrooms')
    expect(html).toContain('3,200 square feet of living space')
    expect(html).toContain('1.20 acres of ground')
    expect(html).toContain('The view: Mountain(s), Pond')
  })

  it('skips the section when fewer than two facts earn a mention', () => {
    const { html } = renderCmaHtml(args({ yearBuilt: 2024 }))
    expect(html).not.toContain('What This Home Has')
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
    const likeSection = html.split('What This Home Has')[1]?.split('<h2')[0] ?? ''
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

  it('names THIS home on the cover and falls back to the this-home plan', () => {
    const { html } = renderCmaHtml(args({}))
    expect(html).toContain('We built a market analysis for 123 Test Way')
    expect(html).toContain('listing video')
    expect(html).toContain('How we would market 123 Test Way')
    expect(html).not.toContain('What Every Listing Gets')
    expect(html).not.toMatch(/what your home is worth/i)
    const coverAt = html.indexOf('cover-title')
    const planAt = html.indexOf('How we would market 123 Test Way')
    const compsAt = html.indexOf('Where the comps sit')
    expect(coverAt).toBeGreaterThan(0)
    expect(planAt).toBeGreaterThan(coverAt)
    expect(compsAt === -1 || planAt < compsAt).toBe(true)
  })

  it('renders the this-home plan as the marketing hero when provided', () => {
    const { html } = renderCmaHtml(
      args(
        {},
        {
          thisHomePlan: [
            'For 123 Test Way we cut a listing video from this home\'s photos.',
            'For 123 Test Way we build a Just Listed flyer, a feature sheet, and an Instagram carousel from this address.',
            'For 123 Test Way we shoot a photo set made for this house.',
            'A written report every week it is listed: showings, saves, views, and what we are doing next.',
          ],
        },
      ),
    )
    expect(html).toContain('How we would market 123 Test Way')
    expect(html).toContain('listing video')
    expect(html).toContain('Also on this listing')
    expect(html).not.toContain('What Every Listing Gets')
  })

  it('the doc label and title never switch to audit', () => {
    const { html } = renderCmaHtml(withReview)
    expect(html).toContain('Comparative Market Analysis')
    expect(html).not.toContain('Listing Audit')
    expect(html).toContain('<title>CMA ·')
  })

  it('one artifact, two media: screen hides the print page header', () => {
    const { html } = renderCmaHtml(args({}))
    expect(html).toMatch(/@media screen \{\s*\.pg-header/)
    expect(html).toContain('@media print')
  })
})

describe('the failed-ask ceiling (applyFailedAskCap)', () => {
  const recentOff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()
  const staleOff = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString()
  function p(over: Partial<CmaPricing> = {}) {
    return { ...pricing, notes: [] as string[], needsReview: false, reviewReason: null, ...over }
  }

  it('clamps list tiers to the backtest quantiles of a recently failed ask', async () => {
    const { applyFailedAskCap } = await import('./expired-audit')
    const x = p({ conservative: 2100000, recommended: 2275000, highEnd: 2455000 })
    const r = applyFailedAskCap(x, { lastFailedListPrice: 1675000, offMarketDate: recentOff })
    expect(r.applied).toBe(true)
    // 0.942 and 0.982 of the $1,675,000 failed ask, rounded to $1K.
    expect(x.conservative).toBe(1578000)
    expect(x.recommended).toBe(1645000)
    expect(x.highEnd).toBe(1675000)
    expect(x.conservative).toBeLessThanOrEqual(x.recommended)
    expect(x.recommended).toBeLessThanOrEqual(x.highEnd)
    expect(r.cappedTo).toBe(1645000)
    expect(x.needsReview).toBe(true)
    expect(x.reviewReason).toContain('$2,275,000')
    expect(x.notes.join(' ')).toContain('3,394')
    expect(x.notes.join(' ')).toContain('94.2%')
  })

  it('the calibration constants match the committed research artifact', async () => {
    const { FAILED_ASK_BACKTEST } = await import('./expired-audit')
    const { readFileSync } = await import('node:fs')
    const artifact = JSON.parse(
      readFileSync(`docs/research/cma-backtest-${FAILED_ASK_BACKTEST.runstamp}.json`, 'utf8'),
    )
    expect(artifact.summary.pairs).toBe(FAILED_ASK_BACKTEST.pairs)
    expect(Math.round(artifact.summary.closeVsFailedAsk.median * 1000) / 1000).toBe(FAILED_ASK_BACKTEST.closeMedianRatio)
    expect(Math.round(artifact.summary.closeVsFailedAsk.p75 * 1000) / 1000).toBe(FAILED_ASK_BACKTEST.closeP75Ratio)
    expect(artifact.summary.shareClosedAboveFailedAsk).toBe(FAILED_ASK_BACKTEST.shareClosedAboveAskPct)
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

describe('report extras pages (when-to-list + competition)', () => {
  const extras = {
    seasonality: {
      byMonth: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthName: ['January','February','March','April','May','June','July','August','September','October','November','December'][i],
        closedCount: 40,
        medianDaysToPending: i === 4 ? 9 : i === 10 ? 41 : 20,
      })),
      fastestMonths: ['May', 'April'],
      slowestMonths: ['October', 'November'],
      yearsCovered: 3,
      totalClosed: 480,
      source: "Supabase listings, City='Bend', seasonality fixture",
    },
    band: {
      lo: 675000, hi: 825000, activeCount: 14, pendingCount: 5,
      activeMedianAsk: 749000, activeMedianDom: 31,
      source: "Supabase listings, City='Bend', band fixture",
    },
    subdivisionPulse: {
      name: 'Kenwood', closedCount: 7, medianClose: 712000, low: 640000, high: 815000, months: 12,
      source: "Supabase listings, SubdivisionName='Kenwood' fixture",
    },
    financing: {
      sampleCount: 500, cashPct: 31.5, conventionalPct: 55.2, fhaVaPct: 9.1, otherPct: 4.2,
      source: "Supabase listings, City='Bend', financing fixture",
    },
    photoBench: {
      subjectPhotos: 11, compPhotos: [{ address: 'a', photos: 38 }, { address: 'b', photos: 42 }, { address: 'c', photos: 40 }],
      compMedianPhotos: 40,
      source: 'Supabase listings photos_count fixture',
    },
  }

  it('renders both pages with every block and its source trace', () => {
    const { html } = renderCmaHtml(args({}, { extras }))
    expect(html).toContain('When to List')
    expect(html).toContain('480')
    expect(html).toContain('Median days to pending by close month')
    expect(html).toContain('May (9 days) and April')
    expect(html).toContain('Your Competition')
    expect(html).toContain('14 homes are for sale')
    expect(html).toContain('$749,000')
    expect(html).toContain('Kenwood, the last 12 months')
    expect(html).toContain('31.5% closed in cash')
    expect(html).toContain('median of 40 photos')
    expect(html).toContain('Closed single-family sales in Bend, grouped by close month.')
    expect(html).toContain('Active and pending listings in Bend in this price band.')
    expect(html).toContain('Bend sales in the last 12 months that reported financing.')
    expect(html).not.toMatch(/Supabase|seasonality fixture|band fixture|financing fixture/)
  })

  it('absent extras render neither page and no empty headings', () => {
    const { html } = renderCmaHtml(args({}))
    expect(html).not.toContain('When to List')
    expect(html).not.toContain('Your Competition')
  })

  it('a lone financing block still gets the competition page, without the others', () => {
    const { html } = renderCmaHtml(args({}, { extras: { ...extras, seasonality: null, band: null, subdivisionPulse: null, photoBench: null } }))
    expect(html).not.toContain('When to List')
    expect(html).toContain('Your Competition')
    expect(html).toContain('Who is buying here')
    expect(html).not.toContain('Your price band, live')
    expect(html).not.toContain('Presentation bench')
  })
})

describe('the subdivision story (print page + immersive scene)', () => {
  const story = {
    facts: {
      name: 'Stone Creek',
      totalSales: 41,
      years: [
        { year: 2023, count: 12, medianClose: 560000, medianPpsf: 270 },
        { year: 2024, count: 15, medianClose: 590000, medianPpsf: 281 },
        { year: 2025, count: 14, medianClose: 605000, medianPpsf: 288 },
      ],
      recordHigh: { price: 705000, address: '20572 Kira', date: '2025-06-10' },
      recordLow: { price: 498000, address: '20510 Byron', date: '2023-02-01' },
      medianDomRecent: 24,
      saleToListRecentPct: 98.6,
      subjectSqftPercentile: 72,
      vintageSpan: { min: 2019, max: 2025 },
      source: "Supabase listings, SubdivisionName='Stone Creek' story fixture",
    },
    sections: [
      { heading: 'A street that sells on consistency', body: 'Homes here sell in a tight band because the product is consistent.' },
    ],
    notableSales: [
      { listNumber: '220000001', address: '20572 Kira', closePrice: 705000, closeDate: '2025-06-10', sqft: 2526, photoUrl: null, line: 'The record sale carried the largest floor plan on the street.' },
    ],
    model: 'claude-sonnet-4-5',
    costUsd: 0.05,
    photoSalesReviewed: 1,
  }

  it('renders the story page with the year table, prose, and source', () => {
    const { html } = renderCmaHtml(args({}, { subdivisionStory: story }))
    expect(html).toContain('The Story of Stone Creek')
    expect(html).toContain('<td>2024</td><td>15</td><td>$590,000</td>')
    expect(html).toContain('A street that sells on consistency')
    expect(html).toContain('as large or larger than 72%')
    expect(html).toContain('$705,000')
    expect(html).toContain('Closed single-family sales in Stone Creek.')
    expect(html).not.toContain('story fixture')
    expect(html).not.toContain('claude-sonnet-4-5')
  })

  it('no story, no page', () => {
    const { html } = renderCmaHtml(args({}))
    expect(html).not.toContain('The Story of')
  })
})
