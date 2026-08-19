import { describe, expect, it } from 'vitest'
import {
  MAX_TITLE_WORDS,
  MIN_OCCUPIED_BANDS,
  MIN_PRICED_LISTINGS,
  PRICE_BANDS,
  buildSearchPriceLadder,
} from './price-ladder'
import type { CityInventoryPublish } from '@/lib/market/publish-city-inventory'

const TILES_PUBLISH = (count: number, median = 799_900): CityInventoryPublish => ({
  count,
  medianListPrice: median,
  source: 'tiles',
})

const PULSE_PUBLISH: CityInventoryPublish = {
  count: 980,
  medianListPrice: 799_900,
  source: 'pulse',
}

/** n tiles at one price. */
function at(price: number, n: number) {
  return Array.from({ length: n }, () => ({ listPrice: price }))
}

/**
 * The live Bend shape, 2026-08-19 (listing_tile_mv, Active + Active Under
 * Contract, property_type A): 77 / 194 / 227 / 105 / 172 / 112 / 93 = 980.
 */
const BEND = [
  ...at(350_000, 77),
  ...at(500_000, 194),
  ...at(700_000, 227),
  ...at(900_000, 105),
  ...at(1_200_000, 172),
  ...at(1_700_000, 112),
  ...at(2_500_000, 93),
]

