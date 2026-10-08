import { describe, expect, it } from 'vitest'
import {
  assembleOpinionPages,
  closingComplianceSentence,
  mapArgs,
  mapSharesPricePage,
  nextStepButtonsHtml,
  nextStepHeading,
  nextStepNoteHtml,
  sellerNetBodyHtml,
  sellerNetKick,
  storyClassFor,
  unsoldMatrixLead,
  whatHappenedHeading,
  type OpinionPageArgs,
} from '@/lib/cma/opinion-pages'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'
import { chapterIsLeadOnly, mapSubsectionHtml } from '@/lib/cma/render-pricing-page'

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
    // Delta 3: the map sits under the number, and there is still exactly one
    // of it in the whole document. This price chapter is its heading and one
    // paragraph, so the map shares its page (2382 Jackson, reader review
    // 2026-10-08) under its own subhead.
    const price = pages.findIndex((p) => p.body.includes('is-answer'))
    const map = pages.findIndex((p) => p.body.includes('pin-map'))
    expect(map).toBe(price)
    expect(pages[map]?.body).toContain('data:image/png;base64,compsmap')
    expect(pages[map]?.body).toContain('<h3 class="subhead">Comparable homes near you</h3>')
    expect(pages.map((p) => p.toc)).not.toContain('Comparable homes near you')
    const all = pages.map((p) => p.body).join('')
    expect(all).not.toContain('data:image/png;base64,subjmap')
    expect((all.match(/data:image\/png;base64,compsmap/g) ?? []).length).toBe(1)
  })

  it('keeps the map its own chapter when the price chapter says more than its lead', () => {
    const base = args()
    const a = {
      ...base,
      pricing: {
        ...base.pricing,
        clamp: { sentence: 'The sales point above the ask that did not sell, so the price stays under it.' },
      } as typeof base.pricing,
      mapDataUri: 'data:image/png;base64,compsmap',
    }
    const pages = assembleOpinionPages(a)
    const price = pages.findIndex((p) => p.body.includes('is-answer'))
    expect(pages[price]?.body).toContain('worth-lead-note')
    expect(pages[price]?.body).not.toContain('pin-map')
    expect(pages.findIndex((p) => p.toc === 'Comparable homes near you')).toBe(price + 1)
  })

  it('folds a lead-only price chapter onto the map page in the immersive too, so the two stay one list', () => {
    const a = { ...args(), mapDataUri: 'data:image/png;base64,compsmap' }
    expect(mapSharesPricePage(a)).toBe(true)
    expect(chapterIsLeadOnly('<h2 class="section is-answer">X.</h2><p class="worth-lead">One.</p>')).toBe(true)
    expect(
      chapterIsLeadOnly('<h2 class="section is-answer">X.</h2><p class="worth-lead">One.</p><p class="worth-lead-note">Two.</p>'),
    ).toBe(false)
    // No map, nothing to fold.
    expect(mapSharesPricePage({ ...args(), mapDataUri: null })).toBe(
      Boolean(mapSubsectionHtml(mapArgs({ ...args(), mapDataUri: null }))),
    )
  })

  it('runs the number, the map, then the three matrices in Delta 3 order', () => {
    // Five price-setting sales is the pricing unit's own floor (Matt
    // 2026-10-07), and the floor the matrix fails closed at
    // (MIN_CLOSED_SALES_FOR_MATRIX).
    const base = args()
    const pages = assembleOpinionPages({
      ...base,
      comps: [0, 1, 2, 3, 4].map((i) => ({ ...base.comps[0]!, listingKey: `K${i}`, address: `${100 + i} Test St` })),
      mapDataUri: 'data:image/png;base64,compsmap',
    })
    const tocs = pages.map((p) => p.toc)
    const price = pages.findIndex((p) => p.body.includes('is-answer'))
    // The map is on the price chapter's page when that chapter is one
    // paragraph, and the next page otherwise. Either way it is under the
    // number and before the sales.
    const map = pages.findIndex((p) => p.body.includes('pin-map'))
    const closed = tocs.indexOf('The sales that set this price')
    const competition = tocs.findIndex((t) => t?.startsWith('Who you would compete with at'))
    const market = tocs.findIndex((t) => t?.endsWith('right now'))
    expect(price).toBeGreaterThanOrEqual(0)
    expect(map === price || map === price + 1).toBe(true)
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
    const price = pages.findIndex((p) => p.body.includes('is-answer'))
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
    expect(body).toContain('First ask')
    expect(body).toContain('class="arc-arrow"')
    expect(body).toContain('outcome')
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
    // Matt 2026-10-07: the money column never reads "that price". The column
    // head says which price, and the cover owns the dollars.
    expect(html).toContain('At the list price')
    expect(html).not.toContain('<td class="v">that price</td>')
    expect(html).not.toContain('$429,000')
    expect(html).toContain('Commission')
    expect(html).toContain('Listing agreement, 5.0%')
    expect(html).toContain('Deschutes County schedule')
    expect(html).toContain('Payoff quote you provided')
    expect(html).toContain('$194,450')
    expect(html).toContain('What you keep')
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
    expect(html).toContain('A net at that price needs')
    expect(html).toContain('the commission written into your listing agreement')
  })

  it('prints no figure on the legacy concessions-only block', () => {
    const html = sellerNetBodyHtml(
      withNet({ expectedConcessions: 8000, predictedSellerNet: 467000, knownCount: 3 }),
    )
    expect(html).not.toContain('$467,000')
    expect(html).toContain('A net at that price needs')
  })

  it('refuses a line with no source, and refuses a net above the list', () => {
    const noSource = sellerNetBodyHtml(
      withNet({ ...NET_SHEET, lines: [{ label: 'Commission', amount: 23750, source: '' }], net: 451250 }),
    )
    expect(noSource).toContain('A net at that price needs')
    const overList = sellerNetBodyHtml(withNet({ ...NET_SHEET, net: 480000 }))
    expect(overList).toContain('A net at that price needs')
    expect(overList).not.toContain('$480,000')
  })

  it('refuses a column that does not add up', () => {
    const html = sellerNetBodyHtml(withNet({ ...NET_SHEET, net: 300000 }))
    expect(html).toContain('A net at that price needs')
  })

  it('on a draft, prices the fees and title and does not subtract a median credit', () => {
    const html = sellerNetBodyHtml({
      ...withNet({
        basis: 'list',
        list: 429000,
        lines: [
          {
            label: 'Seller concession',
            amount: 8000,
            source:
              'Median of the 5 comparable sales that reported the field. 5 of them gave one, median $8,000.',
          },
        ],
        net: 421000,
        sentence:
          'From a $429,000 list, less $8,000 in seller concessions, $421,000 remains. This figure does not include the listing and buyer-broker commission, title insurance, escrow and closing fees, recording and transfer fees and your loan payoff.',
        unknowns: [
          'the listing and buyer-broker commission',
          'title insurance',
          'escrow and closing fees',
          'recording and transfer fees',
          'your loan payoff',
        ],
      }),
      documentStatus: 'draft',
      likeHomeCredits: {
        sentence:
          'Four Countryside houses about this size, built in 2022 or 2023, have sold in the last 18 months. 20457 Aberdeen gave the buyer $7,500. The other three gave nothing. A credit is agreed in the offer, not in the list price, so this sheet takes nothing off for one.',
        source: '4 closed sales in Countryside, 2,098 to 2,838 sqft. Oregon Data Share MLS.',
      },
    })
    // The cover owns the list dollars on a draft too: the column head names
    // the list price, the sources say "the list price".
    expect(html).toContain('At the list price')
    expect(html).not.toContain('$429,000')
    expect(html).toContain('3% of the list price')
    expect(html).toContain('Our fee')
    expect(html).toContain('$12,870')
    expect(html).toContain('if you offer it')
    expect(html).toContain('$10,725')
    expect(html).toContain('Title insurance')
    expect(html).toContain('$1,208')
    expect(html).toContain('Left from the sale')
    expect(html).toContain('$404,197')
    expect(html).toContain('Before the escrow company')
    expect(html).toContain('20457 Aberdeen gave the buyer $7,500')
    expect(html).not.toContain('that price')
    expect(html).not.toContain('does not include')
    expect(html).not.toContain('$8,000')
    expect(html).not.toContain('$421,000')
  })
})

