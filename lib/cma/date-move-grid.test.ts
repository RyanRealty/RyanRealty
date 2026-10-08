/**
 * ONE SET OF NUMBERS (reader review, 62475 Woodsman, 2026-10-08).
 *
 * The stored letter printed a low of $1,359,694 that sat in no table, named
 * 62637 Mt Hood "lowest of the adjusted sales" over a grid that printed it at
 * $1,450,000, above 62667 Ember at $1,379,000, and printed "Net adjustment
 * -$41,100 / -2.4%" beside "Every adjustment added up 9.2%". The grid had taken
 * the date move back out (the flat-date story) while the band, the set-aside
 * and the weights were all built on the date-moved prices.
 *
 * These reproduce Woodsman's seven sales with the stored date moves, run them
 * through the grid resolution the letter uses (`gridSales`), render the
 * chapter, and read every printed figure back out of the printed rows.
 */
import { describe, expect, it } from 'vitest'
import { gridSales, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import { pricingPage, salesThatSetItPage } from '@/lib/cma/render-pricing-page'
import { setAsideRows } from '@/lib/cma/set-aside'
import { tableAdjustedBand } from '@/lib/cma/cover-value'
import { FLAT_LOCAL_DATE_SENTENCE } from '@/lib/cma/flat-date-story'
import { salesMethodSentences } from '@/lib/cma/sales-method-note'
import { TIME_ADJUSTMENT_BASIS_POCKET } from '@/lib/pricing/exclusive-pocket-date-adj'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject = {
  listingKey: 'S',
  mlsNumber: '220000000',
  streetAddress: '62475 Woodsman',
  city: 'Bend',
  state: 'OR',
  postalCode: '97703',
  subdivision: 'Shevlin West',
  beds: 3,
  baths: 4,
  sqft: 2673,
  lotAcres: 0.19,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2025,
  photoUrl: null,
  standardStatus: 'Expired',
  lastListPrice: 1_600_000,
  lastListDate: '2026-03-06',
  listingHistoryLine: null,
} as unknown as CmaSubject

type Sale = {
  key: string
  address: string
  close: number
  concessions: number
  date: number
  closeDate: string
  sqft: number
  weight: number
}

/** render_args.comps on the stored Woodsman row: close, recorded credit, stored timeAdjustment. */
const SALES: Sale[] = [
  { key: 'K1', address: '62531 Woodsman', close: 1_662_500, concessions: 0, date: 0, closeDate: '2026-09-04', sqft: 2824, weight: 3.9206 },
  { key: 'K2', address: '62467 Woodsman', close: 1_708_800, concessions: 41_100, date: -116_239, closeDate: '2026-06-25', sqft: 2998, weight: 1.6567 },
  { key: 'K3', address: '62637 Mt Hood', close: 1_455_000, concessions: 5_000, date: -101_065, closeDate: '2026-05-06', sqft: 2488, weight: 3.2568 },
  { key: 'K4', address: '62552 Woodsman', close: 1_570_000, concessions: 10_000, date: -53_352, closeDate: '2026-04-23', sqft: 2693, weight: 3.2438 },
  { key: 'K5', address: '62621 Mt Hood', close: 1_625_000, concessions: 0, date: -55_575, closeDate: '2026-04-21', sqft: 2845, weight: 1.6095 },
  { key: 'K6', address: '62667 Ember', close: 1_380_000, concessions: 1_000, date: -19_306, closeDate: '2026-02-20', sqft: 2262, weight: 1.5676 },
  { key: 'K7', address: '3369 Zayden', close: 1_807_500, concessions: 0, date: -25_305, closeDate: '2025-12-11', sqft: 2904, weight: 1.5393 },
]

function comp(s: Sale, dated: boolean, size = 0): CmaAdjustedComp {
  const date = dated ? s.date : 0
  const start = s.close - s.concessions
  return {
    listingKey: s.key,
    mlsNumber: s.key,
    address: s.address,
    city: 'Bend',
    subdivision: 'Shevlin West',
    beds: 3,
    baths: 4,
    sqft: s.sqft,
    lotAcres: 0.19,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2025,
    photoUrl: null,
    listPrice: s.close,
    closePrice: s.close,
    closeDate: s.closeDate,
    concessions: s.concessions,
    concessionsAmount: s.concessions,
    daysToOffer: 30,
    monthsSinceClose: 3,
    timeAdjustment: date,
    timeAdjustedPrice: start + date,
    sizeAdjustment: size,
    storyAdjustment: 0,
    adjustedPrice: start + date + size,
    weight: s.weight,
  } as unknown as CmaAdjustedComp
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/** The pricing a build writes over these sales: band, set-aside and weights on `comps`' adjusted prices. */
function pricingFor(comps: CmaAdjustedComp[], timeAdjustment: Record<string, unknown>): CmaPricing {
  const sorted = [...comps].sort((a, b) => a.adjustedPrice - b.adjustedPrice)
  const low = sorted[0]!
  const high = sorted[sorted.length - 1]!
  const kept = sorted.slice(1, -1)
  const valueLow = kept[0]!.adjustedPrice
  const valueHigh = kept[kept.length - 1]!.adjustedPrice
  const raw = kept.reduce((t, c) => t + c.weight, 0)
  const reason = (end: string) => `${end} of the adjusted sales, set aside so one sale cannot set the range`
  return {
    method1Low: valueLow,
    method1Mid: 1_495_000,
    method1High: valueHigh,
    method2: null,
    method3: null,
    conservative: valueLow,
    recommended: 1_576_000,
    highEnd: 1_576_000,
    valueLow,
    valueHigh,
    confidence: 'High',
    confidenceReason: '',
    needsReview: false,
    reviewReason: null,
    notes: [],
    timeAdjustment,
    setAside: [
      { end: 'low', listingKey: low.listingKey, address: low.address, reason: reason('lowest'), adjustedPrice: low.adjustedPrice },
      { end: 'high', listingKey: high.listingKey, address: high.address, reason: reason('highest'), adjustedPrice: high.adjustedPrice },
    ],
    rangeRule: {
      rule: 'trimmed-one-each-end',
      n: comps.length,
      kept: kept.length,
      saleLow: valueLow,
      saleHigh: valueHigh,
      adjustedLow: valueLow,
      adjustedHigh: valueHigh,
      sentence: `The range is the spread of the five sale prices behind this price: ${usd(valueLow)} to ${usd(valueHigh)}.`,
    },
    reconciliation: {
      sentence: '62531 Woodsman carries the most weight of the five sales behind this price.',
      mostWeighted: 'K1',
      weightedPrice: Math.round(kept.reduce((t, c) => t + c.adjustedPrice * c.weight, 0) / raw),
      weights: kept.map((c) => ({
        listingKey: c.listingKey,
        address: c.address,
        weight: Math.round((c.weight / raw) * 1000) / 10,
        weightRaw: c.weight,
        adjustedPrice: c.adjustedPrice,
        grossAdjustmentPct:
          Math.round(
            ((Math.abs(c.timeAdjustment) + Math.abs(c.sizeAdjustment) + (c.concessionsAmount ?? 0)) / c.closePrice) * 1000,
          ) / 10,
      })),
    },
  } as unknown as CmaPricing
}

const POCKET_TIME = {
  basis: TIME_ADJUSTMENT_BASIS_POCKET,
  measure: 'sold and last-ask prices in this exclusive pocket',
  pctPerMonth: 0,
  pctOverWindow: 0,
  windowMonths: 12,
  n: 2606,
  sentence:
    'These sales are the exclusive pocket. Date adjustment was applied to 6 sales. The Bend city index is not used to pump prices. Size and story class do not adjust.',
}

function args(comps: CmaAdjustedComp[], pricing: CmaPricing): OpinionPageArgs {
  return {
    subject,
    comps,
    market: null,
    pricing,
    mapDataUri: null,
    generatedAtIso: '2026-10-07T12:00:00.000Z',
    // The Shevlin West listing-window read on the stored row.
    listingMarket: { ppsfMove: 'held flat', priceMove: 'rose', place: 'Shevlin West' },
  } as unknown as OpinionPageArgs
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&minus;|−/g, '-')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

/** Every cell of one labelled grid row, across every table it is split into. */
function rowCells(html: string, label: string): string[] {
  const out: string[] = []
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1]!.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => stripTags(m[1]!).trim())
    if (cells[0] === label) out.push(...cells.slice(1).filter((c) => c !== '-' && c !== ''))
  }
  return out
}

