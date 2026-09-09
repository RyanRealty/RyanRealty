import { describe, expect, it } from 'vitest'
import {
  assembleOpinionPages,
  closingComplianceSentence,
  nextStepButtonsHtml,
  nextStepHeading,
  sellerNetBodyHtml,
  sellerNetKick,
  storyClassFor,
  whatHappenedHeading,
  type OpinionPageArgs,
} from '@/lib/cma/opinion-pages'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: '220126000',
  streetAddress: '2465 7th',
  city: 'Redmond',
  state: 'OR',
  postalCode: '97756',
  subdivision: 'Diamond Bar Ranch',
  latitude: 44.27,
  longitude: -121.17,
  beds: 3,
  baths: 2,
  sqft: 1440,
  lotAcres: 0.14,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2004,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Withdrawn',
  lastListPrice: 460000,
  lastListDate: '2026-02-01',
  listingHistoryLine: 'Last on market Feb 2026 at $460,000 (withdrawn).',
  levelsRaw: 'One',
}

const comp: CmaAdjustedComp = {
  listingKey: 'C1',
  mlsNumber: '220222218',
  address: '840 Quince',
  city: 'Redmond',
  subdivision: 'Diamond Bar Ranch',
  latitude: 44.27,
  longitude: -121.17,
  beds: 3,
  baths: 2,
  sqft: 1400,
  lotAcres: 0.14,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2004,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 410000,
  closePrice: 410500,
  closeDate: '2026-06-10',
  daysToOffer: 6,
  domTotal: 10,
  selectionTier: 'subdivision',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 410500,
  ppsfTimeAdjusted: 293,
  sizeAdjustment: 0,
  adjustedPrice: 420000,
  weight: 1,
}

const pricing = {
  method1Low: 417000,
  method1Mid: 429000,
  method1High: 444000,
  method2: 429000,
  method3: 429000,
  conservative: 417000,
  recommended: 429000,
  highEnd: 444000,
  valueLow: 417000,
  valueHigh: 444000,
  predictedClose: 420000,
  confidence: 'High',
  confidenceReason: 'Tight set.',
  needsReview: false,
  reviewReason: null,
  notes: [],
} as unknown as CmaPricing

function args(): OpinionPageArgs {
  return {
    subject,
    comps: [comp],
    market: null,
    pricing,
    extras: {
      seasonality: null,
      band: {
        lo: 386000,
        hi: 472000,
        activeCount: 46,
        pendingCount: 17,
        activeMedianAsk: 429000,
        activeMedianDom: 20,
        source: 'test',
        rivals: [
          {
            listingKey: 'R1',
            address: '825 Poplar',
            listPrice: 417250,
            status: 'Active',
            daysOnMarket: 10,
            photoUrl: null,
            latitude: 44.27,
            longitude: -121.17,
            beds: 3,
            baths: 2,
            sqft: 1500,
            yearBuilt: 2011,
            lotAcres: 0.18,
          },
        ],
      },
      subdivisionPulse: null,
      financing: null,
      photoBench: null,
      legal: {
        parcel: '245217',
        taxlot: '151303BD02800',
        flood: { zone: 'X', inSFHA: false },
      },
      propertyFacts: { propertyType: 'Detached house', stories: 'One', fireplaces: 1 },
    },
    mapDataUri: 'data:image/png;base64,aaa',
    generatedAtIso: '2026-09-05T00:00:00.000Z',
    excludedOutliers: [],
  }
}

