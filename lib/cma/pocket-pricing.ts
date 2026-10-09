/**
 * The exclusive pocket's two build steps that sit around pricing, shared by
 * the build (lib/cma/build.ts priceSet) and its dry run
 * (scripts/cma-build-dryrun.ts), so the dry run prices a pocket the way the
 * letter does.
 *
 * 1. DOWN ONLY IF LOCAL FELL (Matt 2026-10-08). Before any sale is adjusted,
 *    the letter's local read is measured: the same listing-window read the
 *    local page prints ("While your home was listed, the median sale in
 *    Shevlin West for a home about this size ... The price per square foot
 *    held flat, $581 then $572"), over the same closes and the same sales
 *    area. Its per-foot verdict gates the pocket's date move: only "fell"
 *    lets a sale move down with the city index. The build hands this one
 *    move to the local page, so the two pages print one read.
 *
 * 2. The pocket's band finish: the set note, the same-subdivision floor on a
 *    cooled band, and the minimum band width (moved here unchanged from the
 *    build).
 */

import { salesSearchAndArea } from '@/lib/cma/assemble-competition'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import {
  listingWindowDates,
  measureListingWindowMarket,
  type ListingWindowCloses,
} from '@/lib/cma/listing-window-load'
import { pocketLocalReadOf, type ListingMarketMove } from '@/lib/cma/listing-window-market'
import type { CmaAdjustedComp, CmaComp, CmaPricing, CmaSubject } from '@/lib/cma/types'
import {
  ensureMinBandWidth,
  roundPriceDown,
  roundPriceUp,
  syncRangeRuleToHeroBand,
} from '@/lib/pricing/estimate'
import {
  exclusivePocketSetNote,
  floorExclusivePocketBandToSameSubCloses,
  type AppliedDateMove,
  type PocketLocalRead,
} from '@/lib/pricing/exclusive-pocket-date-adj'
import { attachSellerNet } from '@/lib/pricing/seller-net'

/**
 * The local page's move for the sales this set prices, and the per-foot
 * verdict the pocket's date gate reads off it.
 *
 * `comps` are the sales as the adjusters will build them (their place, plat
 * slug, rung and position: nothing a date or size move changes), so the area
 * is the one assembleCompetition will draw for the letter. With no dated
 * listing window there is nothing to read ('no-listing-window'); a window
 * whose closes are too thin for the page to print a verdict gives
 * 'too-few-sales', 'one-sale-a-half' or 'no-living-area'. Each of those is
 * no local evidence of a fall, and no sale moves for date.
 */
export function localReadForSet(args: {
  subject: CmaSubject
  comps: readonly CmaComp[]
  diagnostics: CompSelectionDiagnostics
  subjectZone: string | null
  /** The subject's listing window: the same dates the local page reads over. */
  window: { city: string | null | undefined; listDate: string | null | undefined; offDate: string | null | undefined }
  /** The window's closes, read once before pricing (loadListingWindowCloses). */
  closes: ListingWindowCloses | null
  /** The letter's calendar day, stamped on the move. */
  asOf: string
}): { listingMarket: ListingMarketMove | null; pocketLocal: PocketLocalRead } {
  const { compArea } = salesSearchAndArea({
    subject: args.subject,
    comps: args.comps,
    diagnostics: args.diagnostics,
    subjectZone: args.subjectZone,
  })
  const listingMarket = measureListingWindowMarket(args.closes, {
    subdivision: args.subject.subdivision,
    sqft: args.subject.sqft,
    latitude: args.subject.latitude,
    longitude: args.subject.longitude,
    asOf: args.asOf,
    areaKind: compArea?.kind ?? null,
    areaName: compArea?.names?.[0] ?? null,
    propertySubType: args.subject.propertySubType,
  })
  const hasWindow = listingWindowDates(args.window) != null
  return {
    listingMarket,
    pocketLocal: pocketLocalReadOf(listingMarket, hasWindow ? 'too-few-sales' : 'no-listing-window'),
  }
}

