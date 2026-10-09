/**
 * The price, explained (Matt 2026-10-07), on 2566 Keats.
 *
 * Every figure in the fixture below is copied from the stored render_args of
 * cma-2566-keats (cmas.render_args, read 2026-10-07): the five printed sales,
 * their raw weights and adjustments, the reconciliation, the range rule, the
 * time adjustment and the seller-net block. The tests then assert the four
 * reader-facing changes against that row:
 *
 *  1. the price chapter says we would list at the cover's price and expect a
 *     sale near the weighted price of the sales, right under its heading;
 *  2. the net chapter adds a second column at that expected sale, every line
 *     recomputed with the same formula the list column was written with;
 *  3. the method notes leave the price chapter and print in Basis and limits
 *     in plain English, composed from the stored fields;
 *  4. the hero puts the recommended list first and labels Low/High as where
 *     similar homes sold.
 */

import { describe, expect, it } from 'vitest'
import {
  adjustedRangeLine,
  expectedSaleFor,
  expectedSaleNear,
  expectedSaleSentence,
  headingWithPriceSet,
  netAtExpectedSale,
  netCreditsSentence,
} from '@/lib/cma/expected-sale'
import { outsideSubdivisionSentence, salesMethodSentences } from '@/lib/cma/sales-method-note'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import {
  cmaDisclosureProseHtml,
  salesMethodHtml,
  sellerNetBodyHtml,
  sellerNetKick,
  sellerNetPage,
  type OpinionPageArgs,
} from '@/lib/cma/opinion-pages'
import {
  COVER_LIST_PRICE_HEADLINE,
  HERO_SOLD_RANGE_LABEL,
  immersiveHeroNumberHtml,
  letterCoverPayoffHtml,
} from '@/lib/cma/cover-value'
import { renderCmaHtml } from '@/lib/cma/render'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import { recommendUsdForms } from '@/lib/cma/recommend-once'
import { findSellerBannedWords, sellerVisibleText } from '@/lib/cma/seller-text'
import { FLAT_LOCAL_DATE_SENTENCE } from '@/lib/cma/flat-date-story'
import { ownersPolicyPremium } from '@/lib/pricing/owners-policy'
import { printedAdjustedPrice, sellerCostLines } from '@/lib/pricing/seller-net'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

// ── cma-2566-keats, as stored ───────────────────────────────────────────────

const SUBJECT = {
  listingKey: null,
  mlsNumber: null,
  streetAddress: '2566 Keats',
  city: 'Bend',
  state: 'OR',
  postalCode: '97701',
  subdivision: 'Hampton Park',
  latitude: 44.07,
  longitude: -121.27,
  beds: 3,
  baths: 2.5,
  sqft: 2388,
  lotAcres: 0.15,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2004,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Canceled',
  lastListPrice: 649900,
  lastListDate: '2026-02-01',
  listingHistoryLine: null,
} as unknown as CmaSubject

function sale(c: {
  listingKey: string
  address: string
  subdivision: string
  sqft: number
  closePrice: number
  closeDate: string
  timeAdjustment: number
  sizeAdjustment: number
  concessions: number
  adjustedPrice: number
  weight: number
}): CmaAdjustedComp {
  return {
    mlsNumber: null,
    city: 'Bend',
    latitude: 44.07,
    longitude: -121.27,
    beds: 3,
    baths: 2.5,
    lotAcres: 0.15,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2004,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: c.closePrice,
    daysToOffer: 10,
    domTotal: 10,
    selectionTier: 'subdivision',
    monthsSinceClose: 1,
    timeAdjustedPrice: c.closePrice + c.timeAdjustment,
    ppsfTimeAdjusted: Math.round((c.closePrice + c.timeAdjustment) / c.sqft),
    storyAdjustment: 0,
    concessionsAmount: c.concessions,
    ...c,
  } as unknown as CmaAdjustedComp
}