function dollars(cell: string): number {
  const m = /(-)?\$([\d,]+)/.exec(cell.replace(/[−–]/g, '-'))
  if (!m) return Number.NaN
  return (m[1] ? -1 : 1) * Number(m[2]!.replace(/,/g, ''))
}

function chapter(a: OpinionPageArgs): { html: string; text: string; grid: ReturnType<typeof gridSales> } {
  const grid = gridSales(a)
  const input = { subject, comps: grid.comps, market: null, pricing: grid.pricing, tiersUsed: [] }
  const html = `${pricingPage(input).body}\n${salesThatSetItPage(input)?.body ?? ''}`
  return { html, text: stripTags(html), grid }
}

describe('the dated grid: 62475 Woodsman, seven sales, the pocket date move', () => {
  const comps = SALES.map((s) => comp(s, true))
  const pricing = pricingFor(comps, POCKET_TIME)
  const a = args(comps, pricing)
  const { html, text, grid } = chapter(a)

  it('keeps the date move the band was built on, even though the local per-foot held flat', () => {
    expect(grid.comps.map((c) => c.adjustedPrice)).toEqual(comps.map((c) => c.adjustedPrice))
    expect(grid.comps.map((c) => c.timeAdjustment)).toEqual(SALES.map((s) => s.date))
    expect(grid.pricing).toBe(pricing)
  })

  it('prints the date move as its own row and names what it follows', () => {
    const date = rowCells(html, 'Adjusted for date').map(dollars)
    expect(date).toContain(-116_239)
    expect(date).toContain(-101_065)
    // Names whose figure it is (reader review, 62475 Woodsman, 2026-10-08):
    // the city's, not Shevlin West's, whose own per-foot held flat.
    expect(text).toContain(
      "Adjusted for date is how much Bend's median price per square foot fell between the month a sale closed and the last three full months. That figure covers every home sale in Bend, not only Shevlin West. No sale is moved up for date.",
    )
  })

  it('prints the low and the high of the range in the Sale price today row', () => {
    const today = rowCells(html, 'Sale price today').map(dollars)
    expect(today).toHaveLength(7)
    expect(today).toContain(pricing.valueLow) // 62667 Ember, $1,359,694
    expect(today).toContain(pricing.valueHigh) // 62531 Woodsman, $1,662,500
    expect(pricing.valueLow).toBe(1_359_694)
    expect(pricing.valueHigh).toBe(1_662_500)
    const band = tableAdjustedBand(grid.comps, grid.pricing)
    expect(band).toEqual({ low: 1_359_694, high: 1_662_500 })
    expect(text).toContain('run from $1,359,694 to $1,662,500')
    expect(text).not.toContain('$1,379,000 to $1,667,700')
  })

  it('names as set aside the lowest and the highest of the printed Sale price today', () => {
    const today = rowCells(html, 'Sale price today').map(dollars)
    const lowest = Math.min(...today)
    const highest = Math.max(...today)
    expect(lowest).toBe(1_348_935) // 62637 Mt Hood, dated
    expect(highest).toBe(1_782_195) // 3369 Zayden, dated
    const rows = setAsideRows(grid.pricing, grid.comps)
    const byAddress = new Map(grid.comps.map((c) => [c.address, c.adjustedPrice]))
    const low = rows.find((r) => r.reason.startsWith('lowest'))!
    const high = rows.find((r) => r.reason.startsWith('highest'))!
    expect(byAddress.get(low.address)).toBe(lowest)
    expect(byAddress.get(high.address)).toBe(highest)
    expect(text).toContain('62637 Mt Hood lowest of the adjusted sales')
  })

  it('adds the net and the gross percent up from the printed rows', () => {
    const sold = rowCells(html, 'Sold for').map(dollars)
    const net = rowCells(html, 'Net adjustment').map(dollars)
    const gross = rowCells(html, 'Every adjustment added up').map((c) => Number(c.replace('%', '')))
    const today = rowCells(html, 'Sale price today').map(dollars)
    expect(sold).toHaveLength(7)
    SALES.forEach((s, i) => {
      // Net is the concession off plus the date move, and lands on Sale price today.
      expect(net[i]).toBe(-s.concessions + s.date)
      expect(sold[i]! + net[i]!).toBe(today[i])
      const printed = (Math.abs(s.date) + s.concessions) / s.close * 100
      expect(gross[i]).toBeCloseTo(printed, 1)
    })
    // 62467 Woodsman: -$157,339 net, 9.2 percent gross, both off the rows.
    expect(net[1]).toBe(-157_339)
    expect(gross[1]).toBe(9.2)
  })

  it('does not print the flat story beside a grid that moved six sales', () => {
    expect(text).not.toContain(FLAT_LOCAL_DATE_SENTENCE)
    const method = salesMethodSentences({ subject, comps: grid.comps, pricing: grid.pricing }).join(' ')
    expect(method).not.toContain(FLAT_LOCAL_DATE_SENTENCE)
    expect(method).toContain("down by how much Bend's median price per square foot fell")
  })
})