/**
 * The exclusive pocket's band finish, applied in place to a priced pocket set.
 * Moved unchanged from lib/cma/build.ts priceSet, except that the set note now
 * names the local read the date move was gated on.
 */
export function finishExclusivePocketPricing(
  p: CmaPricing,
  args: {
    subject: CmaSubject
    adj: readonly CmaAdjustedComp[]
    /** The kept comps the reader can count: the seller-net sentence counts these. */
    set: readonly CmaComp[]
    pocketLocal?: PocketLocalRead
  },
): void {
  const { subject, adj } = args
  const moves: AppliedDateMove[] = adj.map((c) => ({
    address: c.address,
    closePrice: c.closePrice,
    timeAdjustment: c.timeAdjustment,
    timeAdjustedPrice: c.timeAdjustedPrice,
  }))
  const coolingApplied = moves.some((c) => Number.isFinite(c.timeAdjustment) && c.timeAdjustment < 0)
  p.notes.unshift(
    exclusivePocketSetNote(subject.city, coolingApplied, moves, args.pocketLocal, (p.timeAdjustment?.n ?? 0) > 0),
  )
  // The subject's own subdivision: the picker's own-plat stamp (the one ground
  // decision, lib/pricing/plat-ground.ts, which counts a recorded addition or
  // phase inside the subject's neighborhood and any MLS spelling of its plat,
  // Matt 2026-10-08 "Yes, everywhere"), or the subject's own MLS name.
  const sameSub = (subject.subdivision ?? '').trim().toLowerCase()
  const sameSubRows = adj.filter(
    (c) => c.ownPlat === true || (sameSub !== '' && (c.subdivision ?? '').trim().toLowerCase() === sameSub),
  )
  const weightTotal = sameSubRows.reduce((sum, c) => sum + (c.weight > 0 ? c.weight : 0), 0)
  const topWeight = sameSubRows.reduce((best, c) => (c.weight > best ? c.weight : best), 0)
  const meaningfulAdjusted = sameSubRows
    .filter((c) => {
      const share = weightTotal > 0 ? c.weight / weightTotal : 0
      return c.adjustedPrice > 0 && (share >= 0.05 || c.weight === topWeight)
    })
    .map((c) => c.adjustedPrice)
  const floored = floorExclusivePocketBandToSameSubCloses({
    valueLow: p.valueLow,
    valueHigh: p.valueHigh,
    sameSubdivisionClosePrices: sameSubRows
      .map((c) => c.closePrice)
      .filter((n): n is number => Number.isFinite(n) && n > 0),
    sameSubdivisionAdjustedPrices: meaningfulAdjusted,
    coolingApplied,
  })
  if (floored.floored && floored.floor != null) {
    p.valueLow = floored.valueLow
    p.valueHigh = floored.valueHigh
    if (p.conservative < floored.valueLow) p.conservative = floored.valueLow
    if (p.recommended < floored.valueLow) p.recommended = floored.valueLow
    p.notes.unshift(
      `The printed low is the lowest meaningful same-subdivision adjusted sale at $${Math.round(floored.floor).toLocaleString('en-US')}. A cooled price below every one of those sales does not set the range.`,
    )
    attachSellerNet(p, [...args.set])
  }
  // Recorded after the same-subdivision floor and before the open.
  // The open below is presentation. It must not move the recommendation
  // or the conservative tier. The nudge chases this low.
  const evidenceLow = Math.min(p.valueLow, p.valueHigh)
  if (p.rangeRule) p.rangeRule = { ...p.rangeRule, evidenceLow }
  const widened = ensureMinBandWidth(p.valueLow, p.valueHigh, p.recommended)
  p.valueLow = roundPriceDown(widened.low)
  p.valueHigh = roundPriceUp(widened.high)
  if (p.recommended < p.valueLow) p.recommended = p.valueLow
  if (p.recommended > p.valueHigh) p.recommended = p.valueHigh
  const synced = syncRangeRuleToHeroBand(p)
  p.rangeRule = synced.rangeRule
}