describe('buildSearchPriceLadder', () => {
  it('bands the live Bend inventory and names the modal band', () => {
    const ladder = buildSearchPriceLadder({
      city: 'Bend',
      tiles: BEND,
      published: TILES_PUBLISH(980),
    })
    expect(ladder).not.toBeNull()
    expect(ladder!.title).toBe('227 Bend homes at $600–800K')
    expect(ladder!.line).toBe('980 active single-family listings, grouped by asking price.')
    expect(ladder!.caption).toBe('Bend asking prices')
    expect(ladder!.rows).toHaveLength(7)
    expect(ladder!.rows.map((r) => r.value)).toEqual([77, 194, 227, 105, 172, 112, 93])
    expect(ladder!.rows.map((r) => String(r.tick))).toEqual(PRICE_BANDS.map((b) => b.tick))
    // Bands sum to the charted population — the number in the line.
    expect(ladder!.rows.reduce((n, r) => n + r.value, 0)).toBe(980)
  })

  it('keeps every title inside the authoring discipline', () => {
    const ladder = buildSearchPriceLadder({
      city: 'Bend',
      tiles: BEND,
      published: TILES_PUBLISH(980),
    })
    expect(ladder!.title.split(/\s+/).length).toBeLessThanOrEqual(MAX_TITLE_WORDS)
    expect(ladder!.line.split(/\s+/).length).toBeLessThanOrEqual(14)
  })

  it('drops the city name rather than overrun the title budget', () => {
    const ladder = buildSearchPriceLadder({
      city: 'Black Butte Ranch Village',
      tiles: BEND,
      published: TILES_PUBLISH(980),
    })
    expect(ladder!.title).toBe('227 homes at $600–800K')
    expect(ladder!.title.split(/\s+/).length).toBeLessThanOrEqual(MAX_TITLE_WORDS)
  })

  it('writes the first band with its own preposition', () => {
    const ladder = buildSearchPriceLadder({
      city: 'Madras',
      // Live Madras shape 2026-08-19: 32 / 37 / 13 / 6, nothing above $1M.
      tiles: [...at(300_000, 32), ...at(450_000, 37), ...at(700_000, 13), ...at(900_000, 6)],
      published: TILES_PUBLISH(88, 449_950),
    })
    expect(ladder!.title).toBe('37 Madras homes at $400–600K')
  })

  it('trims the empty bands above a town’s inventory', () => {
    const ladder = buildSearchPriceLadder({
      city: 'Madras',
      tiles: [...at(300_000, 32), ...at(450_000, 37), ...at(700_000, 13), ...at(900_000, 6)],
      published: TILES_PUBLISH(88, 449_950),
    })
    expect(ladder!.rows.map((r) => String(r.tick))).toEqual([
      'Under $400K',
      '$400–600K',
      '$600–800K',
      '$800K–$1M',
    ])
  })

  it('trims empty bands below the inventory too', () => {
    const ladder = buildSearchPriceLadder({
      city: 'Sunriver',
      tiles: [...at(700_000, 30), ...at(900_000, 20), ...at(1_200_000, 10)],
      published: TILES_PUBLISH(60),
    })
    expect(ladder!.rows.map((r) => String(r.tick))).toEqual(['$600–800K', '$800K–$1M', '$1–1.5M'])
  })

  it('keeps an interior gap — a hole in the ladder is a reading', () => {
    const ladder = buildSearchPriceLadder({
      city: 'Sisters',
      tiles: [...at(500_000, 30), ...at(700_000, 20), ...at(1_200_000, 10)],
      published: TILES_PUBLISH(60),
    })
    expect(ladder!.rows.map((r) => String(r.tick))).toEqual([
      '$400–600K',
      '$600–800K',
      '$800K–$1M',
      '$1–1.5M',
    ])
    expect(ladder!.rows[2]!.value).toBe(0)
  })

  it('carries each row’s share of the charted population', () => {
    const ladder = buildSearchPriceLadder({
      city: 'Bend',
      tiles: BEND,
      published: TILES_PUBLISH(980),
    })
    expect(String(ladder!.rows[2]!.note)).toBe('23.2% of 980 active single-family listings')
  })

  it('withholds the whole card when the tile fetch was capped or failed', () => {
    expect(
      buildSearchPriceLadder({ city: 'Bend', tiles: BEND, published: PULSE_PUBLISH }),
    ).toBeNull()
    expect(buildSearchPriceLadder({ city: 'Bend', tiles: BEND, published: null })).toBeNull()
  })

  it('withholds below the small-sample floor', () => {
    const thin = [
      ...at(350_000, MIN_PRICED_LISTINGS - 10),
      ...at(700_000, 5),
      ...at(1_200_000, 4),
    ]
    expect(thin).toHaveLength(MIN_PRICED_LISTINGS - 1)
    expect(
      buildSearchPriceLadder({
        city: 'Terrebonne',
        tiles: thin,
        published: TILES_PUBLISH(MIN_PRICED_LISTINGS - 1),
      }),
    ).toBeNull()
  })

  it('withholds when the inventory lands in fewer than three bands', () => {
    const flat = [...at(500_000, 60), ...at(700_000, 40)]
    const ladder = buildSearchPriceLadder({
      city: 'La Pine',
      tiles: flat,
      published: TILES_PUBLISH(100),
    })
    expect(MIN_OCCUPIED_BANDS).toBe(3)
    expect(ladder).toBeNull()
  })

  it('ignores rows with no asking price and says so in the trace', () => {
    const withBlanks = [...BEND, ...Array.from({ length: 4 }, () => ({ listPrice: null }))]
    const ladder = buildSearchPriceLadder({
      city: 'Bend',
      tiles: withBlanks,
      published: TILES_PUBLISH(984),
    })
    expect(ladder!.rows.reduce((n, r) => n + r.value, 0)).toBe(980)
    expect(ladder!.source).toContain('980 of 984 rows carried an asking price')
  })

  it('states full price coverage when every row is priced', () => {
    const ladder = buildSearchPriceLadder({
      city: 'Bend',
      tiles: BEND,
      published: TILES_PUBLISH(980),
    })
    expect(ladder!.source).toContain('All 980 rows carried an asking price.')
    expect(ladder!.source).toContain('listing_tile_mv')
    expect(ladder!.source).toContain('Active Under Contract')
    expect(ladder!.source).toContain('property class A')
    expect(ladder!.source).toContain('1,500-row ceiling')
  })

  it('rejects a blank city', () => {
    expect(
      buildSearchPriceLadder({ city: '   ', tiles: BEND, published: TILES_PUBLISH(980) }),
    ).toBeNull()
  })

  it('puts a price on a band boundary in the upper band', () => {
    const ladder = buildSearchPriceLadder({
      city: 'Redmond',
      tiles: [...at(399_999, 30), ...at(400_000, 30), ...at(600_000, 30)],
      published: TILES_PUBLISH(90),
    })
    expect(ladder!.rows.map((r) => r.value)).toEqual([30, 30, 30])
    expect(ladder!.rows.map((r) => String(r.tick))).toEqual([
      'Under $400K',
      '$400–600K',
      '$600–800K',
    ])
  })
})
