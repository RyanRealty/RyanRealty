/**
 * Reconciliation — which sale carried the price, and why.
 *
 * Appraisal practice (USPAP SR 1-6, and *The Appraisal of Real Estate* 15th
 * ed.) never averages the adjusted sales silently: it names the one that
 * carries the most weight on three axes — similarity, recency, and the
 * smallest total adjustment — and says so. RPR prints the same thing as a
 * "Comp Weighting" column. We already COMPUTED a weight per sale
 * (`adjustCompAlongMarket`: size proximity × recency) and printed none of it,
 * which is the gap the professional-practice research named as item 2
 * (docs/research/cma-professional-practice-2026-09-07.md).
 *
 * This module is the whole of that: normalize the weights the engine already
 * assigns, state a factual reason per sale, and write one sentence naming the
 * sale that mattered most. It is a pure module with no reads, and it is the
 * SAME function that produces the point value in `estimate.ts` — the sentence
 * the reader gets and the number on the cover cannot come apart.
 *
 * VOICE. The document never says comp, subject, band, kept, or set
 * (docs/plans/CMA_REIMAGINED_2026-09-07.md, "Words"). Every string this module
 * writes is a plain fact about a house: "60 square feet from yours", "sold two
 * months ago", "its price moved 2.1 percent when adjusted for date".
 * A superlative is written only when it is true of the printed sales.
 */

import { LOCATION_MATCH_WEIGHT, capClosedCompShares, type LocationMatch } from '@/lib/pricing/closed-comp-weight'

/** The two fields the weighted value itself needs. Every adjusted sale has them. */
export interface WeightedSale {
  adjustedPrice: number
  weight: number
}

/**
 * The value the printed sales support: each sale's adjusted price times its
 * share of the total weight. Sales with no usable weight are weighted equally
 * rather than dropped. Null when nothing is priceable.
 *
 * This is the ONE definition of the point value. `reconcileAdjustedSales`
 * calls it for the printed sentence and `lib/pricing/estimate.ts` calls it for
 * the recommendation, so the two cannot diverge (D10).
 */
export function weightedAdjustedPrice(sales: readonly WeightedSale[]): number | null {
  const usable = sales.filter((s) => Number.isFinite(s.adjustedPrice) && s.adjustedPrice > 0)
  if (usable.length === 0) return null
  const raw = usable.map((s) => (Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0))
  const shares = capClosedCompShares(raw)
  return Math.round(usable.reduce((sum, s, i) => sum + s.adjustedPrice * (shares[i] ?? 0), 0))
}

/** What the reconciliation needs off an adjusted sale. */
export interface ReconcilableSale {
  listingKey: string
  address: string
  sqft: number
  closePrice: number
  closeDate: string
  monthsSinceClose: number
  timeAdjustment: number
  sizeAdjustment: number
  storyAdjustment?: number
  /** Recorded seller concession. Omitted fixtures stay on date, size, and story only. */
  concessionsAmount?: number | null
  adjustedPrice: number
  /** size proximity × recency, from adjustCompAlongMarket. Judge-weak sales come in halved. */
  weight: number
  /**
   * Rule 15's location step the weight was built on (same subdivision 3,
   * adjacent 2, neighborhood or community 1), as the ladder stamped it on the
   * sale. Absent on older rows and broker-picked comps; the sentence then
   * gives size, date and movement only.
   */
  locationMatch?: LocationMatch | null
}

export interface ReconciliationWeight {
  listingKey: string
  address: string
  /** Share of the total weight, in percent, one decimal. The printed column. */
  weight: number
  /** The engine's raw weight, so a reviewer can re-derive the share. */
  weightRaw: number
  /** Sale price after the date, size and story adjustments. */
  adjustedPrice: number
  /** Date, size, story, and a recorded concession, as a percent of the sale price. */
  grossAdjustmentPct: number
  /** A short factual phrase: size gap, recency, how far the adjustments moved it. */
  reason: string
}

