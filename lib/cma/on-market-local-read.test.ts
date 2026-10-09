/**
 * A HOME ON THE MARKET READS ITS LOCAL MARKET OVER ITS OWN LISTING (reader
 * review 2026-10-09, 3062 NW Kelly Hill; Matt 2026-10-09: "it's definitely
 * going to be closer to 716. It's listed at 699 currently, and it hasn't
 * sold.").
 *
 * The letter said "No sale is adjusted for date. We move these sales down for
 * date only when homes in Westside Meadows are falling in price, and there is
 * no recent listing of your home to measure that over". The home has been
 * listed since May 1, 2026. The build passed `offDate: cycle.offMarketDate ??
 * null`, and an active listing has no off-market date, so the listing window
 * was null and the rule 15 gate took "no-listing-window".
 *
 * Now (lib/cma/listing-window-load.ts subjectListingWindow) an on-market home
 * reads from the day its current stretch began to the letter date. Kelly
 * Hill's window holds two Westside Meadows sales of its size in the first half
 * and one in the second, one sale a half, no per-foot verdict. And because it
 * is Active, not under contract, with its ask cut from $775,000 to $699,999
 * during that stretch, its own unsold listing stands in for the local read
 * (lib/cma/pocket-pricing.ts ownListingRead): its own-ground sales move down
 * with the Bend index, and the note under the grid says so.
 *
 * Fixtures: render_args.subject and render_args.comps of cma-3062-nw-kelly-hill
 * and its judge tiers (build_summary.judgment.verdicts), read 2026-10-09;
 * pricing_market_index for city_slug 'bend', read 2026-10-09. The dollar
 * figures asserted are what the production functions derive from them; the
 * same walk over the same row printed $744,000 under the old gate, the figure
 * the stored letter carries.
 */
