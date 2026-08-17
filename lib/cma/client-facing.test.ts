import { describe, expect, it } from 'vitest'
import {
  clientFacingNotes,
  clientPlaceClause,
  clientSourceLine,
  formatClientMlsField,
  isClientInternalLeak,
  whyThisListPrice,
} from '@/lib/cma/client-facing'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import { cleanText } from '@/lib/cma/render-blocks'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject: CmaSubject = {
  listingKey: '20260225192329433521000000',
  mlsNumber: '220215931',
  streetAddress: '19496 Tumalo Reservoir',
  city: 'Bend',
  state: 'OR',
  postalCode: '97703',
  subdivision: 'N/A',
  latitude: 44.06,
  longitude: -121.31,
  beds: 3,
  baths: 3,
  sqft: 2325,
  lotAcres: 2.28,
  propertySubType: null,
  yearBuilt: 1995,
  garageSpaces: 3,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: '{"Mountain(s)": true, "Territorial": true}',
  taxAnnual: 7247,
  standardStatus: 'Expired',
  lastListPrice: 1225000,
  lastListDate: '2026-03-01',
  listingHistoryLine: null,
}

const comps: CmaAdjustedComp[] = [
  {
    listingKey: 'C-HIGH',
    mlsNumber: '1',
    address: '19000 Ceiling Rd',
    city: 'Bend',
    subdivision: 'N/A',
    latitude: 44.05,
    longitude: -121.3,
    beds: 3,
    baths: 3,
    sqft: 2400,
    lotAcres: 2.1,
    propertySubType: null,
    yearBuilt: 1998,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: '{"Mountain(s)": true}',
    taxAnnual: null,
    listPrice: 1100000,
    closePrice: 1080000,
    closeDate: '2026-04-01',
    daysToOffer: 12,
    domTotal: 20,
    selectionTier: 'primary',
    monthsSinceClose: 3,
    timeAdjustment: 0,
    timeAdjustedPrice: 1080000,
    ppsfTimeAdjusted: 450,
    sizeAdjustment: -20000,
    adjustedPrice: 1120000,
    weight: 0.6,
  },
  {
    listingKey: 'C-BEST',
    mlsNumber: '2',
    address: '19100 Best Match Ln',
    city: 'Bend',
    subdivision: null,
    latitude: 44.05,
    longitude: -121.3,
    beds: 3,
    baths: 3,
    sqft: 2310,
    lotAcres: 2.2,
    propertySubType: null,
    yearBuilt: 1996,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: 'Cascade Mountains, Territorial',
    taxAnnual: null,
    listPrice: 1000000,
    closePrice: 990000,
    closeDate: '2026-05-01',
    daysToOffer: 8,
    domTotal: 14,
    selectionTier: 'primary',
    monthsSinceClose: 2,
    timeAdjustment: 0,
    timeAdjustedPrice: 990000,
    ppsfTimeAdjusted: 429,
    sizeAdjustment: 5000,
    adjustedPrice: 995000,
    weight: 1,
  },
  {
    listingKey: 'C-FLOOR',
    mlsNumber: '3',
    address: '18900 Floor Ave',
    city: 'Bend',
    subdivision: 'Other',
    latitude: 44.05,
    longitude: -121.3,
    beds: 3,
    baths: 2,
    sqft: 2100,
    lotAcres: 2,
    propertySubType: null,
    yearBuilt: 1990,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: 'N/A',
    taxAnnual: null,
    listPrice: 900000,
    closePrice: 880000,
    closeDate: '2026-03-15',
    daysToOffer: 40,
    domTotal: 55,
    selectionTier: 'competing',
    monthsSinceClose: 4,
    timeAdjustment: 0,
    timeAdjustedPrice: 880000,
    ppsfTimeAdjusted: 419,
    sizeAdjustment: 20000,
    adjustedPrice: 900000,
    weight: 0.4,
  },
]

const pricingOverride: CmaPricing = {
  method1Low: 940000,
  method1Mid: 970000,
  method1High: 1000000,
  method2: 980000,
  method3: 978000,
  convergenceSpreadPct: 6.2,
  converged: false,
  conservative: 940000,
  recommended: 1050000,
  highEnd: 1100000,
  valueLow: 940000,
  valueHigh: 1100000,
  confidence: 'Moderate',
  confidenceReason: 'method spread 6.2%',
  needsReview: true,
  reviewReason: 'Adversarial accuracy audit: 5 finding(s) recorded for broker review.',
  compPpsfCv: 0.09,
  priceOverride: 1050000,
  improvementsValueAdd: null,
  notes: [
    'The methods land 6.2% apart, wider than the 5% convergence tolerance. Method 3 (the adjusted-comp reconciliation) governs the recommendation because it carries both the time and size corrections. Confidence is reduced accordingly.',
    'The recommended list price reflects a broker adjustment set above the data-derived reconciliation (a strategic list with negotiation room). The Conservative tier stays anchored to the comp-supported quick-sale floor; the full reconciliation is preserved in the verification trace.',
    'Adversarial accuracy audit: 5 finding(s) recorded for broker review before this analysis is released.',
  ],
}

