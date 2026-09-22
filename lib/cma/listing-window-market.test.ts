import { describe, expect, it } from 'vitest'
import {
  chooseListingMarket,
  listingMarketMoveWord,
  listingMarketSentence,
  listingMarketSource,
  type ListingMarketClose,
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
      subdivision: 'Countryside Phase 2',
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
    expect(move!.grain).toBe('neighborhood')
  })

  it('steps past a subdivision that can only speak by mixing sizes', () => {
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
    expect(move?.grain).toBe('neighborhood')
    expect(move?.sized).toBe(true)
    expect(listingMarketSentence(move!)).toBe(
      'While your home was listed, the median sale in Old Farm District for a home about this size rose from $726,425 to $779,950. The price per square foot fell from $324 to $314.',
    )
    expect(listingMarketSource(move!)).toContain('8 closed sales')
    expect(listingMarketSource({ ...move!, asOf: '2026-09-22' })).toContain('Measured 2026-09-22')
    expect(listingMarketSource(move!)).toContain('Oregon Data Share MLS')
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
    expect(move?.grain).toBe('city')
    expect(move?.place).toBe('Bend')
    expect(move?.priceMove).toBe('held flat')
  })
})

describe('the market slopes', () => {
  const move = chooseListingMarket({
    listDate: '2026-03-06',
    offDate: '2026-09-21',
    subjectSqft: 2468,
    subdivision: 'Countryside Phase 2',
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
      subdivision: null,
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
})

describe('chapter one keeps the regional figures and adds the market', () => {
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
    subdivision: 'Countryside Phase 2',
    neighborhoodSlug: 'bend-old-farm-district',
    neighborhoodName: 'Old Farm District',
    city: 'Bend',
    rows: [
      ...repeat(8, close({ closeDate: '2026-04-01', closePrice: 726425, sqft: 2242, subdivision: 'Other' })),
      ...repeat(8, close({ closeDate: '2026-08-01', closePrice: 779950, sqft: 2483, subdivision: 'Other' })),
    ],
  })!

  it('prints the market sentence under the ask, and still prints the three regional figures', () => {
    const page = whatHappenedPage({ ...base, listingMarket: move })
    expect(page?.body).toContain('rose from $726,425 to $779,950')
    expect(page?.body).toContain('fell from $324 to $314')
    expect(page?.body).toContain('3,394')
    expect(page?.body).toContain('94.2%')
    expect(page?.body).toContain('12.3%')
    const graphic = whatHappenedGraphicHtml(base)
    expect(graphic).not.toContain('While your home was listed')
  })
})
