/** Immersive renderer — scene presence + §0 number identity with render args. */
import { describe, expect, it } from 'vitest'
import { renderImmersiveCmaHtml } from './immersive'
import type { RenderCmaArgs } from './render'
import type { CmaBroker } from './types'

const broker: CmaBroker = {
  id: null, slug: 'matthew-ryan', displayName: 'Matt Ryan', title: 'Owner & Principal Broker',
  licenseNumber: '201212071', email: 'matt@ryan-realty.com', phone: '541.703.3095', photoUrl: '/images/brokers/matt-ryan.png',
}

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs & { broker: CmaBroker } {
  return {
    subject: {
      listingKey: null, mlsNumber: '220214213', streetAddress: '20513 Byron', city: 'Bend', state: 'OR',
      postalCode: '97702', subdivision: 'Stone Creek', latitude: null, longitude: null, beds: 4, baths: 3,
      sqft: 2222, lotAcres: 0.1, propertySubType: null, yearBuilt: 2023, garageSpaces: 2, photoUrl: 'https://cdn.example/hero.jpg',
      publicRemarks: null, viewDescription: null, taxAnnual: null, standardStatus: 'Canceled',
      lastListPrice: 619999, lastListDate: '2026-05-01', listingHistoryLine: null,
    },
    comps: [
      {
        listingKey: 'C1', mlsNumber: '1', address: '61593 Lorenzo', city: 'Bend', subdivision: 'Stone Creek',
        latitude: null, longitude: null, beds: 5, baths: 3, sqft: 2219, lotAcres: 0.08, propertySubType: null,
        yearBuilt: 2020, photoUrl: null, publicRemarks: null, viewDescription: null, taxAnnual: null,
        listPrice: 619900, closePrice: 619900, closeDate: '2026-06-10', daysToOffer: 7, domTotal: 42,
        selectionTier: 'subdivision', monthsSinceClose: 2, timeAdjustment: -644, timeAdjustedPrice: 619256,
        ppsfTimeAdjusted: 279, sizeAdjustment: 419, adjustedPrice: 619675, weight: 1,
      },
    ],
    market: null,
    pricing: {
      method1Low: 621000, method1Mid: 630000, method1High: 637000, method2: 624000, method3: 630000,
      convergenceSpreadPct: 1, converged: true, conservative: 584000, recommended: 609000, highEnd: 619999,
      valueLow: 620000, valueHigh: 635000, confidence: 'High', confidenceReason: 'Three methods converged within 1%.',
      needsReview: false, reviewReason: null, compPpsfCv: 0.02, priceOverride: null, improvementsValueAdd: null, notes: [],
    },
    broker,
    client: { name: 'Eric Demello', email: null, phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-08-05T23:00:00.000Z',
    subjectTrace: 't', compTrace: [], excludedOutliers: [],
    ...over,
  } as RenderCmaArgs & { broker: CmaBroker }
}

describe('renderImmersiveCmaHtml', () => {
  it('hero + answer carry the subject and the exact pricing tiers', () => {
    const html = renderImmersiveCmaHtml(args(), 'https://ryan-realty.com')
    expect(html).toContain('20513 Byron')
    expect(html).toContain('$609,000')
    expect(html).toMatch(/class="ans-n r">\$609,000</)
    expect(html).not.toMatch(/class="ans-n[^"]*"[^>]*data-count/)
    expect(html).not.toMatch(/pin numbers match the map/i)
    expect(html).toContain('$584,000')
    expect(html).toContain('$619,999')
    expect(html).toContain('Prepared for Eric Demello')
    // Two tracked buttons (CMA_REIMAGINED_2026-09-07.md chapter 7).
    expect(html).toContain('Talk with Matt')
    expect(html).toContain('See homes for sale near you')
    expect(html).toContain('https://ryan-realty.com/book?')
  })

  it('opens on the comparative market analysis, not a marketing plan', () => {
    const html = renderImmersiveCmaHtml(args(), 'https://ryan-realty.com')
    expect(html).toContain('Comparative market analysis · 20513 Byron')
    expect(html).not.toContain('How we would market')
    expect(html).not.toContain('listing video')
    expect(html).not.toMatch(/what your home is worth/i)
    expect(html).not.toMatch(/What every listing gets/i)
    const whyAt = html.indexOf('id="what-its-worth"')
    expect(whyAt).toBeGreaterThan(0)
    expect(html).toContain('$609,000.')
  })

  it('the failed-listing scene renders with the backtest constants', () => {
    const html = renderImmersiveCmaHtml(
      args({ expiredAudit: { findings: [{ lens: 'pricing', fact: 'Asked above every sale.', meaning: 'The ask was the ceiling.' }], services: [], netSheet: { lines: [], netLow: 0, netHigh: 0 }, feeLine: '' } as never }),
      'https://ryan-realty.com',
    )
    expect(html).toContain('and did not sell.')
    expect(html).toContain('3,394')
    expect(html).toContain('94.2%')
  })

  it('gives the subdivision no scene of its own', () => {
    // CUT by CMA_REIMAGINED_2026-09-07.md. A year table and four prose cards
    // about the street is not one of the three things a seller reads this for.
    // The subdivision survives as ONE line inside chapter 5.
    const html = renderImmersiveCmaHtml(
      args({
        subdivisionStory: {
          facts: {
            name: 'Stone Creek', totalSales: 41,
            years: [{ year: 2024, count: 15, medianClose: 590000, medianPpsf: 281 }],
            recordHigh: { price: 705000, address: '20572 Kira', date: '2025-06-10' },
            recordLow: { price: 498000, address: '20510 Byron', date: '2023-02-01' },
            medianDomRecent: 24, saleToListRecentPct: 98.6, subjectSqftPercentile: 72,
            vintageSpan: { min: 2019, max: 2025 },
            source: "Supabase listings, SubdivisionName='Stone Creek' story fixture",
          },
          sections: [{ heading: 'A tight band', body: 'Homes here sell close together.' }],
          notableSales: [{ listNumber: '2', address: '20572 Kira', closePrice: 705000, closeDate: '2025-06-10', sqft: 2526, photoUrl: 'https://cdn.example/kira.jpg', line: 'The record sale.' }],
          model: 'claude-sonnet-4-5', costUsd: 0.04, photoSalesReviewed: 1,
        },
      }),
      'https://ryan-realty.com',
    )
    expect(html).not.toContain('id="your-street"')
    expect(html).not.toContain('A tight band')
    expect(html).not.toContain('as large or larger than 72%')
    expect(html).not.toContain('claude-sonnet-4-5')
  })

  it('no story, no scene; no audit, no failed-listing scene', () => {
    const html = renderImmersiveCmaHtml(args(), 'https://ryan-realty.com')
    expect(html).not.toContain('The story of')
    expect(html).not.toContain('and did not sell.')
  })
})
