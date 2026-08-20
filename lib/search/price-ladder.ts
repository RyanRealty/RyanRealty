/**
 * The asking-price ladder for the city search surface — ONE chart-room rank
 * form (lollipop rows) under the results grid, drawn by the V3Chart series
 * atom. No new chart component, no second geometry.
 *
 * WHY IT COSTS NOTHING. The plain-city browse already fetches the city's
 * active class-A tiles (`loadCitySfrTilesForSearch`) to publish the page's
 * active count and median list price. This module bands the SAME array. It
 * adds no query, no await, and nothing above the fold: the card renders in
 * the below-fold SEO tail, under the listings.
 *
 * SECTION 0 RULES THIS FILE ENCODES:
 *  - The card renders ONLY when `publishCityInventory` released the tile
 *    source. That is the page's own gate for "the fetch succeeded, returned
 *    rows, and did not hit the CITY_TILE_FETCH_LIMIT ceiling" — i.e. the set
 *    is the complete active inventory, not a truncated newest-first sample.
 *    A capped or failed fetch withholds the whole card rather than banding a
 *    sample as if it were a census.
 *  - The population phrase comes from `publishSearchCount(grain 'sfr')`, the
 *    same helper the page's FAQ already publishes this number through, so one
 *    number cannot wear two labels on one page.
 *  - The title is a FINDING derived from the rows (the modal band and its
 *    count), never hand-written copy that data drift can falsify.
 *  - Every row's reading carries its share of the charted population.
 *  - The Source disclosure names the table, the read, the status filter, the
 *    MLS property class and what that class actually contains, the price
 *    predicate, and the row counts.
 */

import { listingPriceIsFractionalShare } from '@/lib/listing/publish-listing-figure'
import { CITY_TILE_FETCH_LIMIT, type CityInventoryPublish } from '@/lib/market/publish-city-inventory'
import { publishSearchCount } from '@/lib/search/publish-search-count'

/**
 * One asking-price band. `tick` is the row label on the chart (it lives in a
 * 6.5rem column, so it stays short); `titlePhrase` is the same band written to
 * finish the finding sentence, carrying its own preposition.
 */
export type PriceBand = {
  /** Inclusive floor. */
  min: number
  /** Exclusive ceiling. Infinity on the open top band. */
  max: number
  tick: string
  titlePhrase: string
}

/**
 * Fixed bands, not quantiles. Fixed ranges stay comparable from one town to
 * the next and match how a buyer sets a price filter; quantile bins would
 * redraw the axis per city and compare nothing.
 */
export const PRICE_BANDS: readonly PriceBand[] = [
  { min: 0, max: 400_000, tick: 'Under $400K', titlePhrase: 'under $400K' },
  { min: 400_000, max: 600_000, tick: '$400–600K', titlePhrase: 'at $400–600K' },
  { min: 600_000, max: 800_000, tick: '$600–800K', titlePhrase: 'at $600–800K' },
  { min: 800_000, max: 1_000_000, tick: '$800K–$1M', titlePhrase: 'at $800K–$1M' },
  { min: 1_000_000, max: 1_500_000, tick: '$1–1.5M', titlePhrase: 'at $1–1.5M' },
  { min: 1_500_000, max: 2_000_000, tick: '$1.5–2M', titlePhrase: 'at $1.5–2M' },
  { min: 2_000_000, max: Infinity, tick: '$2M+', titlePhrase: 'above $2M' },
]

/**
 * Below this many priced listings a seven-band split is noise, not a shape —
 * a town with 18 homes puts two or three in each band and the ladder reads as
 * a random walk. Withhold instead.
 */
export const MIN_PRICED_LISTINGS = 25

/** A ladder that lands in one or two bands has no shape to show. */
export const MIN_OCCUPIED_BANDS = 3

/** The authoring discipline V3ChartCard states for its title. */
export const MAX_TITLE_WORDS = 6

/**
 * One band as a chart row. Plain strings, not branded V3Text: this module
 * stays free of the component layer, and the section that renders it wraps
 * each string with v3Text at the boundary. Every string here is non-empty by
 * construction, which is what v3Text requires.
 */
export type SearchPriceLadderRow = {
  /** The band name, as the row label. */
  tick: string
  /** The listing count. Y geometry only. */
  value: number
  /** The count as the caller already formatted it. */
  label: string
  /** The row's reading: its share of the charted population. */
  note: string
}

export type SearchPriceLadder = {
  /** The finding. Six words or fewer, derived from the rows. */
  title: string
  /** What the chart displays. Fourteen words or fewer. */
  line: string
  /** The figure's accessible name. */
  caption: string
  /** The full section 0 trace, for the collapsed Source disclosure. */
  source: string
  rows: SearchPriceLadderRow[]
}

/**
 * The tile fields this needs. `propertySubType` is REQUIRED so no caller can
 * band a set without saying what is in it — see the fractional note below.
 */
export type PricedTile = { listPrice?: number | null; propertySubType: string | null }

/**
 * A FRACTIONAL INTEREST HAS NO PLACE IN AN ASKING-PRICE BAND (§0). MLS
 * PropertyType 'A' carries the sub types "Tenancy in Common" and "Timeshare",
 * whose ListPrice buys a share of a resort home. Banded as homes they pile
 * into the bottom row: measured live 2026-08-19, Active + Active Under
 * Contract class-A rows under $400K —
 *   Sunriver           42 rows, 33 of them fractional  (9 real homes)
 *   Redmond            84 rows, 16 fractional
 *   Bend               77 rows, 12 fractional
 *   Black Butte Ranch   4 rows,  4 fractional          (the band is empty)
 * The Sunriver card's own title is the modal band, so it read "42 Sunriver
 * homes under $400K" off nine.
 */
