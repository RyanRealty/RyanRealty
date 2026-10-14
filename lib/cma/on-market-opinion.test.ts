/**
 * THE OPINION OF VALUE ON AN ON-MARKET LETTER IS THE LIKELY SALE (Matt
 * 2026-10-08, "$716,000, the likely sale"; SKILL.md §0.3 rule 27).
 *
 * Reader review of cma-3062-nw-kelly-hill: the cover said "Our opinion of
 * value $733,000" and page 2 said "The three sales that set this price ...
 * point to a sale near $716,000 once each is weighted by how closely it
 * matches your home." $733,000 was the list recommendation ($736,000 held to
 * the top of the band, $733,116); the weighted price of the three sales is
 * $715,517 (pricing.reconciliation.weightedPrice).
 *
 * The fixture below is that row's stored pricing and grid
 * (render_args.pricing and render_args.comps, read 2026-10-08): every figure
 * the tests assert is one the row carries or the production functions derive
 * from it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyOnMarketOpinion, onMarketOpinionTrace } from './on-market-opinion'
import {
  coverIsOnMarketOpinion,
  expectedSaleFor,
  onMarketOpinionFor,
  onMarketOpinionSentence,
} from './expected-sale'
import { COVER_ON_MARKET_HEADLINE, letterCoverPayoffHtml } from './cover-value'
import { perSquareFootSentence, whatItsWorthLead } from './render-pricing-page'
import { attachSellerNet } from '@/lib/pricing/seller-net'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from './types'

const subject: CmaSubject = {
  listingKey: '20260430162234807780000000',
  mlsNumber: '220220555',
  streetAddress: '3062 NW Kelly Hill',
  city: 'Bend',
  state: 'OR',
  postalCode: '97703',
  subdivision: 'Westside Meadows',
  latitude: 44.073973,
  longitude: -121.362518,
  beds: 3,
  baths: 2,
  sqft: 1702,
  lotAcres: 0.15,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2004,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Active',
  lastListPrice: 699999,
  originalListPrice: 775000,
  lastListDate: '2026-05-01T22:24:26+00:00',
  listingHistoryLine: null,
}

type GridRow = {
  key: string
  address: string
  subdivision: string
  close: number
  adjusted: number
  time: number
  size: number
  concessions: number
  weight: number
  closeDate: string
  sqft: number
}

/** render_args.comps on cma-3062-nw-kelly-hill, the fields the grid prints. */
const GRID: GridRow[] = [
  { key: '20260427230905476201000000', address: '2955 Bordeaux', subdivision: 'Westside Meadows', close: 800000, adjusted: 733116, time: -55690, size: -10194, concessions: 1000, weight: 2.3566, closeDate: '2026-05-29', sqft: 1750 },
  { key: '20260206003214604543000000', address: '2500 Summerhill', subdivision: 'Westside Meadows', close: 717000, adjusted: 593729, time: -48929, size: -59342, concessions: 15000, weight: 1.12, closeDate: '2026-05-13', sqft: 2080 },
  { key: '20251203210810101582000000', address: '62667 McClain', subdivision: 'Skyline West', close: 899000, adjusted: 818217, time: -12582, size: -67891, concessions: 310, weight: 0.5396, closeDate: '2026-02-06', sqft: 2010 },
  { key: '20250812230710647168000000', address: '2974 Chardonnay', subdivision: 'Westside Meadows', close: 735000, adjusted: 674070, time: -20359, size: -40571, concessions: 0, weight: 1.0354, closeDate: '2025-11-26', sqft: 1920 },
  { key: '20241106174956331783000000', address: '3080 Kelly Hill', subdivision: 'Westside Meadows', close: 788000, adjusted: 727451, time: -9298, size: -51251, concessions: 0, weight: 1.5035, closeDate: '2025-01-03', sqft: 1960 },
]

function comp(r: GridRow): CmaAdjustedComp {
  return {
    listingKey: r.key,
    mlsNumber: null,
    address: r.address,
    city: 'Bend',
    subdivision: r.subdivision,
    latitude: 44.073,
    longitude: -121.362,
    beds: 3,
    baths: 2,
    sqft: r.sqft,
    lotAcres: 0.15,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2004,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: r.close,
    closePrice: r.close,
    closeDate: r.closeDate,
    daysToOffer: 13,
    domTotal: 13,
    selectionTier: 'subdivision',
    monthsSinceClose: 5,
    timeAdjustment: r.time,
    timeAdjustedPrice: r.close + r.time,
    ppsfTimeAdjusted: 400,
    sizeAdjustment: r.size,
    storyAdjustment: 0,
    concessionsAmount: r.concessions,
    concessionsYn: r.concessions > 0 ? 'Yes' : 'No',
    adjustedPrice: r.adjusted,
    weight: r.weight,
  } as CmaAdjustedComp
}

