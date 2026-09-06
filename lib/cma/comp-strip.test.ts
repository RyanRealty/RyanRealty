import { describe, expect, it } from 'vitest'
import {
  applyCompVerdicts,
  verdictsFromBuildSummary,
  whyWeKeptComp,
} from '@/lib/cma/client-facing'
import { renderCompMapKeyHtml, renderCompStripHtml } from '@/lib/cma/comp-strip'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import type { CmaAdjustedComp, CmaBroker, CmaSubject } from '@/lib/cma/types'

const broker: CmaBroker = {
  id: null,
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201212071',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/matt-ryan.png',
}

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: '220214213',
  streetAddress: '850 Quince',
  city: 'Redmond',
  state: 'OR',
  postalCode: '97756',
  subdivision: 'Dry Canyon',
  latitude: null,
  longitude: null,
  beds: 3,
  baths: 2,
  sqft: 1842,
  lotAcres: 0.2,
  propertySubType: null,
  yearBuilt: 1994,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/subject.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 525000,
  lastListDate: '2026-03-01',
  listingHistoryLine: null,
}

function comp(over: Partial<CmaAdjustedComp> = {}): CmaAdjustedComp {
  return {
    listingKey: 'C1',
    mlsNumber: '1',
    address: '412 Cascade',
    city: 'Redmond',
    subdivision: 'Dry Canyon',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.18,
    propertySubType: null,
    yearBuilt: 1996,
    photoUrl: 'https://cdn.example/comp.jpg',
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: 510000,
    closePrice: 505000,
    closeDate: '2026-05-01',
    daysToOffer: 9,
    domTotal: 16,
    selectionTier: 'subdivision',
    proximity: '0.4 miles NW',
    monthsSinceClose: 3,
    timeAdjustment: 2000,
    timeAdjustedPrice: 507000,
    ppsfTimeAdjusted: 282,
    sizeAdjustment: 4000,
    adjustedPrice: 511000,
    weight: 1,
    ...over,
  }
}

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  return {
    subject,
    comps: [comp()],
    market: null,
    pricing: {
      method1Low: 500000,
      method1Mid: 510000,
      method1High: 520000,
      method2: 508000,
      method3: 511000,
      convergenceSpreadPct: 2,
      converged: true,
      conservative: 495000,
      recommended: 515000,
      highEnd: 525000,
      valueLow: 500000,
      valueHigh: 525000,
      confidence: 'High',
      confidenceReason: 'tight set',
      needsReview: false,
      reviewReason: null,
      compPpsfCv: 0.03,
      priceOverride: null,
      improvementsValueAdd: null,
      notes: [],
    },
    broker,
    client: { name: 'Pat', email: null, phone: null, notes: null },
    mapDataUri: 'data:image/png;base64,aaa',
    generatedAtIso: '2026-08-17T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    ...over,
  }
}

describe('why we kept a comp', () => {
  it('leads with strong/weak and the judge reason', () => {
    const why = whyWeKeptComp(
      comp({ keepTier: 'strong', keepReason: 'Same subdivision, within 3 percent of living area' }),
    )
    expect(why.tier).toBe('strong')
    expect(why.sentence).toBe('Strong. Same subdivision, within 3 percent of living area.')
  })

  it('drops leaked judge copy and falls back to facts, never N/A', () => {
    const leaked = whyWeKeptComp(
      comp({
        keepTier: 'weak',
        keepReason: 'Adversarial accuracy audit on ListingKey 20260225192329433521000000',
      }),
    )
    expect(leaked.sentence).toMatch(/0\.4 miles NW/)
    expect(leaked.sentence).not.toMatch(/N\/A|ListingKey|Adversarial/i)
  })

  it('hydrates display-only verdicts without changing adjusted price', () => {
    const [out] = applyCompVerdicts([comp({ adjustedPrice: 511000, weight: 1 })], [
      { listingKey: 'C1', tier: 'weak', reason: 'Larger lot than the subject' },
    ])
    expect(out.adjustedPrice).toBe(511000)
    expect(out.weight).toBe(1)
    expect(out.keepTier).toBe('weak')
    expect(whyWeKeptComp(out).sentence).toBe('Weak. Larger lot than the subject.')
  })

  it('reads kept verdicts from build_summary', () => {
    const vs = verdictsFromBuildSummary({
      judgment: {
        verdicts: [
          { listingKey: 'C1', tier: 'strong', reason: 'Closest match' },
          { listingKey: 'X', tier: 'exclude', reason: 'Different product' },
        ],
      },
    })
    expect(vs).toHaveLength(2)
    const [kept] = applyCompVerdicts([comp()], vs)
    expect(kept.keepTier).toBe('strong')
  })
})

