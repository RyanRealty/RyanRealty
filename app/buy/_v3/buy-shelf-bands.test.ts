/**
 * SITE-91. The /buy fold shelf: its band brush, and the two source contracts
 * that keep the shadcn carousel the shadcn carousel.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { HomeRailCard } from '@/app/_v3/home-rail-items'
import { BAND_FLOOR, buyShelfBands, buyShelfLadder, sortByAsk } from './buy-shelf-bands'

function card(price: number | null, key = `k${price}`): HomeRailCard {
  return {
    listingKey: key,
    href: `/homes-for-sale/bend/${key}`,
    photoUrls: ['https://example.test/800x600.jpg'],
    price,
    addressLine: '1 Main Street',
    cityLine: 'Bend 97702',
    beds: 3,
    baths: 2,
    sqft: 1500,
    pricePerSqft: 300,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    subdivisionName: null,
    city: 'Bend',
    listNumber: '220100000',
    badges: [],
    hasTour: false,
    tourUrl: null,
    tourLabel: '3D Walkthrough',
    statusLabel: null,
  }
}

describe('sortByAsk', () => {
  it('opens the shelf at the bottom of the range', () => {
    const out = sortByAsk([card(900_000), card(450_000), card(600_000)])
    expect(out.map((c) => c.price)).toEqual([450_000, 600_000, 900_000])
  })

  it('parks a listing with no published ask at the end rather than at zero', () => {
    const out = sortByAsk([card(null, 'none'), card(450_000)])
    expect(out.map((c) => c.listingKey)).toEqual(['k450000', 'none'])
  })

  it('does not mutate the row it was handed', () => {
    const rows = [card(900_000), card(450_000)]
    sortByAsk(rows)
    expect(rows.map((c) => c.price)).toEqual([900_000, 450_000])
  })
})

describe('buyShelfBands', () => {
  it('leads with Any price and then only the populated rungs, in ladder order', () => {
    const cards = [
      card(520_000, 'a'),
      card(560_000, 'b'),
      card(650_000, 'c'),
      card(880_000, 'd'),
      card(2_400_000, 'e'),
    ]
    const bands = buyShelfBands(cards)
    expect(bands.map((b) => b.key)).toEqual(['any', 'under-600', '600-900'])
    expect(bands[0]?.cards).toHaveLength(5)
    expect(bands[1]?.cards.map((c) => c.listingKey)).toEqual(['a', 'b'])
  })

  it('every band is itself cheapest-first', () => {
    const bands = buyShelfBands([
      card(880_000, 'hi'),
      card(650_000, 'lo'),
      card(520_000, 'a'),
      card(560_000, 'b'),
    ])
    expect(bands.find((b) => b.key === '600-900')?.cards.map((c) => c.price)).toEqual([
      650_000, 880_000,
    ])
  })

  it('a rung under the floor earns no chip — one house behind a filter is a dead end', () => {
    const bands = buyShelfBands([
      card(520_000, 'a'),
      card(560_000, 'b'),
      card(590_000, 'c'),
      card(1_900_000, 'lonely'),
    ])
    expect(BAND_FLOOR).toBe(2)
    expect(bands.map((b) => b.key)).not.toContain('over-1500')
  })

  it('refuses the whole brush when the shelf does not span two rungs', () => {
    expect(buyShelfBands([card(520_000, 'a'), card(560_000, 'b'), card(590_000, 'c')])).toEqual([])
    expect(buyShelfBands([])).toEqual([])
  })

  it('names no figure it was not given — labels are the fixed ladder only', () => {
    const labels = buyShelfBands([
      card(520_000, 'a'),
      card(560_000, 'b'),
      card(650_000, 'c'),
      card(880_000, 'd'),
    ]).map((b) => b.label)
    expect(labels).toEqual(['Any price', 'Under $600K', '$600K to $900K'])
  })
})

describe('the carousel is the installed carousel (ci:catalog-install / --ship)', () => {
  const SHELF = readFileSync('app/buy/_v3/BuyHomesShelf.client.tsx', 'utf8')
  const RAIL = readFileSync('app/_v3/HomeListingRail.client.tsx', 'utf8')
  const RAIL_CSS = readFileSync('app/_v3/home-homes-rails.css', 'utf8')

  it('the route file imports the shadcn source itself, not a house wrapper', () => {
    expect(SHELF).toMatch(/import\s*\{[\s\S]*?\}\s*from\s*'@\/components\/ui\/carousel'/)
  })

  it('both shelves mount the chevrons as flanking children, never a static row', () => {
    for (const src of [SHELF, RAIL]) {
      expect(src).toContain('v3-carousel__step--prev')
      expect(src).toContain('v3-carousel__step--next')
      expect(src).not.toContain('home-rail__arrows')
    }
    /* The sheet still NAMES the old static row in the comment that records why
       it went; what may not come back is a rule for it. */
    expect(RAIL_CSS).not.toMatch(/\.home-rail__arrows\s*[,{[]/)
  })

  it('the slide width stays a variable so the chevrons keep the media midline', () => {
    expect(RAIL_CSS).toContain('--v3-carousel-slide-w')
    expect(RAIL).not.toContain('basis-1/4')
  })

  it('the shelf does not re-implement the card face', () => {
    expect(SHELF).toContain("from '@/app/_v3/HomeListingRail.client'")
    expect(SHELF).toContain('HomeRailCardFace')
  })
})

