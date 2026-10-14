/**
 * DOWN ONLY IF LOCAL FELL (Matt 2026-10-08).
 *
 * Own-ground sales (an exclusive-pocket set: own street, own plat, pocket
 * windows) move down for date with Bend's citywide index ONLY when the home's
 * own local read fell too. Otherwise each sale stays at its sold price. The
 * letter must never move sales against the local trend it prints a page
 * earlier.
 *
 * The case that set the rule: cma-62475-woodsman, seven Shevlin West sales.
 * The Bend index cut the June and May sales 7.0 percent while the local page
 * said Shevlin West homes of about this size held flat, $581 a square foot
 * (4 sales, Mar 6 to Jun 17) then $572 (2 sales, Jun 18 to Sep 30).
 *
 * These run Woodsman's seven sales through the walk the build uses, gated on
 * the stored local read, and hold the grid's date and size rows, the stored
 * basis, the caption under the grid, Basis and limits, and the local page's
 * own sentence to one account.
 */
import { describe, expect, it } from 'vitest'
import { adjustCmaCompAlongMarket, buildTimeAdjustmentBasis } from '@/lib/pricing/estimate'
import {
  applyExclusivePocketDateAdj,
  missingPocketLocalRead,
  TIME_ADJUSTMENT_BASIS_POCKET,
  TIME_ADJUSTMENT_BASIS_POCKET_INDEX,
  type PocketLocalRead,
} from '@/lib/pricing/exclusive-pocket-date-adj'
import type { MarketIndexPoint, MarketPath } from '@/lib/pricing/market-path'
import { sizeAdjustmentFor } from '@/lib/pricing/size-adjustment'
import {
  listingMarketSentence,
  listingMarketSlopes,
  pocketLocalReadOf,
  type ListingMarketClose,
  type ListingMarketMove,
} from '@/lib/cma/listing-window-market'
import { listingWindowDates, measureListingWindowMarket, subjectListingWindow } from '@/lib/cma/listing-window-load'
import { localReadForSet } from '@/lib/cma/pocket-pricing'
import { DATE_REASON_UNDER_GRID, dateBasisCaption, salesMethodSentences } from '@/lib/cma/sales-method-note'
import { FLAT_LOCAL_DATE_SENTENCE, withFlatLocalDateStory } from '@/lib/cma/flat-date-story'
import { pocketDateFollowsLocalReadCheck } from '@/lib/cma/letter-consistency'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import type { CmaComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

/**
 * pricing_market_index, city_slug = 'bend', read 2026-10-08 (the same rows
 * lib/cma/pocket-date-basis.test.ts pins).
 */
const BEND: MarketIndexPoint[] = [
  { month: '2025-09-01', n: 260, ppsf: 391.34 },
  { month: '2025-10-01', n: 225, ppsf: 400.25 },
  { month: '2025-11-01', n: 195, ppsf: 395.45 },
  { month: '2025-12-01', n: 191, ppsf: 367.75 },
  { month: '2026-01-01', n: 142, ppsf: 389.945 },
  { month: '2026-02-01', n: 170, ppsf: 390.605 },
  { month: '2026-03-01', n: 216, ppsf: 379.465 },
  { month: '2026-04-01', n: 206, ppsf: 398.125 },
  { month: '2026-05-01', n: 238, ppsf: 413.3 },
  { month: '2026-06-01', n: 291, ppsf: 414.36 },
  { month: '2026-07-01', n: 279, ppsf: 394.03 },
  { month: '2026-08-01', n: 243, ppsf: 384.5 },
  { month: '2026-09-01', n: 210, ppsf: 371.325 },
]

const AS_OF = '2026-10-08T02:59:09.212Z'

const subject = {
  streetAddress: '62475 Woodsman',
  city: 'Bend',
  subdivision: 'Shevlin West',
  beds: 3,
  baths: 4,
  sqft: 2673,
  yearBuilt: 2025,
  lotAcres: 0.19,
  latitude: 44.073919,
  longitude: -121.37172,
  propertySubType: 'Single Family Residence',
} as unknown as CmaSubject

/** render_args.comps on cma-62475-woodsman: close, recorded concession, and the stored (ungated) date move. */
const SALES = [
  { address: '62531 Woodsman', closeDate: '2026-09-04', close: 1_662_500, concessions: 0, sqft: 2824, storedDate: 0 },
  { address: '62467 Woodsman', closeDate: '2026-06-25', close: 1_708_800, concessions: 41_100, sqft: 2998, storedDate: -116_239 },
  { address: '62637 Mt Hood', closeDate: '2026-05-06', close: 1_455_000, concessions: 5_000, sqft: 2488, storedDate: -101_065 },
  { address: '62552 Woodsman', closeDate: '2026-04-23', close: 1_570_000, concessions: 10_000, sqft: 2693, storedDate: -53_352 },
  { address: '62621 Mt Hood', closeDate: '2026-04-21', close: 1_625_000, concessions: 0, sqft: 2845, storedDate: -55_575 },
  { address: '62667 Ember', closeDate: '2026-02-20', close: 1_380_000, concessions: 1_000, sqft: 2262, storedDate: -19_306 },
  { address: '3369 Zayden', closeDate: '2025-12-11', close: 1_807_500, concessions: 0, sqft: 2904, storedDate: -25_305 },
]

function sale(s: (typeof SALES)[number], i: number): CmaComp {
  return {
    listingKey: `K${i + 1}`,
    address: s.address,
    city: 'Bend',
    subdivision: 'Shevlin West',
    beds: 3,
    baths: 4,
    sqft: s.sqft,
    yearBuilt: 2025,
    lotAcres: 0.19,
    latitude: 44.0739,
    longitude: -121.3717,
    closePrice: s.close,
    closeDate: s.closeDate,
    concessions: s.concessions,
    concessionsAmount: s.concessions,
    selectionTier: 'subdivision-6mo',
    ownPlat: true,
  } as unknown as CmaComp
}

/**
 * render_args.listingMarket on cma-62475-woodsman, as stored: the local page's
 * read. Price per square foot held flat, $581 then $572.
 */
const WOODSMAN_LOCAL: ListingMarketMove = {
  asOf: '2026-10-07',
  late: { n: 2, to: '2026-09-30', from: '2026-06-18', ppsf: 572, median: 1_685_650, sqftMedian: 2911 },
  early: { n: 4, to: '2026-06-17', from: '2026-03-06', ppsf: 581, median: 1_591_500, sqftMedian: 2636 },
  grain: 'subdivision',
  place: 'Shevlin West',
  sized: true,
  ppsfNet: true,
  sqftLow: 2005,
  ppsfMove: 'held flat',
  sqftHigh: 3341,
  priceMove: 'rose',
}

/** The same window, per-foot figures changed: what the page would print had they fallen or risen. */
function localWith(early: number, late: number, word: 'fell' | 'rose' | 'held flat'): ListingMarketMove {
  return {
    ...WOODSMAN_LOCAL,
    early: { ...WOODSMAN_LOCAL.early, ppsf: early },
    late: { ...WOODSMAN_LOCAL.late, ppsf: late },
    ppsfMove: word,
  }
}

/** The build's walk (lib/cma/build.ts priceSet) and its basis (priceCmaSet), gated on `local`. */
function walk(local: PocketLocalRead | undefined, opts: { exclusivePocket?: boolean; points?: MarketIndexPoint[] } = {}) {
  const exclusivePocket = opts.exclusivePocket ?? true
  const points = opts.points ?? BEND
  const comps = SALES.map(
    (s, i) =>
      adjustCmaCompAlongMarket({
        subject,
        subjectStory: 'unknown',
        comp: sale(s, i),
        saleStory: 'unknown',
        points,
        asOf: AS_OF,
        exclusivePocket,
        pocketLocal: local,
      }).adjusted,
  )
  const basis = buildTimeAdjustmentBasis({
    citySlug: 'bend',
    cityName: 'Bend',
    points,
    asOf: AS_OF,
    exclusivePocket,
    pocketLocal: local,
    applied: comps.map((c) => ({
      address: c.address,
      closePrice: c.closePrice,
      timeAdjustment: c.timeAdjustment,
      timeAdjustedPrice: c.timeAdjustedPrice,
      closeDate: c.closeDate,
    })),
  })
  const pricing = { timeAdjustment: basis } as unknown as CmaPricing
  return { comps, basis, pricing }
}

const EM_DASH = '—'

describe('62475 Woodsman: the local page says held flat, so no sale moves for date', () => {
  const local = pocketLocalReadOf(WOODSMAN_LOCAL)
  const { comps, basis, pricing } = walk(local)

  it('reads the same verdict and figures the local page prints', () => {
    expect(local.verdict).toBe('held flat')
    expect(local.place).toBe('Shevlin West')
    expect(local.early).toEqual({ ppsf: 581, n: 4, from: '2026-03-06', to: '2026-06-17' })
    expect(local.late).toEqual({ ppsf: 572, n: 2, from: '2026-06-18', to: '2026-09-30' })
    expect(listingMarketSentence(WOODSMAN_LOCAL)).toContain(
      'the price per square foot in Shevlin West for a home about this size held flat, $581 then $572.',
    )
    expect(listingMarketSentence(WOODSMAN_LOCAL)).not.toContain('rose from $1,591,500')
  })

  it('moves no sale: every factor is 1 and every sale keeps its sold price for date', () => {
    for (const c of comps) {
      expect(c.timeAdjustment, c.address).toBe(0)
      expect(c.timeAdjustedPrice, c.address).toBe(c.closePrice - (c.concessions ?? 0))
    }
    // Before the ruling six of the seven moved (the stored draft).
    expect(SALES.filter((s) => s.storedDate !== 0)).toHaveLength(6)
  })

  it('sizes each sale off its sold price per foot, after the recorded concession', () => {
    for (const c of comps) {
      const sold = c.closePrice - (c.concessions ?? 0)
      const expected = sizeAdjustmentFor({ subjectSqft: subject.sqft, saleSqft: c.sqft, timeAdjustedPrice: sold })
      expect(c.sizeAdjustment, c.address).toBe(expected.sizeAdjustment)
      expect(c.ppsfTimeAdjusted, c.address).toBe(+expected.ppsfTimeAdjusted.toFixed(2))
      expect(c.adjustedPrice, c.address).toBe(sold + c.sizeAdjustment)
    }
  })

  it('records the branch, the local figures and why on the stored basis', () => {
    expect(basis.basis).toBe(TIME_ADJUSTMENT_BASIS_POCKET)
    expect(basis.localGate).toMatchObject({
      branch: 'local-held-flat',
      verdict: 'held flat',
      moved: false,
      place: 'Shevlin West',
      sized: true,
      early: { ppsf: 581, n: 4 },
      late: { ppsf: 572, n: 2 },
    })
    expect(basis.localGate?.rule).toMatch(/down only if local fell/)
    expect(basis.source.filter).toContain('Branch local-held-flat')
    expect(basis.source.filter).toContain('held flat, from $581 a square foot (4 sales, 2026-03-06 to 2026-06-17) to $572 (2 sales, 2026-06-18 to 2026-09-30)')
    expect(basis.source.filter).toContain("pricing_market_index for city_slug='bend' was read and not applied")
    expect(basis.sentence).toContain('each one stands at its sold price')
    expect(basis.indexLevels).toBeUndefined()
  })

  // The reason prints once, under the grid; Basis and limits points back to
  // it (reader review, 3037 Purcell and 62475 Woodsman, 2026-10-08: the same
  // sentence printed in both places).
  it('says so under the grid with the local figures, and Basis and limits points back to it', () => {
    expect(dateBasisCaption({ subject, comps, pricing })).toBe(
      'No sale is adjusted for date. Homes like yours in Shevlin West held flat while your home was listed, $581 then $572 a square foot, so each sale stands at its sold price.',
    )
    expect(salesMethodSentences({ subject, comps, pricing })).toEqual([
      `None of these sales is moved for the month it sold. ${DATE_REASON_UNDER_GRID}`,
    ])
  })

  it('keeps the gate over the generic flat line when the letter applies the flat local story to the same row', () => {
    // opinion-pages gridSales swaps in the generic flat sentence when the
    // local page held flat and nothing moved; the gate's own reason wins,
    // and it is the one under the grid.
    const flat = withFlatLocalDateStory(pricing)
    const method = salesMethodSentences({ subject, comps, pricing: flat })[0]
    expect(method).toBe(`None of these sales is moved for the month it sold. ${DATE_REASON_UNDER_GRID}`)
    expect(method).not.toContain(FLAT_LOCAL_DATE_SENTENCE)
  })
})

describe('the same sales when the local page says fell: the Bend index moves them down, as before', () => {
  const fell = localWith(600, 570, 'fell')
  const local = pocketLocalReadOf(fell)
  const { comps, basis, pricing } = walk(local)

  it('moves exactly what the ungated walk moved (the stored draft)', () => {
    expect(comps.map((c) => c.timeAdjustment)).toEqual(SALES.map((s) => s.storedDate))
    const ungated = walk(undefined).comps
    expect(comps.map((c) => c.adjustedPrice)).toEqual(ungated.map((c) => c.adjustedPrice))
  })

  it('sizes each moved sale off its date-adjusted price per foot', () => {
    for (const c of comps) {
      const expected = sizeAdjustmentFor({ subjectSqft: subject.sqft, saleSqft: c.sqft, timeAdjustedPrice: c.timeAdjustedPrice })
      expect(c.sizeAdjustment, c.address).toBe(expected.sizeAdjustment)
    }
  })

  it('records the index basis with the local fall that let it move', () => {
    expect(basis.basis).toBe(TIME_ADJUSTMENT_BASIS_POCKET_INDEX)
    expect(basis.localGate).toMatchObject({ branch: 'local-fell', verdict: 'fell', moved: true })
    expect(basis.source.filter).toContain('only when the local per-foot read fell')
    expect(basis.sentence).toContain('The local read fell, so these sales move down with the Bend city index.')
  })

  it('names the local fall beside the Bend figure under the grid, once, and Basis and limits points back to it', () => {
    const why =
      "These sales move with Bend's figure only because homes like yours in Shevlin West also fell while your home was listed, from $600 to $570 a square foot."
    expect(dateBasisCaption({ subject, comps, pricing })).toMatch(new RegExp(`No sale is moved up for date\\. ${why.replace(/[.$]/g, '\\$&')}$`))
    const method = salesMethodSentences({ subject, comps, pricing })
    expect(method).toHaveLength(1)
    expect(method[0]).toContain('we moved six of the seven down by how much Bend')
    expect(method[0]!.endsWith(DATE_REASON_UNDER_GRID)).toBe(true)
    expect(method[0]).not.toContain(why)
  })
})

describe('the same sales when the local page says rose: no sale moves', () => {
  const local = pocketLocalReadOf(localWith(560, 590, 'rose'))
  const { comps, basis, pricing } = walk(local)

  it('moves nothing and says the local per-foot rose', () => {
    expect(comps.every((c) => c.timeAdjustment === 0)).toBe(true)
    expect(basis.localGate).toMatchObject({ branch: 'local-rose', moved: false })
    expect(dateBasisCaption({ subject, comps, pricing })).toBe(
      'No sale is adjusted for date. Homes like yours in Shevlin West rose while your home was listed, from $560 to $590 a square foot, and these sales are never moved up for date, so each sale stands at its sold price.',
    )
  })
})

describe('the local page says fell, but the city figure has nothing to move', () => {
  const local = pocketLocalReadOf(localWith(600, 570, 'fell'))

  it('every sale closed at or under today\'s level: nothing moves, and the letter says why', () => {
    // The same months, rising into the reference: every move would be up, and a rise is never applied.
    const rising = BEND.map((p, i) => ({ ...p, ppsf: 300 + i * 10 }))
    const { comps, basis, pricing } = walk(local, { points: rising })
    expect(comps.every((c) => c.timeAdjustment === 0)).toBe(true)
    expect(basis.localGate).toMatchObject({ branch: 'local-fell', moved: false })
    expect(basis.source.filter).toContain('every sale closed in a month at or under the endpoint')
    expect(dateBasisCaption({ subject, comps, pricing })).toBe(
      "No sale is adjusted for date. Homes like yours in Shevlin West fell while your home was listed, from $600 to $570 a square foot, but every sale here closed when Bend's median price per square foot was already at or under today's level, so each sale stands at its sold price.",
    )
  })

  it('no monthly index for the city: nothing moves, and the letter does not claim a level it never read', () => {
    const { comps, basis, pricing } = walk(local, { points: [] })
    expect(comps.every((c) => c.timeAdjustment === 0)).toBe(true)
    expect(basis.n).toBe(0)
    expect(basis.source.filter).toContain("pricing_market_index for city_slug='bend' has no rows in the window")
    expect(basis.sentence).toContain('there is no Bend city index to move a sale by')
    const caption = dateBasisCaption({ subject, comps, pricing }) ?? ''
    expect(caption).toContain('but there is no monthly price figure for Bend to move the sales by')
    expect(caption).not.toContain("today's level")
  })
})

describe('no local read: the sold price stands (the documented default)', () => {
  it('no listing window: moves nothing and says there is nothing to measure over', () => {
    const local = pocketLocalReadOf(null, 'no-listing-window')
    expect(local).toEqual(missingPocketLocalRead('no-listing-window'))
    const { comps, basis, pricing } = walk(local)
    expect(comps.every((c) => c.timeAdjustment === 0)).toBe(true)
    expect(basis.localGate).toMatchObject({ branch: 'no-local-read', missing: 'no-listing-window', moved: false })
    expect(basis.source.table).toContain('no local per-foot read: no-listing-window')
    // The reason prints under the grid; Basis and limits points back to it.
    expect(dateBasisCaption({ subject, comps, pricing })).toBe(
      'No sale is adjusted for date. We move these sales down for date only when homes in Shevlin West are falling in price, and there is no recent listing of your home to measure that over, so each sale stands at its sold price.',
    )
    expect(salesMethodSentences({ subject, comps, pricing })).toEqual([
      `None of these sales is moved for the month it sold. ${DATE_REASON_UNDER_GRID}`,
    ])
  })

  it('too few sales in the window: moves nothing and says too few sold to tell', () => {
    const { comps, pricing } = walk(pocketLocalReadOf(null))
    expect(comps.every((c) => c.timeAdjustment === 0)).toBe(true)
    expect(dateBasisCaption({ subject, comps, pricing })).toBe(
      'No sale is adjusted for date. We move these sales down for date only when homes in Shevlin West fell in price while your home was listed, and too few of them sold then to tell, so each sale stands at its sold price.',
    )
  })

  it('one sale a half: the page prints no trend, so even a falling pair moves nothing', () => {
    const one = { ...localWith(620, 560, 'fell'), late: { ...WOODSMAN_LOCAL.late, n: 1, ppsf: 560 } }
    expect(listingMarketSentence(one)).toContain("One sale is one home's price, not a trend.")
    const local = pocketLocalReadOf(one)
    expect(local).toMatchObject({ verdict: null, missing: 'one-sale-a-half' })
    expect(walk(local).comps.every((c) => c.timeAdjustment === 0)).toBe(true)
  })
})

describe('the two pages agree, whatever the local page says', () => {
  const cases: Array<[string, ListingMarketMove]> = [
    ['held flat (Woodsman)', WOODSMAN_LOCAL],
    ['fell', localWith(600, 570, 'fell')],
    ['rose', localWith(560, 590, 'rose')],
    ['one sale a half', { ...localWith(620, 560, 'fell'), late: { ...WOODSMAN_LOCAL.late, n: 1, ppsf: 560 } }],
  ]
  for (const [name, move] of cases) {
    it(name, () => {
      const { comps, pricing } = walk(pocketLocalReadOf(move))
      const footPanel = listingMarketSlopes(move).panels.find((p) => p.title === 'Price per square foot')!
      // The page prints "fell" over the per-foot slope only when it has a trend to print.
      const pageSaysFell = footPanel.label == null && footPanel.move === 'fell'
      const movedDown = comps.some((c) => c.timeAdjustment < 0)
      expect(movedDown).toBe(pageSaysFell)
      expect(comps.some((c) => c.timeAdjustment > 0)).toBe(false)
      const caption = dateBasisCaption({ subject, comps, pricing }) ?? ''
      const method = salesMethodSentences({ subject, comps, pricing }).join(' ')
      for (const text of [caption, method]) expect(text).not.toContain(EM_DASH)
      // The reason, with the page's own word and figures, prints once, under
      // the grid; Basis and limits points back to it.
      if (footPanel.label == null) {
        // The same word and the same two figures as the page.
        expect(caption).toContain(`${footPanel.move} while your home was listed`)
        expect(caption).toContain(footPanel.fromText)
        expect(caption).toContain(footPanel.toText)
      } else {
        expect(caption).toContain('too few of them sold then to tell')
      }
      expect(method).toContain(DATE_REASON_UNDER_GRID)
      expect(method).not.toContain('while your home was listed')
    })
  }
})

describe('the gate is the pocket rule only', () => {
  const cooling: MarketPath = {
    factor: 0.93,
    fromPpsf: 413.3,
    toPpsf: 384.5,
    monthlyRate: -0.01,
    months: 4,
    regime: 'falling',
    capped: false,
    source: 'index',
    referenceMonths: ['2026-07-01', '2026-08-01', '2026-09-01'],
    reversedWithinSpan: false,
  }
  const held = pocketLocalReadOf(WOODSMAN_LOCAL)

  it('leaves a wider (not own-ground) set on the city index both ways', () => {
    expect(applyExclusivePocketDateAdj(cooling, false, held)).toBe(cooling)
    const wider = walk(held, { exclusivePocket: false }).comps
    const ungatedWider = walk(undefined, { exclusivePocket: false }).comps
    expect(wider.map((c) => c.timeAdjustment)).toEqual(ungatedWider.map((c) => c.timeAdjustment))
    expect(walk(held, { exclusivePocket: false }).basis.localGate).toBeUndefined()
  })

  it('refuses a rise on the pocket whatever the local read says, and keeps a cooling only when it fell', () => {
    const rising = { ...cooling, factor: 1.08, regime: 'rising' as const }
    for (const verdict of ['fell', 'held flat', 'rose', null] as const) {
      expect(applyExclusivePocketDateAdj(rising, true, { verdict }).factor).toBe(1)
    }
    expect(applyExclusivePocketDateAdj(cooling, true, { verdict: 'fell' })).toBe(cooling)
    for (const verdict of ['held flat', 'rose', null] as const) {
      const out = applyExclusivePocketDateAdj(cooling, true, { verdict })
      expect(out.factor).toBe(1)
      expect(out.capped).toBe(true)
    }
    // A caller with no local read (the listing-page stamp) keeps the down-only walk.
    expect(applyExclusivePocketDateAdj(cooling, true)).toBe(cooling)
  })
})

describe('the build reads one local read for the price and the page', () => {
  /** Closed Shevlin West sales inside the listing window, the shape getCmaCityClosedDuring returns. */
  const rows: ListingMarketClose[] = [
    ['2026-03-20', 1_500_000, 2600],
    ['2026-04-15', 1_560_000, 2650],
    ['2026-05-10', 1_620_000, 2700],
    ['2026-06-01', 1_540_000, 2560],
    ['2026-07-10', 1_500_000, 2800],
    ['2026-08-20', 1_480_000, 2750],
    ['2026-09-15', 1_450_000, 2700],
  ].map(([closeDate, closePrice, sqft]) => ({
    closeDate: closeDate as string,
    closePrice: closePrice as number,
    concessions: null,
    sqft: sqft as number,
    subdivision: 'Shevlin West',
    lat: 44.0739,
    lng: -121.3717,
    propertySubType: 'Single Family Residence',
  }))
  const window = { city: 'Bend', listDate: '2026-03-06', offDate: '2026-09-30' }
  const closes = { ...window, rows }
  const diagnostics = {
    subject: { subdivision: 'Shevlin West' },
    ladder: [{ tier: 'subdivision-6mo', ran: true, months_back: 6, comps_added: 7 }],
    rural_acreage: false,
    excluded_totals: {},
  } as unknown as CompSelectionDiagnostics
  const comps = SALES.map(sale)

  it('measures the page read through the same function, over the same area, and gates on its verdict', () => {
    const read = localReadForSet({ subject, comps, diagnostics, subjectZone: null, window, closes, asOf: '2026-10-07' })
    const page = measureListingWindowMarket(closes, {
      subdivision: subject.subdivision,
      sqft: subject.sqft,
      latitude: subject.latitude,
      longitude: subject.longitude,
      asOf: '2026-10-07',
      areaKind: 'subdivision',
      areaName: 'Shevlin West',
      propertySubType: subject.propertySubType,
    })
    expect(page).not.toBeNull()
    expect(read.listingMarket).toEqual(page)
    expect(read.pocketLocal).toEqual(pocketLocalReadOf(page))
    expect(read.pocketLocal.verdict).toBe(page!.ppsfMove)
  })

  it('names why there is no read: no window, or a window with nothing in it', () => {
    const none = localReadForSet({
      subject,
      comps,
      diagnostics,
      subjectZone: null,
      window: { city: 'Bend', listDate: '2026-03-06', offDate: null },
      closes: null,
      asOf: '2026-10-07',
    })
    expect(none.listingMarket).toBeNull()
    expect(none.pocketLocal.missing).toBe('no-listing-window')
    const thin = localReadForSet({ subject, comps, diagnostics, subjectZone: null, window, closes: null, asOf: '2026-10-07' })
    expect(thin.pocketLocal.missing).toBe('too-few-sales')
  })
})

describe('an on-market subject has a listing window', () => {
  const diagnostics = {
    subject: { subdivision: 'Shevlin West' },
    ladder: [{ tier: 'subdivision-6mo', ran: true, months_back: 6, comps_added: 7 }],
    rural_acreage: false,
    excluded_totals: {},
  } as unknown as CompSelectionDiagnostics

  it('runs from the active stretch to the letter day, so the no-listing sentence is not the one printed', () => {
    // 3062 NW Kelly Hill is Active. There is no off-market date. The window is
    // the current stretch through the letter day, and the existing local gate
    // is what may move a sale. This does not add a second discount.
    const window = subjectListingWindow({
      city: 'Bend',
      onMarket: true,
      asOf: '2026-10-08',
      listDate: '2026-05-01T22:24:26+00:00',
      activeFrom: '2026-05-01',
      offDate: null,
    })
    expect(window).toEqual({ city: 'Bend', listDate: '2026-05-01', offDate: '2026-10-08' })
    expect(listingWindowDates(window)).toEqual({ city: 'Bend', listDate: '2026-05-01', offDate: '2026-10-08' })
    const read = localReadForSet({
      subject,
      comps: SALES.map(sale),
      diagnostics,
      subjectZone: null,
      window,
      closes: null,
      asOf: '2026-10-08',
    })
    expect(read.pocketLocal.missing).not.toBe('no-listing-window')
    const { comps, pricing } = walk(read.pocketLocal)
    const caption = dateBasisCaption({ subject, comps, pricing }) ?? ''
    expect(caption).not.toContain('no recent listing of your home')
    expect(caption).not.toContain('—')
  })

  it('leaves an off-market subject on the cycle dates, including a null off date', () => {
    expect(
      subjectListingWindow({
        city: 'Bend',
        onMarket: false,
        asOf: '2026-10-08',
        listDate: '2026-03-06',
        activeFrom: '2026-03-06',
        offDate: null,
      }),
    ).toEqual({ city: 'Bend', listDate: '2026-03-06', offDate: null })
    expect(
      subjectListingWindow({
        city: 'Bend',
        onMarket: false,
        asOf: '2026-10-08',
        listDate: '2026-03-06',
        activeFrom: null,
        offDate: '2026-09-30',
      }).offDate,
    ).toBe('2026-09-30')
  })
})

describe('the save fails a pocket letter whose grid moves against its local page', () => {
  it('passes the gated build, fails a move beside held flat, and skips rows built before the gate', () => {
    const held = walk(pocketLocalReadOf(WOODSMAN_LOCAL))
    expect(
      pocketDateFollowsLocalReadCheck({ timeAdjustment: held.basis, comps: held.comps, listingMarket: WOODSMAN_LOCAL }).pass,
    ).toBe(true)
    const fell = localWith(600, 570, 'fell')
    const moved = walk(pocketLocalReadOf(fell))
    expect(pocketDateFollowsLocalReadCheck({ timeAdjustment: moved.basis, comps: moved.comps, listingMarket: fell }).pass).toBe(true)
    // The moved grid printed beside the held-flat page: the Woodsman defect.
    const against = pocketDateFollowsLocalReadCheck({
      timeAdjustment: moved.basis,
      comps: moved.comps,
      listingMarket: WOODSMAN_LOCAL,
    })
    expect(against.pass).toBe(false)
    expect(against.severity).toBe('hard')
    // A row priced before the gate has no localGate and is not graded.
    const legacy = walk(undefined)
    expect(
      pocketDateFollowsLocalReadCheck({ timeAdjustment: legacy.basis, comps: legacy.comps, listingMarket: WOODSMAN_LOCAL }).pass,
    ).toBe(true)
  })
})

describe('rows stored before the gate print as they did', () => {
  it('a pocket row with no localGate keeps the old sentences', () => {
    const { comps } = walk(undefined)
    const legacy = walk(undefined).pricing
    expect(legacy.timeAdjustment?.localGate).toBeUndefined()
    expect(dateBasisCaption({ subject, comps, pricing: legacy })).toContain(
      "Adjusted for date is how much Bend's median price per square foot fell",
    )
    expect(dateBasisCaption({ subject, comps, pricing: legacy })).not.toContain('only because')
  })
})