describe('assembleOpinionPages format', () => {
  it('carries only the blueprint chapters — no facts table, no lots, no permits', () => {
    const tocs = assembleOpinionPages(args()).map((p) => p.toc)
    // CUT by CMA_REIMAGINED_2026-09-07.md: they answer none of the three
    // questions a seller opens a failed listing's report to answer.
    for (const cut of [
      'Home location',
      'Property facts',
      'Legal, owner, and flood',
      'The land',
      'Permits and ownership',
      'Photos',
    ]) {
      expect(tocs, `${cut} is cut`).not.toContain(cut)
    }
  })

  it('keeps the ONE map on the price chapter (C9)', () => {
    const pages = assembleOpinionPages({
      ...args(),
      subjectMapDataUri: 'data:image/png;base64,subjmap',
      mapDataUri: 'data:image/png;base64,compsmap',
    })
    // Delta 3: the map is its own chapter, under the number, and there is
    // still exactly one of it in the whole document.
    const map = pages.find((p) => p.toc === 'Where all of this is.')
    expect(map?.body).toContain('data:image/png;base64,compsmap')
    expect(map?.body).toContain('pin-map')
    const all = pages.map((p) => p.body).join('')
    expect(all).not.toContain('data:image/png;base64,subjmap')
    expect((all.match(/data:image\/png;base64,compsmap/g) ?? []).length).toBe(1)
    const price = pages.findIndex((p) => p.toc === '$429,000.')
    expect(pages.findIndex((p) => p.toc === 'Where all of this is.')).toBe(price + 1)
  })

  it('runs the number, the map, then the three matrices in Delta 3 order', () => {
    // Three closed sales is the pricing unit's own floor, and the floor the
    // matrix fails closed at (MIN_CLOSED_SALES_FOR_MATRIX).
    const base = args()
    const tocs = assembleOpinionPages({
      ...base,
      comps: [0, 1, 2].map((i) => ({ ...base.comps[0]!, listingKey: `K${i}`, address: `${100 + i} Test St` })),
      mapDataUri: 'data:image/png;base64,compsmap',
    }).map((p) => p.toc)
    const price = tocs.indexOf('$429,000.')
    const map = tocs.indexOf('Where all of this is.')
    const closed = tocs.indexOf('The sales that set this price')
    const competition = tocs.findIndex((t) => t?.startsWith('Who you would compete with at'))
    const market = tocs.findIndex((t) => t?.endsWith('right now'))
    expect(price).toBeGreaterThanOrEqual(0)
    expect(map).toBe(price + 1)
    expect(closed).toBe(map + 1)
    expect(competition).toBeGreaterThan(closed)
    if (market >= 0) expect(market).toBeGreaterThan(competition)
  })

  it('puts the listings that came off unsold between the sales and the competition', () => {
    const pages = assembleOpinionPages({
      ...args(),
      extras: {
        ...args().extras!,
        marketArea: {
          grain: 'subdivision',
          label: 'Diamond Bar Ranch',
          source: 'test',
          priceLo: 365000,
          priceHi: 494000,
          selected: {
            key: 'selected',
            label: 'Used for the recommend',
            count: 3,
            low: 390000,
            median: 410000,
            high: 420000,
            medianPpsf: 280,
            medianDom: 12,
          },
          active: null,
          pending: null,
          expired: null,
          closed: null,
          sold90: null,
          listingTrend: null,
          expiredPeers: [
            {
              listingKey: 'U1',
              address: '2527 5th',
              listPrice: 430000,
              status: 'Canceled',
              daysOnMarket: 36,
              onMarketDate: '2025-12-15',
              photoUrl: null,
              latitude: 44.29,
              longitude: -121.16,
              beds: 2,
              baths: 1,
              sqft: 789,
              lotAcres: 0.14,
              yearBuilt: 2008,
              propertySubType: 'Single Family Residence',
              originalListPrice: 430000,
              listingHistoryLine: null,
            },
          ],
        },
      },
    })
    const tocs = pages.map((p) => p.toc)
    const competition = tocs.findIndex((t) => t?.startsWith('Who you would compete with at'))
    const price = tocs.indexOf('$429,000.')
    // The listings that did not sell are their own chapter (Delta 1), and they
    // sit BEFORE the number they explain. Competition follows the number.
    // Delta 3's order: the number, the map, matrix 1, matrix 2, matrix 3.
    const stories = tocs.indexOf('The listings near you that did not sell.')
    expect(stories).toBeGreaterThanOrEqual(0)
    expect(stories).toBeGreaterThan(price)
    expect(competition).toBeGreaterThan(stories)
    const body = pages[stories]!.body
    expect(body).toContain('2527 5th')
    // Matrix 2, one column set with the closed sales, never the cards it
    // replaced and never the price ruler of dots before them.
    expect(body).toContain('comp-matrix is-unsold')
    expect(body).toContain('First ask \u2192 last ask \u2192 outcome')
    expect(body).not.toContain('dns-card')
    expect(body).not.toContain("Didn't sell")
    expect(body).not.toContain('Recommended $')
    expect(body).not.toContain('ruler-wide')
  })

  it('omits a citywide 90-day median that does not describe this house', () => {
    const pages = assembleOpinionPages({
      ...args(),
      extras: {
        ...args().extras!,
        sold90: {
          count: 76,
          low: 390000,
          median: 477450,
          high: 1350000,
          bedsLabel: '3 bedroom / 2 bath',
          source: 'test',
        },
      },
    })
    expect(pages.map((p) => p.toc).join(' ')).not.toMatch(/What 3 bedroom/)
  })

  it('does not print a citywide dollar-volume leftover page', () => {
    const pages = assembleOpinionPages({
      ...args(),
      market: {
        geoLabel: 'Redmond',
        monthsOfSupply: 4,
        saleToListRatio: 0.978,
        medianDom: 21,
        medianSalePrice: 532311,
        yearMart: {
          source: 'mart',
          geoType: 'city',
          geoLabel: 'Redmond',
          geoSlug: 'redmond',
          year: 2025,
          soldCount: 1029,
          totalVolume: 589287488,
          computedAt: '2026-09-06',
        },
      } as never,
    })
    expect(pages.map((p) => p.toc).join(' ')).not.toMatch(/closed sales, 2025/i)
  })
})

