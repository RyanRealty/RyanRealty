import { describe, expect, it } from 'vitest'
import {
  chooseListingMarket,
  listingMarketMoveWord,
  listingMarketSentence,
  listingMarketSource,
  withSqftMedian,
  type ListingMarketClose,
  type ListingMarketMove,
} from '@/lib/cma/listing-window-market'
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

  it('draws the dollar rise and the per-foot fall on separate slopes', () => {
    const svg = listingMarketSlopesSvg({ ...listingMarketSlopes(move), caption: listingMarketSentence(move) })
    expect(svg).toContain('Old Farm District, a home about this size')
    expect(svg).toContain('$726,425')
    expect(svg).toContain('$779,950')
    expect(svg).toContain('$324')
    expect(svg).toContain('$314')
    expect(svg).toContain('>rose<')
    expect(svg).toContain('>fell<')
    expect(svg).toContain('2,242 sqft')
    expect(svg).toContain('2,483 sqft')
    expect(svg.match(/Mar 6–Jun 12/g)).toHaveLength(1)
    expect(svg).not.toContain('<rect')
    const priceY = Number(/\$726,425<\/text>/.test(svg) ? /y="([\d.]+)"[^>]*>\$726,425</.exec(svg)?.[1] : NaN)
    const firstCircles = [...svg.matchAll(/<circle[^>]*\bcy="([\d.]+)"/g)].slice(0, 2).map((m) => Number(m[1]))
    expect(priceY).toBeLessThan(Math.min(...firstCircles))
    expect(firstCircles[0]).toBeGreaterThan(firstCircles[1]!)
    expect(svg).toContain('#A8452B')
    const rose = svg.indexOf('>rose<')
    const fell = svg.indexOf('>fell<')
    expect(svg.slice(0, rose)).not.toContain('#A8452B')
    expect(svg.slice(rose, fell)).toContain('#A8452B')
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
    expect(page?.body).toContain('rose from $726,425 to $779,950')
    expect(page?.body).toContain('fell from $324 to $314')
    expect(page?.body).not.toContain('3,394')
    expect(page?.body).not.toContain('94.2%')
    expect(page?.body).not.toContain('12.3%')
    const graphic = whatHappenedGraphicHtml(base)
    expect(graphic).not.toContain('While your home was listed')
  })
})
