/**
 * ROUND-FOUR CLASS E — numbers that contradict other numbers in the same
 * document (docs/plans/CMA_REIMAGINED_2026-09-07.md, "Round four audit").
 *
 * Every case here is a pair of statements a seller can hold on one screen, or
 * two screens apart, and read as the document arguing with itself:
 *
 *   E1  2465: "not enough recent sales inside Diamond Bar Ranch" over a grid
 *       in which three of five sales ARE Diamond Bar Ranch.
 *   E2  Concorde: three list ceilings on two screens, the highest of them the
 *       $1,500,000 ask that had just failed to sell.
 *   E3  19968: the market chapter's "six sales support $370,000 to $479,000"
 *       against the price chapter's four — and $479,000 is the sale the
 *       document says it set aside.
 *   E4  the same set-aside sale, sitting on the axis end it is supposed not to
 *       be the end of, carrying two labels.
 *   E5  "peaked in April" in chapter 3 over "April was the low month" in
 *       chapter 5 — two measures reading as one contradiction.
 *   E6  19968: "listed $140,000" from a November 2004 cycle, printed beside a
 *       $461,000 recommendation.
 *
 * Asserted against RENDERED HTML wherever the defect was a rendered one: the
 * prose said one thing and the grid beside it did another, and only the
 * chapter shows that.
 */
