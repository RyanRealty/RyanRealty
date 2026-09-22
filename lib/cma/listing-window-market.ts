/**
 * What sale prices did while this home was listed.
 *
 * The tightest grain that can say up, down, or flat: the subdivision, then
 * the neighborhood polygon, then the city. Each half of the listing has to
 * hold enough closes for a median. Homes about the subject's size are tried
 * at every grain before any mixed-size set, so a mix of cottages and large
 * houses does not decide the story.
 */

import type { CmaWindowCloseRow } from '@/lib/data/cma/builderReads'
import { marketAreaName, resolveMarketArea } from '@/lib/cma/market-area'
import { usd } from '@/lib/cma/render-blocks'

export const LISTING_MARKET_MIN_HALF = 8
const FLAT = 0.03

export type ListingMarketMoveWord = 'rose' | 'fell' | 'held flat'

export type ListingMarketHalf = {
  median: number
  ppsf: number | null
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
  /** The day these closes were read. Printed on the source line. */
  asOf?: string | null
}

export type ListingMarketClose = {
  closeDate: string
  closePrice: number
  sqft: number | null
  subdivision: string | null
  lat: number | null
  lng: number | null
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

function halfOf(rows: ListingMarketClose[], from: string, to: string): ListingMarketHalf | null {
  const prices = rows.map((r) => r.closePrice).filter((n) => n > 0)
  const mid = median(prices)
  if (mid == null) return null
  const ppsf = median(
    rows
      .filter((r) => r.sqft != null && r.sqft > 0)
      .map((r) => r.closePrice / r.sqft!),
  )
  return {
    median: Math.round(mid),
    ppsf: ppsf == null ? null : Math.round(ppsf),
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

function enough(early: ListingMarketClose[], late: ListingMarketClose[]): boolean {
  return early.length >= LISTING_MARKET_MIN_HALF && late.length >= LISTING_MARKET_MIN_HALF
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

  const grains: Array<{ rows: ListingMarketClose[]; place: string; grain: ListingMarketMove['grain'] }> = []
  const subdivision = input.subdivision?.trim()
  if (subdivision) {
    grains.push({
      rows: windowed.filter((r) => (r.subdivision ?? '').trim() === subdivision),
      place: subdivision,
      grain: 'subdivision',
    })
  }
  const slug = input.neighborhoodSlug
  const neighborhood = input.neighborhoodName?.trim()
  if (slug && neighborhood) {
    grains.push({
      rows: windowed.filter((r) => resolveMarketArea(r.lat, r.lng) === slug),
      place: neighborhood,
      grain: 'neighborhood',
    })
  }
  grains.push({ rows: windowed, place: input.city.trim() || 'this city', grain: 'city' })

  const attempt = (useSize: boolean): ListingMarketMove | null => {
    for (const grain of grains) {
      const rows = useSize && lo != null && hi != null ? inSize(grain.rows, lo, hi) : grain.rows
      const halves = splitHalves(rows, start, end, midDay)
      if (!enough(halves.early, halves.late)) continue
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

  // Similar size at every grain before any mixed-size set. A subdivision
  // whose only readable median mixes cottages with large houses steps up,
  // instead of letting that mix decide the direction.
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

/** The sentence under the chart. Both halves are named, and the rate per foot when it exists. */
export function listingMarketSentence(move: ListingMarketMove): string {
  const size = move.sized ? ' for a home about this size' : ''
  const price = moveClause(move.priceMove, move.early.median, move.late.median)
  const head = `While your home was listed, the median sale in ${move.place}${size} ${price}.`
  if (move.ppsfMove == null || move.early.ppsf == null || move.late.ppsf == null) return head
  const foot = moveClause(move.ppsfMove, move.early.ppsf, move.late.ppsf)
  return `${head} The price per square foot ${foot}.`
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
  const measured = move.asOf ? ` Measured ${move.asOf}.` : ''
  const lateSpan = spokenSpan(move.late.from, move.late.to)
  const year = move.late.to.slice(0, 4)
  const lateLabeled = year && !lateSpan.includes(year) ? `${lateSpan}, ${year}` : lateSpan
  return `${move.early.n} closed sales ${spokenSpan(move.early.from, move.early.to)}, then ${move.late.n} from ${lateLabeled}. Single-family homes in ${move.place}${size}. Oregon Data Share MLS.${measured}`
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
}

/** The two drawings under the listing timeline. Dollars and the rate per foot never share an axis. */
export function listingMarketSlopes(move: ListingMarketMove): {
  kicker: string
  panels: ListingMarketSlopePanel[]
} {
  const size = move.sized ? ', a home about this size' : ''
  const panels: ListingMarketSlopePanel[] = [
    {
      title: 'Sale price',
      fromText: usd(move.early.median),
      toText: usd(move.late.median),
      fromWhen: spokenSpan(move.early.from, move.early.to),
      toWhen: spokenSpan(move.late.from, move.late.to),
      fromN: `${move.early.n} sales`,
      toN: `${move.late.n} sales`,
      move: move.priceMove,
      deltaPct: move.early.median > 0 ? (move.late.median - move.early.median) / move.early.median : 0,
    },
  ]
  if (move.ppsfMove && move.early.ppsf != null && move.late.ppsf != null) {
    panels.push({
      title: 'Price per square foot',
      fromText: usd(move.early.ppsf),
      toText: usd(move.late.ppsf),
      fromWhen: spokenSpan(move.early.from, move.early.to),
      toWhen: spokenSpan(move.late.from, move.late.to),
      fromN: `${move.early.n} sales`,
      toN: `${move.late.n} sales`,
      move: move.ppsfMove,
      deltaPct: move.early.ppsf > 0 ? (move.late.ppsf - move.early.ppsf) / move.early.ppsf : 0,
    })
  }
  return { kicker: `${move.place}${size}`, panels }
}

export function closesFromRows(rows: readonly CmaWindowCloseRow[]): ListingMarketClose[] {
  return rows.map((r) => ({
    closeDate: String(r.CloseDate ?? ''),
    closePrice: Number(r.ClosePrice),
    sqft: r.TotalLivingAreaSqFt != null ? Number(r.TotalLivingAreaSqFt) : null,
    subdivision: r.SubdivisionName,
    lat: r.Latitude != null ? Number(r.Latitude) : null,
    lng: r.Longitude != null ? Number(r.Longitude) : null,
  }))
}
