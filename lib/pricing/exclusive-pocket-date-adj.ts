/**
 * Exclusive-pocket date-adjust residual (Canter 2026-09-15 → 2026-09-17).
 *
 * Admin already owns picker exclusivity (SaddleStone / Horse Back / Ranch in;
 * Clearpine / Forest Edge / Grand Peaks out). Do not reopen that path.
 *
 * The city monthly index is every Sisters sale. Walking exclusive-pocket
 * Horse Back closes along a rising city series reintroduces the upmarket
 * ppsf the picker excluded and pumps recommend toward ~$800k+. Flex uses
 * nearer list/sold without that pump.
 *
 * Matt 2026-09-17 Flex-style cool: exclusive pocket refuses upward city-index
 * pump (factor > 1 → flat) but allows downward cooling (factor ≤ 1). Story
 * stays 0 on the exclusive pocket. Story is killed entirely — even when
 * the pocket is starved and widens one ring. Matt 2026-10-08: size adjusts on
 * the pocket too, so the notes below say only that story class does not
 * adjust (lib/pricing/size-adjustment.ts owns the size line).
 */

import type { MarketPath } from '@/lib/pricing/market-path'
import { classifyRungName } from '@/lib/pricing/rung-class'

export const TIME_ADJUSTMENT_MEASURE_POCKET = 'sold and last-ask prices in this exclusive pocket'

/**
 * The pocket basis when NO sale moved for date: every rise in the city index
 * was refused and no sale's month sat above today's level, so each sale is
 * priced on its own sold figure.
 */
export const TIME_ADJUSTMENT_BASIS_POCKET = 'exclusive-pocket-sold-list' as const

/**
 * The pocket basis when at least one sale DID move for date. Those moves are
 * the city's pricing_market_index (every home sale in the city), walked only
 * down (applyExclusivePocketDateAdj). The record used to keep the sold-list
 * basis and say "date adjustment does not walk pricing_market_index for bend
 * ... The Bend city index is not used" over seven comps stamped
 * marketPathSource 'index', six of them moved by that index (reader review,
 * 62475 Woodsman, 2026-10-08). The basis now names the path that moved them.
 */
export const TIME_ADJUSTMENT_BASIS_POCKET_INDEX = 'exclusive-pocket-city-index-down' as const

/** Either exclusive-pocket basis, the one that moved sales or the one that moved none. */
export function isPocketTimeBasis(basis: unknown): boolean {
  return basis === TIME_ADJUSTMENT_BASIS_POCKET || basis === TIME_ADJUSTMENT_BASIS_POCKET_INDEX
}

/**
 * Matt 2026-09-17 re-anchor: Canter gold bar = live market-cool Rec ~$680
 * (@ 0cccf1ea4). FlexMLS ~$659 RETIRED as Tip Ready refuse bar.
 * Tip Ready: |Recommended − CANTER_GOLD_RECOMMEND| ≤ CANTER_GOLD_TOLERANCE.
 */
export const CANTER_GOLD_RECOMMEND = 680_000
/** Live closed-comp band around the cool Rec (reasonable gate). */
export const CANTER_GOLD_LOW = 675_000
export const CANTER_GOLD_HIGH = 705_000
export const CANTER_GOLD_TOLERANCE = 40_000

/** @deprecated Flex ~$659 retired — aliases to CANTER_GOLD_*. */
export const FLEX_CANTER_RECOMMEND = CANTER_GOLD_RECOMMEND
/** @deprecated use CANTER_GOLD_LOW */
export const FLEX_CANTER_LOW = CANTER_GOLD_LOW
/** @deprecated use CANTER_GOLD_HIGH */
export const FLEX_CANTER_HIGH = CANTER_GOLD_HIGH

/** Retired Flex refuse bar — history only; never Tip Ready refuse. */
export const RETIRED_FLEX_CANTER_RECOMMEND = 659_000

/** Tip Ready: Canter Rec near live gold ~$680. */
export function canterRecommendNearGold(recommended: number): boolean {
  if (!(recommended > 0)) return false
  return Math.abs(recommended - CANTER_GOLD_RECOMMEND) <= CANTER_GOLD_TOLERANCE
}