/**
 * Round-four class A. The chapter either itemises every deduction or it prints
 * no figure at all — a number headed as what the seller keeps, with the
 * commission, title, escrow and the loan payoff outside the arithmetic, is the
 * one figure in this document a seller quotes back.
 */
const NET_SHEET = {
  basis: 'Commission is the rate in your listing agreement; title and escrow are the Deschutes County schedule.',
  // AT THE LIST THIS DOCUMENT RECOMMENDS. A sheet priced above the chapter's
  // own list ceiling is refused outright now (class E, one list ceiling per
  // document) — asserted in its own case below.
  list: 429000,
  lines: [
    { label: 'Commission', amount: 21450, source: 'Listing agreement, 5.0%' },
    { label: 'Title and escrow', amount: 3100, source: 'Deschutes County schedule' },
    { label: 'Loan payoff', amount: 210000, source: 'Payoff quote you provided' },
  ],
  net: 194450,
  sentence: 'At $429,000 you would walk away with about $194,450.',
  unknowns: [],
}

function withNet(sellerNet: unknown): OpinionPageArgs {
  return { ...args(), pricing: { ...pricing, sellerNet } as unknown as CmaPricing }
}

describe('net at list itemises, or prints no figure at all', () => {
  it('prints the list, every cost line with its source, and the net', () => {
    const html = sellerNetBodyHtml(withNet(NET_SHEET))
    expect(html).toContain('List price')
    expect(html).toContain('$429,000')
    expect(html).toContain('Commission')
    expect(html).toContain('Listing agreement, 5.0%')
    expect(html).toContain('Deschutes County schedule')
    expect(html).toContain('Payoff quote you provided')
    expect(html).toContain('$194,450')
    expect(html).toContain('What you keep at $429,000')
  })

  it('names what is not in the net and refuses the phrase when something is missing', () => {
    const a = withNet({ ...NET_SHEET, unknowns: ['commission', 'title', 'escrow', 'your loan payoff'] })
    const html = sellerNetBodyHtml(a)
    expect(html).toContain(
      'This does not include commission, title, escrow, or your loan payoff.',
    )
    expect(html).not.toContain('What you keep')
    expect(sellerNetKick(a)).toBe('Net at list')
  })

  it('prints no figure when there are no cost lines, and says what a net would need', () => {
    const html = sellerNetBodyHtml(withNet({ list: 475000, lines: [], net: 475000, unknowns: [] }))
    expect(html).not.toContain('$475,000')
    expect(html).toContain('A net at $429,000 needs')
    expect(html).toContain('the commission written into your listing agreement')
  })

  it('prints no figure on the legacy concessions-only block', () => {
    const html = sellerNetBodyHtml(
      withNet({ expectedConcessions: 8000, predictedSellerNet: 467000, knownCount: 3 }),
    )
    expect(html).not.toContain('$467,000')
    expect(html).toContain('A net at $429,000 needs')
  })

  it('refuses a line with no source, and refuses a net above the list', () => {
    const noSource = sellerNetBodyHtml(
      withNet({ ...NET_SHEET, lines: [{ label: 'Commission', amount: 23750, source: '' }], net: 451250 }),
    )
    expect(noSource).toContain('A net at $429,000 needs')
    const overList = sellerNetBodyHtml(withNet({ ...NET_SHEET, net: 480000 }))
    expect(overList).toContain('A net at $429,000 needs')
    expect(overList).not.toContain('$480,000')
  })

  it('refuses a column that does not add up', () => {
    const html = sellerNetBodyHtml(withNet({ ...NET_SHEET, net: 300000 }))
    expect(html).toContain('A net at $429,000 needs')
  })
})

/**
 * Round-four class B. The story is about the ask that ran the clock, not the
 * cut the listing came off at.
 */