describe('the flat grid: the same sales when no date move ran', () => {
  const comps = SALES.map((s) => comp(s, false))
  const pricing = pricingFor(comps, { ...POCKET_TIME, sentence: 'These sales are the exclusive pocket.' })
  const { html, text, grid } = chapter(args(comps, pricing))

  it('prints no date row and the flat local story', () => {
    expect(rowCells(html, 'Adjusted for date').map(dollars).filter((n) => n !== 0)).toEqual([])
    expect(text).not.toContain('Adjusted for date is')
    expect(grid.pricing.timeAdjustment?.sentence).toBe(FLAT_LOCAL_DATE_SENTENCE)
    const method = salesMethodSentences({ subject, comps: grid.comps, pricing: grid.pricing }).join(' ')
    expect(method).toContain(FLAT_LOCAL_DATE_SENTENCE)
  })

  it('still reads the range and the set-aside off the printed rows', () => {
    const today = rowCells(html, 'Sale price today').map(dollars)
    expect(today).toContain(pricing.valueLow)
    expect(today).toContain(pricing.valueHigh)
    const rows = setAsideRows(grid.pricing, grid.comps)
    const byAddress = new Map(grid.comps.map((c) => [c.address, c.adjustedPrice]))
    expect(rows.map((r) => byAddress.get(r.address)).sort()).toEqual(
      [Math.min(...today), Math.max(...today)].sort(),
    )
  })

  it('tells no flat story when the local per-foot did not hold flat', () => {
    const moved = gridSales({ ...args(comps, pricing), listingMarket: { ppsfMove: 'rose' } } as unknown as OpinionPageArgs)
    expect(moved.pricing.timeAdjustment?.sentence).not.toBe(FLAT_LOCAL_DATE_SENTENCE)
  })
})