/** Matt 2026-09-17 — Tip Ready refuse below this many closed comps. */
export const CANTER_MIN_CLOSED_COMPS = 5

/**
 * True only when every rung is the subject's own street, own plat, or the
 * 0.25 mi pocket, and at least one of those is present. Any wider rung,
 * including a name the classifier does not know, keeps size adjustment and
 * the upward date move. `broker-selected` on its own is not exclusive.
 */
export function selectionIsExclusivePocket(tiersUsed: readonly string[]): boolean {
  const classes = tiersUsed.map((tier) => classifyRungName(tier))
  if (classes.some((kind) => kind === 'widen' || kind === 'unclassified')) return false
  return classes.some((kind) => kind === 'exclusive')
}

// ── DOWN ONLY IF LOCAL FELL (Matt 2026-10-08) ──────────────────────────────
//
// Own-ground sales (the exclusive-pocket set: own street, own plat, pocket
// windows) move down for date along the city index ONLY when the home's own
// local read fell too. Otherwise each one stays at its sold price. The letter
// must never move sales against the local trend it prints a page earlier: on
// 62475 Woodsman the Bend index cut the June and May Shevlin West sales 7.0
// percent while the local page said Shevlin West homes of about this size
// held flat, $581 then $572 a square foot.
//
// The gate reads the SAME verdict the local page prints: the per-foot word of
// the listing-window read (lib/cma/listing-window-market.ts, `ppsfMove`, 3
// percent either way is "held flat"), built by the build from the same closes
// and the same sales area before any sale is adjusted.

/** The per-foot word the letter's local page prints. */
export type PocketLocalVerdict = 'fell' | 'held flat' | 'rose'

/**
 * Why the letter has no per-foot verdict to gate on. With none, no sale is
 * moved for date: there is no local evidence of a fall, so the sold price
 * stands (Matt 2026-10-08: "ONLY when the home's own local read also fell").
 *
 *  - no-listing-window: the home has no dated listing period to read over (it
 *    is not a failed listing, or that period is too old to tell a story);
 *  - too-few-sales: the window held no closes, or too few in the home's place
 *    for a median in each half, so the local page prints no chart;
 *  - one-sale-a-half: the local page prints "one sale, not a trend";
 *  - no-living-area: the halves have no per-foot figure.
 */
export type PocketLocalMissing = 'no-listing-window' | 'too-few-sales' | 'one-sale-a-half' | 'no-living-area'

/** One half of the local read, as the local page prints it. */
export type PocketLocalHalf = { ppsf: number | null; n: number; from: string; to: string }

/**
 * THE HOME'S OWN LISTING AS THE LOCAL READ (Matt 2026-10-09, 3062 NW Kelly
 * Hill: "it's definitely going to be closer to 716. It's listed at 699
 * currently, and it hasn't sold."). A home on the market today, not under
 * contract, whose ask has come down during its current stretch, is its own
 * evidence that the local market did not rise: it has sat unsold through its
 * asks. When its listing window holds too few local sales to give a per-foot
 * verdict, that record stands in for the local read, and own-ground sales
 * move down with the city index as they would if the local read had fallen.
 * Every figure is the subject's own MLS record.
 */
export type PocketOwnListing = {
  /** The Pacific day the current stretch on the market began. */
  since: string
  /** The ask in effect when that stretch began. */
  firstAsk: number
  /** The ask today. Under `firstAsk` by construction. */
  ask: number
  /** Whole calendar days from `since` to the letter date. */
  days: number | null
}

/**
 * The home's own local read, reduced to what the date gate and the date
 * sentences need. `verdict` is null exactly when the local page prints no
 * per-foot rise, fall or flat.
 */
