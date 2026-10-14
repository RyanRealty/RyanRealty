import { describe, expect, it } from 'vitest'
import {
  chooseListingMarket,
  listingMarketMoveWord,
  listingMarketPriceLedMixShift,
  listingMarketSentence,
  listingMarketSizeMix,
  listingMarketSource,
  pocketLocalReadOf,
  withSqftMedian,
  type ListingMarketClose,
  type ListingMarketMove,
} from '@/lib/cma/listing-window-market'
import { applyExclusivePocketDateAdj } from '@/lib/pricing/exclusive-pocket-date-adj'
import type { MarketPath } from '@/lib/pricing/market-path'
import { listingMarketSlopesPhoneSvg, listingMarketSlopesSvg } from '@/lib/cma/market-charts'
import { listingMarketSlopes } from '@/lib/cma/listing-window-market'
import { whatHappenedGraphicHtml, whatHappenedPage, type OpinionPageArgs } from '@/lib/cma/opinion-pages'

const OLD_FARM = { lat: 44.019176, lng: -121.298609 }

function close(over: Partial<ListingMarketClose> & Pick<ListingMarketClose, 'closeDate' | 'closePrice'>): ListingMarketClose {
  return {
    sqft: 2468,
    subdivision: 'Somewhere Else',
    lat: OLD_FARM.lat,
    lng: OLD_FARM.lng,
    ...over,
  }
}

function repeat(n: number, row: ListingMarketClose): ListingMarketClose[] {
  return Array.from({ length: n }, () => row)
}

function textOutsideViewBox(svg: string): string[] {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  if (!vb) return ['no viewBox']
  const W = Number(vb[1])
  const H = Number(vb[2])
  const bad: string[] = []
  for (const m of svg.matchAll(
    /<text[^>]*\bx="([-\d.]+)"[^>]*\by="([-\d.]+)"[^>]*?(?:text-anchor="(start|middle|end)")?[^>]*>([\s\S]*?)<\/text>/g,
  )) {
    const x = Number(m[1])
    const y = Number(m[2])
    if (x < 0 || x > W || y < 0 || y > H) bad.push(`${m[4]} at ${x},${y}`)
  }
  return bad
}