describe('the dated pocket grid with a size line (Matt 2026-10-08: the pocket adjusts for size too)', () => {
  // Illustrative size dollars, not a stored figure: the size rate is the size
  // agent's (lib/pricing/size-adjustment.ts). What is pinned here is that the
  // grid, the band and the set-aside read date, concessions and size together.
  const SIZE = [-20_000, -45_000, 25_000, 0, -25_000, 60_000, -35_000]
  const comps = SALES.map((s, i) => comp(s, true, SIZE[i]!))
  const pricing = pricingFor(comps, POCKET_TIME)
  const { html, grid } = chapter(args(comps, pricing))

  it('lands every Sale price today on sold, less the credit, plus date and size', () => {
    const sold = rowCells(html, 'Sold for').map(dollars)
    const size = rowCells(html, 'Adjusted for size (theirs vs yours)').map(dollars)
    const net = rowCells(html, 'Net adjustment').map(dollars)
    const gross = rowCells(html, 'Every adjustment added up').map((c) => Number(c.replace('%', '')))
    const today = rowCells(html, 'Sale price today').map(dollars)
    expect(today).toHaveLength(7)
    expect(size.filter((n) => n !== 0)).toEqual(SIZE.filter((n) => n !== 0))
    SALES.forEach((s, i) => {
      expect(net[i]).toBe(-s.concessions + s.date + SIZE[i]!)
      expect(sold[i]! + net[i]!).toBe(today[i])
      const printed = ((Math.abs(s.date) + Math.abs(SIZE[i]!) + s.concessions) / s.close) * 100
      expect(gross[i]).toBeCloseTo(printed, 1)
    })
  })

  it('prints the band ends in that row and sets aside its lowest and highest', () => {
    const today = rowCells(html, 'Sale price today').map(dollars)
    expect(today).toContain(pricing.valueLow)
    expect(today).toContain(pricing.valueHigh)
    expect(tableAdjustedBand(grid.comps, grid.pricing)).toEqual({ low: pricing.valueLow, high: pricing.valueHigh })
    const rows = setAsideRows(grid.pricing, grid.comps)
    const byAddress = new Map(grid.comps.map((c) => [c.address, c.adjustedPrice]))
    expect(rows.map((r) => byAddress.get(r.address)).sort()).toEqual(
      [Math.min(...today), Math.max(...today)].sort(),
    )
  })
})