export type PocketLocalRead = {
  verdict: PocketLocalVerdict | null
  missing: PocketLocalMissing | null
  /** The place the local page names (a subdivision or neighborhood). */
  place: string | null
  /** True when the read is homes about the subject's size. */
  sized: boolean
  /** 'townhouse' or 'condo' when the subject is not a detached house. */
  productNoun: string | null
  early: PocketLocalHalf | null
  late: PocketLocalHalf | null
  /**
   * True when the window runs from the day the home came on the market to the
   * letter date because it is on the market today (Matt 2026-10-09). The
   * sentences then say "since your home came on the market", never "while
   * your home was listed". Absent on a failed listing's window.
   */
  ongoing?: boolean
  /**
   * The home's own listing, standing in for a local read too thin to judge
   * (PocketOwnListing). Only on an on-market home with no per-foot verdict.
   */
  ownListing?: PocketOwnListing | null
}

/** Which way the gate went, stored on the time-adjustment basis. */
export type PocketDateBranch = 'local-fell' | 'local-held-flat' | 'local-rose' | 'own-listing-unsold' | 'no-local-read'

export function pocketDateBranch(local: Pick<PocketLocalRead, 'verdict' | 'ownListing'>): PocketDateBranch {
  if (local.verdict === 'fell') return 'local-fell'
  if (local.verdict === 'held flat') return 'local-held-flat'
  if (local.verdict === 'rose') return 'local-rose'
  if (local.ownListing) return 'own-listing-unsold'
  return 'no-local-read'
}

/**
 * True when the gate lets a sale move down with the city index: the local
 * per-foot read fell, or, with no per-foot verdict, the home's own listing
 * has sat unsold through its asks (Matt 2026-10-09). Every reader of the gate
 * asks this one question, so the move and the sentence cannot disagree.
 */
export function pocketLocalAllowsDown(local: Pick<PocketLocalRead, 'verdict' | 'ownListing'>): boolean {
  if (local.verdict === 'fell') return true
  return local.verdict == null && local.ownListing != null
}