describe('listing window market', () => {
  it('calls a move under 3 percent flat, and names the direction past it', () => {
    expect(listingMarketMoveWord(100000, 102900)).toBe('held flat')
    expect(listingMarketMoveWord(100000, 103100)).toBe('rose')
    expect(listingMarketMoveWord(100000, 96900)).toBe('fell')
  })

  it('puts a close on the midpoint day in the second half', () => {
    const rows = [
      ...repeat(8, close({ closeDate: '2026-04-01', closePrice: 100000 })),
      ...repeat(7, close({ closeDate: '2026-08-01', closePrice: 200000 })),
      close({ closeDate: '2026-06-13', closePrice: 200000 }),
    ]
    const move = chooseListingMarket({
      listDate: '2026-03-06',
      offDate: '2026-09-21',
      subjectSqft: null,
      subdivision: 'Somewhere Else',
      neighborhoodSlug: 'bend-old-farm-district',
      neighborhoodName: 'Old Farm District',
      city: 'Bend',
      rows,
    })
    expect(move).not.toBeNull()
    expect(move!.early.to).toBe('2026-06-12')
    expect(move!.late.from).toBe('2026-06-13')
    expect(move!.early.n).toBe(8)
    expect(move!.late.n).toBe(8)
    expect(move!.grain).toBe('subdivision')
  })

  it('stays on a subdivision even when the only readable set mixes sizes', () => {
    const tiny = { sqft: 1000, subdivision: 'Countryside Phase 2' as string | null }
    const like = { sqft: 2468, subdivision: 'Other Plat' as string | null }
    const rows = [
      ...repeat(10, close({ ...tiny, closeDate: '2026-04-01', closePrice: 400000 })),
      ...repeat(10, close({ ...tiny, closeDate: '2026-08-01', closePrice: 250000 })),
      ...repeat(8, close({ ...like, closeDate: '2026-04-01', closePrice: 726425, sqft: 2242 })),
      ...repeat(8, close({ ...like, closeDate: '2026-08-01', closePrice: 779950, sqft: 2483 })),
    ]
    const move = chooseListingMarket({
      listDate: '2026-03-06',
      offDate: '2026-09-21',
      subjectSqft: 2468,
      subdivision: 'Countryside Phase 2',
      neighborhoodSlug: 'bend-old-farm-district',
      neighborhoodName: 'Old Farm District',
      city: 'Bend',
      rows,
    })
    expect(move).not.toBeNull()
    expect(move!.place).toBe('Countryside Phase 2')
    expect(move!.grain).toBe('subdivision')
    expect(move!.place).not.toBe('Old Farm District')
  })

  it('uses the city when the subdivision and the neighborhood are too thin', () => {
    const rows = repeat(8, close({ closeDate: '2026-04-01', closePrice: 500000, lat: 0, lng: 0, subdivision: 'Far' })).concat(
      repeat(8, close({ closeDate: '2026-08-01', closePrice: 500000, lat: 0, lng: 0, subdivision: 'Far' })),
    )
    const move = chooseListingMarket({
      listDate: '2026-03-06',
      offDate: '2026-09-21',
      subjectSqft: null,
      subdivision: 'Countryside Phase 2',
      neighborhoodSlug: 'bend-old-farm-district',
      neighborhoodName: 'Old Farm District',
      city: 'Bend',
      rows,
    })
    expect(move).toBeNull()
  })

  it('draws the subdivision from one close and then three, and does not step up to a parent or the city', () => {
    const rows = [
      close({
        closeDate: '2026-06-10',
        closePrice: 732000,
        sqft: 2018,
        subdivision: 'Copperstone',
        propertySubType: 'Townhouse',
      }),
      close({
        closeDate: '2026-07-14',
        closePrice: 699000,
        sqft: 2275,
        subdivision: 'Copperstone',
        propertySubType: 'Townhouse',
      }),
      close({
        closeDate: '2026-08-05',
        closePrice: 670000,
        sqft: 2386,
        subdivision: 'Copperstone',
        propertySubType: 'Townhouse',
      }),
      close({
        closeDate: '2026-09-23',
        closePrice: 600000,
        sqft: 2275,
        subdivision: 'Copperstone',
        propertySubType: 'Townhouse',
      }),
    ]
    const move = chooseListingMarket({
      listDate: '2026-03-27',
      offDate: '2026-09-30',
      subjectSqft: 2275,
      subdivision: 'Copperstone',
      neighborhoodSlug: 'awbrey-butte',
      neighborhoodName: 'Awbrey Butte',
      city: 'Bend',
      rows,
      propertySubType: 'Townhouse',
    })
    expect(move).not.toBeNull()
    expect(move!.place).toBe('Copperstone')
    expect(move!.grain).toBe('subdivision')
    expect(move!.early.n).toBe(1)
    expect(move!.late.n).toBe(3)
    expect(move!.sized).toBe(true)
    const told = { ...move!, productNoun: 'townhouse' }
    // One sale in the first half is that home's price, not a median.
    expect(listingMarketSentence(told)).toContain('the one townhouse sale in Copperstone')
    expect(listingMarketSentence(told)).toContain('the median of the 3 in the second half')
    expect(listingMarketSentence(told)).not.toMatch(/\b(rose|fell)\b/)
    expect(listingMarketSource(told)).toContain('Townhouses in Copperstone')
    expect(listingMarketSource(told)).toMatch(/^1 closed sale [A-Z]/)
    expect(listingMarketSource(told)).not.toMatch(/single-family/i)
    expect(listingMarketSentence(move!)).toContain('the one sale in Copperstone')
  })

  it('does not draw a neighborhood from one close and then three', () => {
    const move = chooseListingMarket({
      listDate: '2026-03-06',
      offDate: '2026-09-21',
      subjectSqft: null,
      subdivision: null,
      areaKind: 'neighborhood',
      neighborhoodSlug: 'bend-old-farm-district',
      neighborhoodName: 'Old Farm District',
      city: 'Bend',
      rows: [
        close({ closeDate: '2026-04-01', closePrice: 700000, subdivision: 'Other' }),
        ...repeat(3, close({ closeDate: '2026-08-01', closePrice: 710000, subdivision: 'Other' })),
      ],
    })
    expect(move).toBeNull()
  })
})