const EXPOSURE = {
  segments: [
    { ask: 500000, from: '2025-08-01', to: '2025-12-31', days: 152, sharePct: 81.3, pctAboveRangeTop: 12.6 },
    { ask: 460000, from: '2026-01-01', to: '2026-02-04', days: 35, sharePct: 18.7, pctAboveRangeTop: 3.6 },
  ],
  dominant: 500000,
  final: 460000,
  sentence: 'It asked $500,000 for 152 days, then $460,000 for 35.',
}

function withAudit(expiredAudit: unknown): OpinionPageArgs {
  return { ...args(), expiredAudit: expiredAudit as OpinionPageArgs['expiredAudit'] }
}

const FINDINGS = [{ lens: 'pricing' as const, fact: 'It sat 187 days.', meaning: '' }]

describe('chapter one reads the ask that ran the clock', () => {
  it('names both asks and their days', () => {
    const a = withAudit({ findings: FINDINGS, askExposure: EXPOSURE, finalCycle: { days: 187 } })
    expect(whatHappenedHeading(a)).toBe('It asked $500,000 for 152 days, then $460,000 for 35.')
  })

  it('measures the gap off the dominant ask, not the final one', () => {
    const a = withAudit({ findings: FINDINGS, askExposure: EXPOSURE, finalCycle: { days: 187 } })
    // $500,000 against a $444,000 top is 12.6 percent — far-above. The final
    // $460,000 ask is 3.6 percent, which is near-above and a different story,
    // and it is the one the chapter used to tell.
    expect(storyClassFor(a)).toBe('far-above')
  })

  it('tells no causal story when the row does not say which ask ran the clock', () => {
    const a = withAudit({ findings: FINDINGS, finalCycle: { days: 187 } })
    expect(storyClassFor(a)).toBeNull()
    expect(whatHappenedHeading(a)).toBe('It asked $460,000 and did not sell.')
  })

  it('goes neutral when the ask sat below the bottom of the range', () => {
    const low = {
      ...EXPOSURE,
      dominant: 380000,
      final: 380000,
      segments: [{ ask: 380000, from: null, to: null, days: 187, sharePct: 100, pctAboveRangeTop: null }],
    }
    const a = withAudit({ findings: FINDINGS, askExposure: low, finalCycle: { days: 187 } })
    expect(storyClassFor(a)).toBe('neutral')
  })

  it('goes neutral, and says so in the title, on a home listed with another brokerage', () => {
    const a: OpinionPageArgs = {
      ...withAudit({ findings: FINDINGS, askExposure: EXPOSURE, finalCycle: { days: 187 } }),
      subjectStatus: {
        standardStatus: 'Active',
        isActiveWithOtherBrokerage: true,
        isWithdrawnNotExpired: false,
        listingAgentIsUs: false,
        note: null,
      },
    }
    expect(storyClassFor(a)).toBe('neutral')
    expect(whatHappenedHeading(a)).toBe('It is listed at $460,000.')
  })
})

/** Round-four class D. */
describe('the closing does not solicit somebody else\'s listing', () => {
  const active: OpinionPageArgs = {
    ...args(),
    broker: {
      id: null,
      slug: 'matthew-ryan',
      displayName: 'Matt Ryan',
      title: 'Principal Broker',
      licenseNumber: '201234567',
      email: 'matt@ryan-realty.com',
      phone: '5415551234',
      photoUrl: null,
    },
    subjectStatus: {
      standardStatus: 'Active',
      isActiveWithOtherBrokerage: true,
      isWithdrawnNotExpired: false,
      listingAgentIsUs: false,
      note: null,
    },
  }

  it('replaces the two asks with one neutral action and adds the non-solicitation sentence', () => {
    const buttons = nextStepButtonsHtml(active)
    expect(buttons).not.toContain('Talk with Matt')
    expect(buttons).toContain('See homes for sale near you')
    expect((buttons.match(/class="btn/g) ?? []).length).toBe(1)
    expect(closingComplianceSentence(active)).toContain('not a solicitation')
    expect(nextStepHeading(active)).toBe('What this report is.')
  })

  it('says the report is not an offer to interfere when the listing was withdrawn', () => {
    const withdrawn: OpinionPageArgs = {
      ...active,
      subjectStatus: {
        standardStatus: 'Withdrawn',
        isActiveWithOtherBrokerage: false,
        isWithdrawnNotExpired: true,
        listingAgentIsUs: false,
        note: null,
      },
    }
    expect(closingComplianceSentence(withdrawn)).toContain('not an offer to interfere')
    expect(nextStepButtonsHtml(withdrawn)).toContain('Talk with Matt')
  })

  it('says nothing extra on a plain expired row', () => {
    expect(closingComplianceSentence(args())).toBe('')
  })
})