describe('comparison strip + map key', () => {
  it('prints photo, pin, sold, $/sf, facts, distance, DOM, adjusted, and why', () => {
    const html = renderCompStripHtml([
      comp({ keepTier: 'strong', keepReason: 'Same street character and living area' }),
    ])
    expect(html).toContain('comp.jpg')
    expect(html).toContain('>1<')
    expect(html).toContain('412 Cascade')
    expect(html).toContain('$505,000')
    expect(html).toContain('$281/sf')
    expect(html).toContain('3 bd')
    expect(html).toContain('1,800 sqft')
    expect(html).toContain('1996')
    expect(html).toContain('0.4 miles NW')
    expect(html).toContain('9 days to offer')
    expect(html).toContain('16 DOM')
    expect(html).toContain('$511,000')
    expect(html).toContain('Sold May 1, 2026')
    expect(html).toContain('Adjusted close')
    expect(html).not.toContain('Adjusted to subject')
    expect(html).toContain('Strong. Same street character and living area.')
    expect(html).not.toMatch(/\bN\/A\b/)
    expect(html).not.toContain('line-clamp')
    expect(html).not.toContain('text-overflow')
  })

  it('map key is more than address and close price', () => {
    const html = renderCompMapKeyHtml(subject, [
      comp({ keepTier: 'weak', keepReason: 'Older than the subject by two years' }),
    ])
    expect(html).toContain('412 Cascade')
    expect(html).toContain('$505,000')
    expect(html).toContain('$281/sf')
    expect(html).toContain('adjusted close $511,000')
    expect(html).toContain('0.4 miles NW')
    expect(html).toContain('9 days to offer')
    expect(html).toContain('Weak. Older than the subject by two years.')
    expect(html).toContain('850 Quince')
  })
})

describe('web and print tell the same comps story', () => {
  it('immersive leads with the kept-sales strip, not the neighborhood year bars', () => {
    const html = renderImmersiveCmaHtml(
      {
        ...args({
          comps: [comp({ keepTier: 'strong', keepReason: 'Same subdivision and size band' })],
          subdivisionStory: {
            facts: {
              name: 'Dry Canyon',
              totalSales: 12,
              years: [{ year: 2025, count: 4, medianClose: 490000, medianPpsf: 270 }],
              recordHigh: { price: 540000, address: '1 A St', date: '2025-06-01' },
              recordLow: { price: 410000, address: '2 B St', date: '2023-01-01' },
              medianDomRecent: 20,
              saleToListRecentPct: 98,
              subjectSqftPercentile: 50,
              vintageSpan: { min: 1990, max: 2001 },
              source: 'test',
            },
            sections: [{ heading: 'A street', body: 'Homes here sell close together.' }],
            notableSales: [],
            model: 'claude-sonnet-4-5',
            costUsd: 0,
            photoSalesReviewed: 0,
          },
        }),
        broker,
      },
      'https://ryan-realty.com',
    )
    const priceAt = html.indexOf('id="how-we-got-the-price"')
    const streetAt = html.indexOf('id="your-street"')
    expect(priceAt).toBeGreaterThan(0)
    expect(streetAt).toBeGreaterThan(priceAt)
    expect(html).toContain('412 Cascade')
    expect(html).toContain('$505,000')
    expect(html).toContain('$511,000')
    expect(html).toContain('Adjusted close')
    expect(html).not.toContain('Marker key')
    expect(html).toContain('aspect-ratio:1/1')
    expect(html).not.toContain('claude-sonnet-4-5')
  })

  it('print strip matches the web facts; flyers stay as drill-in', () => {
    const { html } = renderCmaHtml(
      args({
        comps: [comp({ keepTier: 'strong', keepReason: 'Same subdivision and size band' })],
      }),
    )
    const matrixAt = html.indexOf('comp-matrix')
    const flyerAt = html.indexOf('class="flyer-title"')
    expect(matrixAt).toBeGreaterThan(0)
    expect(flyerAt).toBeGreaterThan(matrixAt)
    expect(html).toContain('412 Cascade')
    expect(html).toContain('0.4 miles NW')
    expect(html).toContain('Days to offer')
    expect(html).toContain('Adjusted close')
    expect(html).toContain('$511,000')
    expect(html).toContain('class="flyer-title"')
    expect(html).not.toContain('Marker key')
    expect(html).not.toContain('DTO (DOM)')
    expect(html).not.toMatch(/\bN\/A\b/)
  })
})