describe('one sale a half (3037 Purcell, Silver Sage, 2026-10-07)', () => {
  // The letter said "the median sale in Silver Sage rose from $503,000 to
  // $559,000" over one sale in each half. One sale has no median and no trend.
  // The two prices are the letter's; the dates and the first sale's size are illustrative.
  const one: ListingMarketMove = {
    place: 'Silver Sage',
    grain: 'subdivision',
    sized: true,
    sqftLow: 1200,
    sqftHigh: 2000,
    early: { median: 503000, ppsf: 323, sqftMedian: 1558, n: 1, from: '2026-05-01', to: '2026-07-17' },
    late: { median: 559000, ppsf: 359, sqftMedian: 1558, n: 1, from: '2026-07-18', to: '2026-10-05' },
    priceMove: 'rose',
    ppsfMove: 'rose',
  }

  it('names the one sale and its price, with no median and no rise', () => {
    const s = listingMarketSentence(one)
    expect(s).toBe(
      "While your home was listed, the one sale in Silver Sage for a home about this size in the first half of the listing closed at $503,000, and the one in the second half closed at $559,000. Per square foot, that is $323, then $359. One sale is one home's price, not a trend.",
    )
    expect(s).not.toMatch(/median|rose|fell/)
    expect(s).not.toContain('\u2014')
  })

  it('counts one closed sale in the singular', () => {
    expect(listingMarketSource(one)).toMatch(/^1 closed sale May 1–Jul 17, then 1 from /)
    expect(listingMarketSource({ ...one, early: { ...one.early, n: 2 } })).toMatch(/^2 closed sales /)
  })

  it('keeps the median wording when both halves hold two or more', () => {
    const two = { ...one, early: { ...one.early, n: 2 }, late: { ...one.late, n: 3 } }
    expect(listingMarketSentence(two)).toContain('the median sale in Silver Sage for a home about this size rose from $503,000 to $559,000')
  })

  it('names a single later sale beside an earlier median', () => {
    const s = listingMarketSentence({ ...one, early: { ...one.early, n: 4 } })
    expect(s).toContain('the median of the 4 sales in Silver Sage for a home about this size in the first half of the listing was $503,000')
    expect(s).toContain('the one in the second half closed at $559,000')
  })

  it('fits the phone chart with the longer caption', () => {
    const svg = listingMarketSlopesPhoneSvg({ ...listingMarketSlopes(one), caption: listingMarketSentence(one) })
    expect(textOutsideViewBox(svg)).toEqual([])
  })

  it('prints no rise or fall on the chart over one sale a half', () => {
    const drawn = { ...listingMarketSlopes(one), caption: listingMarketSentence(one) }
    expect(drawn.panels.every((p) => p.label === 'one sale, not a trend')).toBe(true)
    const svg = listingMarketSlopesSvg(drawn)
    expect(svg).toContain('one sale, not a trend')
    expect(svg).not.toMatch(/>(rose|fell)</)
    const many = listingMarketSlopes({ ...one, early: { ...one.early, n: 2 }, late: { ...one.late, n: 2 } })
    expect(many.panels.every((p) => p.label === undefined)).toBe(true)
  })
})