const COMPS: CmaAdjustedComp[] = [
  sale({ listingKey: '20260716190044749942000000', address: '2542 Keats', subdivision: 'Hampton Park', sqft: 2169, closePrice: 605000, closeDate: '2026-09-28', timeAdjustment: 0, sizeAdjustment: 29806, concessions: 14600, adjustedPrice: 620206, weight: 3.7826 }),
  sale({ listingKey: '20251106005706564311000000', address: '530 Majesty', subdivision: 'Deer Pointe Village', sqft: 2008, closePrice: 581000, closeDate: '2026-03-23', timeAdjustment: -9064, sizeAdjustment: 54117, concessions: 0, adjustedPrice: 626053, weight: 0.5788 }),
  sale({ listingKey: '20250225224323817327000000', address: '2642 Keats', subdivision: 'Hampton Park', sqft: 2184, closePrice: 637000, closeDate: '2026-02-26', timeAdjustment: -8680, sizeAdjustment: 28551, concessions: 17000, adjustedPrice: 639871, weight: 3.1222 }),
  sale({ listingKey: '20250811193728773852000000', address: '700 Shelley', subdivision: 'Hampton Park', sqft: 1704, closePrice: 535000, closeDate: '2025-09-08', timeAdjustment: -20606, sizeAdjustment: 100833, concessions: 12000, adjustedPrice: 603227, weight: 1.5126 }),
  sale({ listingKey: '20240619002154496116000000', address: '2537 Longfellow', subdivision: 'Hampton Park', sqft: 1764, closePrice: 550000, closeDate: '2024-11-01', timeAdjustment: -33715, sizeAdjustment: 91316, concessions: 0, adjustedPrice: 607601, weight: 1.501 }),
]

const STORED_TIME_SENTENCE =
  "Each sale is moved by the change in Bend's median price a square foot between the month it closed and the last three complete months. Over the last 12 months that index rose to a peak in May 2026 and has come back 7.0 percent since, so every sale below moves down. The index is built from 2,606 sales."
const STORED_RANGE_SENTENCE =
  'The range is the spread of all five sale prices adjusted for date and size: $603,227 to $639,871. The range is those adjusted sale prices. Homes in this city are closing at 95.8 percent of the price they first asked. That share is a list-strategy fact. It is not applied to this range.'

const PRICING = {
  method1Low: 668000,
  method1Mid: 680000,
  method1High: 699000,
  method2: 626000,
  method3: 622000,
  convergenceSpreadPct: 9.3,
  converged: false,
  conservative: 629000,
  recommended: 639000,
  highEnd: 639871,
  valueLow: 603227,
  valueHigh: 639871,
  predictedClose: 622128,
  failedAsk: 649900,
  failedAskCapped: false,
  failedAskBelowRange: false,
  confidence: 'Moderate',
  confidenceReason: 'Held to this level by the pricing methods land 9.3% apart.',
  needsReview: false,
  reviewReason: null,
  priceOverride: null,
  improvementsValueAdd: null,
  compPpsfCv: 0.029,
  notes: [],
  clamp: null,
  setAside: [],
  reconciliation: {
    weightedPrice: 622128,
    mostWeighted: '20260716190044749942000000',
    sentence:
      '2542 Keats carries the most weight of the five sales behind this price, at 36 percent: it is 219 square feet smaller than yours, it sold last month, and it needed the smallest adjustment of any of them.',
    weights: [
      { listingKey: '20260716190044749942000000', address: '2542 Keats', weight: 36, grossAdjustmentPct: 7.3 },
      { listingKey: '20251106005706564311000000', address: '530 Majesty', weight: 5.5, grossAdjustmentPct: 10.9 },
      { listingKey: '20250225224323817327000000', address: '2642 Keats', weight: 29.7, grossAdjustmentPct: 8.5 },
      { listingKey: '20250811193728773852000000', address: '700 Shelley', weight: 14.4, grossAdjustmentPct: 24.9 },
      { listingKey: '20240619002154496116000000', address: '2537 Longfellow', weight: 14.3, grossAdjustmentPct: 22.7 },
    ],
  },
  rangeRule: {
    n: 5,
    kept: 5,
    rule: 'min-max',
    saleLow: 603227,
    saleHigh: 639871,
    adjustedLow: 603227,
    adjustedHigh: 639871,
    saleToAskRatio: 0.95815,
    saleToAskSource: 'city-index',
    ratiosExcluded: 0,
    endpointPpsfAside: 0,
    endpointWeightAside: 0,
    sentence: STORED_RANGE_SENTENCE,
  },
  timeAdjustment: {
    n: 2606,
    basis: 'city-monthly-index-trailing-3',
    measure: 'median price a square foot, every home sale in the city',
    pctPerMonth: -0.2,
    windowMonths: 12,
    pctOverWindow: -2.8,
    referenceMonths: ['2026-07-01', '2026-08-01', '2026-09-01'],
    shape: {
      turned: true,
      extreme: 'peak',
      extremeMonth: '2026-05-01',
      sinceExtremePct: -7,
      overWindowPct: -2.8,
      movesUp: [],
      movesDown: ['2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01'],
      clause: 'rose to a peak in May 2026 and has come back 7.0 percent since, so every sale below moves down',
    },
    sentence: STORED_TIME_SENTENCE,
  },
  sellerNet: {
    basis: 'list',
    list: 639000,
    net: 602296,
    lines: [
      { label: 'Our fee', amount: 19170, source: '3% of $639,000' },
      { label: "Buyer's agent", amount: 15975, source: '2.5% of $639,000, if you offer it' },
      { label: 'Title insurance', amount: 1559, source: "Oregon owner's policy rate at $639,000" },
    ],
    sentence: '',
    unknowns: [],
    expectedConcessions: 12000,
    knownCount: 5,
    givenCount: 3,
    medianWhenGiven: 14600,
    rate: 0.6,
  },
} as unknown as CmaPricing

