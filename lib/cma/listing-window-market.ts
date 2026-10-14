/**
 * What sale prices did while this home was listed.
 *
 * The chart uses the same place as the sales, and the same subtype. It does
 * not step up to a parent polygon or the city, and it never prints N/A.
 * Each half of the listing has to hold enough closes for a median. Homes
 * about the subject's size are tried before a mixed-size set.
 */

import type { CmaWindowCloseRow } from '@/lib/data/cma/builderReads'
import { marketAreaName, productTypeCompatible, resolveMarketArea } from '@/lib/cma/market-area'
import { usd } from '@/lib/cma/render-blocks'
import { formatCalendarDay } from '@/lib/format/date'
import { realSubdivisionName } from '@/lib/pricing/classes'
import { resolveConcessions } from '@/lib/pricing/seller-net'
import type { PocketLocalMissing, PocketLocalRead } from '@/lib/pricing/exclusive-pocket-date-adj'

export const LISTING_MARKET_MIN_HALF = 8
const FLAT = 0.03

/**
 * Median living area moved this far between the two halves: the homes are
 * not one size, so the median sale price is not the market move.
 *
 * 5 percent is the line this file already used to say the later homes were
 * larger or smaller (2026-10-09, 2902 Pinnacle). Under it, "a home about
 * this size" still holds and the sale-price word stands. The 3 percent flat
 * band above is the price word, not a size line.
 */
export const LISTING_MARKET_SIZE_MIX = 0.05

/** Printed on the sale-price slope in place of rose, fell, or held flat. */
export const SIZE_MIX_SLOPE_LABEL = 'different sizes'

export type ListingMarketMoveWord = 'rose' | 'fell' | 'held flat'

export type ListingMarketHalf = {
  median: number
  ppsf: number | null
  /** Median living area of this half. Explains a price move that disagrees with the rate per foot. */
  sqftMedian?: number | null
  n: number
  from: string
  to: string
}

export type ListingMarketMove = {
  place: string
  grain: 'subdivision' | 'neighborhood' | 'city'
  sized: boolean
  sqftLow: number | null
  sqftHigh: number | null
  early: ListingMarketHalf
  late: ListingMarketHalf
  priceMove: ListingMarketMoveWord
  ppsfMove: ListingMarketMoveWord | null
  /** The day these closes were read: the letter's calendar day. Printed on the source line. */
  asOf?: string | null
  /**
   * True when each half's rate per foot is the sale price less its recorded
   * seller concession, the way the table's Sold $/sqft row reads (reader
   * review 2026-10-08: the chart printed the gross rate beside a net table).
   * Absent on rows measured before this, whose stored figures are gross.
   */
  ppsfNet?: boolean
  /**
   * Singular product for the sentence, when the subject is not a detached
   * house. Absent keeps the single-family wording the older letters use.
   */
  productNoun?: string | null
}

export type ListingMarketClose = {
  closeDate: string
  closePrice: number
  /** Recorded seller concession, resolved (lib/pricing/seller-net.ts). Null when nothing was recorded. */
  concessions?: number | null
  sqft: number | null
  subdivision: string | null
  lat: number | null
  lng: number | null
  propertySubType?: string | null
}

