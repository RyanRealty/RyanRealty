import { describe, expect, it } from 'vitest'
import {
  clientFacingListingPlan,
  clientFacingNotes,
  clientPlaceClause,
  clientSourceLine,
  formatClientMlsField,
  isClientInternalLeak,
  stripClientMethodTrace,
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
    extras: {
      seasonality: {
        byMonth: [
          { month: 4, monthName: 'April', closedCount: 200, medianDaysToPending: 15 },
          { month: 8, monthName: 'August', closedCount: 180, medianDaysToPending: 45 },
        ],
        fastestMonths: ['April'],
        slowestMonths: ['August'],
        yearsCovered: 3,
        totalClosed: 2708,
        source:
          "Supabase listings, City='Redmond', PropertyType='A', Closed, CloseDate ≥ 2023-08-17; 2708 sales grouped by close month, median days_to_pending per month",
      },
      band: {
        lo: 428000,
        hi: 523000,
        activeCount: 12,
        pendingCount: 3,
        activeMedianAsk: 475000,
        activeMedianDom: 22,
        source:
          "Supabase listings, City='Redmond', PropertyType='A', Active + Pending, ListPrice 428000..523000, pulled at build time",
      },
      subdivisionPulse: null,
      financing: null,
      photoBench: null,
    },
    listingPlan: {
      source: 'Every line above traces to a figure already computed in this report.',
      items: [
        {
          trigger: '12 homes are active in this price band right now, against 3 pending.',
          action: 'With 12 homes already listed in this band, we lead the launch on what makes this one different rather than on price alone.',
          basis:
            "Price band 12 active vs 3 pending, $428,000 to $523,000. Supabase listings, City='Redmond', PropertyType='A', Active + Pending, ListPrice 428000..523000, pulled at build time.",
        },
        {
          trigger: 'April listings in this market reach pending in a median of 15 days. August listings take a median of 45.',
          action: 'We aim the launch at April, when homes here have gone pending in a median of 15 days against 45 in August.',
          basis: 'Seasonality April median 15 vs 45. Supabase listings, City=\'Redmond\', PropertyType=\'A\', Closed, CloseDate ≥ 2023-08-17; 2708 sales grouped by close month.',
        },
        {
          trigger: 'Homes like yours are for sale in Redmond now.',
          action: 'We price against the live band, not a citywide median.',
          basis: "Supabase listings, City='Redmond', PropertyType='A', Active + Pending, pulled at build time",
        },
      ],
    },
    ...over,
  }
}