const pricingConverged: CmaPricing = {
  ...pricingOverride,
  method3: 655000,
  recommended: 655000,
  conservative: 639000,
  highEnd: 669000,
  valueLow: 639000,
  valueHigh: 669000,
  convergenceSpreadPct: 1.2,
  converged: true,
  priceOverride: null,
  needsReview: false,
  reviewReason: null,
  notes: [],
  confidence: 'High',
  confidenceReason: 'Seven closed sales in a tight size band.',
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

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  return {
    subject,
    comps,
    market: {
      geoSlug: 'bend',
      geoLabel: 'Bend',
      periodStart: '2025-08-01',
      periodEnd: '2026-08-01',
      soldCount365: 2400,
      medianSalePrice: 650000,
      medianDom: 18,
      medianPpsf: 320,
      saleToListRatio: 0.989,
      yoyMedianPriceDeltaPct: -1.2,
      activeCount: 400,
      pendingCount: 80,
      monthsOfSupply: 3.8,
      mosFormula: 'market_pulse_live.months_of_supply',
      marketVerdict: 'seller',
      methodologyVersion: 'v3-2026-05-07',
      computedAt: '2026-08-01T00:00:00.000Z',
      pulseUpdatedAt: '2026-08-01T00:00:00.000Z',
    },
    pricing: pricingOverride,
    broker,
    client: { name: 'Test Seller', email: null, phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-08-17T00:00:00.000Z',
    subjectTrace:
      'Entered by MLS 20260225192329433521000000. Subject uses the MOST RECENT listing of the property: MLS 220215931.',
    compTrace: [
      'Broker-selected comp set: 5 of 5 requested ListingKey(s) resolved as valid closed SFR.',
      'Comparability judgment (claude-sonnet-4-5) applied for the narrative.',
    ],
    excludedOutliers: [],
    sellerImprovementsText: null,
    site: null,
    expiredAudit: null,
    development: null,
    rental: null,
    ...over,
  }
}

const LEAK = /N\/A|ListingKey|Supabase|claude-sonnet|Adversarial accuracy audit|needs_review|broker-selected|\{"Mountain/i

describe('client field formatters', () => {
  it('omits N/A and other MLS sentinels', () => {
    expect(cleanText('N/A')).toBeNull()
    expect(cleanText('n/a')).toBeNull()
    expect(cleanText('Other')).toBeNull()
    expect(cleanText('—')).toBeNull()
    expect(clientPlaceClause('N/A', 'Bend')).toBe('Bend')
    expect(clientPlaceClause(null, null)).toBeNull()
  })

  it('formats JSON view flags into human labels', () => {
    expect(formatClientMlsField('{"Mountain(s)": true, "Territorial": false}')).toBe('Mountain(s)')
    expect(formatClientMlsField('{"Mountain(s)": true}')).toBe('Mountain(s)')
    expect(formatClientMlsField('Cascade Mountains, Territorial')).toBe('Cascade Mountains, Territorial')
    expect(formatClientMlsField('N/A')).toBeNull()
  })

  it('strips audit and pipeline notes from the client list', () => {
    const kept = clientFacingNotes(pricingOverride.notes, pricingOverride)
    expect(kept.join(' ')).not.toMatch(/Adversarial|ListingKey|verification trace/i)
    expect(kept.some((n) => /Method 3.*governs the recommendation/i.test(n))).toBe(false)
  })

  it('replaces leaked source lines', () => {
    expect(clientSourceLine('Supabase listings, ListingKey abc', 'Closed MLS sales.')).toBe('Closed MLS sales.')
    expect(isClientInternalLeak('claude-sonnet-4-5')).toBe(true)
  })
})

describe('why this list price', () => {
  it('explains a broker override above Method 3', () => {
    const why = whyThisListPrice({
      subject,
      comps,
      market: args().market,
      pricing: pricingOverride,
    })
    expect(why.heading).toBe('Why $1,050,000')
    expect(why.coverSentence).toMatch(/strategic list above the \$978,000/)
    expect(why.strategy).toMatch(/room to negotiate/)
    expect(why.bullets.map((b) => b.label)).toEqual(['19000 Ceiling Rd', '19100 Best Match Ln', '18900 Floor Ave'])
    expect(why.market).toMatch(/98\.9% of list/)
  })

  it('explains a failed ask when that fact is on the row', () => {
    const why = whyThisListPrice({
      subject,
      comps,
      market: null,
      pricing: {
        ...pricingOverride,
        recommended: 1203000,
        priceOverride: null,
        reviewReason: 'Comp evidence supported $1,300,000 against the $1,225,000 asking that just failed.',
        notes: ['Your last listing asked $1,225,000 and did not sell.'],
      },
    })
    expect(why.coverSentence).toMatch(/Capped under the \$1,225,000 ask that did not sell/)
    expect(why.strategy).toMatch(/did not sell/)
  })

  it('does not call Method 3 the list when the cover is the engine number', () => {
    const why = whyThisListPrice({
      subject,
      comps,
      market: null,
      pricing: {
        ...pricingConverged,
        converged: false,
        method3: 477000,
        recommended: 505000,
        priceOverride: null,
      },
    })
    expect(why.coverSentence).not.toMatch(/477,000/)
    expect(why.coverSentence).not.toMatch(/That is the number/)
  })

  it('hides the pricing-engine board note from the seller', () => {
    const kept = clientFacingNotes(
      ['List price is the pricing engine list ($505,000), not Method 3.', 'Closed sales in Redmond.'],
      { ...pricingConverged, recommended: 505000, method3: 477000 },
    )
    expect(kept.join(' ')).not.toMatch(/pricing engine/i)
    expect(kept).toContain('Closed sales in Redmond.')
  })

  it('keeps 3480-quality why when methods converge', () => {
    const why = whyThisListPrice({
      subject: { ...subject, streetAddress: '3480 SW 45th', lastListPrice: 650000 },
      comps,
      market: args().market,
      pricing: pricingConverged,
      equity: {
        purchasePrice: 650000,
        purchaseDate: '2025-08-14',
        yearsHeld: 1,
        gainDollars: 5000,
        gainPct: 0.8,
        annualizedPct: 0.8,
        source: 'Supabase listings, prior sale',
      },
    })
    expect(why.heading).toBe('Why $655,000')
    expect(why.coverSentence).toMatch(/best match land at this number/)
    expect(why.ownership).toMatch(/August 2025 at \$650,000/)
    expect(why.strategy).toBeNull()
  })
})

describe('engine output no longer contains the Tumalo leaks', () => {
  it('print HTML omits N/A, raw JSON, audit, model, and ListingKey traces', () => {
    const { html } = renderCmaHtml(args())
    expect(html).not.toMatch(LEAK)
    expect(html).toContain('Why $1,050,000')
    expect(html).toContain('strategic list')
    expect(html).toContain('Mountain(s)')
    expect(html).toContain('Comparative Market Analysis')
    expect(html).not.toContain('Verification Trace')
    expect(html).not.toContain('broker price opinion')
    expect(html).toContain('Bend, Oregon 97703')
    expect(html).not.toContain('· N/A')
  })

  it('immersive HTML shares the same hygiene', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    expect(html).not.toMatch(LEAK)
    expect(html).toContain('Why $1,050,000')
    expect(html).toContain('comparative market analysis')
    expect(html).not.toContain('broker price opinion')
    expect(html).not.toContain('claude-sonnet-4-5')
    expect(html).toContain('Mountain(s)')
  })
})

describe('client document look', () => {
  it('immersive HTML has no page-number chrome', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    expect(html).not.toMatch(/Page\s+\d+\s+of\s+\d+/i)
    expect(html).not.toContain('class="pageNumber"')
    expect(html).not.toContain('class="pg-footer"')
    expect(html).not.toContain('<span class="p">')
    expect(html).toContain('.page-num,.pg-num,.pageNumber,.pg-footer,.toc .p{display:none}')
  })

  it('photos are flush, not rounded cards', () => {
    const { html } = renderCmaHtml(args())
    expect(html).toMatch(/\.hero-photo\s*\{[^}]*border-radius:\s*0/)
    expect(html).toMatch(/\.comp-card\s*\{[^}]*border-radius:\s*0/)
    expect(html).toMatch(/\.flyer-hero\s*\{[^}]*border-radius:\s*0/)
    expect(html).not.toMatch(/\.hero-photo\s*\{[^}]*border-radius:\s*[1-9]/)
    expect(html).not.toMatch(/\.comp-card\s*\{[^}]*border-radius:\s*[1-9]/)
    const immersive = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    expect(immersive).toContain('.comp-ph{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;border-radius:0}')
    expect(immersive).not.toMatch(/\.comp-ph\{[^}]*border-radius:1[68]px/)
  })

  it('print CSS keeps safe @page margins', () => {
    const { html } = renderCmaHtml(args())
    expect(html).toMatch(/@page\s*\{[^}]*margin:\s*0\.4in/)
    expect(html).toContain('Why $1,050,000')
    expect(html).toContain('<svg')
  })
})
