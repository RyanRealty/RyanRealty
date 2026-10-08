/**
 * LETTER WORDING, ROUND TWO (independent reader reviews of the rebuilt
 * letters, 2026-10-08: 3037 Purcell, 20676 Wild Rose, 3177 Coho, 915
 * Saginaw, 1355 Jacksonville, 2745 Aldrich).
 *
 *  1. "Adjusted to today" / "Sale price today" only when a sale moved for
 *     date; every adjustment the sales carry is named, seller concessions
 *     included.
 *  3. A rule 26 letter says its two facts once; adjusted figures are never
 *     what homes "sold for".
 *  4. On a cover the weights did not make (rule 26, or the street sale) the
 *     sales are the ones that set the range.
 *  5. The running header is the chapter's name, never its sentence heading.
 *  6. Set-aside columns are marked in the grid, with the map's set-aside pin.
 *  9. A one-sale trim that kept the street sale says which sale and why.
 * 10. A cover held to the street sale says so, once.
 * 11. A move that rounds to nothing prints "$0", never "+$0".
 *
 * Items 2, 7 and 8 are pinned beside their own code (pocket-local-gate,
 * date-move-grid, competition-band-basis, market-status, counted-rows).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adjustmentsApplied, anySaleMovedForDate, movesADollar } from '@/lib/cma/adjustments-applied'
import { usdSigned } from '@/lib/cma/render-blocks'
import {
  HERO_SOLD_RANGE_LABEL,
  HERO_SOLD_RANGE_LABEL_PLAIN,
  HERO_SOLD_RANGE_LABEL_TO_HOME,
  heroSoldRangeLabel,
  letterCoverPayoffHtml,
  rangeSpreadCauseSentence,
} from '@/lib/cma/cover-value'
import { adjustedForClause, didNotSellPage, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import { adjustedRangeLine } from '@/lib/cma/expected-sale'
import { SET_ASIDE_COLUMN_TAG, renderCompMatrixHtml } from '@/lib/cma/comp-matrix'
import { adjustedWorthSentence, neutralAskReading } from '@/lib/cma/ask-story'
import { WEIGHT_AMONG_SALES_ROW_LABEL, WEIGHT_IN_PRICE_ROW_LABEL, salesSetOnlyTheRange, weightRowLabel } from '@/lib/cma/sales-role'
import { streetAnchorRead } from '@/lib/cma/street-anchor'
import {
  HELD_SALES_HEADING,
  RANGE_SALES_HEADING,
  WHAT_ITS_WORTH_CHAPTER,
  pricingPage,
  salesThatSetItHeading,
  salesThatSetItPage,
  streetHoldSentence,
} from '@/lib/cma/render-pricing-page'
import { CLOSED_SET_RANGE_LABEL, pinLegendHtml, type CmaPinFact } from '@/lib/cma/comp-pin-map'
import { zoneLabelLines } from '@/lib/cma/market-charts'
import { setAsideSalePredicate } from '@/lib/cma/set-aside'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

const EM_DASH = '—'

function sale(o: Record<string, unknown>): CmaAdjustedComp {
  return {
    city: 'Bend',
    subdivision: 'Park Place',
    sqft: 2100,
    closeDate: '2026-06-01',
    concessions: 0,
    concessionsAmount: 0,
    storyAdjustment: 0,
    ...o,
  } as unknown as CmaAdjustedComp
}

/** 915 Saginaw as stored (render_args 2026-09-28): the cover is 536 Saginaw's $727,148 plus 10 percent, rounded. */
const SAGINAW_COMPS: CmaAdjustedComp[] = [
  sale({ listingKey: 'K1', address: '335 17th', closePrice: 1_120_000, timeAdjustment: 0, sizeAdjustment: -66_091, adjustedPrice: 1_053_909, weight: 1.2876 }),
  sale({ listingKey: 'K2', address: '628 Portland', closePrice: 1_150_000, timeAdjustment: 0, sizeAdjustment: -36_180, adjustedPrice: 1_113_820, weight: 0.7798 }),
  sale({ listingKey: 'K3', address: '2068 Cascade View', closePrice: 966_074, concessions: 14_074, concessionsAmount: 14_074, timeAdjustment: 0, sizeAdjustment: 35_577, adjustedPrice: 987_577, weight: 0.6673 }),
  sale({ listingKey: 'K4', address: '2258 6th', closePrice: 1_319_780.79, timeAdjustment: 0.21, sizeAdjustment: -21_731, adjustedPrice: 1_298_050, weight: 0.5368 }),
  sale({ listingKey: 'K5', address: '536 Saginaw', closePrice: 745_000, timeAdjustment: -10_430, sizeAdjustment: -7_422, adjustedPrice: 727_148, weight: 1.106 }),
]