const LEAK = /N\/A|ListingKey|Supabase|claude-sonnet|Adversarial accuracy audit|needs_review|broker-selected|\{"Mountain|PropertyType=|pulled at build time/i

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
    expect(isClientInternalLeak("PropertyType='A'")).toBe(true)
    expect(isClientInternalLeak('pulled at build time')).toBe(true)
  })

  it('strips query footnotes and keeps seller meaning', () => {
    expect(
      stripClientMethodTrace(
        "12 homes like yours are for sale in Redmond now. Supabase listings, City='Redmond', PropertyType='A', pulled at build time.",
      ),
    ).toBe('12 homes like yours are for sale in Redmond now.')
    expect(stripClientMethodTrace('Seasonality April median 15 vs 45.')).toBeNull()
    expect(stripClientMethodTrace('Price band 12 active vs 3 pending, $428,000 to $523,000.')).toBeNull()
    expect(
      clientFacingListingPlan({
        source: "Supabase listings, City='Redmond', PropertyType='A'",
        items: [
          {
            trigger: '12 homes are active in this price band right now, against 3 pending.',
            action: 'We lead the launch on what makes this one different.',
            basis:
              "Supabase listings, City='Redmond', PropertyType='A', Active + Pending, ListPrice 428000..523000, pulled at build time.",
          },
        ],
      })?.items[0]?.basis,
    ).toBe('')
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

describe('client document has no query junk or price tween', () => {
  it('print and immersive HTML fail on method traces', () => {
    const print = renderCmaHtml(args()).html
    const immersive = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    for (const html of [print, immersive]) {
      expect(html).not.toContain('Supabase')
      expect(html).not.toContain('PropertyType=')
      expect(html).not.toContain('pulled at build time')
      expect(html).not.toMatch(/CloseDate\s*[≥>=]/)
      expect(html).not.toMatch(/Seasonality April median 15 vs 45/)
      expect(html).not.toMatch(/Price band 12 active vs 3 pending/)
      expect(html).toMatch(/homes like yours are for sale in Redmond now/i)
    }
  })

  it('prints the recommended list immediately with no count-up interpolation', () => {
    const html = renderImmersiveCmaHtml(
      { ...args({ pricing: { ...pricingOverride, recommended: 475000 } }), broker },
      'https://ryan-realty.com',
    )
    expect(html).toContain('>$475,000<')
    expect(html).toMatch(/class="ans-n r">\$475,000</)
    expect(html).not.toMatch(/class="ans-n[^"]*"[^>]*data-count/)
    expect(html).toContain("if(el.classList&&el.classList.contains('ans-n'))return")
  })

  it('web page does not claim pin numbers match a map that is not there', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    expect(html).not.toMatch(/pin numbers match the map/i)
    const printNoMap = renderCmaHtml(args()).html
    expect(printNoMap).not.toMatch(/Pin numbers match the map/)
    const printWithMap = renderCmaHtml(args({ mapDataUri: 'data:image/png;base64,aaa' })).html
    expect(printWithMap).toContain('Pin numbers match the map')
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
    expect(html).toMatch(/#bar\{[^}]*background:var\(--cream\)/)
    expect(html).not.toMatch(/#bar\{[^}]*backdrop-filter/)
    expect(html).not.toMatch(/#bar\{[^}]*background:rgba\(250,248,244/)
  })

  it('photos and listing cards are square, not app-card rounded', () => {
    const { html } = renderCmaHtml(args())
    const immersive = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    const printCards = ['.hero-photo', '.comp-card', '.flyer-hero', '.comp-ph', '.comp-row', '.value-block', '.tier', '.hl', '.use-card', '.zone-mast', '.glance-row', '.photo-tile']
    const immersiveCards = ['.hero-img', '.comp-ph', '.comp-row', '.nb', '.nb-img', '.photo-tile', '.story-card', '.like,.cando', '.plan']
    for (const sel of printCards) {
      const re = new RegExp(`${sel.replace(/[.*,]/g, '\\$&')}\\s*\\{[^}]*border-radius:\\s*(\\d+)(?:px)?`)
      const m = html.match(re)
      expect(m, `${sel} should declare a radius`).toBeTruthy()
      expect(Number(m![1]), `${sel} radius`).toBeLessThanOrEqual(2)
    }
    for (const sel of immersiveCards) {
      const re = new RegExp(`${sel.replace(/[.*,]/g, '\\$&')}\\{[^}]*border-radius:(\\d+)`)
      const m = immersive.match(re)
      expect(m, `${sel} should declare a radius`).toBeTruthy()
      expect(Number(m![1]), `${sel} radius`).toBeLessThanOrEqual(2)
    }
    expect(immersive).toContain('img{max-width:100%;display:block;border-radius:0}')
    expect(immersive).toContain('html{scroll-behavior:smooth;background:var(--cream);border-radius:0;min-height:100%}')
    expect(html).toMatch(/img\s*\{\s*border-radius:\s*0/)
    expect(html).toMatch(/html,\s*body\s*\{[^}]*border-radius:\s*0/)
    expect(html).toMatch(/\.page\s*\{[^}]*border-radius:\s*0/)
    expect(html).not.toMatch(/background:\s*#e8e3d8/)
    expect(html).not.toMatch(/box-shadow:\s*0\s+6px\s+24px/)
    expect(html).not.toMatch(/\.(hero-photo|comp-card|flyer-hero|comp-ph|comp-row)\s*\{[^}]*border-radius:\s*(1[2-9]|2[0-4])px/)
    expect(immersive).not.toMatch(/\.(hero-img|comp-ph|comp-row|nb|nb-img|photo-tile)\s*\{[^}]*border-radius:(1[2-9]|2[0-4])px/)
  })

  it('print CSS keeps safe @page margins', () => {
    const { html } = renderCmaHtml(args())
    expect(html).toMatch(/@page\s*\{[^}]*margin:\s*0\.4in/)
    expect(html).toContain('Why $1,050,000')
    expect(html).toContain('<svg')
  })
})