describe('the market slopes', () => {
  const move = chooseListingMarket({
    listDate: '2026-03-06',
    offDate: '2026-09-21',
    subjectSqft: 2468,
    subdivision: null,
    areaKind: 'neighborhood',
    neighborhoodSlug: 'bend-old-farm-district',
    neighborhoodName: 'Old Farm District',
    city: 'Bend',
    rows: [
      ...repeat(8, close({ closeDate: '2026-04-01', closePrice: 726425, sqft: 2242, subdivision: 'Other' })),
      ...repeat(8, close({ closeDate: '2026-08-01', closePrice: 779950, sqft: 2483, subdivision: 'Other' })),
    ],
  })!

  it('leads with the per-foot fall and does not call the larger homes a rise', () => {
    // 2,242 sqft then 2,483 sqft is about 11 percent larger. The dollar median
    // rose and the rate per foot fell. That dollar rise is the size, not the market.
    expect(listingMarketSizeMix(move)).toBe(true)
    const sentence = listingMarketSentence(move)
    expect(sentence).toContain('the price per square foot in Old Farm District for a home about this size fell from $324 to $314')
    expect(sentence).toContain('The later homes were larger.')
    expect(sentence).toContain('The median sale was $726,425, then $779,950.')
    expect(sentence).not.toContain('rose from $726,425')
    expect(listingMarketPriceLedMixShift(move)).toBeNull()
    const slopes = listingMarketSlopes(move)
    expect(slopes.panels.map((p) => p.title)).toEqual(['Price per square foot', 'Sale price'])
    expect(slopes.panels[1]!.label).toBe('different sizes')
    const svg = listingMarketSlopesSvg({ ...slopes, caption: sentence })
    expect(svg).toContain('Old Farm District, a home about this size')
    expect(svg).toContain('$726,425')
    expect(svg).toContain('$779,950')
    expect(svg).toContain('$324')
    expect(svg).toContain('$314')
    expect(svg).toContain('>fell<')
    expect(svg).toContain('>different sizes<')
    expect(svg).not.toMatch(/>(rose|held flat)</)
    expect(svg).toContain('2,242 sqft')
    expect(svg).toContain('2,483 sqft')
    expect(svg.match(/Mar 6–Jun 12/g)).toHaveLength(1)
    expect(svg).not.toContain('<rect')
    const footY = Number(/y="([\d.]+)"[^>]*>\$324</.exec(svg)?.[1])
    const firstCircles = [...svg.matchAll(/<circle[^>]*\bcy="([\d.]+)"/g)].slice(0, 2).map((m) => Number(m[1]))
    expect(footY).toBeLessThan(Math.min(...firstCircles))
    // The per-foot slope falls: the left point sits above the right one.
    expect(firstCircles[0]).toBeLessThan(firstCircles[1]!)
    expect(svg).toContain('#A8452B')
    const fell = svg.indexOf('>fell<')
    const sizes = svg.indexOf('>different sizes<')
    expect(svg.slice(0, fell)).toContain('#A8452B')
    expect(svg.slice(sizes)).not.toContain('#A8452B')
  })

  it('fits a phone with nothing outside the viewBox', () => {
    const svg = listingMarketSlopesPhoneSvg({ ...listingMarketSlopes(move), caption: listingMarketSentence(move) })
    expect(svg).toContain('viewBox="0 0 360')
    expect(textOutsideViewBox(svg)).toEqual([])
  })

  it('draws a flat pair on one horizontal line', () => {
    const flat = chooseListingMarket({
      listDate: '2026-03-06',
      offDate: '2026-09-21',
      subjectSqft: null,
      subdivision: 'Somewhere Else',
      neighborhoodSlug: null,
      neighborhoodName: null,
      city: 'Bend',
      rows: [
        ...repeat(8, close({ closeDate: '2026-04-01', closePrice: 500000 })),
        ...repeat(8, close({ closeDate: '2026-08-01', closePrice: 510000 })),
      ],
    })!
    const svg = listingMarketSlopesSvg({ ...listingMarketSlopes(flat), caption: 'flat' })
    const ys = [...svg.matchAll(/<circle[^>]*\bcy="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(ys.length).toBeGreaterThanOrEqual(2)
    expect(ys[0]).toBe(ys[1])
    expect(svg).toContain('held flat')
    expect(svg).not.toContain('#A8452B')
  })

  it('keeps the signed dollars and attaches the size only when the halves still match', () => {
    const stored = {
      ...move,
      early: { ...move.early, sqftMedian: null },
      late: { ...move.late, sqftMedian: null },
    } satisfies ListingMarketMove
    expect(withSqftMedian(stored, move).early.sqftMedian).toBe(2242)
    expect(withSqftMedian(stored, move).late.sqftMedian).toBe(2483)
    expect(withSqftMedian(stored, move).early.median).toBe(stored.early.median)
    const drifted = { ...move, late: { ...move.late, median: move.late.median + 1000 } }
    expect(withSqftMedian(stored, drifted).early.sqftMedian).toBeNull()
  })
})

describe('chapter one keeps the market and does not print the regional tiles', () => {
  const base = {
    subject: {
      streetAddress: '20506 Murphy',
      city: 'Bend',
      standardStatus: 'Canceled',
      lastListPrice: 729000,
      lastListDate: '2026-03-06',
      subdivision: 'Countryside Phase 2',
      sqft: 2468,
      latitude: OLD_FARM.lat,
      longitude: OLD_FARM.lng,
    },
    pricing: { valueLow: 693000, valueHigh: 735000 },
    market: { medianDom: 25 },
    expiredAudit: {
      findings: [{ lens: 'pricing', fact: 'Sat 199 days.', meaning: '' }],
      finalCycle: {
        listDate: '2026-03-06',
        initialAsk: 769000,
        cuts: [{ date: '2026-05-02', ask: 729000 }],
        offMarketDate: '2026-09-21',
        status: 'Canceled',
        days: 199,
      },
    },
    generatedAtIso: '2026-09-22T00:00:00.000Z',
  } as unknown as OpinionPageArgs

  const move = chooseListingMarket({
    listDate: '2026-03-06',
    offDate: '2026-09-21',
    subjectSqft: 2468,
    subdivision: null,
    areaKind: 'neighborhood',
    neighborhoodSlug: 'bend-old-farm-district',
    neighborhoodName: 'Old Farm District',
    city: 'Bend',
    rows: [
      ...repeat(8, close({ closeDate: '2026-04-01', closePrice: 726425, sqft: 2242, subdivision: 'Other' })),
      ...repeat(8, close({ closeDate: '2026-08-01', closePrice: 779950, sqft: 2483, subdivision: 'Other' })),
    ],
  })!

  it('prints the market sentence under the ask, and does not print the regional tiles', () => {
    const page = whatHappenedPage({ ...base, listingMarket: move })
    expect(page?.body).toContain('fell from $324 to $314')
    expect(page?.body).toContain('The later homes were larger.')
    expect(page?.body).toContain('The median sale was $726,425, then $779,950.')
    expect(page?.body).not.toContain('rose from $726,425')
    expect(page?.body).toContain('>different sizes<')
    expect(page?.body).not.toContain('3,394')
    expect(page?.body).not.toContain('94.2%')
    expect(page?.body).not.toContain('12.3%')
    const graphic = whatHappenedGraphicHtml(base)
    expect(graphic).not.toContain('While your home was listed')
  })
})

describe('the rate per foot is net of recorded concessions, like the table (reader review 2026-10-08)', () => {
  // The table's Sold $/sqft row is the sale price less any recorded seller
  // concession over living area; the chart printed the gross rate beside it.
  const rows = [
    ...repeat(8, close({ closeDate: '2026-04-01', closePrice: 500000, sqft: 2000, concessions: 10000 })),
    ...repeat(8, close({ closeDate: '2026-08-01', closePrice: 500000, sqft: 2000, concessions: null })),
  ]
  const move = chooseListingMarket({
    listDate: '2026-03-06',
    offDate: '2026-09-21',
    subjectSqft: null,
    subdivision: 'Somewhere Else',
    neighborhoodSlug: 'bend-old-farm-district',
    neighborhoodName: 'Old Farm District',
    city: 'Bend',
    rows,
  })

  it('takes the concession off the rate per foot and leaves the sale price gross', () => {
    expect(move).not.toBeNull()
    expect(move!.early.median).toBe(500000)
    expect(move!.early.ppsf).toBe(245)
    expect(move!.late.ppsf).toBe(250)
    expect(move!.ppsfNet).toBe(true)
  })

  it('says so on the source line, and prints the measured day the way the letter writes a date', () => {
    const source = listingMarketSource({ ...move!, asOf: '2026-10-07' })
    expect(source).toContain('Per square foot is the sale price less any recorded seller concession, over living area.')
    expect(source).toContain('Measured October 7, 2026.')
    expect(source).not.toContain('2026-10-07')
    expect(source).not.toMatch(/Measured \d{4}-\d{2}-\d{2}/)
  })

  it('claims nothing about concessions on a row measured before this (stored figures are gross)', () => {
    const stored: ListingMarketMove = {
      place: 'Silver Sage',
      grain: 'subdivision',
      sized: false,
      sqftLow: null,
      sqftHigh: null,
      early: { median: 503000, ppsf: 323, n: 2, from: '2026-05-01', to: '2026-07-17' },
      late: { median: 559000, ppsf: 359, n: 3, from: '2026-07-18', to: '2026-10-05' },
      priceMove: 'rose',
      ppsfMove: 'rose',
      asOf: '2026-10-08',
    }
    const source = listingMarketSource(stored)
    expect(source).not.toContain('concession')
    expect(source).toContain('Measured October 8, 2026.')
  })
})

/**
 * render_args.listingMarket on cma-2902-pinnacle, as stored 2026-09-30.
 * Mountain View, a home about this size. The later homes are 12 percent
 * smaller, the median sale went from $585,000 to $550,000, and the rate
 * went from $335 to $357 a square foot. The dollar drop is the size mix.
 */
const PINNACLE: ListingMarketMove = {
  place: 'Mountain View',
  grain: 'neighborhood',
  sized: true,
  sqftLow: 1188,
  sqftHigh: 1980,
  early: { from: '2026-05-12', to: '2026-06-25', n: 13, median: 585000, ppsf: 335, sqftMedian: 1727 },
  late: { from: '2026-06-26', to: '2026-08-10', n: 9, median: 550000, ppsf: 357, sqftMedian: 1518 },
  priceMove: 'fell',
  ppsfMove: 'rose',
  ppsfNet: true,
  asOf: '2026-09-30',
}

const COOLING: MarketPath = {
  factor: 0.93,
  fromPpsf: 335,
  toPpsf: 311,
  monthlyRate: -0.01,
  months: 3,
  regime: 'falling',
  capped: false,
  source: 'index',
  referenceMonths: ['2026-05-01', '2026-06-01', '2026-07-01'],
  reversedWithinSpan: false,
}

describe('size mix is not a market move (2902 Pinnacle, 2026-10-09)', () => {
  it('leads with the per-foot rise and does not call the smaller homes a fall', () => {
    expect(listingMarketSizeMix(PINNACLE)).toBe(true)
    const s = listingMarketSentence(PINNACLE)
    expect(s).toBe(
      'While your home was listed, the price per square foot in Mountain View for a home about this size rose from $335 to $357. The later homes were smaller. The median one was 1,518 square feet, and the earlier median was 1,727. The median sale was $585,000, then $550,000.',
    )
    expect(s).not.toMatch(/\bfell\b/)
    expect(listingMarketPriceLedMixShift(PINNACLE)).toBeNull()
  })

  it('draws the per-foot rise first and labels the sale price as different sizes', () => {
    const slopes = listingMarketSlopes(PINNACLE)
    expect(slopes.kicker).toBe('Mountain View, a home about this size')
    expect(slopes.panels.map((p) => p.title)).toEqual(['Price per square foot', 'Sale price'])
    expect(slopes.panels[0]).toMatchObject({ move: 'rose', fromText: '$335', toText: '$357' })
    expect(slopes.panels[0]!.label).toBeUndefined()
    expect(slopes.panels[1]).toMatchObject({ move: 'fell', label: 'different sizes', fromText: '$585,000', toText: '$550,000' })
    const svg = listingMarketSlopesPhoneSvg({ ...slopes, caption: listingMarketSentence(PINNACLE) })
    expect(svg).toContain('>rose<')
    expect(svg).toContain('>different sizes<')
    expect(svg).not.toMatch(/>(fell|held flat)</)
    expect(svg).not.toContain('#A8452B')
    expect(svg).toContain('1,727 sqft')
    expect(svg).toContain('1,518 sqft')
    expect(textOutsideViewBox(svg)).toEqual([])
    const page = whatHappenedPage({
      subject: {
        streetAddress: '2902 Pinnacle',
        city: 'Bend',
        standardStatus: 'Canceled',
        sqft: 1584,
        lastListPrice: 585000,
      },
      pricing: { valueLow: 483000, valueHigh: 591000 },
      market: { medianDom: 26 },
      expiredAudit: {
        findings: [{ lens: 'pricing', fact: 'Sat 90 days.', meaning: '' }],
        finalCycle: { listDate: '2026-05-12', offMarketDate: '2026-08-10', status: 'Canceled', days: 90 },
      },
      listingMarket: PINNACLE,
      generatedAtIso: '2026-09-30T00:00:00.000Z',
    } as unknown as OpinionPageArgs)
    expect(page?.body).toContain(listingMarketSentence(PINNACLE))
    expect(page?.body).toContain('>different sizes<')
  })

  it('does not read the dollar fall as a local fall, so an own-ground sale is not cut', () => {
    const local = pocketLocalReadOf(PINNACLE)
    expect(local.verdict).toBe('rose')
    expect(local.missing).toBeNull()
    const stayed = applyExclusivePocketDateAdj(COOLING, true, local)
    expect(stayed.factor).toBe(1)
    expect(stayed).not.toBe(COOLING)
  })

  it('keeps the sale-price word when the two windows are within 5 percent of size', () => {
    const close = {
      ...PINNACLE,
      late: { ...PINNACLE.late, sqftMedian: 1641 },
    }
    expect(listingMarketSizeMix(close)).toBe(false)
    expect(listingMarketSentence(close)).toContain('fell from $585,000 to $550,000')
    expect(listingMarketPriceLedMixShift(close)).toBeNull()
    const over = {
      ...PINNACLE,
      late: { ...PINNACLE.late, sqftMedian: 1640 },
    }
    expect(listingMarketSizeMix(over)).toBe(true)
    expect(listingMarketSentence(over)).not.toContain('fell from')
    expect(listingMarketPriceLedMixShift(over)).toBeNull()
  })
})