function saginawPricing(over: Record<string, unknown> = {}): CmaPricing {
  return {
    recommended: 800_000,
    conservative: 725_000,
    highEnd: 911_000,
    valueLow: 727_148,
    valueHigh: 1_113_820,
    predictedClose: 1_053_900,
    notes: [],
    rangeRule: {
      n: 5,
      kept: 4,
      rule: 'trimmed-one-each-end',
      adjustedLow: 727_148,
      adjustedHigh: 1_113_820,
      saleLow: 727_148,
      saleHigh: 1_113_820,
      endpointPpsfAside: 0,
      endpointWeightAside: 0,
    },
    setAside: [
      { end: 'high', reason: 'highest of the adjusted sales, set aside so one sale cannot set the range', address: '2258 6th', listingKey: 'K4', adjustedPrice: 1_298_050 },
    ],
    streetAnchor: {
      addresses: ['536 Saginaw'],
      listingKeys: ['K5'],
      anchor: 727_148,
      ceiling: 800_000,
      floor: 725_000,
      before: 1_000_000,
      after: 800_000,
      sentence: '536 Saginaw is the same size as this home and sits on the same street.',
    },
    hold: { kind: 'ask-in-band', ask: 925_000, bandLow: 727_000, bandHigh: 1_115_000, reason: 'test' },
    reconciliation: {
      sentence: '335 17th carries the most weight of the four sales behind this price, at 33.5 percent.',
      weights: [
        { listingKey: 'K1', address: '335 17th', weight: 33.5, grossAdjustmentPct: 5.9, reason: '' },
        { listingKey: 'K2', address: '628 Portland', weight: 20.3, grossAdjustmentPct: 3.1, reason: '' },
        { listingKey: 'K3', address: '2068 Cascade View', weight: 17.4, grossAdjustmentPct: 5.1, reason: '' },
        { listingKey: 'K5', address: '536 Saginaw', weight: 28.8, grossAdjustmentPct: 2.4, reason: '' },
      ],
    },
    ...over,
  } as unknown as CmaPricing
}

const SAGINAW = {
  streetAddress: '915 Saginaw',
  city: 'Bend',
  postalCode: '97703',
  subdivision: 'Park Place',
  propertySubType: 'Single Family Residence',
  sqft: 2085,
  beds: 3,
  baths: 2,
  standardStatus: 'Canceled',
  lastListPrice: 925_000,
} as unknown as CmaSubject