describe('buyShelfLadder', () => {
  it('places each ask between the shelf’s own low and high', () => {
    const ladder = buyShelfLadder([card(400_000, 'a'), card(600_000, 'b'), card(800_000, 'c')])
    expect(ladder).not.toBeNull()
    expect(ladder?.low).toBe(400_000)
    expect(ladder?.high).toBe(800_000)
    expect(ladder?.marks.map((m) => m.pct)).toEqual([0, 0.5, 1])
    expect(ladder?.marks.map((m) => m.index)).toEqual([0, 1, 2])
  })

  it('keeps the cards in the order it was handed, so mark i is card i', () => {
    const ladder = buyShelfLadder([card(800_000, 'c'), card(400_000, 'a'), card(600_000, 'b')])
    expect(ladder?.marks.map((m) => m.listingKey)).toEqual(['c', 'a', 'b'])
  })

  it('refuses a strip that would be marks stacked on one point', () => {
    expect(buyShelfLadder([card(500_000, 'a'), card(500_000, 'b'), card(500_000, 'c')])).toBeNull()
  })

  it('refuses fewer than three asks, and ignores a listing with no published ask', () => {
    expect(buyShelfLadder([card(400_000, 'a'), card(800_000, 'b')])).toBeNull()
    expect(
      buyShelfLadder([card(400_000, 'a'), card(800_000, 'b'), card(null, 'none')]),
    ).toBeNull()
  })

  it('skips a card the caller refuses, and keeps the others on their own index', () => {
    const cards = [card(400_000, 'share'), card(600_000, 'b'), card(800_000, 'c'), card(1_000_000, 'd')]
    const ladder = buyShelfLadder(cards, (c) => c.listingKey === 'share')
    // The low end is the cheapest WHOLE dwelling, not the share ask.
    expect(ladder?.low).toBe(600_000)
    expect(ladder?.marks.map((m) => m.listingKey)).toEqual(['b', 'c', 'd'])
    // …and each surviving mark still points at its card's slot in the shelf.
    expect(ladder?.marks.map((m) => m.index)).toEqual([1, 2, 3])
  })

  it('refuses the strip when skipping leaves fewer than three asks', () => {
    const cards = [card(400_000, 'a'), card(600_000, 'b'), card(800_000, 'share')]
    expect(buyShelfLadder(cards, (c) => c.listingKey === 'share')).toBeNull()
  })

  it('names no figure but the low and the high it was handed', () => {
    const ladder = buyShelfLadder([card(400_000, 'a'), card(600_000, 'b'), card(800_000, 'c')])
    expect(Object.keys(ladder ?? {}).sort()).toEqual(['high', 'low', 'marks'])
  })
})