import { describe, expect, it } from 'vitest'
import {
  keptSaleCount,
  listRangeBounds,
  pricingPage,
  salesThatSetItPage,
  whatItsWorthLead,
} from '@/lib/cma/render-pricing-page'
import { compSearchSentence, keptInSubdivision } from '@/lib/cma/render-comp-search'
import { listCeiling, readCompSearch, readRangeRuleKept } from '@/lib/cma/render-contract'
import { renderCompMatrixHtml, subjectPrintableAsk } from '@/lib/cma/comp-matrix'
import { worthStripSvg, WORTH_STRIP_WIDE } from '@/lib/cma/worth-strip'
import { renderInventoryBoardHtml } from '@/lib/cma/market-area-chapters'
import { cityMedianReconciliationHtml, sellerNetPage, nextStepPage } from '@/lib/cma/opinion-pages'
import type { OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'

// ── fixtures ────────────────────────────────────────────────────────────────

const AS_OF = '2026-09-08T12:00:00.000Z'

function subject(over: Record<string, unknown> = {}): CmaSubject {
  return {
    listingKey: 'S1',
    mlsNumber: '220000850',
    streetAddress: '2465 7th',
    city: 'Redmond',
    state: 'OR',
    postalCode: '97756',
    subdivision: 'Diamond Bar Ranch',
    beds: 3,
    baths: 2,
    sqft: 1440,
    lotAcres: 0.17,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2004,
    photoUrl: null,
    standardStatus: 'Withdrawn',
    lastListPrice: 460000,
    lastListDate: '2026-02-26T23:27:57+00:00',
    listingHistoryLine: null,
    ...over,
  } as unknown as CmaSubject
}

function comp(i: number, adjusted: number, close: number, subdivision: string | null): CmaAdjustedComp {
  return {
    listingKey: `C${i}`,
    mlsNumber: String(220000000 + i),
    address: `${i}00 Swalley`,
    city: 'Redmond',
    subdivision,
    beds: 3,
    baths: 2,
    sqft: 1440,
    lotAcres: 0.17,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2004,
    photoUrl: null,
    listPrice: close,
    closePrice: close,
    closeDate: '2026-06-24',
    daysToOffer: 12,
    monthsSinceClose: 3,
    timeAdjustment: 0,
    timeAdjustedPrice: close,
    sizeAdjustment: adjusted - close,
    adjustedPrice: adjusted,
    weight: 1,
  } as unknown as CmaAdjustedComp
}

/** The 2465 shape: five sales, THREE of them in the subject's subdivision. */
const DBR_COMPS: CmaAdjustedComp[] = [
  comp(1, 412_000, 410_000, 'Diamond Bar Ranch'),
  comp(2, 426_000, 424_000, 'Diamond Bar Ranch'),
  comp(3, 428_000, 427_000, 'Red Bar Estates'),
  comp(4, 435_000, 433_000, 'Diamond Bar Ranch'),
  comp(5, 443_000, 441_000, 'Red Bar Estates'),
]

/** The 19968 shape: six sales, the highest and lowest set aside. */
const SIX_COMPS: CmaAdjustedComp[] = [
  comp(1, 296_000, 295_000, 'Romaine Village'),
  comp(2, 370_000, 368_000, 'Romaine Village'),
  comp(3, 402_000, 400_000, 'Romaine Village'),
  comp(4, 431_000, 429_000, 'Romaine Village'),
  comp(5, 479_000, 477_000, 'Romaine Village'),
  comp(6, 512_000, 510_000, 'Romaine Village'),
]

function pricing(over: Record<string, unknown> = {}): CmaPricing {
  return {
    method1Low: 412_000,
    method1Mid: 435_000,
    method1High: 443_000,
    method2: null,
    method3: 435_000,
    conservative: 420_000,
    recommended: 435_000,
    highEnd: 452_000,
    valueLow: 412_000,
    valueHigh: 443_000,
    confidence: 'Moderate',
    confidenceReason: '',
    needsReview: false,
    reviewReason: null,
    rangeRule: { rule: 'min-max', n: 5, kept: 5, sentence: 'The range is the spread of all five.' },
    ...over,
  } as unknown as CmaPricing
}

/** The trimmed-one-each-end pricing 19968 ships, over SIX_COMPS. */
function trimmedPricing(over: Record<string, unknown> = {}): CmaPricing {
  return pricing({
    conservative: 383_000,
    recommended: 461_000,
    highEnd: 496_000,
    valueLow: 370_000,
    valueHigh: 479_000,
    rangeRule: {
      rule: 'trimmed-one-each-end',
      n: 6,
      kept: 4,
      sentence:
        'The range is the spread of the four sale prices behind this price, with the highest and the lowest set aside.',
    },
    ...over,
  })
}

/**
 * The number chapter and matrix 1. Delta 3 split them; every count E3 checks
 * has to agree across both, which is the whole point of the check.
 */
function chapter(p: CmaPricing, comps: CmaAdjustedComp[], over: Record<string, unknown> = {}): string {
  const input = {
    subject: subject(),
    comps,
    market: null,
    pricing: p,
    tiersUsed: [],
    askCtx: { asOfIso: AS_OF, hasFinalCycle: true },
    ...over,
  }
  return `${pricingPage(input).body}\n${salesThatSetItPage(input)?.body ?? ''}`
}

function opinionArgs(over: Partial<OpinionPageArgs> = {}): OpinionPageArgs {
  return {
    subject: subject(),
    comps: SIX_COMPS,
    market: null,
    pricing: trimmedPricing(),
    mapDataUri: null,
    generatedAtIso: AS_OF,
    ...over,
  } as OpinionPageArgs
}

// ── E1. The search sentence may not refute the grid under it ────────────────

describe('E1 — the search sentence never claims a shortage the printed sales refute', () => {
  const trace = [
    'subdivision-6mo: +3 (running 3). GLA ±15%, same subdivision.',
    'subdivision-9mo: +1 (running 4). GLA ±15%, same subdivision.',
    'nearby-1mi-6mo: +1 (running 5). GLA ±15%, ≤1 mi.',
  ]

  it('counts the printed sales that are in the subject subdivision', () => {
    expect(keptInSubdivision('Diamond Bar Ranch', DBR_COMPS)).toBe(3)
    expect(keptInSubdivision('Red Bar Estates', DBR_COMPS)).toBe(2)
    expect(keptInSubdivision(null, DBR_COMPS)).toBe(0)
    // "N/A" is not a subdivision. Concorde ships exactly that string.
    expect(keptInSubdivision('N/A', DBR_COMPS)).toBe(0)
  })

  it('names the three in-subdivision sales instead of claiming there were none', () => {
    const sentence = compSearchSentence({
      subdivision: 'Diamond Bar Ranch',
      compTrace: trace,
      comps: DBR_COMPS,
      fallback: 'There were not enough recent sales inside Diamond Bar Ranch, so we opened to 1 mile.',
    })
    expect(sentence).toContain('Three of these five sales are inside Diamond Bar Ranch')
    expect(sentence).toContain('1 mile')
    expect(sentence).not.toContain('not enough')
  })

  it('says every sale is inside when every printed sale is', () => {
    const sentence = compSearchSentence({
      subdivision: 'Romaine Village',
      compTrace: [...trace, 'nearby-2mi-6mo: +1 (running 7). GLA ±20%, ≤2 mi.'],
      comps: SIX_COMPS,
      fallback: 'There were not enough recent sales inside Romaine Village, so we opened to 2 miles.',
    })
    expect(sentence).toBe('Every one of these sales is inside Romaine Village from the last 9 months.')
  })

  it('keeps the shortage claim when no printed sale is inside the subdivision', () => {
    const outside = DBR_COMPS.map((c) => ({ ...c, subdivision: 'Red Bar Estates' }))
    const fallback = 'There were not enough recent sales inside Diamond Bar Ranch, so we opened to 1 mile.'
    expect(
      compSearchSentence({ subdivision: 'Diamond Bar Ranch', compTrace: trace, comps: outside, fallback }),
    ).toBe(fallback)
  })

  it('prints compSearch.sentence when the row carries one', () => {
    const args = {
      compSearch: {
        subdivision: 'Diamond Bar Ranch',
        rungs: [{ key: 'subdivision-6mo', label: 'Same subdivision', window: '6mo', added: 3, kept: 3 }],
        keptBySubdivision: { 'Diamond Bar Ranch': 3, 'Red Bar Estates': 2 },
        sentence: 'Three sales came from inside Diamond Bar Ranch and two from one mile out.',
      },
    }
    expect(readCompSearch(args)?.rungs).toHaveLength(1)
    expect(compSearchSentence({ subdivision: 'Diamond Bar Ranch', args, comps: DBR_COMPS })).toBe(
      'Three sales came from inside Diamond Bar Ranch and two from one mile out.',
    )
  })

  it('refuses even a STORED sentence that claims a shortage the grid refutes', () => {
    const args = {
      compSearch: {
        subdivision: 'Diamond Bar Ranch',
        rungs: [],
        keptBySubdivision: {},
        sentence: 'There were not enough recent sales inside Diamond Bar Ranch, so we opened up.',
      },
    }
    const sentence = compSearchSentence({
      subdivision: 'Diamond Bar Ranch',
      args,
      compTrace: trace,
      comps: DBR_COMPS,
    })
    expect(sentence).not.toContain('not enough')
    expect(sentence).toContain('Three of these five sales are inside Diamond Bar Ranch')
  })

  it('reaches the rendered chapter', () => {
    const html = pricingPage({
      subject: subject(),
      comps: DBR_COMPS,
      market: null,
      pricing: pricing(),
      tiersUsed: ['subdivision-6mo', 'nearby-1mi-6mo'],
      compTrace: trace,
      askCtx: { asOfIso: AS_OF, hasFinalCycle: true },
    }).body
    expect(html).toContain('Three of these five sales are inside Diamond Bar Ranch')
    expect(html).not.toContain('not enough recent sales inside Diamond Bar Ranch')
  })
})

// ── E2. One list ceiling per document ───────────────────────────────────────

describe('E2 — one list ceiling per document', () => {
  /** The Concorde row: highEnd IS the failed ask, the clamp sits under it. */
  const concorde = pricing({
    conservative: 1_413_000,
    recommended: 1_473_000,
    highEnd: 1_500_000,
    valueLow: 1_390_000,
    valueHigh: 1_930_000,
    clamp: { kind: 'failed-ask', appliedTo: 'recommended', before: 1_774_000, after: 1_473_000 },
  })

  it('resolves the ceiling to min(highEnd, clamp.after)', () => {
    expect(listCeiling(concorde)).toBe(1_473_000)
    // No clamp on the row: the method's own high end stands.
    expect(listCeiling(pricing())).toBe(452_000)
    // A clamp the row says did not bind is not a ceiling.
    expect(listCeiling(pricing({ clamp: { after: 300_000, bound: false } }))).toBe(452_000)
  })

  it('prints the list range against that ceiling and never above it', () => {
    expect(listRangeBounds(concorde)).toEqual({ low: 1_413_000, high: 1_473_000 })
    const lead = whatItsWorthLead(subject({ standardStatus: 'Expired', lastListPrice: 1_500_000 }), concorde, {
      asOfIso: AS_OF,
      hasFinalCycle: true,
    })
    expect(lead).toContain('List between $1,413,000 and that price.')
    expect(lead).not.toContain('$1,500,000')
  })

  it('never prints the failed ask itself as the top of the list range', () => {
    // A row with no clamp whose high end was capped exactly AT the ask.
    const capped = pricing({ conservative: 1_413_000, recommended: 1_473_000, highEnd: 1_500_000 })
    expect(listRangeBounds(capped, 1_500_000)).toEqual({ low: 1_413_000, high: 1_473_000 })
    // A high end merely ABOVE an old ask is a reading the sales may support.
    expect(listRangeBounds(capped, 1_400_000)).toEqual({ low: 1_413_000, high: 1_500_000 })
  })

  it('refuses a net sheet priced above the ceiling, or at the failed ask', () => {
    const sheet = (list: number) => ({
      basis: 'Deschutes County schedule.',
      list,
      lines: [{ label: 'Commission', amount: 20_000, source: 'Listing agreement, 5.0%' }],
      net: list - 20_000,
      sentence: null,
      unknowns: [],
    })
    const at = (list: number) =>
      sellerNetPage(
        opinionArgs({
          comps: DBR_COMPS,
          pricing: pricing({ sellerNet: sheet(list) }),
          expiredAudit: { findings: [], finalCycle: { initialAsk: 460_000, cuts: [] } } as never,
        }),
      )?.body ?? ''
    // $452,000 is the ceiling: a sheet there itemises.
    expect(at(452_000)).toContain('List price')
    // Above it, and the chapter prints no figure at all.
    expect(at(460_001)).not.toContain('List price')
    expect(at(460_001)).toContain('needs')
    // AT the failed ask ($460,000) is the same defect wearing the failed price.
    expect(at(460_000)).not.toContain('List price')
  })

  it('never prints a second ceiling in the closing', () => {
    const closing = nextStepPage(
      opinionArgs({
        broker: {
          id: null,
          slug: 'matthew-ryan',
          displayName: 'Matt Ryan',
          title: 'Principal Broker',
          licenseNumber: '201206613',
          email: 'matt@ryan-realty.com',
          phone: '541.703.3095',
          photoUrl: null,
        },
      }),
    )
    expect(closing).not.toBeNull()
    // The closing carries no price of any kind — not the recommend, not a
    // range, not the ask. Three ceilings became three because every chapter
    // that could restate one did.
    expect(closing!.body).not.toMatch(/\$[\d,]{6,}/)
  })
})

// ── E3. One n for the set the price is over ─────────────────────────────────

describe('E3 — the strip caption, the chapter lead, the range cause and the set-aside list agree', () => {
  it('reads the pricing side kept count', () => {
    expect(readRangeRuleKept(trimmedPricing())).toBe(4)
    // Floor: six comps cannot trim ends (would leave 4 < 5), so the live
    // count is every printed sale — not the stale rangeRule.kept.
    expect(keptSaleCount(trimmedPricing(), SIX_COMPS)).toBe(6)
  })

  it('states six everywhere when the stack floor blocks end-trimming', () => {
    const html = chapter(trimmedPricing(), SIX_COMPS)
    // worth-strip (and its One scale caption) omitted — cover owns the number.
    expect(html).not.toContain('One scale: sale price today.')
    expect(html).not.toContain('worth-strip')
    expect(html).toContain('The six closed sales below set this number')
    expect(html).not.toContain('Two more are shown below and set aside.')
    expect(html).not.toContain('These 2 sales are shown above and did not set the number.')
  })

  it('the market chapter counts every printed sale when the floor blocks trim', () => {
    const html = cityMedianReconciliationHtml(opinionArgs())
    expect(html).toContain('The six sales behind your price')
    expect(html).toContain('$295,000 to $510,000')
    expect(html).not.toContain('The four sales behind your price')
  })
})

// ── E4. The axis end wins ───────────────────────────────────────────────────

describe('E4 — a set-aside sale is never an axis label', () => {
  const sales = SIX_COMPS.map((c, i) => ({
    n: i + 1,
    address: c.address,
    adjustedPrice: c.adjustedPrice,
    setAside: i === 0 || i === 5,
  }))

  it('labels the axis with valueLow and valueHigh, not the outermost dots', () => {
    const svg = worthStripSvg(
      { sales, rangeLow: 370_000, rangeHigh: 479_000, recommended: 461_000, lastAsk: null, keptCount: 4 },
      WORTH_STRIP_WIDE,
    )
    expect(svg).toContain('$370K')
    expect(svg).toContain('$479K')
    // The two set-aside sales are $296K and $512K. Neither labels an end.
    expect(svg).not.toContain('$296K')
    expect(svg).not.toContain('$512K')
  })

  it('drops the "set aside" label when the sale sits exactly on an axis end', () => {
    // 19968 AS IT SHIPS. The set-aside sale is $479,614 and the stated worth
    // top is $479,000 — never equal, three tenths of a pixel apart, which is
    // why the rule is "does the word land on the axis label", not "are the
    // two prices the same". The $431,000 one is set aside too and sits well
    // inside the axis, so the pair separates that rule from "no set-aside
    // sale is ever labelled".
    const onEnd = sales.map((s, i) => ({
      ...s,
      adjustedPrice: i === 4 ? 479_614 : s.adjustedPrice,
      setAside: i === 3 || i === 4,
    }))
    const svg = worthStripSvg(
      { sales: onEnd, rangeLow: 370_000, rangeHigh: 479_000, recommended: 461_000, lastAsk: null, keptCount: 4 },
      WORTH_STRIP_WIDE,
    )
    // Both are drawn hollow — that is what says "not one of the sales the
    // range is the spread of".
    expect((svg.match(/class="ws-aside"/g) ?? []).length).toBe(2)
    // But only ONE "set aside" word: the one that is not on an axis end.
    expect((svg.match(/>set aside</g) ?? []).length).toBe(1)
    // The axis end still carries the chapter's own number.
    expect(svg).toContain('$479K')
  })

  it('states one scale, and the document n, in the caption', () => {
    const svg = worthStripSvg(
      { sales, rangeLow: 370_000, rangeHigh: 479_000, recommended: 461_000, lastAsk: null, keptCount: 4 },
      WORTH_STRIP_WIDE,
    )
    expect(svg).toContain('One scale: sale price today. 4 sales.')
    expect(svg).toContain('The shading is what your home is worth')
    // The list line is a labelled mark on that same scale.
    expect(svg).toContain('list $461K')
  })
})

// ── E5. Each month names its measure ────────────────────────────────────────

describe('E5 — chapter 3 and chapter 5 each name what they measure', () => {
  it("names the index's measure beside its month", () => {
    const html = chapter(
      pricing({
        timeAdjustment: {
          sentence: 'Over the last 12 months that index rose to a peak in April 2026.',
          measure: 'the median price a square foot across every Redmond sale',
        },
      }),
      DBR_COMPS,
    )
    expect(html).toContain('rose to a peak in April 2026.')
    expect(html).toContain('That index is the median price a square foot across every Redmond sale.')
  })

  it('never repeats a measure the sentence already names', () => {
    const html = chapter(
      pricing({
        timeAdjustment: {
          sentence: 'The index of median price a square foot peaked in April 2026.',
          measure: 'median price a square foot',
        },
      }),
      DBR_COMPS,
    )
    expect(html).not.toContain('That index is median price a square foot.')
  })

  it('prints the index sentence untouched when the row names no measure', () => {
    const html = chapter(
      pricing({ timeAdjustment: { sentence: 'That index rose to a peak in April 2026.' } }),
      DBR_COMPS,
    )
    expect(html).toContain('That index rose to a peak in April 2026.')
    expect(html).not.toContain('That index is ')
  })

  const market = (over: Record<string, unknown> = {}): CmaMarketContext =>
    ({
      geoLabel: 'Redmond',
      monthsOfSupply: null,
      activeCount: null,
      medianDom: null,
      trend: [
        { periodStart: '2025-10-01', medianSalePrice: 470_000 },
        { periodStart: '2025-11-01', medianSalePrice: 468_000 },
        { periodStart: '2025-12-01', medianSalePrice: 472_000 },
        { periodStart: '2026-01-01', medianSalePrice: 461_000 },
        { periodStart: '2026-02-01', medianSalePrice: 466_000 },
        { periodStart: '2026-03-01', medianSalePrice: 482_000 },
        { periodStart: '2026-04-01', medianSalePrice: 455_000 },
      ],
      ...over,
    }) as unknown as CmaMarketContext

  it('names the month line as the middle sale price when the row says nothing', () => {
    const html = renderInventoryBoardHtml(market())
    expect(html).toContain('The line below is the middle sale price in Redmond, month by month')
  })

  it("uses the row's own phrase when market.trendMeasure is there", () => {
    const html = renderInventoryBoardHtml(market({ trendMeasure: 'the median closed price, every home' }))
    expect(html).toContain('The line below is the median closed price, every home in Redmond, month by month')
  })
})

// ── E6. An ask is only an ask while it is this listing's ask ────────────────

describe('E6 — the subject column never prints a stale cycle as "listed"', () => {
  const closed2004 = subject({
    streetAddress: '19968 Terrace',
    standardStatus: 'Closed',
    lastListPrice: 140_000,
    lastListDate: '2004-11-12T14:52:28+00:00',
    subdivision: 'Romaine Village',
  })

  it('refuses an ask from a cycle older than twelve months', () => {
    expect(subjectPrintableAsk(closed2004, { asOfIso: AS_OF })).toBeNull()
    expect(
      subjectPrintableAsk(subject({ lastListDate: '2026-02-26T23:27:57+00:00' }), { asOfIso: AS_OF }),
    ).toBe(460_000)
  })

  it('refuses it when the audit found no final listing cycle, whatever the date', () => {
    expect(
      subjectPrintableAsk(subject({ lastListDate: '2026-08-01T00:00:00.000Z' }), {
        asOfIso: AS_OF,
        hasFinalCycle: false,
      }),
    ).toBeNull()
  })

  it("keeps a live listing's ask — that IS today's price", () => {
    expect(
      subjectPrintableAsk(
        subject({ standardStatus: 'Active', lastListPrice: 629_000, lastListDate: null }),
        { asOfIso: AS_OF, hasFinalCycle: false },
      ),
    ).toBe(629_000)
  })

  it('shows size and year only, with no ask, in the rendered column', () => {
    const html = renderCompMatrixHtml(closed2004, SIX_COMPS, '', null, undefined, { asOfIso: AS_OF })
    expect(html).not.toContain('listed $140,000')
    expect(html).not.toContain('Listed $140,000')
    expect(html).toContain('1,440 sqft')
    expect(html).toContain('2004')
    // The phone card says what is true of a home nobody is selling.
    expect(html).toContain('Not on the market')
  })

  it('still prints a current ask', () => {
    const html = renderCompMatrixHtml(subject(), SIX_COMPS, '', null, undefined, {
      asOfIso: AS_OF,
      hasFinalCycle: true,
    })
    expect(html).toContain('listed $460,000')
  })
})