function isWholeHomeTile(tile: PricedTile): boolean {
  return !listingPriceIsFractionalShare(tile.propertySubType)
}

function usablePrices(tiles: readonly PricedTile[]): number[] {
  const out: number[] = []
  for (const tile of tiles) {
    if (!isWholeHomeTile(tile)) continue
    const price = Number(tile.listPrice)
    if (Number.isFinite(price) && price > 0) out.push(price)
  }
  return out
}

function bandIndex(price: number): number {
  for (let i = 0; i < PRICE_BANDS.length; i++) {
    const band = PRICE_BANDS[i]!
    if (price >= band.min && price < band.max) return i
  }
  return PRICE_BANDS.length - 1
}

/**
 * Trim empty bands off both ends. An interior zero stays: a gap in the middle
 * of the ladder is a real reading ("nothing between $1M and $1.5M"), while a
 * run of empty bands past the top of a town's inventory is only dead axis.
 */
function occupiedSpan(counts: readonly number[]): { start: number; end: number } | null {
  let start = 0
  while (start < counts.length && counts[start] === 0) start++
  let end = counts.length - 1
  while (end >= start && counts[end] === 0) end--
  if (end < start) return null
  return { start, end }
}

/** Share to one decimal, e.g. 23.2. */
function sharePct(count: number, total: number): string {
  return ((count / total) * 100).toFixed(1)
}

/**
 * Build the ladder, or return null when the data cannot honestly carry it.
 *
 * `published` is the page's own `publishCityInventory` result. Passing it in
 * (rather than recomputing) is what binds this card to the figures the page
 * already prints: `source === 'tiles'` is precisely the state in which the
 * tile array is the complete, uncapped active inventory.
 */
export function buildSearchPriceLadder(input: {
  city: string
  tiles: readonly PricedTile[]
  published: CityInventoryPublish | null
}): SearchPriceLadder | null {
  const city = input.city.trim()
  if (!city) return null

  // The page's own census gate. 'pulse' means the tile fetch failed, came back
  // empty, or hit the row ceiling — in every one of those states the array is
  // not the city's inventory and must not be banded.
  if (input.published?.source !== 'tiles') return null

  const prices = usablePrices(input.tiles)
  if (prices.length < MIN_PRICED_LISTINGS) return null

  const counts = PRICE_BANDS.map(() => 0)
  for (const price of prices) counts[bandIndex(price)]!++

  const occupied = counts.filter((n) => n > 0).length
  if (occupied < MIN_OCCUPIED_BANDS) return null

  const span = occupiedSpan(counts)
  if (!span) return null

  const total = prices.length
  const published = publishSearchCount({ value: total, grain: 'sfr' })
  if (!published) return null

  const rows: SearchPriceLadderRow[] = []
  for (let i = span.start; i <= span.end; i++) {
    const band = PRICE_BANDS[i]!
    const count = counts[i]!
    rows.push({
      tick: band.tick,
      value: count,
      label: count.toLocaleString('en-US'),
      note: `${sharePct(count, total)}% of ${published.phrase}`,
    })
  }

  // The finding: the band holding the most homes. Ties resolve to the lower
  // band so the same rows always produce the same title.
  let peak = span.start
  for (let i = span.start; i <= span.end; i++) {
    if (counts[i]! > counts[peak]!) peak = i
  }
  const peakBand = PRICE_BANDS[peak]!
  const peakCount = counts[peak]!.toLocaleString('en-US')
  const withCity = `${peakCount} ${city} homes ${peakBand.titlePhrase}`
  const title =
    withCity.trim().split(/\s+/).length <= MAX_TITLE_WORDS
      ? withCity
      : `${peakCount} homes ${peakBand.titlePhrase}`

  const rowCount = input.tiles.length
  const n = (v: number) => v.toLocaleString('en-US')
  const shareCount = input.tiles.filter((t) => !isWholeHomeTile(t)).length
  const unpriced = rowCount - shareCount - total
  const coverageParts: string[] = []
  if (shareCount > 0) {
    coverageParts.push(
      `${n(shareCount)} of them price a fractional interest rather than a home (MLS sub type Tenancy in Common or Timeshare) and are not banded.`,
    )
  }
  if (unpriced > 0) {
    coverageParts.push(`${n(unpriced)} carried no asking price and are not banded.`)
  }
  const priceCoverage =
    coverageParts.length === 0
      ? `All ${n(rowCount)} rows carried an asking price.`
      : `${n(total)} of ${n(rowCount)} rows are banded: ${coverageParts.join(' ')}`

  return {
    title,
    line: `${published.phrase}, grouped by asking price.`,
    caption: `${city} asking prices`,
    source:
      `listing_tile_mv through getCityListings. City ${city}, standard_status Active or ` +
      'Active Under Contract, MLS property class A (residential dwellings: single-family, ' +
      'townhouse, condo, manufactured on land), asking price above zero. ' +
      `${priceCoverage} ` +
      'The same live set the active count and median list price above publish from, read ' +
      `uncapped: the ${CITY_TILE_FETCH_LIMIT.toLocaleString('en-US')}-row ceiling was not reached, ` +
      'so this is the whole active inventory rather than a sample. Bands are fixed price ranges. ' +
      'An empty band above or below the inventory is not drawn.',
    rows,
  }
}