function dayMs(iso: string): number | null {
  const day = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const t = Date.parse(`${day}T00:00:00.000Z`)
  return Number.isNaN(t) ? null : t
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

export function listingMarketMoveWord(from: number, to: number): ListingMarketMoveWord {
  if (!(from > 0) || !(to > 0)) return 'held flat'
  const delta = (to - from) / from
  if (Math.abs(delta) < FLAT) return 'held flat'
  return delta > 0 ? 'rose' : 'fell'
}

/** The sale price after a recorded seller concession, or the sale price when none was recorded. */
function netPrice(row: ListingMarketClose): number {
  const c = row.concessions
  return c != null && Number.isFinite(c) && c > 0 ? row.closePrice - c : row.closePrice
}

function halfOf(rows: ListingMarketClose[], from: string, to: string): ListingMarketHalf | null {
  const prices = rows.map((r) => r.closePrice).filter((n) => n > 0)
  const mid = median(prices)
  if (mid == null) return null
  const withSize = rows.filter((r) => r.sqft != null && r.sqft > 0)
  // Net of concessions, the table's Sold $/sqft definition. The median sale
  // price above stays the closing price, as the table's Sold row does.
  const ppsf = median(withSize.map((r) => netPrice(r) / r.sqft!))
  const sqftMedian = median(withSize.map((r) => r.sqft!))
  return {
    median: Math.round(mid),
    ppsf: ppsf == null ? null : Math.round(ppsf),
    sqftMedian: sqftMedian == null ? null : Math.round(sqftMedian),
    n: prices.length,
    from,
    to,
  }
}

function dayBefore(iso: string): string {
  const t = dayMs(iso)
  return t == null ? iso : isoDay(t - 86_400_000)
}

/**
 * The calendar day that starts the second half.
 *
 * An odd-length listing lands the midpoint at noon. Comparing instants then
 * put that day's sales in the first half while the caption said they were in
 * the second. The split is by calendar day: a close on the midpoint day is late.
 */
function midpointDay(start: number, end: number): string {
  return isoDay(start + (end - start) / 2)
}

function splitHalves(
  rows: ListingMarketClose[],
  start: number,
  end: number,
  midDay: string,
): { early: ListingMarketClose[]; late: ListingMarketClose[] } {
  const early: ListingMarketClose[] = []
  const late: ListingMarketClose[] = []
  for (const row of rows) {
    const day = row.closeDate.slice(0, 10)
    const t = dayMs(day)
    if (t == null || t < start || t > end) continue
    if (day < midDay) early.push(row)
    else late.push(row)
  }
  return { early, late }
}

function enough(early: ListingMarketClose[], late: ListingMarketClose[], min: number): boolean {
  return early.length >= min && late.length >= min
}

function inSize(rows: ListingMarketClose[], low: number, high: number): ListingMarketClose[] {
  return rows.filter((r) => r.sqft != null && r.sqft >= low && r.sqft <= high)
}

function finish(
  place: string,
  grain: ListingMarketMove['grain'],
  sized: boolean,
  sqftLow: number | null,
  sqftHigh: number | null,
  earlyRows: ListingMarketClose[],
  lateRows: ListingMarketClose[],
  earlyFrom: string,
  earlyTo: string,
  lateFrom: string,
  lateTo: string,
): ListingMarketMove | null {
  const early = halfOf(earlyRows, earlyFrom, earlyTo)
  const late = halfOf(lateRows, lateFrom, lateTo)
  if (!early || !late) return null
  return {
    place,
    grain,
    sized,
    sqftLow,
    sqftHigh,
    early,
    late,
    priceMove: listingMarketMoveWord(early.median, late.median),
    ppsfMove: early.ppsf != null && late.ppsf != null ? listingMarketMoveWord(early.ppsf, late.ppsf) : null,
    ppsfNet: true,
  }
}

/**
 * Pick the grain and the two halves. `rows` are already one city's closes.
 * Returns null when no grain has enough sales in both halves.
 */
export function chooseListingMarket(input: {
  listDate: string
  offDate: string
  subjectSqft: number | null
  subdivision: string | null
  neighborhoodSlug: string | null
  neighborhoodName: string | null
  city: string
  rows: readonly ListingMarketClose[]
  /** The sales boundary. A subdivision does not fall through to its parent polygon. */
  areaKind?: string | null
  propertySubType?: string | null
}): ListingMarketMove | null {
  const start = dayMs(input.listDate)
  const end = dayMs(input.offDate)
  if (start == null || end == null || end <= start) return null
  const midDay = midpointDay(start, end)
  const earlyFrom = isoDay(start)
  const earlyTo = dayBefore(midDay)
  const lateFrom = midDay
  const lateTo = isoDay(end)
  const windowed = input.rows.filter((r) => {
    const t = dayMs(r.closeDate)
    return t != null && t >= start && t <= end && r.closePrice > 0
  })
  const sqft = input.subjectSqft
  const sized = sqft != null && sqft > 0
  const lo = sized ? Math.round(sqft * 0.75) : null
  const hi = sized ? Math.round(sqft * 1.25) : null

  const typed = input.propertySubType
    ? windowed.filter(
        (r) => !r.propertySubType || productTypeCompatible(input.propertySubType!, r.propertySubType),
      )
    : windowed
  const grains: Array<{ rows: ListingMarketClose[]; place: string; grain: ListingMarketMove['grain'] }> = []
  const subdivision = realSubdivisionName(input.subdivision)
  const kind = (input.areaKind ?? '').trim()
  const slug = input.neighborhoodSlug
  const neighborhood = input.neighborhoodName?.trim()
  const polygon = kind === 'neighborhood' || kind === 'community'
  if (!polygon && subdivision) {
    grains.push({
      rows: typed.filter((r) => (r.subdivision ?? '').trim() === subdivision),
      place: subdivision,
      grain: 'subdivision',
    })
  } else if (polygon && slug && neighborhood && realSubdivisionName(neighborhood)) {
    grains.push({
      rows: typed.filter((r) => resolveMarketArea(r.lat, r.lng) === slug),
      place: neighborhood,
      grain: 'neighborhood',
    })
  }

  const attempt = (useSize: boolean): ListingMarketMove | null => {
    for (const grain of grains) {
      const rows = useSize && lo != null && hi != null ? inSize(grain.rows, lo, hi) : grain.rows
      const halves = splitHalves(rows, start, end, midDay)
      // A subdivision chart can be two real medians. A parent polygon still
      // needs a full half, so a thin plat does not become the neighborhood.
      const min = grain.grain === 'subdivision' ? 1 : LISTING_MARKET_MIN_HALF
      if (!enough(halves.early, halves.late, min)) continue
      return finish(
        grain.place,
        grain.grain,
        useSize,
        useSize ? lo : null,
        useSize ? hi : null,
        halves.early,
        halves.late,
        earlyFrom,
        earlyTo,
        lateFrom,
        lateTo,
      )
    }
    return null
  }

  // Similar size first. If that set is too thin, stay on the same place
  // and read the mixed sizes. Never step up to a parent polygon or the city.
  if (lo != null && hi != null) {
    const sizedHit = attempt(true)
    if (sizedHit) return sizedHit
  }
  return attempt(false)
}

function moveClause(word: ListingMarketMoveWord, from: number, to: number): string {
  if (word === 'held flat') return `held flat, ${usd(from)} then ${usd(to)}`
  if (word === 'rose') return `rose from ${usd(from)} to ${usd(to)}`
  return `fell from ${usd(from)} to ${usd(to)}`
}

/**
 * How far the later half's median living area moved from the earlier half.
 * Null when either half has no size. Positive means the later homes are larger.
 */
export function listingMarketSizeShift(move: Pick<ListingMarketMove, 'early' | 'late'>): number | null {
  const early = move.early.sqftMedian
  const late = move.late.sqftMedian
  if (early == null || late == null || !(early > 0) || !(late > 0)) return null
  return (late - early) / early
}

/**
 * The two halves are a trend, and they are not the same size of home.
 * One sale a half is not a trend (listingMarketOneSaleAHalf owns that print).
 */
export function listingMarketSizeMix(move: ListingMarketMove): boolean {
  if (listingMarketOneSaleAHalf(move)) return false
  const shift = listingMarketSizeShift(move)
  return shift != null && Math.abs(shift) >= LISTING_MARKET_SIZE_MIX
}

/**
 * The like-for-like sentence. The market word is the per-foot move. The two
 * median sale prices print as what those homes sold for, with no rise, fall,
 * or flat on them (2026-10-09, 2902 Pinnacle).
 */
function sizeMixSentence(move: ListingMarketMove, size: string): string {
  const early = move.early.sqftMedian!
  const late = move.late.sqftMedian!
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
  const sizeLine = `The later homes were ${late > early ? 'larger' : 'smaller'}. The median one was ${fmt(late)} square feet, and the earlier median was ${fmt(early)}.`
  const dollars = `The median sale was ${usd(move.early.median)}, then ${usd(move.late.median)}.`
  const hasFoot = move.ppsfMove != null && move.early.ppsf != null && move.late.ppsf != null
  if (!hasFoot) return `While your home was listed, ${sizeLine} ${dollars}`
  const where = move.productNoun ? `for a ${move.productNoun} in ${move.place}` : `in ${move.place}`
  const foot = `the price per square foot ${where}${size} ${moveClause(move.ppsfMove!, move.early.ppsf!, move.late.ppsf!)}`
  return `While your home was listed, ${foot}. ${sizeLine} ${dollars}`
}

/**
 * A half holding one sale has no median and no trend: it is one home's price.
 * A subdivision chart may draw one sale a half (chooseListingMarket), so the
 * sentence then names "the one sale" and its price, and claims no median,
 * no rise and no fall (3037 Purcell, 2026-10-07: "the median sale in Silver
 * Sage rose from $503,000 to $559,000" was one sale against one sale).
 */
function singleSaleSentence(move: ListingMarketMove, product: string, size: string): string {
  const where = `${product}sale in ${move.place}${size}`
  const first =
    move.early.n === 1
      ? `the one ${where} in the first half of the listing closed at ${usd(move.early.median)}`
      : `the median of the ${move.early.n} ${product}sales in ${move.place}${size} in the first half of the listing was ${usd(move.early.median)}`
  const second =
    move.late.n === 1
      ? `the one in the second half closed at ${usd(move.late.median)}`
      : `the median of the ${move.late.n} in the second half was ${usd(move.late.median)}`
  const foot =
    move.early.ppsf != null && move.late.ppsf != null
      ? ` Per square foot, that is ${usd(move.early.ppsf)}, then ${usd(move.late.ppsf)}.`
      : ''
  return `While your home was listed, ${first}, and ${second}.${foot} One sale is one home's price, not a trend.`
}

/** A stored move, or null when the value is not one the local page could print. */
export function readListingMarketMove(value: unknown): ListingMarketMove | null {
  if (!value || typeof value !== 'object') return null
  const m = value as ListingMarketMove
  if (m.priceMove !== 'rose' && m.priceMove !== 'fell' && m.priceMove !== 'held flat') return null
  if (typeof m.place !== 'string' || !m.place.trim()) return null
  if (!m.early || !m.late) return null
  if (!(m.early.median > 0) || !(m.late.median > 0)) return null
  if (!(m.early.n > 0) || !(m.late.n > 0)) return null
  return m
}

/**
 * True when a half holds one sale. The local page then prints that sale's
 * price and "one sale is one home's price, not a trend", never a rise, fall
 * or flat (3037 Purcell, 2026-10-07). The sentence, the slope label and the
 * pocket date gate all read this one test, so the gate can never act on a
 * verdict the page did not print.
 */
export function listingMarketOneSaleAHalf(move: Pick<ListingMarketMove, 'early' | 'late'>): boolean {
  return move.early.n < 2 || move.late.n < 2
}

/**
 * The per-foot verdict the local page prints, or why it prints none
 * (Matt 2026-10-08, "Down only if local fell"). The pocket date gate reads
 * this, built from the same move the page draws, so the two pages of a letter
 * cannot disagree about which way homes like this one went.
 *
 * `ifMissing` names why there is no move at all: the build knows whether it
 * had a listing window to read over.
 */
export function pocketLocalReadOf(
  move: ListingMarketMove | null,
  ifMissing: PocketLocalMissing = 'too-few-sales',
): PocketLocalRead {
  if (!move) {
    return { verdict: null, missing: ifMissing, place: null, sized: false, productNoun: null, early: null, late: null }
  }
  const half = (h: ListingMarketHalf) => ({ ppsf: h.ppsf, n: h.n, from: h.from, to: h.to })
  const base = {
    place: move.place,
    sized: move.sized,
    productNoun: move.productNoun ?? null,
    early: half(move.early),
    late: half(move.late),
  }
  if (listingMarketOneSaleAHalf(move)) return { ...base, verdict: null, missing: 'one-sale-a-half' }
  if (move.ppsfMove == null || move.early.ppsf == null || move.late.ppsf == null) {
    return { ...base, verdict: null, missing: 'no-living-area' }
  }
  return { ...base, verdict: move.ppsfMove, missing: null }
}

/** The sentence under the chart. Both halves are named, and the rate per foot when it exists. */
export function listingMarketSentence(move: ListingMarketMove): string {
  const size = move.sized ? ' for a home about this size' : ''
  const product = move.productNoun ? `${move.productNoun} ` : ''
  if (listingMarketOneSaleAHalf(move)) return singleSaleSentence(move, product, size)
  // A size gap is not a market move. Lead with the per-foot word, the same
  // word the date gate reads, and do not call the dollar median a rise or a fall.
  if (listingMarketSizeMix(move)) return sizeMixSentence(move, size)
  const price = moveClause(move.priceMove, move.early.median, move.late.median)
  const head = `While your home was listed, the median ${product}sale in ${move.place}${size} ${price}.`
  if (move.ppsfMove == null || move.early.ppsf == null || move.late.ppsf == null) return head
  const foot = `The price per square foot ${moveClause(move.ppsfMove, move.early.ppsf, move.late.ppsf)}.`
  return `${head} ${foot}`
}

/**
 * Why a rendered trend is still a price-led size mix, or null when the print
 * is like for like. Lookpass `--check` fails a letter on a non-null result.
 * The stored `priceMove` stays the dollar fact. This reads what the page prints.
 */
export function listingMarketPriceLedMixShift(move: ListingMarketMove | null): string | null {
  if (!move || !listingMarketSizeMix(move)) return null
  const price = listingMarketSlopes(move).panels.find((p) => p.title === 'Sale price')
  const word = price?.label ?? price?.move
  if (word === 'rose' || word === 'fell' || word === 'held flat') {
    const pct = Math.round(Math.abs(listingMarketSizeShift(move)!) * 100)
    return `sale price prints "${word}" while the median living area moved ${pct}%`
  }
  const sentence = listingMarketSentence(move)
  if (/median (?:\w+ )?sale\b[^.]{0,120}\b(rose|fell|held flat)\b/.test(sentence)) {
    return 'the sentence calls the median sale a rise, a fall, or flat across different sizes'
  }
  if (move.ppsfMove != null && move.early.ppsf != null && move.late.ppsf != null) {
    const footAt = sentence.toLowerCase().indexOf('price per square foot')
    const saleAt = sentence.toLowerCase().indexOf('the median sale')
    if (footAt < 0 || (saleAt >= 0 && saleAt < footAt)) {
      return 'the sentence leads with the median sale instead of the price per square foot'
    }
  }
  return null
}

/** Same dollars, same counts. Size can be attached without replacing the signed medians. */
export function sameListingMarketHalves(a: ListingMarketMove, b: ListingMarketMove): boolean {
  return (
    a.place === b.place &&
    a.early.median === b.early.median &&
    a.late.median === b.late.median &&
    a.early.ppsf === b.early.ppsf &&
    a.late.ppsf === b.late.ppsf &&
    a.early.n === b.early.n &&
    a.late.n === b.late.n
  )
}

export function withSqftMedian(stored: ListingMarketMove, fresh: ListingMarketMove): ListingMarketMove {
  if (stored.early.sqftMedian != null && stored.late.sqftMedian != null) return stored
  if (fresh.early.sqftMedian == null || fresh.late.sqftMedian == null) return stored
  if (!sameListingMarketHalves(stored, fresh)) return stored
  return {
    ...stored,
    early: { ...stored.early, sqftMedian: fresh.early.sqftMedian },
    late: { ...stored.late, sqftMedian: fresh.late.sqftMedian },
  }
}

function spokenDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function spokenSpan(from: string, to: string): string {
  const a = spokenDay(from)
  const b = spokenDay(to)
  const year = to.slice(0, 4)
  return year && from.slice(0, 4) === year ? `${a}–${b}` : `${a}–${b}, ${year}`
}

export function listingMarketSource(move: ListingMarketMove): string {
  const size =
    move.sized && move.sqftLow != null && move.sqftHigh != null
      ? `, ${move.sqftLow.toLocaleString('en-US')}–${move.sqftHigh.toLocaleString('en-US')} sqft`
      : ''
  // The letter's calendar day, written the way the rest of the letter writes a
  // date ("October 7, 2026"), never the ISO key (reader review 2026-10-08).
  const measuredDay = move.asOf ? formatCalendarDay(move.asOf, { month: 'long', day: 'numeric', year: 'numeric' }) : ''
  const measured = measuredDay ? ` Measured ${measuredDay}.` : ''
  const net = move.ppsfNet ? ' Per square foot is the sale price less any recorded seller concession, over living area.' : ''
  const lateSpan = spokenSpan(move.late.from, move.late.to)
  const year = move.late.to.slice(0, 4)
  const lateLabeled = year && !lateSpan.includes(year) ? `${lateSpan}, ${year}` : lateSpan
  const homes =
    move.productNoun === 'townhouse'
      ? 'Townhouses'
      : move.productNoun === 'condo'
        ? 'Condos'
        : move.productNoun
          ? move.productNoun
          : 'Single-family homes'
  const earlySales = `${move.early.n} closed ${move.early.n === 1 ? 'sale' : 'sales'}`
  return `${earlySales} ${spokenSpan(move.early.from, move.early.to)}, then ${move.late.n} from ${lateLabeled}. ${homes} in ${move.place}${size}.${net} Oregon Data Share MLS.${measured}`
}

export type ListingMarketSlopePanel = {
  title: string
  fromText: string
  toText: string
  fromWhen: string
  toWhen: string
  fromN: string
  toN: string
  move: ListingMarketMoveWord
  deltaPct: number
  /** Printed in place of the move word. Set when a half holds one sale: one sale is not a trend. */
  label?: string
}

function halfMeta(half: ListingMarketHalf): string {
  const sales = `${half.n} ${half.n === 1 ? 'sale' : 'sales'}`
  if (half.sqftMedian == null || !(half.sqftMedian > 0)) return sales
  return `${sales}, ${Math.round(half.sqftMedian).toLocaleString('en-US')} sqft`
}

/** The slope word when a half holds one sale. */
export const ONE_SALE_SLOPE_LABEL = 'one sale, not a trend'

/** The two readings under the listing timeline. Dollars and the rate per foot never share an axis. */
export function listingMarketSlopes(move: ListingMarketMove): {
  kicker: string
  panels: ListingMarketSlopePanel[]
} {
  const size = move.sized ? ', a home about this size' : ''
  const fromWhen = spokenSpan(move.early.from, move.early.to)
  const toWhen = spokenSpan(move.late.from, move.late.to)
  const fromN = halfMeta(move.early)
  const toN = halfMeta(move.late)
  // One sale a half is one home's price: the chart does not print "rose" or
  // "fell" over it, the same as the sentence under it (3037 Purcell, 2026-10-07).
  // A size mix keeps the dollar slope (the medians did move) but the word is
  // "different sizes", never a market verb, and the per-foot slope leads
  // (2026-10-09, 2902 Pinnacle).
  const oneSale = listingMarketOneSaleAHalf(move)
  const mix = listingMarketSizeMix(move)
  const label = oneSale ? ONE_SALE_SLOPE_LABEL : mix ? SIZE_MIX_SLOPE_LABEL : undefined
  const sale: ListingMarketSlopePanel = {
    title: 'Sale price',
    fromText: usd(move.early.median),
    toText: usd(move.late.median),
    fromWhen,
    toWhen,
    fromN,
    toN,
    move: move.priceMove,
    deltaPct: move.early.median > 0 ? (move.late.median - move.early.median) / move.early.median : 0,
    ...(label ? { label } : {}),
  }
  const panels: ListingMarketSlopePanel[] = []
  const foot: ListingMarketSlopePanel | null =
    move.ppsfMove && move.early.ppsf != null && move.late.ppsf != null
      ? {
          title: 'Price per square foot',
          fromText: usd(move.early.ppsf),
          toText: usd(move.late.ppsf),
          fromWhen,
          toWhen,
          fromN,
          toN,
          move: move.ppsfMove,
          deltaPct: move.early.ppsf > 0 ? (move.late.ppsf - move.early.ppsf) / move.early.ppsf : 0,
          ...(oneSale ? { label: ONE_SALE_SLOPE_LABEL } : {}),
        }
      : null
  // Like for like leads. The dollar panel stays, under the per-foot move,
  // when the homes in the two windows are not one size.
  if (mix && foot) panels.push(foot, sale)
  else {
    panels.push(sale)
    if (foot) panels.push(foot)
  }
  return { kicker: `${move.place}${size}`, panels }
}

export function closesFromRows(rows: readonly CmaWindowCloseRow[]): ListingMarketClose[] {
  return rows.map((r) => ({
    closeDate: String(r.CloseDate ?? ''),
    closePrice: Number(r.ClosePrice),
    concessions: resolveConcessions({
      amount: r.concessions_amount,
      closeDate: String(r.CloseDate ?? ''),
    }),
    sqft: r.TotalLivingAreaSqFt != null ? Number(r.TotalLivingAreaSqFt) : null,
    subdivision: r.SubdivisionName,
    lat: r.Latitude != null ? Number(r.Latitude) : null,
    lng: r.Longitude != null ? Number(r.Longitude) : null,
    propertySubType: r.property_sub_type ?? null,
  }))
}