function wholeDollars(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/**
 * The engine-note reason a cooling move was allowed, for the stored records:
 * "The local read fell" or the home's own listing in figures.
 */
export function pocketDownReason(local: Pick<PocketLocalRead, 'verdict' | 'ownListing'>): string {
  const own = local.verdict == null ? local.ownListing : null
  if (own) {
    const days = own.days != null ? `, ${own.days} ${own.days === 1 ? 'day' : 'days'}` : ''
    return `The home has been on the market since ${own.since}${days}, not sold and not under contract, its ask cut from ${wholeDollars(own.firstAsk)} to ${wholeDollars(own.ask)}; that listing stands in for the local read (Matt 2026-10-09)`
  }
  return 'The local read fell'
}

/** A local read with no verdict, for a letter that has nothing to read. */
export function missingPocketLocalRead(missing: PocketLocalMissing): PocketLocalRead {
  return { verdict: null, missing, place: null, sized: false, productNoun: null, early: null, late: null }
}

/** The ruling, as the stored basis records it. */
export const POCKET_LOCAL_GATE_RULE =
  'Matt 2026-10-08, down only if local fell: own-ground sales move down along the city index only when the per-foot price of homes like the subject in its own place also fell while it was listed; otherwise each sale stays at its sold price.'

/**
 * The gate as stored on the time-adjustment basis (`timeAdjustment.localGate`):
 * the local read the build gated on, which branch that set, and whether any
 * sale actually moved. The letter's date sentences are composed from this.
 */
export type PocketLocalGateRecord = PocketLocalRead & {
  branch: PocketDateBranch
  /** True when at least one sale was moved for date. */
  moved: boolean
  rule: string
}

export function pocketLocalGateRecord(local: PocketLocalRead, moved: boolean): PocketLocalGateRecord {
  return { ...local, branch: pocketDateBranch(local), moved, rule: POCKET_LOCAL_GATE_RULE }
}

/** The path with no date move: factor 1, and marked as not walked so recency weighs it as unmoved. */
function refuseDateMove(path: MarketPath): MarketPath {
  return {
    ...path,
    factor: 1,
    monthlyRate: 0,
    regime: 'flat',
    capped: true,
  }
}

/**
 * Flex-style time/date on exclusive pocket (market cool / no false hope):
 * allow downward cooling; refuse upward city-index pump.
 *
 * `local` is the letter's own local read (Matt 2026-10-08, "Down only if local
 * fell"). When it is passed, a downward move is kept only when that read fell;
 * held flat, rose or no verdict at all leaves every sale at its sold price.
 * A caller with no local read (the listing-page stamp, which prints no local
 * page) passes nothing and keeps the down-only walk.
 */
export function applyExclusivePocketDateAdj(
  path: MarketPath,
  exclusivePocket: boolean,
  local?: Pick<PocketLocalRead, 'verdict' | 'ownListing'>,
): MarketPath {
  if (!exclusivePocket) return path
  if (path.factor === 1) return path
  // Rising city index: refuse the pump, whatever the local read says.
  if (path.factor > 1) return refuseDateMove(path)
  // Cooling: kept only when the home's own ground fell too, if we know it, or
  // when the home's own unsold listing stands in for a read too thin to judge.
  if (local !== undefined && !pocketLocalAllowsDown(local)) return refuseDateMove(path)
  return path
}

/**
 * @deprecated Matt 2026-09-17 killed story-adj entirely. Always returns 0.
 * Kept so Tip Ready contracts can assert the refuse still holds if called.
 */
export function applyExclusivePocketStoryAdj(_rawStoryAdj: number, _exclusivePocket: boolean): number {
  return 0
}

export function exclusivePocketPathNote(
  address: string,
  cityPath: MarketPath,
  applied?: MarketPath,
  local?: PocketLocalRead,
): string {
  const cityPct = ((cityPath.factor - 1) * 100).toFixed(1)
  const used = applied ?? (cityPath.factor <= 1 ? cityPath : { ...cityPath, factor: 1 })
  // A cooling the local gate refused (Matt 2026-10-08, down only if local fell).
  if (local !== undefined && !pocketLocalAllowsDown(local) && cityPath.factor < 1 && used.factor === 1) {
    return `${address}: exclusive pocket, not moved for date. ${pocketLocalReadNote(local)} The city index would have moved it ${cityPct}%. Story class does not adjust.`
  }
  if (used.factor < 1) {
    const appliedPct = ((used.factor - 1) * 100).toFixed(1)
    if (cityPath.factor > 1) {
      return `${address}: exclusive pocket — Flex-style cooling date adjustment ${appliedPct}% (city index refused upward pump of ${cityPct}%). Story class does not adjust.`
    }
    return `${address}: exclusive pocket — Flex-style cooling date adjustment ${appliedPct}% along the city index (pricing_market_index, ${used.fromPpsf} to ${used.toPpsf} $/sqft). Story class does not adjust.`
  }
  if (cityPath.factor > 1) {
    return `${address}: exclusive pocket — date adjustment not applied along the city index (would have pumped ${cityPct}%). No date move. Story class does not adjust.`
  }
  return `${address}: exclusive pocket — date adjustment flat. No date move. Story class does not adjust.`
}

function halfNote(half: PocketLocalHalf | null): string {
  if (!half) return ''
  const sales = `${half.n} ${half.n === 1 ? 'sale' : 'sales'}`
  return ` (${sales}, ${half.from} to ${half.to})`
}

function wholeUsd(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : 'no figure'
}

/**
 * The local read in one line for the stored record: the place, the verdict
 * and the two per-foot figures with their sale counts and dates, exactly as
 * the local page measured them. No em dash: pricing notes are prose the
 * brand-voice gate reads.
 */
export function pocketLocalReadNote(local: PocketLocalRead): string {
  if (local.verdict == null) {
    const listed = local.ongoing ? 'since it came on the market' : 'while it was listed'
    const why =
      local.missing === 'no-listing-window'
        ? 'the home has no dated listing period to read over'
        : local.missing === 'one-sale-a-half'
          ? 'one half of the listing held a single sale, which is not a trend'
          : local.missing === 'no-living-area'
            ? 'the sales carry no per-foot figure'
            : `too few sales closed in the home's own place ${listed}`
    if (local.ownListing) return `No local per-foot read: ${why}. ${pocketDownReason(local)}.`
    return `No local per-foot read: ${why}, so there is no local evidence of a fall.`
  }
  const where = `${local.place ?? 'the home\'s own place'}${local.sized ? ', homes about this size' : ''}`
  const early = `${wholeUsd(local.early?.ppsf)} a square foot${halfNote(local.early)}`
  const late = `${wholeUsd(local.late?.ppsf)}${halfNote(local.late)}`
  const word = local.verdict === 'held flat' ? 'held flat, from' : `${local.verdict} from`
  return `Local read (${where}): per-foot price ${word} ${early} to ${late}.`
}

/** One closed sale the date adjustment did or did not move. */
export type AppliedDateMove = {
  address: string
  closePrice: number
  timeAdjustment: number
  timeAdjustedPrice?: number | null
  /** The close date, so the basis can record the index level the sale moved from. */
  closeDate?: string | null
}

const DATE_MOVE_MIN_DOLLARS = 500

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/**
 * The sentence for the moves that were actually applied. Null when nothing
 * moved. Names the percentage and the comps, so a grid that walked a sale
 * from $621,000 to $594,000 cannot sit under a line that says no date
 * adjustment was applied.
 *
 * EVERY "MOVED X PERCENT, FROM A TO B" IS TRUE OF A AND B (reader review,
 * 2382 Jackson, 2026-10-07). The date move starts from the sale price after
 * a recorded seller concession (comparisonSalePrice), and `timeAdjustedPrice`
 * is that start plus the date move. The line used to print the date move as a
 * share of the CLOSE and run it from the close to the post-concession price:
 * "2266 Jackson moved -8.1 percent, from $690,000 to $619,448", where
 * $690,000 to $619,448 is really -10.2 percent and the date move alone is
 * -8.2 percent of $675,000. Now the percent is the date move over the price
 * it moved from, the "from" is that price, and a concession that came off
 * first is named with the close it came off.
 */
export function describeAppliedDateAdjustments(moves: readonly AppliedDateMove[]): string | null {
  const moved = moves.filter((m) => {
    if (!(m.closePrice > 0) || !Number.isFinite(m.timeAdjustment)) return false
    return Math.abs(m.timeAdjustment) >= DATE_MOVE_MIN_DOLLARS
  })
  if (moved.length === 0) return null
  const bits = moved.map((m) => {
    const hasTo = m.timeAdjustedPrice != null && Number.isFinite(m.timeAdjustedPrice) && m.timeAdjustedPrice > 0
    // The price the date move started from: the close, less any recorded
    // seller concession. Read back off the stored pair so the line and the
    // grid can never disagree about it.
    const from = hasTo ? Math.round((m.timeAdjustedPrice as number) - m.timeAdjustment) : m.closePrice
    const to = hasTo ? (m.timeAdjustedPrice as number) : m.closePrice + m.timeAdjustment
    const base = from > 0 ? from : m.closePrice
    const pct = (m.timeAdjustment / base) * 100
    const sign = pct > 0 ? '+' : ''
    const where = m.address.trim() || 'one sale'
    const concession = Math.round(m.closePrice - base)
    const move = `${where} moved ${sign}${pct.toFixed(1)} percent for date, from ${usd(base)} to ${usd(to)}`
    return concession >= 1
      ? `${move}, after ${usd(concession)} in seller concessions came off its ${usd(m.closePrice)} sale`
      : move
  })
  const head =
    moved.length === 1
      ? 'Date adjustment was applied to one sale.'
      : `Date adjustment was applied to ${moved.length} sales.`
  return `${head} ${bits.join('; ')}.`
}

/**
 * What the pocket did with the city index, when it moved at least one sale.
 * The moves ARE that index, walked down, so the note says so; it used to say
 * "The Bend city index is not used to pump prices." beside six sales the Bend
 * index had just moved down (reader review, 62475 Woodsman, 2026-10-08).
 */
export function pocketIndexDownClause(city: string | null | undefined): string {
  const place = (city ?? '').trim() || 'this city'
  return `Each moved sale walked the ${place} city index (pricing_market_index, every home sale in ${place}) down to the median of its last three complete months; a rise in that index is never applied to these sales.`
}

/**
 * Set-level note. Must match the math: when sales were cooled, name those
 * sales and the percentage and the city index that moved them. When nothing
 * moved, say the city index was not walked.
 */
export function exclusivePocketSetNote(
  city: string,
  coolingApplied: boolean,
  applied?: readonly AppliedDateMove[],
  /** The letter's local read, when the build gated on it (Matt 2026-10-08). */
  local?: PocketLocalRead,
  /** False when the city has no monthly index to move a sale by. */
  indexAvailable = true,
): string {
  const place = (city ?? '').trim() || 'this city'
  const detail = describeAppliedDateAdjustments(applied ?? [])
  const gate = local !== undefined ? ` ${pocketLocalReadNote(local)}` : ''
  if (coolingApplied && detail) {
    // The home's own unsold listing already says itself in the gate note; the
    // "local read fell" clause is only for a per-foot read that fell.
    const why =
      local === undefined
        ? ''
        : local.verdict === 'fell'
          ? `${gate} The local read fell, so these sales move down with the ${place} city index.`
          : `${gate} These sales move down with the ${place} city index.`
    return `These sales are the exclusive pocket.${why} ${detail} ${pocketIndexDownClause(place)} Story class does not adjust.`
  }
  if (coolingApplied) {
    return `These sales are the exclusive pocket.${gate} Flex-style cooling date adjustment moves a sale down along the ${place} city index where its month sat above today's level. ${pocketIndexDownClause(place)} Story class does not adjust.`
  }
  if (local !== undefined && !pocketLocalAllowsDown(local)) {
    return `These sales are the exclusive pocket.${gate} A sale on the home's own ground moves down along the ${place} city index only when that local read fell, so no sale is moved for the month it sold and each one stands at its sold price. Story class does not adjust.`
  }
  if (local !== undefined) {
    const lead = local.verdict === 'fell' ? 'The local read fell, but no' : 'No'
    const leadNoIndex = local.verdict === 'fell' ? 'The local read fell, but there' : 'There'
    return indexAvailable
      ? `These sales are the exclusive pocket.${gate} ${lead} sale closed in a month the ${place} city index sat above today's level, so no sale is moved for the month it sold. Story class does not adjust.`
      : `These sales are the exclusive pocket.${gate} ${leadNoIndex} is no ${place} city index to move a sale by, so no sale is moved for the month it sold. Story class does not adjust.`
  }
  return `These sales are the exclusive pocket. Date adjustment is not applied along the ${place} city index. That series includes tracts already excluded from this set. No sale is moved for the month it sold. Story class does not adjust.`
}

/**
 * A cooled exclusive-pocket band may not sit below every meaningful
 * same-subdivision adjusted sale. The floor is that adjusted price, never
 * the unadjusted close: lifting to the raw close puts a cooled top-weight
 * sale (Slate Rolen, $594k) outside the band it should anchor.
 *
 * When `sameSubdivisionAdjustedPrices` is passed, raw closes are ignored.
 * An empty adjusted list means there is no same-subdivision floor.
 */
export function floorExclusivePocketBandToSameSubCloses(args: {
  valueLow: number
  valueHigh: number
  sameSubdivisionClosePrices: readonly number[]
  sameSubdivisionAdjustedPrices?: readonly number[]
  coolingApplied: boolean
}): { valueLow: number; valueHigh: number; floored: boolean; floor: number | null } {
  const low = Math.min(args.valueLow, args.valueHigh)
  const high = Math.max(args.valueLow, args.valueHigh)
  const adjusted =
    args.sameSubdivisionAdjustedPrices?.filter((n) => Number.isFinite(n) && n > 0) ?? null
  const closes =
    adjusted != null
      ? adjusted
      : args.sameSubdivisionClosePrices.filter((n) => Number.isFinite(n) && n > 0)
  if (!args.coolingApplied || closes.length === 0) {
    return { valueLow: low, valueHigh: high, floored: false, floor: null }
  }
  const floor = Math.min(...closes)
  // Never lift the low above a meaningful same-subdivision adjusted sale.
  // The floor is the lowest of those sales, so a band that already includes
  // one stays where the adjustment put it.
  if (low >= floor) return { valueLow: low, valueHigh: high, floored: false, floor }
  return { valueLow: floor, valueHigh: Math.max(floor, high), floored: true, floor }
}
