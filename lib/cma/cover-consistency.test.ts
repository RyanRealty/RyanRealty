/**
 * §0 self-consistency contract for the cover page: a client must never read
 * a confidence label that contradicts the document's own needsReview flag,
 * and must never see a recommended list price sitting outside the printed
 * "supported" range. Both defects were found by an adversarial audit of the
 * live cma-20513-byron document (Audit verdict: fail, needsReview true,
 * recommended $609,000 outside the printed $620,000-$635,000 range while the
 * cover still read "High confidence").
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { renderImmersiveCmaHtml } from './immersive'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: '220214213',
  streetAddress: '20513 Byron',
  city: 'Bend',
  state: 'OR',
  postalCode: '97702',
  subdivision: 'Stone Creek',
  latitude: 44.06,
  longitude: -121.31,
  beds: 4,
  baths: 3,
  sqft: 2222,
  lotAcres: 0.1,
  propertySubType: null,
  yearBuilt: 2023,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Canceled',
  lastListPrice: 619999,
  lastListDate: '2026-05-01',
  listingHistoryLine: null,
}

const comp: CmaAdjustedComp = {
  listingKey: 'C1',
  mlsNumber: '1',
  address: '61593 Lorenzo',
  city: 'Bend',
  subdivision: 'Stone Creek',
  latitude: 44.05,
  longitude: -121.3,
  beds: 5,
  baths: 3,
  sqft: 2219,
  lotAcres: 0.08,
  propertySubType: null,
  yearBuilt: 2020,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 619900,
  closePrice: 619900,
  closeDate: '2026-06-10',
  daysToOffer: 7,
  domTotal: 42,
  selectionTier: 'subdivision',
  monthsSinceClose: 2,
  timeAdjustment: -644,
  timeAdjustedPrice: 619256,
  ppsfTimeAdjusted: 279,
  sizeAdjustment: 419,
  adjustedPrice: 619675,
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

/** The cma-20513-byron shape: comp evidence $620k-$635k, recommendation
 *  clamped to $609,000 by applyFailedAskCap, needsReview true because of it,
 *  but confidence still the raw 'High' computePricing landed on from the
 *  comp stats alone (build.ts/expired-audit.ts never touch confidence). */
function byronPricing(overrides: Partial<CmaPricing> = {}): CmaPricing {
  return {
    method1Low: 621000,
    method1Mid: 630000,
    method1High: 637000,
    method2: 624000,
    method3: 630000,
    convergenceSpreadPct: 1,
    converged: true,
    conservative: 584000,
    recommended: 609000,
    highEnd: 619999,
    valueLow: 620000,
    valueHigh: 635000,
    confidence: 'High',
    confidenceReason: 'Three methods converged within 1%.',
    needsReview: true,
    reviewReason:
      'Comp evidence supported $630,000 against the $619,999 asking that just failed. List tiers clamped to the failed-ask backtest quantiles (median 0.942, p75 0.982, cap 1.00).',
    compPpsfCv: 0.02,
    priceOverride: null,
    improvementsValueAdd: null,
    notes: [],
    ...overrides,
  }
}

function byronArgs(pricingOverrides: Partial<CmaPricing> = {}): RenderCmaArgs {
  return {
    subject,
    comps: [comp],
    market: null,
    pricing: byronPricing(pricingOverrides),
    broker,
    client: { name: 'Eric Demello', email: null, phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-08-05T23:00:00.000Z',
    subjectTrace: 'subject trace',
    compTrace: ['comp trace'],
    excludedOutliers: [],
    sellerImprovementsText: null,
    site: null,
    expiredAudit: null,
    development: null,
    rental: null,
  }
}

describe('print CMA cover — no confidence pills, community not ZIP', () => {
  it('never prints a confidence pill, even when the engine is High or needsReview', () => {
    const flagged = renderCmaHtml(byronArgs()).html
    const clean = renderCmaHtml(byronArgs({ needsReview: false, reviewReason: null })).html
    for (const html of [flagged, clean]) {
      expect(html).not.toContain('High confidence')
      expect(html).not.toContain('Moderate confidence')
      expect(html).not.toMatch(/Confidence:/)
    }
  })

  it('says closed MLS sales and names the community', () => {
    const { html } = renderCmaHtml({
      ...byronArgs({ needsReview: false, reviewReason: null }),
      market: {
        geoSlug: 'caldera-springs',
        geoLabel: 'Caldera Springs',
        periodStart: '2025-08-14',
        periodEnd: '2026-08-14',
        soldCount365: 39,
        medianSalePrice: 1790000,
        medianDom: 72,
        medianPpsf: 580,
        saleToListRatio: 0.937,
        yoyMedianPriceDeltaPct: 4.7,
        activeCount: 48,
        pendingCount: 12,
        monthsOfSupply: 22.2,
        mosFormula: 'market_pulse_live.months_of_supply',
        marketVerdict: 'buyer',
        methodologyVersion: 'v3-2026-05-07',
        computedAt: '2026-08-14T20:00:00.000Z',
        pulseUpdatedAt: '2026-08-14T20:00:00.000Z',
      },
    })
    expect(html).toContain('closed MLS sales')
    expect(html).toContain('Automated estimates are not used.')
    expect(html).toContain('The market read is Caldera Springs.')
    expect(html).not.toMatch(/not the ZIP/i)
  })
})

describe('print CMA cover — the recommendation never sits outside its own stated range', () => {
  it('relabels "Supported range" to "Comp-supported range" and explains the cap when recommended is clamped outside it', () => {
    const { html } = renderCmaHtml(byronArgs())
    expect(html).toContain('$609,000')
    expect(html).toContain('Comp-supported range $620,000 to $635,000')
    expect(html).not.toContain('>Supported range $620,000 to $635,000')
    expect(html).toMatch(/capped below this range/)
  })

  it('keeps the plain "Supported range" label with no cap note when the recommendation sits inside it', () => {
    const { html } = renderCmaHtml(byronArgs({ recommended: 630000, conservative: 620000, highEnd: 635000 }))
    expect(html).toContain('List $620,000 to $635,000')
    expect(html).not.toContain('Comp-supported range')
    expect(html).not.toMatch(/capped (below|above) this range/)
  })

  it('never leaves valueLow/valueHigh (the comp math) altered by the display fix', () => {
    const { html } = renderCmaHtml(byronArgs())
    // The evidence range itself is untouched — only the label and the added
    // sentence change. This asserts the fix did not silently widen the range.
    expect(html).toContain('$620,000 to $635,000')
  })
})

describe('immersive CMA — same two contracts, same source data', () => {
  it('flags the out-of-range recommendation identically to the print doc and prints no confidence pill', () => {
    const html = renderImmersiveCmaHtml({ ...byronArgs(), broker }, 'https://ryan-realty.com')
    expect(html).not.toContain('Confidence: High')
    expect(html).not.toContain('Confidence: Moderate')
    expect(html).toMatch(/capped below this range/)
    expect(html).toContain('The comp-supported range is $620,000 to $635,000')
  })
})