/**
 * The heading names every ask and how long it ran. The gap class uses the
 * last ask, the price the listing came off at, which is what the email and
 * the tables use. The original list is not that number.
 */
const EXPOSURE = {
  segments: [
    { ask: 500000, from: '2025-08-01', to: '2025-12-31', days: 152, sharePct: 81.3, pctAboveRangeTop: 12.6 },
    { ask: 460000, from: '2026-01-01', to: '2026-02-04', days: 35, sharePct: 18.7, pctAboveRangeTop: 3.6 },
  ],
  dominant: 500000,
  final: 460000,
  sentence: 'You asked $500,000 for 152 days, then $460,000 for 35.',
}

function withAudit(expiredAudit: unknown): OpinionPageArgs {
  return { ...args(), expiredAudit: expiredAudit as OpinionPageArgs['expiredAudit'] }
}

const FINDINGS = [{ lens: 'pricing' as const, fact: 'Your home sat 187 days.', meaning: '' }]

describe('chapter one reads the ask that ran the clock', () => {
  it('names both asks and their days', () => {
    const a = withAudit({ findings: FINDINGS, askExposure: EXPOSURE, finalCycle: { days: 187 } })
    expect(whatHappenedHeading(a)).toBe('You asked $500,000 for 152 days, then $460,000 for 35.')
  })

  it('names the original list when the exposure starts at a later ask', () => {
    const a = withAudit({ findings: FINDINGS, askExposure: EXPOSURE, finalCycle: { days: 187 } })
    a.subject = { ...a.subject, originalListPrice: 1_025_000 }
    const heading = whatHappenedHeading(a)
    expect(heading).toContain('$1,025,000')
    expect(heading).toContain('You asked $500,000 for 152 days, then $460,000 for 35.')
  })

  it('measures the gap off the last ask, not the original list', () => {
    const a = withAudit({ findings: FINDINGS, askExposure: EXPOSURE, finalCycle: { days: 187 } })
    // $500,000 against a $444,000 top is 12.6 percent. The last ask, $460,000,
    // is 3.6 percent, near the range. The percent line uses the last ask.
    expect(storyClassFor(a)).toBe('near-above')
  })

  it('tells no causal story when the row does not say which ask ran the clock', () => {
    const a = withAudit({ findings: FINDINGS, finalCycle: { days: 187 } })
    expect(storyClassFor(a)).toBeNull()
    expect(whatHappenedHeading(a)).toBe('You asked $460,000 and did not sell.')
  })

  it('goes neutral when the ask sat below the bottom of the range', () => {
    const low = {
      ...EXPOSURE,
      dominant: 380000,
      final: 380000,
      segments: [{ ask: 380000, from: null, to: null, days: 187, sharePct: 100, pctAboveRangeTop: null }],
    }
    const a = withAudit({ findings: FINDINGS, askExposure: low, finalCycle: { days: 187 } })
    a.subject = { ...a.subject, lastListPrice: 380_000 }
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
    expect(whatHappenedHeading(a)).toBe('Your home is listed at $460,000.')
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
    expect(buttons).not.toContain('Talk with')
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
    expect(closingComplianceSentence(withdrawn)).toBe('')
    const note = nextStepNoteHtml(withdrawn)
    expect(note).not.toContain('not an offer to interfere')
    expect(note).not.toContain('may still be running')
    expect(note).toContain('tel:+15415551234')
    expect(note).toContain('mailto:matt@ryan-realty.com')
    // Withdrawn is not somebody else's live listing, so the one next step
    // (Matt 2026-10-07) is there: book a time, then Call and Text.
    const buttons = nextStepButtonsHtml(withdrawn)
    expect(buttons).toContain('>Pick a time with Matt<')
    expect(buttons).toContain('>Call<')
    expect(buttons).toContain('>Text<')
    expect(buttons).toContain('sms:+15415551234')
  })

  it('puts the signing broker on the phone, the email, and the calendar', () => {
    const paul: OpinionPageArgs = {
      ...active,
      broker: {
        ...active.broker!,
        slug: 'paul-stevenson',
        displayName: 'Paul Stevenson',
        title: 'Broker',
        email: 'paul@ryan-realty.com',
        phone: '5415023436',
      },
      subjectStatus: {
        standardStatus: 'Withdrawn',
        isActiveWithOtherBrokerage: false,
        isWithdrawnNotExpired: true,
        listingAgentIsUs: false,
        note: null,
      },
    }
    const note = `${nextStepButtonsHtml(paul)}${nextStepNoteHtml(paul)}`
    expect(note).toContain('tel:+15415023436')
    expect(note).toContain('sms:+15415023436')
    expect(note).toContain('mailto:paul@ryan-realty.com')
    expect(note).toContain('Pick a time with Paul')
    expect(note).toContain('agent=paul')
    expect(note).not.toContain('541.703.3095')
    expect(note).not.toContain('matt@ryan-realty.com')
    expect(note).not.toContain('agent=paul-stevenson')
  })

  it('says nothing extra on a plain expired row', () => {
    expect(closingComplianceSentence(args())).toBe('')
  })
})