/** What a homeowner reads. */
function visible(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

describe('11. a move that rounds to nothing prints $0, like the rest of its row', () => {
  it('prints $0 for +$0.21 and -$0.40, and signs a move of a dollar or more', () => {
    expect(usdSigned(0.21)).toBe('$0')
    expect(usdSigned(-0.4)).toBe('$0')
    expect(usdSigned(0)).toBe('$0')
    expect(usdSigned(0.6)).toBe('+$1')
    expect(usdSigned(-10_430)).toBe('−$10,430')
    expect(movesADollar(0.21)).toBe(false)
    expect(movesADollar(-10_430)).toBe(true)
  })

  it('915 Saginaw: 2258 6th date cell is $0, never +$0', () => {
    const html = renderCompMatrixHtml(SAGINAW, SAGINAW_COMPS)
    expect(html).not.toContain('+$0')
  })
})

describe('1. the letter names exactly the adjustments the sales carry', () => {
  const sizeOnly = [
    sale({ listingKey: 'A', address: '1 A', closePrice: 500_000, timeAdjustment: 0, sizeAdjustment: 5_000, adjustedPrice: 505_000, weight: 1 }),
    sale({ listingKey: 'B', address: '2 B', closePrice: 520_000, concessions: 9_000, concessionsAmount: 9_000, timeAdjustment: 0, sizeAdjustment: -3_000, adjustedPrice: 508_000, weight: 1 }),
  ]
  const dated = [
    sale({ listingKey: 'C', address: '3 C', closePrice: 500_000, timeAdjustment: -4_000, sizeAdjustment: 0, adjustedPrice: 496_000, weight: 1 }),
    sale({ listingKey: 'D', address: '4 D', closePrice: 510_000, timeAdjustment: 0, sizeAdjustment: 0, adjustedPrice: 510_000, weight: 1 }),
  ]
  const bare = [
    sale({ listingKey: 'E', address: '5 E', closePrice: 500_000, timeAdjustment: 0, sizeAdjustment: 0, adjustedPrice: 500_000, weight: 1 }),
  ]

  it('reads date, size, style and seller concessions off the sales', () => {
    expect(adjustmentsApplied(sizeOnly)).toEqual(['size', 'concessions'])
    expect(adjustmentsApplied(dated)).toEqual(['date'])
    expect(adjustmentsApplied(SAGINAW_COMPS)).toEqual(['date', 'size', 'concessions'])
    expect(anySaleMovedForDate(sizeOnly)).toBe(false)
    expect(anySaleMovedForDate([SAGINAW_COMPS[3]!])).toBe(false)
  })

  it('3037 Purcell: no sale moved for date, so the cover says adjusted to your home, never today', () => {
    expect(heroSoldRangeLabel(sizeOnly)).toBe(HERO_SOLD_RANGE_LABEL_TO_HOME)
    expect(heroSoldRangeLabel(dated)).toBe(HERO_SOLD_RANGE_LABEL)
    expect(heroSoldRangeLabel(bare)).toBe(HERO_SOLD_RANGE_LABEL_PLAIN)
    const pricing = { recommended: 506_000, valueLow: 505_000, valueHigh: 508_000, notes: [] } as unknown as CmaPricing
    const cover = letterCoverPayoffHtml(pricing, sizeOnly)
    expect(cover).toContain('>Where similar homes sold, adjusted to your home<')
    expect(cover).not.toContain('adjusted to today')
  })

  it('the grid row is "Adjusted price" when no sale moved for date, and its working is named the same way', () => {
    const subject = { ...SAGINAW, sqft: 2100 } as CmaSubject
    const five = [0, 1, 2, 3, 4].map((i) =>
      sale({ listingKey: `P${i}`, address: `${10 + i} Purcell`, closePrice: 500_000 + i * 1000, timeAdjustment: 0, sizeAdjustment: 2_000, adjustedPrice: 502_000 + i * 1000, weight: 1 }),
    )
    const html = renderCompMatrixHtml(subject, five)
    expect(html).toContain('>Adjusted price<')
    expect(html).not.toContain('Sale price today')
  })

  it('3177 Coho: names the seller concessions with date and size, in every place', () => {
    expect(adjustedForClause(SAGINAW_COMPS)).toBe('adjusted for date, size and seller concessions')
    expect(adjustedForClause(sizeOnly)).toBe('adjusted for size and seller concessions')
    expect(adjustedRangeLine(sizeOnly)).toBe("The two sales, after seller concessions and adjusted to your home's size, run from $505,000 to $508,000.")
    expect(adjustedRangeLine(dated)).toBe("The two sales, adjusted to today's market, run from $496,000 to $510,000.")
  })
})

describe('3. a range of adjusted figures is never what homes sold for', () => {
  it('says what the adjusted range is', () => {
    const s = neutralAskReading({ ask: 599_900, rangeLow: 627_332, rangeHigh: 724_442, days: 25 })
    expect(s).toBe('You asked $599,900. Adjusted to your home, homes like yours are worth $627,332 to $724,442. You were on the market 25 days.')
    expect(s).not.toMatch(/sold for/)
    expect(adjustedWorthSentence(500_000, 500_000)).toBe('Adjusted to your home, homes like yours are worth $500,000.')
  })
})

describe('4 and 10. on a cover the weights did not make, the sales set the range', () => {
  it('915 Saginaw: the cover is held to the street sale, so the sales set the range', () => {
    const p = saginawPricing()
    const street = streetAnchorRead(p, SAGINAW_COMPS)
    expect(street).toMatchObject({ anchor: 727_148, ceiling: 800_000, premium: 0.1, holdsCover: true })
    expect(street?.sales.map((c) => c.address)).toEqual(['536 Saginaw'])
    expect(salesSetOnlyTheRange(p, SAGINAW_COMPS)).toBe(true)
    expect(weightRowLabel(p, SAGINAW_COMPS)).toBe(WEIGHT_AMONG_SALES_ROW_LABEL)
    expect(salesThatSetItHeading(p, SAGINAW_COMPS)).toBe(RANGE_SALES_HEADING)
  })

  it('prints one plain sentence naming the street sale, its adjusted price and the 10% limit, from the grid', () => {
    const s = streetHoldSentence(saginawPricing(), SAGINAW_COMPS)
    expect(s).toBe(
      "The price on the cover is held to 536 Saginaw, on your street and close to your home's size. Adjusted to your home, that sale is worth $727,148, and the price on the cover is that figure plus 10 percent, rounded to the nearest $5,000.",
    )
    // 727,148 x 1.10 = 799,862.80, to the nearest $5,000 is the $800,000 cover.
    expect(Math.round((727_148 * 1.1) / 5000) * 5000).toBe(800_000)
    expect(s).not.toContain('$800,000')
    expect(s).not.toContain(EM_DASH)
  })

  it('says nothing about the street sale when the cover is not its ceiling, or on a rule 26 hold', () => {
    const lower = saginawPricing({ recommended: 790_000 })
    expect(streetHoldSentence(lower, SAGINAW_COMPS)).toBe('')
    expect(salesSetOnlyTheRange(lower, SAGINAW_COMPS)).toBe(false)
    const below = saginawPricing({ hold: { kind: 'ask-below-band', ask: 925_000, reason: 'test' } })
    expect(streetHoldSentence(below, SAGINAW_COMPS)).toBe('')
    // The rule 26 hold sets only the range whatever the street sale does.
    expect(salesSetOnlyTheRange(below, SAGINAW_COMPS)).toBe(true)
  })

  it('the price chapter prints the street sentence once, and the sales chapter calls the weights what they are', () => {
    const p = saginawPricing()
    const input = { subject: SAGINAW, comps: SAGINAW_COMPS, market: null, pricing: p, tiersUsed: [] }
    const price = visible(pricingPage(input).body)
    expect(price.match(/The price on the cover is held to 536 Saginaw/g)?.length).toBe(1)
    expect(price).toContain('The four sales that set the range support $727,148 to $1,113,820.')
    const sales = salesThatSetItPage(input)!
    const text = visible(sales.body)
    expect(text).toContain('The sales that set the range.')
    expect(text).toContain(WEIGHT_AMONG_SALES_ROW_LABEL)
    expect(text).not.toContain(WEIGHT_IN_PRICE_ROW_LABEL)
    expect(text).toContain('the most weight of the four sales that set the range')
    expect(text).toContain('It does not set the price on the cover.')
    expect(text).not.toContain('moved the number')
    expect(text).toContain('did not set the range')
    expect(text).not.toMatch(/sales behind this price|behind this number/)
  })

  it('a rule 26 hold: the sales set the range, never the cover, and the held-in-band letter keeps its own heading', () => {
    const below = saginawPricing({ streetAnchor: null, hold: { kind: 'ask-below-band', ask: 599_900, reason: 'test' } })
    expect(salesThatSetItHeading(below, SAGINAW_COMPS)).toBe(RANGE_SALES_HEADING)
    expect(weightRowLabel(below, SAGINAW_COMPS)).toBe(WEIGHT_AMONG_SALES_ROW_LABEL)
    const inBand = saginawPricing({ streetAnchor: null })
    expect(salesThatSetItHeading(inBand, SAGINAW_COMPS)).toBe(HELD_SALES_HEADING)
    expect(weightRowLabel(inBand, SAGINAW_COMPS)).toBe(WEIGHT_IN_PRICE_ROW_LABEL)
  })

  it('the map legend says the closed pins set the range on those letters', () => {
    const facts = [{ key: '1', family: 'closed', address: '1 A' }] as unknown as CmaPinFact[]
    expect(pinLegendHtml(facts, { closedLabel: CLOSED_SET_RANGE_LABEL })).toContain('Closed sales: these set the range')
    expect(pinLegendHtml(facts)).toContain('Closed sales: these set the price')
  })
})

describe('9. a one-sale trim that kept the street sale says which sale and why', () => {
  it('915 Saginaw: the high sale was set aside and 536 Saginaw is kept as the low end', () => {
    expect(rangeSpreadCauseSentence(saginawPricing(), { comps: SAGINAW_COMPS })).toBe(
      'That range is wide because the four sales behind it still land $386,672 apart once each is moved to today, and that is after setting aside one sale at the high end of the prices. 536 Saginaw, on your street, is kept as the low end because the price on the cover is held to it.',
    )
  })

  it('says the old trim sentence when no street sale was kept', () => {
    const s = rangeSpreadCauseSentence(saginawPricing({ streetAnchor: null }), { comps: SAGINAW_COMPS })
    expect(s).toContain('one sale at the end of the prices so a single sale cannot set the range')
  })

  it('says "adjusted to your home" when no sale behind the range moved for date', () => {
    const comps = SAGINAW_COMPS.map((c) => ({ ...c, timeAdjustment: 0 }))
    const s = rangeSpreadCauseSentence(saginawPricing({ streetAnchor: null }), { comps })
    expect(s).toContain('apart once each is adjusted to your home')
    expect(s).not.toContain('moved to today')
  })
})

describe('5. the running header is the chapter name, never the sentence heading', () => {
  it('915 Saginaw: the price chapter heads its sheets with the chapter name', () => {
    const page = pricingPage({ subject: SAGINAW, comps: SAGINAW_COMPS, market: null, pricing: saginawPricing(), tiersUsed: [] })
    expect(page.meta).toBe(`915 Saginaw · ${WHAT_ITS_WORTH_CHAPTER}`)
    expect(page.meta.length).toBeLessThan(40)
    // The sentence heading stays the chapter's h2.
    expect(page.body).toContain('<h2 class="section is-answer">')
  })
})

describe('6. set-aside columns are marked in the grid, desktop and phone', () => {
  it('3177 Coho shape: the set-aside sale carries the tag and the set-aside pin; the others carry neither', () => {
    const p = saginawPricing()
    const html = renderCompMatrixHtml(SAGINAW, SAGINAW_COMPS, '', null, undefined, undefined, {
      isSetAside: setAsideSalePredicate(p, SAGINAW_COMPS),
    })
    const heads = [...html.matchAll(/<th class="v" data-comp="(\d+)"[^>]*>([\s\S]*?)<\/th>/g)]
    const aside = heads.filter(([, , body]) => body!.includes(SET_ASIDE_COLUMN_TAG))
    // The fact table and the adjustment table each head the column once.
    expect(new Set(aside.map(([, key]) => key))).toEqual(new Set(['4']))
    for (const [, , body] of aside) expect(body).toContain('pin-badge is-closed is-aside')
    const kept = heads.filter(([, key]) => key !== '4')
    for (const [, , body] of kept) {
      expect(body).not.toContain(SET_ASIDE_COLUMN_TAG)
      expect(body).not.toContain('is-aside')
    }
    // The phone card for the same sale.
    const card = /<article class="comp-stack-card" data-comp="4"[\s\S]*?<\/article>/.exec(html)?.[0] ?? ''
    expect(card).toContain(`<span class="matrix-aside">${SET_ASIDE_COLUMN_TAG}</span>`)
    expect(card).toContain('is-aside')
    const other = /<article class="comp-stack-card" data-comp="1"[\s\S]*?<\/article>/.exec(html)?.[0] ?? ''
    expect(other).not.toContain('matrix-aside')
  })
})

describe('the zone label names every adjustment and still fits the phone frame', () => {
  it('breaks once after "sold," when one line would overflow at the smallest size', () => {
    const label = 'where homes like yours sold, adjusted for date, size and seller concessions'
    const phone = zoneLabelLines(label, 360 - 58 - 8, 10.5)
    expect(phone.lines).toEqual(['where homes like yours sold,', 'adjusted for date, size and seller concessions'])
    for (const line of phone.lines) expect(line.length * 0.62 * phone.fs).toBeLessThanOrEqual(360 - 58 - 8)
    const wide = zoneLabelLines(label, 720 - 78 - 8, 12)
    expect(wide.lines).toEqual([label])
    // A label that fits keeps one line, as before.
    expect(zoneLabelLines('where homes like yours sold, adjusted for date and size', 294, 10.5).lines).toHaveLength(1)
  })
})

describe('3. on a whole held letter (rule 26), chapter 1 does not restate the two facts', () => {
  const broker = {
    id: 'id-matt',
    slug: 'matthew-ryan',
    displayName: 'Matt Ryan',
    title: 'Owner & Principal Broker',
    licenseNumber: '201206613',
    email: 'matt@ryan-realty.com',
    phone: '541.703.3095',
    photoUrl: '/images/brokers/ryan-matt.png',
  } as CmaBroker

  function heldBelow(): RenderCmaArgs {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), 'lib/cma/fixtures/letter-shapes', 'purcell.json'), 'utf8'),
    ) as RenderCmaArgs
    const p = raw.pricing as CmaPricing
    return {
      ...raw,
      broker,
      client: { name: null, email: null, phone: null, notes: null },
      mapDataUri: null,
      subjectMapDataUri: null,
      pricing: { ...p, recommended: 380_000, failedAsk: 429_000, hold: { kind: 'ask-below-band', ask: 429_000, reason: 'test' } },
    } as unknown as RenderCmaArgs
  }

  it('prints no ask-against-range caption under the chart, and the price chapter states both facts once', () => {
    const text = visible(renderCmaHtml(heldBelow()).html)
    expect(text).not.toContain('You were asking')
    expect(text).not.toMatch(/Homes like yours sold for/)
    expect(text.match(/Buyers passed at the last ask of \$429,000\./g)?.length).toBe(1)
    expect(text).toContain('that set the range support')
    expect(text).toContain('The sales that set the range.')
    expect(text).not.toContain('The sales behind this price.')
    expect(text).not.toContain(EM_DASH)
  })
})