const COMP_SEARCH = {
  subdivision: 'Hampton Park',
  sentence: 'Four of the five sales are in Hampton Park. One more was added: 530 Majesty in Deer Pointe Village.',
  ruralSentence: null,
  keptBySubdivision: { 'Hampton Park': 4, 'Deer Pointe Village': 1 },
  rungs: [],
}

const BROKER: CmaBroker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/ryan-matt.png',
}

function opinion(over: Partial<OpinionPageArgs> = {}): OpinionPageArgs {
  return {
    subject: SUBJECT,
    comps: COMPS,
    market: null,
    pricing: PRICING,
    mapDataUri: null,
    generatedAtIso: '2026-10-06T20:27:12.888Z',
    compSearch: COMP_SEARCH,
    compTrace: [],
    tiersUsed: [],
    broker: BROKER,
    ...over,
  } as OpinionPageArgs
}

function renderArgs() {
  return {
    subject: SUBJECT,
    comps: COMPS,
    market: null,
    pricing: PRICING,
    broker: BROKER,
    client: { name: 'Pat', email: null, phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-10-06T20:27:12.888Z',
    subjectTrace: 't',
    compTrace: [],
    compSearch: COMP_SEARCH,
    excludedOutliers: [],
    tiersUsed: [],
  } as unknown as Parameters<typeof renderCmaHtml>[0]
}

// The list points at the cover, which owns those dollars, and the expected
// sale prints to the thousand where it says "near" (reader review 2026-10-07).
const EXPECTED_SENTENCE =
  "We'd list at the price on the cover and expect it to sell near $622,000, which is what the five sales point to once each is weighted by how closely it matches your home."
// Three of the five carry a seller concession the grid takes off first, so
// the line names it (reader review, 3177 Coho, 2026-10-08).
const RANGE_LINE = "After seller concessions and adjusted to today's market and your home's size, they run from $603,227 to $639,871."

/** The worth-lead paragraph as a reader sees it. */
function worthLead(html: string): string {
  const m = /<p class="worth-lead">([\s\S]*?)<\/p>/.exec(html)
  return sellerVisibleText(m?.[1] ?? '')
}

// ── 1. the expected sale ────────────────────────────────────────────────────

describe('the price chapter says why the list sits where it does (Keats)', () => {
  it('reads the expected sale off the row, and checks it against the printed grid', () => {
    // The same weights over the grid's "Sale price today" row land on it.
    expect(expectedSaleFor({ pricing: PRICING, comps: COMPS })).toEqual({
      price: 622128,
      field: 'pricing.predictedClose',
      sales: 5,
    })
  })

  it('prints one plain sentence, with the expected sale and without the cover dollars', () => {
    const e = expectedSaleFor({ pricing: PRICING, comps: COMPS })!
    expect(expectedSaleSentence(e)).toBe(EXPECTED_SENTENCE)
    for (const form of recommendUsdForms(639000)) expect(EXPECTED_SENTENCE).not.toContain(form)
    expect(adjustedRangeLine(COMPS, { afterExpected: e })).toBe(RANGE_LINE)
    expect(adjustedRangeLine(COMPS)).toBe(
      "The five sales, after seller concessions and adjusted to today's market and your home's size, run from $603,227 to $639,871.",
    )
  })

  it('puts the sentence right under the heading, in the letter and the immersive', () => {
    for (const omitLeadPrices of [false, true]) {
      const page = pricingPage({ subject: SUBJECT, comps: COMPS, market: null, pricing: PRICING, renderArgs: opinion(), omitLeadPrices })
      expect(page.toc).toBe('Four of the five sales are in Hampton Park.')
      expect(worthLead(page.body)).toBe(`${EXPECTED_SENTENCE} ${RANGE_LINE}`)
      // The method notes are gone from under the headline.
      const text = sellerVisibleText(page.body)
      expect(text).not.toContain('One more was added')
      expect(text).not.toContain('Each sale is moved')
      expect(text).not.toContain('list-strategy')
      expect(text).not.toContain('The sales support')
      expect(text).not.toContain('List in that range.')
      expect(page.body).not.toContain('class="method-line"')
    }
  })

  it('reads the weighted price when predictedClose is the ask-derived close, not the sales', () => {
    // reconcileAskAndComps: with a last ask the close is ask x 0.98, rounded.
    const askDerived = { ...PRICING, predictedClose: 637000 } as CmaPricing
    expect(expectedSaleFor({ pricing: askDerived, comps: COMPS })).toEqual({
      price: 622128,
      field: 'pricing.reconciliation.weightedPrice',
      sales: 5,
    })
  })

  it('prints nothing new when the sales cannot carry it', () => {
    const at = (p: Partial<CmaPricing>, comps: CmaAdjustedComp[] = COMPS) =>
      expectedSaleFor({ pricing: { ...PRICING, ...p } as CmaPricing, comps })
    // At or above the list: Portland weighs out to $1,093,251 under a $1,073,000 list.
    expect(at({ recommended: 622128 })).toBeNull()
    expect(at({ recommended: 622000 })).toBeNull()
    expect(at({ recommended: 610000 })).toBeNull()
    // No weighted price on the row.
    expect(at({ reconciliation: null } as Partial<CmaPricing>)).toBeNull()
    // No grid to check it against.
    expect(at({}, [])).toBeNull()
    // The grid moved after the build (one sale $10,000 lower than the weights saw).
    const moved = COMPS.map((c, i) => (i === 0 ? { ...c, adjustedPrice: c.adjustedPrice - 10000 } : c))
    expect(at({}, moved)).toBeNull()
    // The flat local date story is a sentence, not a moved grid: it prints
    // only when no sale moved (lib/cma/flat-date-story.ts), so it leaves the
    // figure to the grid check above.
    expect(at({ timeAdjustment: { ...(PRICING.timeAdjustment as object), sentence: FLAT_LOCAL_DATE_SENTENCE } } as Partial<CmaPricing>)).toEqual(at({}))
  })
})

// ── 2. the net, in two columns ──────────────────────────────────────────────

describe('net from the sale: the list, and the expected sale (Keats arithmetic)', () => {
  const sheet = { list: 639000, net: 602296, lines: (PRICING.sellerNet as { lines: Array<{ label: string; amount: number }> }).lines }

  it('uses the same Oregon owner-policy rate for both columns', () => {
    // OTIRO Schedule One: $1,350 at $500,000, plus $1.50 per started $1,000.
    expect(ownersPolicyPremium(639000)).toBe(1559) // 1,350 + 139 x 1.5 = 1,558.5, half up
    expect(ownersPolicyPremium(622128)).toBe(1535) // 1,350 + 123 x 1.5 = 1,534.5, half up
    expect(sellerCostLines(639000).map((l) => l.amount)).toEqual([19170, 15975, 1559])
  })

  it('recomputes every line at the $622,000 the header prints, and shows the arithmetic', () => {
    const t = netAtExpectedSale({ pricing: PRICING, comps: COMPS, sheet })!
    expect(t).not.toBeNull()
    expect(t.expected.price).toBe(622128)
    expect(expectedSaleNear(t.expected)).toBe(622000)
    expect(t.lines).toEqual([
      { label: 'Our fee', source: '3% of the sale price', atList: 19170, atExpected: 18660 },
      { label: "Buyer's agent", source: '2.5% of the sale price, if you offer it', atList: 15975, atExpected: 15550 },
      { label: 'Title insurance', source: "Oregon owner's policy rate", atList: 1559, atExpected: 1533 },
    ])
    // List column, as stored: 639,000 - 19,170 - 15,975 - 1,559 = 602,296.
    expect(t.netAtList).toBe(639000 - 19170 - 15975 - 1559)
    expect(t.netAtList).toBe(602296)
    // Expected column, at the printed $622,000: 3% - 2.5% - title(622,000).
    const fee = Math.round(622000 * 0.03) // 18,660
    const buyers = Math.round(622000 * 0.025) // 15,550
    const title = ownersPolicyPremium(622000)! // 1,350 + 122 x 1.5 = 1,533
    expect(title).toBe(1533)
    expect(t.netAtExpected).toBe(622000 - fee - buyers - title)
    expect(t.netAtExpected).toBe(586257)
  })

  it('does not take the typical $12,000 credit off a second time', () => {
    // The grid's "Sale price today" is each sale AFTER its seller's credit:
    // 2542 Keats closed at $605,000, gave $14,600, and grew $29,806 for size.
    expect(printedAdjustedPrice(COMPS[0]!)).toBe(605000 - 14600 + 29806)
    // So $622,128, the weighted grid, already sits after the credits. The
    // brief's formula (622,128 - fees - title - 12,000 = 574,376) would count
    // the credit twice; the column does not print it.
    const t = netAtExpectedSale({ pricing: PRICING, comps: COMPS, sheet })!
    expect(t.netAtExpected).not.toBe(622128 - 18664 - 15553 - 1535 - 12000)
    expect(netCreditsSentence(t)).toBe(
      'The five sales are counted after any credit their sellers gave the buyer. Three of the five gave one, and the typical credit across all five was $12,000. This column figures the fees on $622,000. If the sale is written higher with a credit back to the buyer, the fees are figured on the higher price.',
    )
  })

  it('renders two columns, each head naming the price it is worked at', () => {
    const html = sellerNetBodyHtml(opinion())
    // The cover owns the recommended dollars (Matt lock 2026-09-12): the head
    // names the price in words, and no cell reprints it.
    expect(html).toContain('At the list price')
    expect(html).not.toContain('At $639,000')
    expect(html).toContain('If it sells near $622,000')
    for (const v of ['−$19,170', '−$18,660', '−$15,975', '−$15,550', '−$1,559', '−$1,533', '$602,296', '$586,257']) {
      expect(html).toContain(v)
    }
    expect(html.split('$639,000')).toHaveLength(1)
    for (const form of recommendUsdForms(639000).filter((f) => f !== '$639,000')) expect(html).not.toContain(form)
    expect(html).not.toContain('<td class="v">that price</td>')
    expect(sellerVisibleText(html)).toContain("Both columns are before the escrow company's fee and what you still owe on the home.")
    expect(sellerNetPage(opinion())!.toc).toBe('Net from the sale')
    expect(sellerNetKick(opinion())).toBe('Net from the sale')
  })

  it('keeps one column when the stored sheet is not the formula', () => {
    const handSheet = {
      ...(PRICING.sellerNet as object),
      lines: [{ label: 'Commission', amount: 25000, source: 'Listing agreement, 5.0%' }],
      net: 614000,
    }
    const a = opinion({ pricing: { ...PRICING, sellerNet: handSheet } as CmaPricing })
    const html = sellerNetBodyHtml(a)
    expect(html).not.toContain('If it sells near')
    expect(html).toContain('At the list price')
    expect(html).toContain('Left from the sale')
    expect(sellerNetPage(a)!.toc).toBe('Net at list')
    // A stored sheet that names nothing it leaves out still leaves out escrow
    // and the payoff, and says so (20676 Wild Rose, reader review 2026-10-07).
    expect(sellerVisibleText(html)).toContain("Before the escrow company's fee and what you still owe on the home.")
  })

  it('keeps the escrow line on a stored one-column sheet of the engine lines (Wild Rose)', () => {
    // The weighted price sits above the list, so there is no second column,
    // and the stored sheet renders off the stored path, not the draft one.
    const a = opinion({
      documentStatus: 'ready',
      pricing: { ...PRICING, predictedClose: 700000, reconciliation: { ...(PRICING as unknown as { reconciliation: object }).reconciliation, weightedPrice: 700000 } } as unknown as CmaPricing,
    } as Partial<OpinionPageArgs>)
    const html = sellerNetBodyHtml(a)
    expect(html).not.toContain('If it sells near')
    expect(sellerVisibleText(html)).toContain("Before the escrow company's fee and what you still owe on the home.")
  })
})

// ── 3. the method, in Basis and limits ──────────────────────────────────────

describe('the method moves to Basis and limits, in plain English (Keats)', () => {
  const KEATS_METHOD = [
    'One of the five sales, 530 Majesty, is outside Hampton Park, in Deer Pointe Village.',
    "Bend's median price per square foot, the figure under the sales grid, is built from 2,606 home sales across Bend.",
    'Over the last 12 months it peaked in May 2026 and has come down 7.0 percent since.',
    "That moves four of the five sales down. The other one sold when that figure was already at today's level, so it does not move.",
    'Homes in Bend are selling for 95.8 percent of the price they first asked.',
    'That matters for the list price, not for the range.',
  ]

  it('composes the paragraph from the stored fields and the grid, not the stored sentences', () => {
    expect(
      salesMethodSentences({
        subject: SUBJECT,
        comps: COMPS,
        pricing: PRICING,
        searchTail: 'One more was added: 530 Majesty in Deer Pointe Village.',
      }),
    ).toEqual(KEATS_METHOD)
  })

  it('prints it under its own label, between what was looked at and condition', () => {
    const html = cmaDisclosureProseHtml(opinion())
    expect(salesMethodHtml(opinion())).toBe(
      `<p><strong>How the sales were chosen and adjusted.</strong> ${KEATS_METHOD.join(' ').replace(/'/g, '&#39;')}</p>`,
    )
    const at = html.indexOf('How the sales were chosen and adjusted.')
    expect(at).toBeGreaterThan(html.indexOf('What was looked at.'))
    expect(at).toBeLessThan(html.indexOf('Condition was not adjusted for.'))
    const text = sellerVisibleText(html)
    expect(text).not.toContain('list-strategy fact')
    expect(text).not.toContain('One more was added')
    expect(text).not.toContain('every sale below moves down')
  })

  it('names every sale outside the subdivision, with its own subdivision', () => {
    const two = COMPS.map((c, i) => (i === 3 ? { ...c, subdivision: 'Awbrey Glen' } : c))
    expect(outsideSubdivisionSentence(SUBJECT, two)).toBe(
      'Two of the five sales are outside Hampton Park: 530 Majesty in Deer Pointe Village and 700 Shelley in Awbrey Glen.',
    )
    expect(outsideSubdivisionSentence({ subdivision: null }, COMPS)).toBeNull()
  })

  it('counts an own-plat sale as inside when the MLS name differs (1355 Jacksonville)', () => {
    const sales = [
      { address: '1367 Milwaukee', subdivision: 'Northwest Townsite Co 2nd Addt', ownPlat: true },
      { address: '1345 Milwaukee', subdivision: 'Grandview' },
      { address: '1340 Cumberland', subdivision: 'Highland' },
      { address: '1613 Ithaca', subdivision: 'Bonne Home' },
      { address: '1685 Fresno', subdivision: 'Bonne Home' },
    ] as never
    expect(outsideSubdivisionSentence({ subdivision: 'Northwest Townsite' }, sales)).toBe(
      'Four of the five sales are outside Northwest Townsite: 1345 Milwaukee in Grandview, 1340 Cumberland in Highland, 1613 Ithaca in Bonne Home and 1685 Fresno in Bonne Home.',
    )
  })

  it('prints a bare MLS code as the recorded plat (61197 Cottonwood, CLAB)', () => {
    const sales = [
      { address: '1 Lark', subdivision: 'Larkspur' },
      { address: '20825 Chloe', subdivision: 'Chloe Estates' },
      { address: '61197 Cottonwood', subdivision: 'CLAB', subdivisionSlug: 'tara-view-estates' },
    ] as never
    expect(outsideSubdivisionSentence({ subdivision: 'Larkspur' }, sales)).toBe(
      'Two of the three sales are outside Larkspur: 20825 Chloe in Chloe Estates and 61197 Cottonwood in Tara View Estates.',
    )
  })

  it('says a sale did not move only for the reason the index gives', () => {
    // 61404 Skene, as stored: two July sales moved down although July is one
    // of the three reference months, and three August sales did not move,
    // because August is in neither movesDown nor movesUp.
    const dates = ['2026-08-11', '2026-08-10', '2026-08-03', '2026-07-24', '2026-07-24']
    const moves = [0, 0, 0, -74241, -81070]
    const skene = COMPS.map((c, i) => ({ ...c, closeDate: dates[i]!, timeAdjustment: moves[i]! }))
    const said = salesMethodSentences({ subject: SUBJECT, comps: skene, pricing: PRICING }).join(' ')
    expect(said).toContain(
      "That moves two of the five sales down. The other three sold when that figure was already at today's level, so they do not move.",
    )
    // A sale outside the window that did not move gets no reason at all.
    const old = COMPS.map((c, i) => (i === 0 ? { ...c, closeDate: '2023-03-01' } : c))
    expect(salesMethodSentences({ subject: SUBJECT, comps: old, pricing: PRICING }).join(' ')).toContain(
      'That moves four of the five sales down. The other one does not move.',
    )
  })

  it('reads the band without a set-aside sale, so the line counts the rest and says the ends were set aside (the band is always trimmed, Matt 2026-10-07)', () => {
    // A set-aside sale still carries its weight on the grid; the band readers
    // skip it by name, so it never sets an end and the count is the kept set.
    const aside = {
      ...PRICING,
      rangeRule: { ...(PRICING as unknown as { rangeRule: object }).rangeRule, rule: 'trimmed-one-each-end' },
      setAside: [{ listingKey: COMPS[3]!.listingKey, address: '700 Shelley', adjustedPrice: 603227, end: 'low', reason: 'x' }],
    } as unknown as CmaPricing
    const line = adjustedRangeLine(COMPS, { pricing: aside })
    expect(line).not.toContain('$603,227')
    expect(line).toMatch(/^The four sales, after seller concessions and adjusted to today's market and your home's size, run from \$[\d,]+ to \$639,871\./)
    expect(line).toContain('The highest and the lowest sale are set aside, so the range runs between the rest.')
  })

  it('prints a basis it does not know as the pricing side wrote it', () => {
    const yoy = {
      ...PRICING,
      timeAdjustment: { basis: 'yoy-median', sentence: 'Each sale is moved by the year-over-year median move.', n: 0 },
    } as unknown as CmaPricing
    expect(salesMethodSentences({ subject: SUBJECT, comps: COMPS, pricing: yoy })).toContain(
      'Each sale is moved by the year-over-year median move.',
    )
  })

  it('never prints the exclusive-pocket engine note; the reader gets one date sentence (2382 Jackson)', () => {
    for (const basis of ['exclusive-pocket-sold-list', 'exclusive-pocket']) {
      const pocket = {
        ...PRICING,
        timeAdjustment: { basis, sentence: 'These sales are the exclusive pocket. Size and story class do not adjust.', n: 0 },
      } as unknown as CmaPricing
      const text = salesMethodSentences({ subject: SUBJECT, comps: COMPS, pricing: pocket }).join(' ')
      expect(text).not.toMatch(/exclusive pocket|story class|That index is/i)
    }
  })
})

// ── 4. the hero ─────────────────────────────────────────────────────────────

describe('the hero leads with the recommended list price', () => {
  it('prints the list first and biggest, then the sold range under its own label', () => {
    for (const html of [
      immersiveHeroNumberHtml({ subject: SUBJECT, comps: COMPS, market: null, pricing: PRICING }),
      letterCoverPayoffHtml(PRICING, COMPS),
    ]) {
      const order = [
        COVER_LIST_PRICE_HEADLINE,
        '$639,000',
        HERO_SOLD_RANGE_LABEL,
        '>Low<',
        '$603,227',
        '>High<',
        '$639,871',
      ].map((s) => html.indexOf(s))
      expect(order.every((i) => i >= 0)).toBe(true)
      expect([...order].sort((x, y) => x - y)).toEqual(order)
      expect((html.match(/\$639,000/g) ?? []).length).toBe(1)
      expect(html).toContain('class="ht is-rec"')
      expect(html).not.toContain('>Recommended<')
    }
  })
})

// ── voice ───────────────────────────────────────────────────────────────────

describe('the new copy keeps the voice rules', () => {
  const letter = renderCmaHtml(renderArgs()).html
  const immersive = renderImmersiveCmaHtml(renderArgs(), 'https://ryan-realty.com')

  it('carries every new sentence in both documents', () => {
    for (const html of [letter, immersive]) {
      const text = sellerVisibleText(html)
      expect(text).toContain(EXPECTED_SENTENCE)
      expect(text).toContain('How the sales were chosen and adjusted.')
      expect(text).toContain('If it sells near $622,000')
      expect(text).toContain(HERO_SOLD_RANGE_LABEL)
    }
  })

  it('has no em dash and no banned seller word', () => {
    const fresh = [
      EXPECTED_SENTENCE,
      RANGE_LINE,
      HERO_SOLD_RANGE_LABEL,
      sellerVisibleText(salesMethodHtml(opinion())),
      sellerVisibleText(sellerNetBodyHtml(opinion())),
    ]
    for (const s of fresh) {
      expect(s).not.toContain('—')
      expect(s).not.toContain(' -- ')
      expect(findSellerBannedWords(`<p>${s}</p>`)).toEqual([])
    }
    for (const html of [letter, immersive]) {
      expect(findSellerBannedWords(html).map((h) => h.label)).toEqual([])
    }
  })
})

describe('review fixes (2026-10-07)', () => {
  const expected = { price: 622128, field: 'pricing.predictedClose' as const, sales: 5 }

  it('a home on the market gets no "we would list" line (non-solicitation)', () => {
    const line = expectedSaleSentence(expected, { onMarket: true })
    expect(line).toBe(
      'The five sales point to a sale near $622,000 once each is weighted by how closely it matches your home.',
    )
    expect(line).not.toMatch(/we'?d list|we would list/i)
  })

  it('an off-market home keeps the list line', () => {
    expect(expectedSaleSentence(expected)).toMatch(/^We'd list at the price on the cover and expect it to sell near \$622,000/)
  })

  it('a sale with no subdivision on record is not called outside', () => {
    const comps = [
      { address: '1 A St', subdivision: 'Hampton Park' },
      { address: '2 B St', subdivision: null },
      { address: '3 C St', subdivision: 'Deer Pointe Village' },
    ] as never
    expect(outsideSubdivisionSentence({ subdivision: 'Hampton Park' }, comps)).toBeNull()
  })

  it('the hero labels a list-tier fallback as a list range, never as sold prices', async () => {
    const { heroTrioHtml, HERO_LIST_RANGE_LABEL, HERO_SOLD_RANGE_LABEL } = await import('@/lib/cma/cover-value')
    const html = heroTrioHtml({ recommended: 500000, conservative: 480000, highEnd: 520000 } as never)
    expect(html).toContain(HERO_LIST_RANGE_LABEL)
    expect(html).not.toContain(HERO_SOLD_RANGE_LABEL)
  })
})

describe('reader review 2026-10-07: every reference names its number, every count its set', () => {
  const expected = { price: 522219, field: 'pricing.predictedClose' as const, sales: 3 }

  it('rounds "near" to the thousand and points at the cover for the list', () => {
    expect(expectedSaleNear(expected)).toBe(522000)
    const line = expectedSaleSentence(expected)
    expect(line).toContain('near $522,000')
    expect(line).not.toContain('$522,219')
    expect(line).toContain('the price on the cover')
    expect(line).not.toContain('that price')
  })

  it('names the sales behind the figure when the grid prints more of them (3037 Purcell)', () => {
    const line = expectedSaleSentence(expected, { setters: ['2110 Carrie', '2014 Taylor', '2591 Purcell'] })
    expect(line).toBe(
      "We'd list at the price on the cover and expect it to sell near $522,000, which is what the three sales behind it, 2110 Carrie, 2014 Taylor and 2591 Purcell, point to once each is weighted by how closely it matches your home.",
    )
    const live = expectedSaleSentence(expected, { onMarket: true, setters: ['2110 Carrie', '2014 Taylor', '2591 Purcell'] })
    expect(live).toMatch(/^The three sales that set this price, 2110 Carrie, 2014 Taylor and 2591 Purcell, point to a sale near \$522,000/)
    // A setter list that does not match the count is not printed as the set.
    expect(expectedSaleSentence(expected, { setters: ['2110 Carrie', '2014 Taylor'] })).toContain('the three sales point to')
  })

  const sale = (listingKey: string, address: string, subdivision: string) =>
    ({ listingKey, address, subdivision }) as unknown as CmaAdjustedComp
  const grid = [
    sale('A', '2058 Hollow Tree', 'Silver Sage'),
    sale('B', '2110 Carrie', 'Silver Sage'),
    sale('C', '2014 Taylor', 'Tamarack Park'),
    sale('D', '2107 Carrie', 'Silver Sage'),
    sale('E', '2591 Purcell', 'Holliday Park'),
  ]
  const priced = (keys: string[]) =>
    ({
      recommended: 538000,
      reconciliation: { weights: keys.map((listingKey) => ({ listingKey, weight: 33.3 })) },
    }) as unknown as CmaPricing

  it('counts the sales that set the price beside the printed count when they differ', () => {
    const heading = 'Three of the five sales are in Silver Sage.'
    expect(headingWithPriceSet(heading, { subdivision: 'Silver Sage', comps: grid, pricing: priced(['B', 'C', 'E']) })).toBe(
      'Three of the five sales are in Silver Sage, and one of the three that set the price is.',
    )
    expect(headingWithPriceSet(heading, { subdivision: 'Silver Sage', comps: grid, pricing: priced(['A', 'B', 'D']) })).toBe(
      'Three of the five sales are in Silver Sage, and all three that set the price are.',
    )
    expect(headingWithPriceSet(heading, { subdivision: 'Silver Sage', comps: grid, pricing: priced(['C', 'E']) })).toBe(
      'Three of the five sales are in Silver Sage, and none of the two that set the price is.',
    )
  })

  it('leaves the heading alone when every printed sale sets the price or no weights are recorded', () => {
    const heading = 'Three of the five sales are in Silver Sage.'
    expect(
      headingWithPriceSet(heading, { subdivision: 'Silver Sage', comps: grid, pricing: priced(['A', 'B', 'C', 'D', 'E']) }),
    ).toBe(heading)
    expect(headingWithPriceSet(heading, { subdivision: 'Silver Sage', comps: grid, pricing: priced([]) })).toBe(heading)
    expect(
      headingWithPriceSet('All five sales are in Holliday Park.', {
        subdivision: 'Holliday Park',
        comps: grid.map((c) => ({ ...c, subdivision: 'Holliday Park' })),
        pricing: priced(['A', 'B', 'C']),
      }),
    ).toBe('All five sales are in Holliday Park.')
  })
})