const comps: CmaAdjustedComp[] = GRID.map(comp)

/** render_args.pricing on cma-3062-nw-kelly-hill, the fields this rule reads. */
function storedPricing(over: Partial<CmaPricing> = {}): CmaPricing {
  const p = {
    method1Low: 634000,
    method1Mid: 676000,
    method1High: 723000,
    method2: 727000,
    method3: 710000,
    convergenceSpreadPct: 7.2,
    converged: false,
    conservative: 704000,
    recommended: 733000,
    highEnd: 733116,
    valueLow: 674070,
    valueHigh: 733116,
    predictedClose: 686000,
    currentAsk: 699999,
    confidence: 'Moderate',
    confidenceReason: 'test',
    needsReview: false,
    reviewReason: null,
    compPpsfCv: 0.1,
    priceOverride: null,
    improvementsValueAdd: null,
    notes: [],
    clamp: null,
    hold: null,
    reconciliation: {
      weightedPrice: 715517,
      sentence: '',
      weights: [
        { listingKey: GRID[0]!.key, address: '2955 Bordeaux', weight: 40, weightRaw: 2.3566, adjustedPrice: 733116, grossAdjustmentPct: 8.4, reason: '' },
        { listingKey: GRID[3]!.key, address: '2974 Chardonnay', weight: 26.6, weightRaw: 1.0354, adjustedPrice: 674070, grossAdjustmentPct: 8.3, reason: '' },
        { listingKey: GRID[4]!.key, address: '3080 Kelly Hill', weight: 33.4, weightRaw: 1.5035, adjustedPrice: 727451, grossAdjustmentPct: 7.7, reason: '' },
      ],
    },
    setAside: [
      { end: 'low', listingKey: GRID[1]!.key, address: '2500 Summerhill', reason: 'lowest of the adjusted sales, set aside so one sale cannot set the range', adjustedPrice: 593729 },
      { end: 'high', listingKey: GRID[2]!.key, address: '62667 McClain', reason: 'highest of the adjusted sales, set aside so one sale cannot set the range', adjustedPrice: 818217 },
    ],
    rangeRule: {
      n: 5,
      kept: 3,
      rule: 'trimmed-one-each-end',
      saleLow: 674070,
      saleHigh: 733116,
      adjustedLow: 674070,
      adjustedHigh: 733116,
      saleToAskRatio: 0.9571,
      saleToAskSource: 'city-index',
      endpointPpsfAside: 0,
      endpointWeightAside: 0,
    },
    ...over,
  } as unknown as CmaPricing
  attachSellerNet(p, [GRID[0]!, GRID[3]!, GRID[4]!].map(comp))
  return p
}

describe('the opinion of value on 3062 NW Kelly Hill is the likely sale', () => {
  it('reads $716,000 off the printed grid: the weighted $715,517 to the thousand', () => {
    const o = onMarketOpinionFor({ pricing: storedPricing(), comps })
    expect(o).not.toBeNull()
    expect(o!.price).toBe(715517)
    expect(o!.field).toBe('pricing.reconciliation.weightedPrice')
    expect(o!.sales).toBe(3)
    expect(o!.value).toBe(716000)
  })

  it('carries $716,000 as the stored recommended price, and the range does not move', () => {
    const stored = storedPricing()
    const { pricing, opinion, skipped } = applyOnMarketOpinion(stored, comps, { onMarket: true })
    expect(skipped).toBeNull()
    expect(opinion!.value).toBe(716000)
    expect(pricing.recommended).toBe(716000)
    expect(pricing.valueLow).toBe(674070)
    expect(pricing.valueHigh).toBe(733116)
    // The list tiers bracket the cover figure (range-consistency).
    expect(pricing.conservative).toBeLessThanOrEqual(pricing.recommended)
    expect(pricing.recommended).toBeLessThanOrEqual(pricing.highEnd)
    // The §0 trace on the row: where the figure came from, and what it replaced.
    expect(pricing.onMarketOpinion).toEqual({
      value: 716000,
      weightedPrice: 715517,
      field: 'pricing.reconciliation.weightedPrice',
      sales: 3,
      listRecommended: 733000,
    })
    // The stored net block follows the figure; it never quotes a second price.
    expect(pricing.sellerNet?.list).toBe(716000)
    // Pure: the row handed in is untouched.
    expect(stored.recommended).toBe(733000)
    expect(stored.sellerNet?.list).toBe(733000)
  })

  it('is idempotent: the build reads it again after the pin and gets the same figure', () => {
    const once = applyOnMarketOpinion(storedPricing(), comps, { onMarket: true }).pricing
    const twice = applyOnMarketOpinion(once, comps, { onMarket: true }).pricing
    expect(twice.recommended).toBe(716000)
    expect(twice.onMarketOpinion?.listRecommended).toBe(733000)
  })

  it('records one plain trace line for the admin, with no em dash', () => {
    const result = applyOnMarketOpinion(storedPricing(), comps, { onMarket: true })
    const line = onMarketOpinionTrace(result)!
    expect(line).toContain('$716,000')
    expect(line).toContain('$715,517')
    expect(line).toContain('in place of the list figure $733,000')
    expect(line).not.toMatch(/—/)
  })
})