export interface CmaReconciliation {
  weights: ReconciliationWeight[]
  /** ListingKey of the sale carrying the most weight. Null on an empty set. */
  mostWeighted: string | null
  /** The weighted value the printed sales support, before any list-price step. */
  weightedPrice: number | null
  /** One sentence, seller language, naming that sale and why it leads. */
  sentence: string | null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * ONE ROUNDING FOR THE WEIGHT COLUMN (reader review, 2382 Jackson,
 * 2026-10-07). Shares become tenths of a percent by the largest remainder, so
 * the printed column adds to exactly 100.0 and the sentence quotes the same
 * figure the table prints. Rounding each share on its own let three equal
 * sales print 33.3, 33.3 and 33.3, a column that adds to 99.9. Ties in the
 * remainder go to the larger share, then to the earlier sale.
 */
export function printedWeightPercents(shares: readonly number[]): number[] {
  const tenths = shares.map((s) => (Number.isFinite(s) && s > 0 ? s * 1000 : 0))
  const total = tenths.reduce((sum, t) => sum + t, 0)
  if (!(total > 0)) return shares.map(() => 0)
  const floors = tenths.map((t) => Math.floor(t + 1e-9))
  let left = Math.round(total) - floors.reduce((sum, t) => sum + t, 0)
  const order = tenths
    .map((t, i) => ({ i, rem: t - floors[i]!, t }))
    .sort((a, b) => b.rem - a.rem || b.t - a.t || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i] = floors[i]! + 1
    left -= 1
  }
  return floors.map((t) => t / 10)
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** "five", not "5", under ten. Mirrors lib/pricing/estimate.ts `countWord`. */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
function countWord(n: number): string {
  return n >= 0 && n < COUNT_WORDS.length ? COUNT_WORDS[n]! : String(n)
}

/** Recorded concession dollars. Missing or non-finite stays out of the gross. */
function concessionDollars(sale: ReconcilableSale): number {
  const n = sale.concessionsAmount
  return typeof n === 'number' && Number.isFinite(n) ? Math.abs(n) : 0
}

/** Total adjustment movement as a share of the sale price. */
export function grossAdjustmentPct(sale: ReconcilableSale): number {
  if (!(sale.closePrice > 0)) return 0
  const gross =
    Math.abs(sale.timeAdjustment) +
    Math.abs(sale.sizeAdjustment) +
    Math.abs(sale.storyAdjustment ?? 0) +
    concessionDollars(sale)
  return round1((gross / sale.closePrice) * 100)
}

/** "the same size as yours" · "60 square feet smaller than yours". */
function sizePhrase(sale: ReconcilableSale, subjectSqft: number): string {
  if (!(subjectSqft > 0) || !(sale.sqft > 0)) return 'the same layout as yours'
  const delta = Math.round(sale.sqft - subjectSqft)
  if (delta === 0) return 'the same size as yours'
  const n = Math.abs(delta).toLocaleString('en-US')
  return `${n} square ${Math.abs(delta) === 1 ? 'foot' : 'feet'} ${delta > 0 ? 'larger' : 'smaller'} than yours`
}

/**
 * Calendar year, month and (when the string carries one) day from a date
 * string. Read off the text: a local Date would shift the day.
 */
function yearMonthDay(iso: string | null | undefined): { y: number; m: number; d: number | null } | null {
  if (!iso) return null
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso.trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  if (!Number.isInteger(y) || m < 1 || m > 12) return null
  const d = match[3] != null ? Number(match[3]) : null
  return { y, m, d: d != null && d >= 1 && d <= 31 ? d : null }
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/**
 * Whole months from the close to the letter, counted by the day: May 29 to
 * October 8 is 4 months and 9 days, so 4. A close on the 31st is a month old
 * on the last day of a shorter month. Null when either date has no day.
 */
export function wholeMonthsBetween(closeIso: string | null | undefined, asOfIso: string | null | undefined): number | null {
  const close = yearMonthDay(closeIso)
  const letter = yearMonthDay(asOfIso)
  if (!close || !letter || close.d == null || letter.d == null) return null
  let months = (letter.y - close.y) * 12 + (letter.m - close.m)
  const closeDay = Math.min(close.d, daysInMonth(letter.y, letter.m))
  if (letter.d < closeDay) months -= 1
  return months
}

/**
 * "sold this month" · "sold a month ago" · "sold 7 months ago", off the
 * stored monthsSinceClose when there is no letter date. Whole months
 * elapsed, so 4.6 is 4, never 5.
 */
function monthsSincePhrase(monthsRaw: number): string {
  const months = Math.floor(Number.isFinite(monthsRaw) ? monthsRaw : 0)
  if (months <= 0) return 'sold this month'
  if (months === 1) return 'sold a month ago'
  return `sold ${months} months ago`
}

/**
 * Recency from the letter date when both dates are present.
 *
 * WHOLE MONTHS ELAPSED, COUNTED BY THE DAY (reader review 2026-10-08, 3062 NW
 * Kelly Hill). 2955 Bordeaux closed May 29, 2026 and the letter of Oct 8 said
 * "it sold 5 months ago": October less May, a calendar count. It was 4 months
 * and 9 days. A close less than a month old is "sold this month" in the same
 * calendar month and "sold last month" in the one before. A close one whole
 * month old is "sold last month" when it was the previous calendar month and
 * "sold a month ago" otherwise. Older closes print the whole months. Without
 * a day on either date the calendar count stands; without asOf, the stored
 * monthsSinceClose phrase stays.
 */
function recencyPhrase(sale: ReconcilableSale, asOf?: string | null): string {
  const close = yearMonthDay(sale.closeDate)
  const letter = yearMonthDay(asOf)
  if (!close || !letter) return monthsSincePhrase(sale.monthsSinceClose)
  const calendar = (letter.y - close.y) * 12 + (letter.m - close.m)
  const whole = wholeMonthsBetween(sale.closeDate, asOf) ?? calendar
  if (calendar <= 0 || whole < 0) return 'sold this month'
  if (whole === 0) return calendar === 1 ? 'sold last month' : 'sold this month'
  if (whole === 1) return calendar === 1 ? 'sold last month' : 'sold a month ago'
  return `sold ${whole} months ago`
}

/** Names only the lines that moved by at least a dollar. */
function adjustmentClaim(sale: ReconcilableSale): string {
  const parts: string[] = []
  if (Math.abs(sale.timeAdjustment) >= 1) parts.push('date')
  if (Math.abs(sale.sizeAdjustment) >= 1) parts.push('size')
  if (Math.abs(sale.storyAdjustment ?? 0) >= 1) parts.push('story')
  if (concessionDollars(sale) >= 1) parts.push('seller concessions')
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

/** "its price moved 2.1 percent when adjusted for date" · "its price did not move". */
function movementPhrase(sale: ReconcilableSale, pct: number): string {
  const claim = adjustmentClaim(sale)
  if (pct <= 0 || !claim) return 'its price did not move'
  return `its price moved ${pct} percent when adjusted for ${claim}`
}

/** The location step the sale's weight stands on, or null when the row never classed it. */
function locationStep(sale: ReconcilableSale): number | null {
  const match = sale.locationMatch
  if (!match || !(match in LOCATION_MATCH_WEIGHT)) return null
  return LOCATION_MATCH_WEIGHT[match]
}

/** "in your subdivision" · "in the subdivision next to yours" · "in your neighborhood". */
function locationPhrase(match: LocationMatch): string | null {
  if (match === 'same-subdivision') return 'in your subdivision'
  if (match === 'adjacent-subdivision') return 'in the subdivision next to yours'
  if (match === 'neighborhood-or-community') return 'in your neighborhood'
  return null
}

/**
 * LOCATION IS THE HEAVIEST FACTOR WHEN IT SEPARATES THE LEADER (rule 15,
 * reader review 2026-10-08). The weight is a location step plus a similarity
 * fraction under one (lib/pricing/closed-comp-weight.ts), so a same-subdivision
 * sale outweighs every adjacent or neighborhood sale whatever their size and
 * date. The sentence used to give size, date and movement as the reasons even
 * then. When the leader's step is above another priced sale's, the step is
 * why it leads, and the sentence says so first. When every sale shares the
 * step, location explains nothing about the order and the sentence stays on
 * size, date and movement.
 */
function leadingLocation(leader: ReconcilableSale, usable: readonly ReconcilableSale[]): string | null {
  const step = locationStep(leader)
  if (step == null || !(step > 0) || !leader.locationMatch) return null
  const others = usable.filter((s) => s.listingKey !== leader.listingKey).map(locationStep)
  if (!others.some((o) => o != null && o < step)) return null
  return locationPhrase(leader.locationMatch)
}

/**
 * The weights, the leader, the weighted value, and the sentence.
 *
 * Weight shares are the engine's own weights over their total, so they sum to
 * 100 by construction. A sale with a non-positive weight cannot pull the value
 * and is dropped from the reconciliation; when every weight is missing the
 * sales are weighted equally rather than silently ignored, and the value is
 * then their plain mean.
 */
export function reconcileAdjustedSales(args: {
  sales: readonly ReconcilableSale[]
  subjectSqft: number
  /** Letter date. Used only for the recency phrase, never for the weights. */
  asOf?: string | null
}): CmaReconciliation {
  const usable = args.sales.filter((s) => Number.isFinite(s.adjustedPrice) && s.adjustedPrice > 0)
  if (usable.length === 0) {
    return { weights: [], mostWeighted: null, weightedPrice: null, sentence: null }
  }
  const rawOf = (s: ReconcilableSale) =>
    Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0
  const shares = capClosedCompShares(usable.map(rawOf))
  const share = (_s: ReconcilableSale, i: number) => shares[i] ?? 0

  const weightedPrice = weightedAdjustedPrice(usable)

  const smallestGross = Math.min(...usable.map(grossAdjustmentPct))
  const closestSize =
    args.subjectSqft > 0 ? Math.min(...usable.map((s) => Math.abs(s.sqft - args.subjectSqft))) : null
  const mostRecent = Math.min(...usable.map((s) => s.monthsSinceClose))

  const printed = printedWeightPercents(shares)
  const weights: ReconciliationWeight[] = usable.map((s, i) => {
    const gross = grossAdjustmentPct(s)
    const parts = [sizePhrase(s, args.subjectSqft), recencyPhrase(s, args.asOf), movementPhrase(s, gross)]
    const leads: string[] = []
    // "closest in size to yours" adds nothing beside "the same size as yours",
    // and printing both reads as padding.
    if (closestSize != null && closestSize > 0 && Math.abs(s.sqft - args.subjectSqft) === closestSize) {
      leads.push('closest in size to yours')
    }
    if (s.monthsSinceClose === mostRecent) leads.push('the most recent sale')
    if (gross === smallestGross) leads.push('the smallest adjustment of the sales behind this price')
    return {
      listingKey: s.listingKey,
      address: s.address,
      weight: printed[i] ?? round1(share(s, i) * 100),
      weightRaw: +rawOf(s).toFixed(4),
      adjustedPrice: Math.round(s.adjustedPrice),
      grossAdjustmentPct: gross,
      reason: [...leads, ...parts].join(', '),
    }
  })

  const leader = [...weights].sort(
    (a, b) => b.weight - a.weight || a.listingKey.localeCompare(b.listingKey),
  )[0]!
  // A SUPERLATIVE ONLY WHEN IT IS TRUE OF THE SHARES. When the leader's share
  // equals another sale's, no one sale carries the most weight, and the
  // largest remainder may still print one of them a tenth higher.
  const topShare = Math.max(...shares)
  const tied = usable
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => Math.abs((shares[i] ?? 0) - topShare) <= 1e-9)
  if (tied.length > 1) {
    const figures = tied.map(({ i }) => weights[i]!.weight.toFixed(1))
    const same = figures.every((f) => f === figures[0])
    const who =
      tied.length === usable.length
        ? `The ${countWord(usable.length)} sales behind this price carry equal weight`
        : `${joinAnd(tied.map(({ s }) => s.address))} carry equal weight, the most of the ${countWord(
            usable.length,
          )} sales behind this price`
    const sentence = same
      ? `${who}, at ${figures[0]} percent each.`
      : `${who}. Rounded to add up to 100, the table shows ${joinAnd(figures)} percent.`
    return { weights, mostWeighted: leader.listingKey, weightedPrice, sentence }
  }
  // A TIE AT THE PRECISION THE TABLE PRINTS (reader review 2026-10-08, 1355
  // Jacksonville). 1340 Cumberland's share was 33.45 percent and 1613
  // Ithaca's 33.40; both print 33.4, and "1340 Cumberland carries the most
  // weight ... at 33.4 percent" named one of two equal figures on the page.
  // When the leader's printed figure is another sale's too, every sale that
  // prints it is named.
  const printedTop = leader.weight
  const printedTied = weights
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.weight.toFixed(1) === printedTop.toFixed(1))
  if (printedTied.length > 1) {
    const figure = printedTop.toFixed(1)
    const sentence =
      printedTied.length === usable.length
        ? `The ${countWord(usable.length)} sales behind this price carry equal weight, at ${figure} percent each.`
        : `${joinAnd(printedTied.map(({ i }) => usable[i]!.address))} carry the most weight of the ${countWord(
            usable.length,
          )} sales behind this price, at ${figure} percent each.`
    return { weights, mostWeighted: leader.listingKey, weightedPrice, sentence }
  }
  const leaderSale = usable.find((s) => s.listingKey === leader.listingKey)!
  const where = leadingLocation(leaderSale, usable)
  const why = [
    `it is ${sizePhrase(leaderSale, args.subjectSqft)}`,
    `it ${recencyPhrase(leaderSale, args.asOf)}`,
    leader.grossAdjustmentPct === smallestGross && usable.length > 1
      ? 'it needed the smallest adjustment of any of them'
      : movementPhrase(leaderSale, leader.grossAdjustmentPct),
  ]
  // Location first when the step is what put it on top (leadingLocation).
  if (where) why.unshift(`it is ${where}`)
  // ONE COUNT (tasteReview round three, §2 item 1). The sentence states how
  // many sales are behind the price, and it is the same number as the weights
  // below it — because the sales set aside by the range rule never reach this
  // function at all.
  const sentence = `${leader.address} carries the most weight of the ${countWord(
    usable.length,
  )} sales behind this price, at ${leader.weight} percent: ${why.slice(0, -1).join(', ')}, and ${why[why.length - 1]}.`

  return { weights, mostWeighted: leader.listingKey, weightedPrice, sentence }
}