describe('unsoldMatrixLead counts its rows (2745 Aldrich, reader review 2026-10-08)', () => {
  const range = { low: 473_949, high: 479_161 }
  const row = (address: string, lastAsk: number | null) =>
    ({ address, lastAsk, status: 'Expired' }) as unknown as Parameters<typeof unsoldMatrixLead>[0][number]

  it('says "This one" over a single listing that never came down', () => {
    expect(unsoldMatrixLead([row('2812 Aldrich', 495_000)], range)).toContain('This one asked and never came down to the range.')
    expect(unsoldMatrixLead([row('2812 Aldrich', 495_000)], range)).not.toContain('These')
  })

  it('keeps "These" over two or more', () => {
    expect(unsoldMatrixLead([row('2812 Aldrich', 495_000), row('3223 Spring Creek', 499_000)], range)).toContain(
      'These asked and never came down to the range.',
    )
  })

  it('counts the ones that never came down when some did', () => {
    expect(unsoldMatrixLead([row('2812 Aldrich', 495_000), row('3223 Spring Creek', 475_000)], range)).toContain(
      '1 of these 2 listings never came down to the range.',
    )
  })
})

describe('the map and the pages around it (reader review 2026-10-08)', () => {
  const area = {
    kind: 'subdivision',
    names: ['Diamond Bar Ranch'],
    radiusMiles: null,
    centre: { lat: 44.27, lng: -121.17 },
    source: 'test',
    sentence: 'Diamond Bar Ranch, your own subdivision.',
  } as const

  function fiveSales(): CmaAdjustedComp[] {
    // Two units in one building print the same street address (no unit on
    // either ladder): 101 Test St is K1 and K2.
    return [0, 1, 2, 3, 4].map((i) => ({
      ...comp,
      listingKey: `K${i}`,
      address: i === 2 ? '101 Test St' : `${100 + i} Test St`,
      adjustedPrice: 400_000 + i * 10_000,
      latitude: 44.27 + i * 0.001,
      longitude: -121.17,
    }))
  }

  it('draws the sales the table sets aside as set aside, by listing key (62475 Woodsman, 2382 Jackson)', () => {
    const a: OpinionPageArgs = {
      ...args(),
      comps: fiveSales(),
      pricing: {
        ...pricing,
        setAside: [
          { listingKey: 'K0', address: '100 Test St', reason: 'lowest of the adjusted sales', adjustedPrice: 400_000 },
          { listingKey: 'K1', address: '101 Test St', reason: 'highest of the adjusted sales', adjustedPrice: 410_000 },
        ],
      } as unknown as CmaPricing,
      mapDataUri: null,
    }
    const closed = mapArgs(a).facts.filter((f) => f.family === 'closed')
    // K2 shares K1's address and is not set aside: the key decides.
    expect(closed.filter((f) => f.setAside).map((f) => f.key)).toEqual(['1', '2'])
    expect(closed.find((f) => f.key === '3')?.setAside).toBeUndefined()
    // The table names the same two.
    const all = assembleOpinionPages(a)
      .map((p) => p.body)
      .join('')
    expect(all).toContain('These 2 sales are shown above and did not set the number.')
    const map = mapSubsectionHtml(mapArgs(a))
    expect(map).toContain('Closed sales: these set the price')
    expect(map).toContain('Closed sales shown but set aside')
    expect((map.match(/class="pin-sale is-closed is-aside"/g) ?? []).length).toBe(2)
  })

  it('keeps one closed legend line when nothing is set aside', () => {
    const map = mapSubsectionHtml(mapArgs({ ...args(), comps: fiveSales(), mapDataUri: null }))
    expect(map).toContain('Closed sales: these set the price')
    expect(map).not.toContain('set aside')
  })

  it('says plainly that no other listing came off, under a heading that is not plural over nothing (3037 Purcell)', () => {
    const a: OpinionPageArgs = {
      ...args(),
      subject: { ...subject, standardStatus: 'Expired' },
      expiredPeers: {
        area,
        windowMonths: 18,
        windowsTried: [3, 6, 9, 12, 18],
        widenedTo: null,
        count: 0,
        areaTotal: 0,
        found: 0,
        likeYours: false,
        shortfall: true,
        sentence: '',
        peers: [],
      } as unknown as OpinionPageArgs['expiredPeers'],
    }
    const page = assembleOpinionPages(a).find((p) => p.meta.endsWith('Did not sell'))
    expect(page?.toc).toBe('No other listing like yours near you came off unsold.')
    expect(page?.body).not.toContain('The listings near you that did not sell.')
    expect(page?.body).toContain(
      'No other home like yours in Diamond Bar Ranch came off the market without selling in the last 18 months.',
    )
  })

  it('never points at "this map" on a page without one (2382 Jackson, 62475 Woodsman)', () => {
    const a: OpinionPageArgs = {
      ...args(),
      subject: { ...subject, standardStatus: 'Expired' },
      expiredPeers: {
        area,
        windowMonths: 18,
        windowsTried: [3, 6, 9, 12, 18],
        widenedTo: null,
        count: 0,
        areaTotal: 2,
        found: 0,
        likeYours: false,
        shortfall: true,
        sentence:
          'Two homes in Diamond Bar Ranch came off the market without selling in the last 18 months. None were close to this home in bedrooms, bathrooms, size or age, so none are on this map.',
        peers: [],
      } as unknown as OpinionPageArgs['expiredPeers'],
      bandRivals: {
        area,
        lo: 386_000,
        hi: 472_000,
        activeCount: 0,
        pendingCount: 0,
        rivals: [],
        unlikeCount: 1,
        sentence:
          'No home like yours in Diamond Bar Ranch is for sale or under contract between $386,000 and $472,000. One other home is listed there in that range, but it is not close to this home in bedrooms, bathrooms, size or age, so it is not on this map.',
        source:
          'Homes for sale and under contract in Diamond Bar Ranch between $386,000 and $472,000, from the Oregon Data Share MLS as of Sep 5, 2026.',
        widenedFrom: null,
        ringsTried: [],
      } as unknown as OpinionPageArgs['bandRivals'],
    }
    const pages = assembleOpinionPages(a)
    const unsold = pages.find((p) => p.meta.endsWith('Did not sell'))!
    const compete = pages.find((p) => p.meta.endsWith('At this price'))!
    for (const p of [unsold, compete]) {
      expect(p.body).not.toContain('this map')
      expect(p.body).not.toContain('pin-map')
    }
    expect(unsold.toc).toBe('No other listing like yours near you came off unsold.')
    expect(unsold.body).toContain('so they are not compared here.')
    expect(compete.body).toContain('so it is not compared here.')
    // No table, so the trace prints as the count's source, not a caption.
    expect(compete.body).toContain(
      '<p class="small">Source: homes for sale and under contract in Diamond Bar Ranch between $386,000 and $472,000, from the Oregon Data Share MLS as of Sep 5, 2026.</p>',
    )
  })
})