describe('the cover and the price chapter say one number', () => {
  const onCover = applyOnMarketOpinion(storedPricing(), comps, { onMarket: true }).pricing

  it('the cover reads "Our opinion of value $716,000"', () => {
    const html = letterCoverPayoffHtml(onCover, comps, { onMarket: true })
    expect(html).toContain(COVER_ON_MARKET_HEADLINE)
    expect(html).toContain('$716,000')
    expect(html).not.toContain('$733,000')
    // The sold range under it is unchanged.
    expect(html).toContain('$674,070')
    expect(html).toContain('$733,116')
  })

  it('the price per square foot under it is figured on the same $716,000', () => {
    expect(perSquareFootSentence(1702, onCover.recommended)).toBe(
      "The price on the cover comes to $421 per square foot across your home's 1,702 square feet.",
    )
  })

  it('page 2 says the figure once, plainly, never as a second "near" number', () => {
    expect(coverIsOnMarketOpinion(onCover, onMarketOpinionFor({ pricing: onCover, comps }))).toBe(true)
    const lead = whatItsWorthLead(subject, onCover, undefined, comps)
    expect(lead).toContain(
      'The three sales that set this value, 2955 Bordeaux, 2974 Chardonnay and 3080 Kelly Hill, point to $716,000 once each is weighted by how closely it matches your home.',
    )
    expect(lead).not.toMatch(/\bnear \$/)
    expect(lead).not.toMatch(/We'd list|List in that range|list at/i)
    expect(lead).toContain('Your home is listed at $699,999, inside the range the sales support.')
    expect(lead).not.toMatch(/—/)
  })

  it('a row built before the ruling keeps its cover figure and its "near" sentence until it is rebuilt', () => {
    const stored = storedPricing()
    expect(coverIsOnMarketOpinion(stored, onMarketOpinionFor({ pricing: stored, comps }))).toBe(false)
    const lead = whatItsWorthLead(subject, stored, undefined, comps)
    expect(lead).toContain('point to a sale near $716,000 once each is weighted')
    expect(lead).not.toMatch(/We'd list|List in that range/)
  })

  it('names no sales when the grid prints only the ones that set it', () => {
    const o = onMarketOpinionFor({ pricing: onCover, comps })!
    expect(onMarketOpinionSentence(o)).toBe(
      'The three sales that set this value point to $716,000 once each is weighted by how closely it matches your home.',
    )
  })
})

describe('what does not change', () => {
  it('a letter whose home is not on the market is returned as it came, byte for byte', () => {
    const p = storedPricing()
    const before = JSON.stringify(p)
    const result = applyOnMarketOpinion(p, comps, { onMarket: false })
    expect(result.pricing).toBe(p)
    expect(result.skipped).toBe('off-market')
    expect(JSON.stringify(result.pricing)).toBe(before)
    expect(onMarketOpinionTrace(result)).toBeNull()
  })

  it('an expired letter keeps "We\'d list at the price on the cover and expect it to sell near"', () => {
    const expired = { ...subject, standardStatus: 'Expired' }
    const p = storedPricing()
    expect(expectedSaleFor({ pricing: p, comps })?.price).toBe(715517)
    const lead = whatItsWorthLead(expired, p, undefined, comps)
    expect(lead).toContain(
      "We'd list at the price on the cover and expect it to sell near $716,000, which is what the three sales behind it, 2955 Bordeaux, 2974 Chardonnay and 3080 Kelly Hill, point to once each is weighted by how closely it matches your home.",
    )
  })

  it('a broker override stands', () => {
    const p = storedPricing({ priceOverride: 720000, recommended: 720000 })
    const result = applyOnMarketOpinion(p, comps, { onMarket: true })
    expect(result.pricing).toBe(p)
    expect(result.skipped).toBe('broker-override')
  })

  it('a grid that cannot produce the weighted sale leaves the list figure and says why', () => {
    const p = storedPricing()
    const short = comps.filter((c) => c.address !== '2974 Chardonnay')
    const result = applyOnMarketOpinion(p, short, { onMarket: true })
    expect(result.pricing).toBe(p)
    expect(result.skipped).toBe('grid-cannot-produce')
    expect(onMarketOpinionTrace(result)).toContain('keeps the list figure')
  })
})

describe('the thousand stays inside the printed band', () => {
  /** Three equally weighted sales close together, so the weighted sale sits near the band's top. */
  function tight(prices: [number, number, number], weightedPrice: number): { pricing: CmaPricing; comps: CmaAdjustedComp[] } {
    const rows = prices.map((adjusted, i) =>
      comp({ key: `T${i}`, address: `${i + 1} Test`, subdivision: 'Westside Meadows', close: adjusted, adjusted, time: 0, size: 0, concessions: 0, weight: 1, closeDate: '2026-05-01', sqft: 1700 }),
    )
    const pricing = storedPricing({
      recommended: 733000,
      valueLow: Math.min(...prices),
      valueHigh: Math.max(...prices),
      conservative: Math.min(...prices),
      highEnd: Math.max(...prices),
      setAside: [],
      reconciliation: {
        weightedPrice,
        sentence: '',
        weights: rows.map((r) => ({ listingKey: r.listingKey, address: r.address, weight: 33.3, weightRaw: 1, adjustedPrice: r.adjustedPrice, grossAdjustmentPct: 0, reason: '' })),
      },
    } as unknown as Partial<CmaPricing>)
    return { pricing, comps: rows }
  }

  it('steps down to the thousand inside the band when the nearest one is past its top', () => {
    // Weighted $732,517: the nearest thousand, $733,000, is above the $732,850 high.
    const t = tight([731_900, 732_800, 732_850], 732_517)
    expect(onMarketOpinionFor(t)!.value).toBe(732_000)
  })

  it('prints the dollar figure when no thousand fits inside the band', () => {
    const t = tight([732_600, 732_700, 732_800], 732_700)
    expect(onMarketOpinionFor(t)!.value).toBe(732_700)
  })
})

describe('the build carries it', () => {
  const src = readFileSync(join(process.cwd(), 'lib/cma/build.ts'), 'utf8')

  it('decides it before the competition is read, again after the pin, and before any hold', () => {
    const decided = src.indexOf('const subjectIsOnMarket = subjectOnMarket({ subject })')
    const settle = src.indexOf('const settleRecommended = async (')
    const firstApply = src.indexOf('applyOnMarketOpinion(current, printedCompGrid(comps, verdictsForGrid)')
    const competition = src.indexOf('const competition = await assembleCompetition({', settle)
    const pin = src.indexOf('pricing = pinPrintedBandToSettingSales(pricing, renderComps)')
    const afterPin = src.indexOf('if (subjectIsOnMarket) pricing = applyOnMarketOpinion(pricing, renderComps', pin)
    const hold = src.indexOf('applyAskInBandHold(pricing,')
    const persisted = src.indexOf('recommended_list: pricing.recommended')
    for (const at of [decided, settle, firstApply, competition, pin, afterPin, hold, persisted]) expect(at).toBeGreaterThan(0)
    expect(decided).toBeLessThan(settle)
    expect(firstApply).toBeLessThan(competition)
    expect(afterPin).toBeGreaterThan(pin)
    expect(afterPin).toBeLessThan(hold)
    expect(persisted).toBeGreaterThan(afterPin)
    // The competition band is centered on the figure the cover prints.
    expect(src).toContain('recommended: opinion?.opinion ? opinion.pricing.recommended : current.recommended')
  })
})