describe('8. the unsold count names the window it counted, re-rendered from a stored row', () => {
  it('1355 Jacksonville: the stored count gets the list-price window the read used', () => {
    const area = {
      kind: 'subdivisions' as const,
      names: ['Northwest Townsite', 'Grandview', 'Highland', 'Bonne Home'],
      radiusMiles: null,
      centre: { lat: 44.06, lng: -121.32 },
      source: 'test',
      sentence: 'Northwest Townsite and the plats around it.',
    }
    const page = didNotSellPage({
      subject: { streetAddress: '1355 Jacksonville', city: 'Bend', subdivision: 'Northwest Townsite', standardStatus: null, lastListPrice: null },
      comps: [],
      pricing: { recommended: 732_000, valueLow: 695_610, valueHigh: 732_795, notes: [] },
      compArea: area,
      bandRivals: { lo: 623_000, hi: 843_000, bandBasis: { center: 733_000, halfWidth: 0.15, baseHalfWidth: 0.1 } },
      expiredPeers: {
        area,
        windowMonths: 18,
        windowsTried: [3, 6, 9, 12, 18],
        widenedTo: 18,
        count: 0,
        areaTotal: 2,
        found: 0,
        likeYours: false,
        shortfall: true,
        peers: [],
        sentence:
          'Two homes in Northwest Townsite, Grandview, Highland and Bonne Home came off the market without selling in the last 18 months. None were close to this home in bedrooms, bathrooms, size or age, so they are not compared here.',
      },
      generatedAtIso: '2026-10-08T12:00:00.000Z',
    } as unknown as OpinionPageArgs)
    // 0.55 and 1.85 times $733,000 (the stored center), to the thousand: the
    // window the stored citation recorded (ListPrice 403000..1356000).
    expect(page?.body).toContain(
      'Two homes in Northwest Townsite, Grandview, Highland and Bonne Home listed between $403,000 and $1,356,000 came off the market without selling in the last 18 months.',
    )
  })
})