import { describe, expect, it } from 'vitest'
import { adjustCmaCompAlongMarket, priceCmaSet } from '@/lib/pricing/estimate'
import {
  applyExclusivePocketDateAdj,
  missingPocketLocalRead,
  pocketDateBranch,
  pocketLocalAllowsDown,
  type PocketLocalRead,
} from '@/lib/pricing/exclusive-pocket-date-adj'
import type { MarketIndexPoint, MarketPath } from '@/lib/pricing/market-path'
import { listingMarketSentence, type ListingMarketClose } from '@/lib/cma/listing-window-market'
import { listingWindowDates, subjectListingWindow } from '@/lib/cma/listing-window-load'
import { finishExclusivePocketPricing, localReadForSet, ownListingRead } from '@/lib/cma/pocket-pricing'
import { dateBasisCaption, salesMethodSentences, DATE_REASON_UNDER_GRID } from '@/lib/cma/sales-method-note'
import { pocketDateFollowsLocalReadCheck } from '@/lib/cma/letter-consistency'
import { reviewWeightFactor } from '@/lib/cma/review-weight'
import { printedCompGrid } from '@/lib/cma/assemble-competition'
import { applyOnMarketOpinion } from '@/lib/cma/on-market-opinion'
import { attachSellerNet } from '@/lib/pricing/seller-net'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import type { CmaComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

/** pricing_market_index, city_slug = 'bend', read 2026-10-09. */
const BEND: MarketIndexPoint[] = [
  ['2024-10-01', 211, 419.24], ['2024-11-01', 180, 375.305], ['2024-12-01', 155, 409.61],
  ['2025-01-01', 169, 389.11], ['2025-02-01', 140, 379.36], ['2025-03-01', 191, 394.35],
  ['2025-04-01', 209, 418.98], ['2025-05-01', 214, 433.61], ['2025-06-01', 243, 387.93],
  ['2025-07-01', 250, 393.24], ['2025-08-01', 248, 402.925], ['2025-09-01', 260, 391.34],
  ['2025-10-01', 225, 400.25], ['2025-11-01', 195, 395.45], ['2025-12-01', 191, 367.75],
  ['2026-01-01', 142, 389.945], ['2026-02-01', 170, 390.605], ['2026-03-01', 216, 379.465],
  ['2026-04-01', 206, 398.125], ['2026-05-01', 238, 413.3], ['2026-06-01', 291, 414.36],
  ['2026-07-01', 279, 394.03], ['2026-08-01', 243, 384.5], ['2026-09-01', 239, 371.13],
  ['2026-10-01', 47, 425.7],
].map(([month, n, ppsf]) => ({ month: month as string, n: n as number, ppsf: ppsf as number }))

const AS_OF = '2026-10-09'
const LETTER_DAY = '2026-10-08'

/** render_args.subject on cma-3062-nw-kelly-hill (the fields the gate reads). */
const subject = {
  listingKey: '20260430162234807780000000',
  streetAddress: '3062 NW Kelly Hill',
  city: 'Bend',
  subdivision: 'Westside Meadows',
  subdivisionSlug: 'westside-meadows-ii',
  beds: 3,
  baths: 2,
  bathsFull: 2,
  bathsHalf: 0,
  sqft: 1702,
  yearBuilt: 2004,
  lotAcres: 0.15,
  latitude: 44.073973,
  longitude: -121.362518,
  propertySubType: 'Single Family Residence',
  standardStatus: 'Active',
  lastListPrice: 699999,
  originalListPrice: 775000,
  lastListDate: '2026-05-01T22:24:26+00:00',
  stretch: { from: '2026-05-01', firstAsk: 775000, restarted: false },
} as unknown as CmaSubject

/** render_args.comps on cma-3062-nw-kelly-hill, the facts each sale was priced on. */
const SALES = [
  { key: '20260427230905476201000000', address: '2955 Bordeaux', lat: 44.070463, lng: -121.361933, lot: 0.16, bathsFull: 2, bathsHalf: 0, dom: 30, closeDate: '2026-05-29', close: 800_000, concessions: 1000, sqft: 1750, beds: 3, baths: 2, yb: 2004, tier: 'subdivision-6mo', own: true, sub: 'Westside Meadows' },
  { key: '20260206003214604543000000', address: '2500 Summerhill', lat: 44.072295, lng: -121.361609, lot: 0.15, bathsFull: 2, bathsHalf: 1, dom: 91, closeDate: '2026-05-13', close: 717_000, concessions: 15_000, sqft: 2080, beds: 4, baths: 3, yb: 2003, tier: 'subdivision-6mo', own: true, sub: 'Westside Meadows' },
  { key: '20251203210810101582000000', address: '62667 McClain', lat: 44.075012, lng: -121.366245, lot: 0.09, bathsFull: 2, bathsHalf: 1, dom: 64, closeDate: '2026-02-06', close: 899_000, concessions: 310, sqft: 2010, beds: 3, baths: 3, yb: 2022, tier: 'pocket-9mo', own: false, sub: 'Skyline West' },
  { key: '20250812230710647168000000', address: '2974 Chardonnay', lat: 44.07304, lng: -121.362825, lot: 0.16, bathsFull: 2, bathsHalf: 0, dom: 104, closeDate: '2025-11-26', close: 735_000, concessions: 0, sqft: 1920, beds: 4, baths: 2, yb: 2002, tier: 'subdivision-12mo', own: true, sub: 'Westside Meadows' },
  { key: '20241106174956331783000000', address: '3080 Kelly Hill', lat: 44.074231, lng: -121.362659, lot: 0.15, bathsFull: 2, bathsHalf: 1, dom: 56, closeDate: '2025-01-03', close: 788_000, concessions: 0, sqft: 1960, beds: 3, baths: 3, yb: 2004, tier: 'subdivision-24mo', own: true, sub: 'Westside Meadows' },
]

/** build_summary.judgment.verdicts tiers. */
const VERDICTS = [
  { listingKey: SALES[0]!.key, tier: 'strong' },
  { listingKey: SALES[1]!.key, tier: 'weak' },
  { listingKey: SALES[2]!.key, tier: 'weak' },
  { listingKey: SALES[3]!.key, tier: 'weak' },
  { listingKey: SALES[4]!.key, tier: 'weak' },
]

const comps: CmaComp[] = SALES.map(
  (s) =>
    ({
      listingKey: s.key,
      address: s.address,
      city: 'Bend',
      subdivision: s.sub,
      beds: s.beds,
      baths: s.baths,
      sqft: s.sqft,
      bathsFull: s.bathsFull,
      bathsHalf: s.bathsHalf,
      yearBuilt: s.yb,
      lotAcres: s.lot,
      latitude: s.lat,
      longitude: s.lng,
      domTotal: s.dom,
      closePrice: s.close,
      closeDate: s.closeDate,
      concessions: s.concessions,
      concessionsAmount: s.concessions,
      selectionTier: s.tier,
      ownPlat: s.own,
      propertySubType: 'Single Family Residence',
    }) as unknown as CmaComp,
)

const diagnostics = {
  subject: { subdivision: 'Westside Meadows' },
  ladder: [
    { tier: 'subdivision-6mo', ran: true, months_back: 6, comps_added: 2 },
    { tier: 'subdivision-12mo', ran: true, months_back: 12, comps_added: 1 },
    { tier: 'subdivision-24mo', ran: true, months_back: 24, comps_added: 1 },
    { tier: 'pocket-9mo', ran: true, months_back: 9, comps_added: 1 },
  ],
  rural_acreage: false,
  excluded_totals: {},
} as unknown as CompSelectionDiagnostics

/** Closed Westside Meadows sales of Kelly Hill's size inside May 1 to Oct 8: two, then one. */
const closeRow = (closeDate: string, closePrice: number, sqft: number): ListingMarketClose => ({
  closeDate,
  closePrice,
  concessions: null,
  sqft,
  subdivision: 'Westside Meadows',
  lat: 44.074,
  lng: -121.3625,
  propertySubType: 'Single Family Residence',
})
const WINDOW_ROWS = [closeRow('2026-05-13', 717_000, 2080), closeRow('2026-05-29', 800_000, 1750), closeRow('2026-08-20', 800_000, 2091)]

function walk(local: PocketLocalRead) {
  const adj = comps
    .map(
      (c) =>
        adjustCmaCompAlongMarket({
          subject,
          subjectStory: 'unknown',
          comp: c,
          saleStory: 'unknown',
          points: BEND,
          asOf: AS_OF,
          exclusivePocket: true,
          pocketLocal: local,
        }).adjusted,
    )
    .map((c) => {
      const f = reviewWeightFactor(VERDICTS.find((v) => v.listingKey === c.listingKey)?.tier)
      return f < 1 ? { ...c, weight: +(c.weight * f).toFixed(4) } : c
    })
  const p = priceCmaSet({
    subject,
    adjusted: adj,
    market: null,
    input: {},
    selection: { pricingSales: [], tiersUsed: ['subdivision-6mo', 'subdivision-12mo', 'subdivision-24mo', 'pocket-9mo'] },
    marketIndex: BEND,
    asOf: AS_OF,
    holdFailedAskUnderSaleSet: true,
    pocketLocal: local,
  }) as CmaPricing
  attachSellerNet(p, comps)
  finishExclusivePocketPricing(p, { subject, adj, set: comps, pocketLocal: local })
  const grid = printedCompGrid(adj, VERDICTS)
  const opinion = applyOnMarketOpinion(p, grid, { onMarket: true })
  return { adj, grid, pricing: opinion.pricing, opinion: opinion.opinion }
}

describe('the window: an on-market home reads from its stretch start to the letter date', () => {
  it('Kelly Hill reads May 1 to the letter date, not no window at all', () => {
    const w = subjectListingWindow({ subject, finalCycle: null, letterDay: LETTER_DAY })
    expect(w).toEqual({ city: 'Bend', listDate: '2026-05-01', offDate: LETTER_DAY, ongoing: true })
    expect(listingWindowDates(w)).toEqual({ listDate: '2026-05-01', offDate: LETTER_DAY, city: 'Bend' })
  })

  it('a home with no stretch read starts on its last list day, as a Pacific day', () => {
    // 2026-05-02T02:30Z is 7:30 PM on May 1 in Bend.
    const s = { ...subject, stretch: null, lastListDate: '2026-05-02T02:30:00+00:00' } as unknown as CmaSubject
    expect(subjectListingWindow({ subject: s, finalCycle: null, letterDay: LETTER_DAY }).listDate).toBe('2026-05-01')
  })

  it('a failed listing keeps its final cycle, and a home off the market with no cycle keeps no window', () => {
    const expired = { ...subject, standardStatus: 'Expired' } as unknown as CmaSubject
    expect(
      subjectListingWindow({ subject: expired, finalCycle: { listDate: '2026-03-06', offMarketDate: '2026-09-30' }, letterDay: LETTER_DAY }),
    ).toEqual({ city: 'Bend', listDate: '2026-03-06', offDate: '2026-09-30', ongoing: false })
    const closed = { ...subject, standardStatus: 'Closed' } as unknown as CmaSubject
    const w = subjectListingWindow({ subject: closed, finalCycle: null, letterDay: LETTER_DAY })
    expect(w.ongoing).toBe(false)
    expect(listingWindowDates(w)).toBeNull()
  })
})

describe('the own listing stands in only for an Active home whose ask came down', () => {
  it('Kelly Hill: May 1, $775,000 to $699,999, 160 days', () => {
    expect(ownListingRead(subject, LETTER_DAY)).toEqual({ since: '2026-05-01', firstAsk: 775_000, ask: 699_999, days: 160 })
  })

  it('no cut, under contract, or no first ask: no stand-in', () => {
    expect(ownListingRead({ ...subject, lastListPrice: 775_000 } as CmaSubject, LETTER_DAY)).toBeNull()
    expect(ownListingRead({ ...subject, standardStatus: 'Pending' } as CmaSubject, LETTER_DAY)).toBeNull()
    expect(ownListingRead({ ...subject, standardStatus: 'Active Under Contract' } as CmaSubject, LETTER_DAY)).toBeNull()
    expect(ownListingRead({ ...subject, standardStatus: 'Expired' } as CmaSubject, LETTER_DAY)).toBeNull()
    // A stretch that came back with no recorded opening ask has nothing to compare.
    expect(
      ownListingRead({ ...subject, stretch: { from: '2026-05-01', firstAsk: null, restarted: true } } as unknown as CmaSubject, LETTER_DAY),
    ).toBeNull()
  })
})

describe('3062 NW Kelly Hill: one sale a half, so the unsold listing is the local read', () => {
  const window = subjectListingWindow({ subject, finalCycle: null, letterDay: LETTER_DAY })
  const closes = { listDate: '2026-05-01', offDate: LETTER_DAY, city: 'Bend', rows: WINDOW_ROWS, ongoing: true }
  const read = localReadForSet({ subject, comps, diagnostics, subjectZone: null, window, closes, asOf: LETTER_DAY })

  it('reads Westside Meadows over May 1 to Oct 8: two sales then one, no per-foot verdict', () => {
    expect(read.listingMarket).toMatchObject({ place: 'Westside Meadows', grain: 'subdivision', ongoing: true })
    expect(read.listingMarket!.early.n).toBe(2)
    expect(read.listingMarket!.late.n).toBe(1)
    expect(listingMarketSentence(read.listingMarket!)).toMatch(/^Since your home came on the market, /)
    expect(read.pocketLocal).toMatchObject({
      verdict: null,
      missing: 'one-sale-a-half',
      ongoing: true,
      ownListing: { since: '2026-05-01', firstAsk: 775_000, ask: 699_999, days: 160 },
    })
    expect(pocketDateBranch(read.pocketLocal)).toBe('own-listing-unsold')
    expect(pocketLocalAllowsDown(read.pocketLocal)).toBe(true)
  })

  const { adj, grid, pricing, opinion } = walk(read.pocketLocal)

  it('moves each sale down with the Bend index (Matt 2026-10-09: "closer to 716")', () => {
    expect(adj.map((c) => [c.address, c.timeAdjustment])).toEqual([
      ['2955 Bordeaux', -55_690],
      ['2500 Summerhill', -48_929],
      ['62667 McClain', -12_582],
      ['2974 Chardonnay', -20_359],
      ['3080 Kelly Hill', -9_298],
    ])
    expect(adj.every((c) => c.timeAdjustment <= 0)).toBe(true)
  })

  it('prices the opinion of value off those sales: $713,621 weighted, $714,000 on the cover, not $744,000', () => {
    expect(pricing.reconciliation?.weightedPrice).toBe(713_621)
    expect(opinion?.value).toBe(714_000)
    expect(pricing.recommended).toBe(714_000)
    // The same walk under the old gate is the stored letter: $744,000.
    const old = walk(missingPocketLocalRead('no-listing-window'))
    expect(old.adj.every((c) => c.timeAdjustment === 0)).toBe(true)
    expect(old.pricing.reconciliation?.weightedPrice).toBe(743_974)
    expect(old.opinion?.value).toBe(744_000)
  })

  it('records the branch and the listing on the stored basis', () => {
    expect(pricing.timeAdjustment?.localGate).toMatchObject({
      branch: 'own-listing-unsold',
      moved: true,
      ongoing: true,
      ownListing: { since: '2026-05-01', firstAsk: 775_000, ask: 699_999 },
    })
    expect(pricing.timeAdjustment?.sentence).toContain('The home has been on the market since 2026-05-01, 160 days')
    expect(pricing.timeAdjustment?.sentence).not.toContain('The local read fell')
  })

  it('says so under the grid, truthfully, and never "no recent listing"', () => {
    const caption = dateBasisCaption({ subject, comps: grid, pricing }) ?? ''
    expect(caption).toContain(
      'Too few homes like yours in Westside Meadows sold since your home came on the market to tell which way prices went there. Your home has been listed since May 1, 2026 and has not sold, and its asking price came down from $775,000 to $699,999, so these sales move down with Bend\'s figure.',
    )
    expect(caption).not.toMatch(/no recent listing|while your home was listed|—/)
    const method = salesMethodSentences({ subject, comps: grid, pricing }).join(' ')
    expect(method).toContain(DATE_REASON_UNDER_GRID)
  })

  it('passes the save check: the page prints no trend and the gate recorded the listing', () => {
    expect(
      pocketDateFollowsLocalReadCheck({ timeAdjustment: pricing.timeAdjustment, comps: grid, listingMarket: read.listingMarket }).pass,
    ).toBe(true)
  })
})

describe('rule 15 is unchanged where a local read exists', () => {
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
  const own = { since: '2026-05-01', firstAsk: 775_000, ask: 699_999, days: 160 }

  it('a per-foot verdict wins over the listing: held flat or rose moves nothing', () => {
    for (const verdict of ['held flat', 'rose'] as const) {
      expect(applyExclusivePocketDateAdj(cooling, true, { verdict, ownListing: own }).factor).toBe(1)
    }
    expect(applyExclusivePocketDateAdj(cooling, true, { verdict: null, ownListing: own })).toBe(cooling)
    expect(applyExclusivePocketDateAdj(cooling, true, { verdict: null, ownListing: null }).factor).toBe(1)
  })

  it('a failed listing never gets the stand-in, even with too few sales', () => {
    const expired = { ...subject, standardStatus: 'Expired' } as unknown as CmaSubject
    const window = { city: 'Bend', listDate: '2026-05-01', offDate: '2026-09-30' }
    const r = localReadForSet({ subject: expired, comps, diagnostics, subjectZone: null, window, closes: null, asOf: LETTER_DAY })
    expect(r.pocketLocal.missing).toBe('too-few-sales')
    expect(r.pocketLocal.ownListing).toBeUndefined()
    expect(r.pocketLocal.ongoing).toBeUndefined()
  })

  it('an on-market home whose window held no closes at all says too few sold, never no listing', () => {
    const window = subjectListingWindow({ subject: { ...subject, lastListPrice: 775_000 } as CmaSubject, finalCycle: null, letterDay: LETTER_DAY })
    const r = localReadForSet({ subject: { ...subject, lastListPrice: 775_000 } as CmaSubject, comps, diagnostics, subjectZone: null, window, closes: null, asOf: LETTER_DAY })
    expect(r.pocketLocal).toMatchObject({ verdict: null, missing: 'too-few-sales', ongoing: true })
    expect(r.pocketLocal.ownListing).toBeUndefined()
    const { grid, pricing } = walk(r.pocketLocal)
    expect(dateBasisCaption({ subject, comps: grid, pricing })).toBe(
      'No sale is adjusted for date. We move these sales down for date only when homes in Westside Meadows fell in price since your home came on the market, and too few of them sold then to tell, so each sale stands at its sold price.',
    )
  })
})
