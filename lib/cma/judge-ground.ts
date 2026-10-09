/**
 * An exclusion counts only when the reason is true of the fields the model was
 * shown. The comp-review judge invents cutoffs ("below a 1600 sqft size floor",
 * "below a $419/sqft floor") that the subject and the sale do not support, and
 * one invented line can drop every candidate.
 *
 * Rules, in order. A failure ignores the exclusion: the vote is kept at weak.
 *
 *  1. A measurement the reason states (the sale's own $/sqft, a sqft figure
 *     that is not a floor, a "built YYYY", a bed count, an acreage) must match
 *     the subject or the comp. A number that matches neither is a contradiction.
 *  2. A size floor (a cutoff that is not the subject's living area) is supported
 *     only when the comp is on the failing side of that cutoff AND the living
 *     area gap is past SIZE_FLOOR_GAP (25%, the one price-setting band, rule
 *     20). A smaller gap is the invented 1600 sqft floor: the sale is a bit
 *     smaller, not a different size class.
 *  3. A direct size comparison that names the real sqft, with no floor, needs
 *     the same gap as a floor: past SIZE_FLOOR_GAP (25%, the picker's
 *     living-area band). A tighter cut dropped sales the picker kept. There is
 *     one size cutoff, and it is the picker's: a sale at exactly 25% sets the
 *     price (lib/pricing/price-set.ts clearlyDifferentSize), so the review
 *     may not drop it either.
 *  4. A $/sqft floor, ceiling, or band is supported only when the comp's actual
 *     $/sqft is outside it. "Below $419" when the sale is at $430 is ignored.
 *  5. ONE 20% LINE (Matt 2026-10-08, lib/pricing/price-tier.ts). When the
 *     home has an independent price anchor (the selection's
 *     diagnostics.price_anchor, the figure the comp search graded every sale
 *     against), a price-tier cut is supported only when the sale's own closed
 *     $/sqft (close price over living area, before date adjustment) is outside
 *     that anchor plus or minus 20%. A cut of a sale inside the line is
 *     overridden like any unsupported exclusion: kept at half weight. The
 *     search admitted it on that same line, so the review cannot drop it for
 *     price. With no anchor, the old rule holds: a cut that clears the cited
 *     number is still ignored when the sale sits within PRICE_TIER_OUTLIER
 *     (20%) of the median $/sqft of the other candidates.
 *  6. Lot (Matt 2026-10-08, "review uses search's rule"). Under one acre on
 *     both sides, a lot difference is disclosed (the Lot size row beside every
 *     sale in the comp matrix, and the sentence Basis and limits states,
 *     lib/cma/lot-disclosure.ts) and is never grounds to drop a sale: the comp
 *     search only separates lots at one acre (lotCompatible in
 *     lib/pricing/classes.ts). The exclusion is overridden and the sale kept at
 *     half weight with the difference stated. At one acre and above on either
 *     side the old test holds: the cited acres must match, and the lots must
 *     actually differ (ratio at least 2, or at least 0.15 acres).
 *  7. Vintage is not a second cut. The picker already applied year built, and
 *     it widens closed-sale age and date when the first location search is
 *     short of 3. A 15-year wall here dropped sales the picker kept, so a
 *     vintage exclusion is kept.
 *  8. Structure type: a different MLS sub-type; a multi-unit on one side and
 *     not the other, read by the search's own reader (multiUnitFromRemarks,
 *     rule 23); an ADU sale against a subject whose remarks state none
 *     (aduSaleRefused, Matt 2026-10-08); or remarks that name an attached,
 *     condo or manufactured product the subject is not. "Split-level" is a
 *     story, not a different product. A structure claim those readers do not
 *     back is ignored, whatever basis the model gave it.
 *  9. Location: a place word in the reason (fairway, golf, resort, highway)
 *     must be in the comp remarks or view and not in the subject's.
 * 10. Condition: a condition word in the reason must appear in the comp remarks.
 * 11. Beds or baths: the room rule (lib/pricing/room-counts.ts, skill 0.1)
 *     is the only room wall. Cited counts must match the fields. An exclusion
 *     for a gap that rule allows (up to two whole bedrooms off, up to two
 *     whole bathrooms off, or both) is ignored. An exclusion for three or
 *     more whole rooms apart on one count stays.
 * 12. Basis `other` with no checkable claim is kept. An exclusion we cannot
 *     disprove is not thrown out. An exclusion we can disprove is.
 *
 * Legitimate exclusions stay: a real duplex in the remarks, a living area gap
 * past 25%, a $/sqft outside the 20% line, a doubled lot at an acre or more, a room gap
 * the one-room rule refuses, a fairway the remarks actually name. Year built
 * does not drop a sale the picker kept.
 */

import type { CmaComp, CmaSubject } from '@/lib/cma/types'
import { productTypeCompatible } from '@/lib/cma/market-area'
import {
  isPriceTierExclusion,
  ppsf,
  type CompVerdict,
  type ExclusionBasis,
} from '@/lib/cma/judge-consistency'
import { PRICE_SET_SQFT_BAND } from '@/lib/pricing/price-set'
import { aduSaleRefused, multiUnitFromRemarks } from '@/lib/pricing/classes'
import { describePriceTierLine, priceTierPosition, salePpsf, type PriceTierLine } from '@/lib/pricing/price-tier'
import { carriedRoomDecision } from '@/lib/pricing/room-ground'
import { roomDifferenceSentence } from '@/lib/pricing/room-counts'

/**
 * The one size cutoff, the picker's (Matt 2026-10-08, "25% everywhere"): the
 * same band rule 20 refuses a sale on. A gap PAST it supports an exclusion; a
 * gap on it does not, because that sale set the price.
 */
export const SIZE_FLOOR_GAP = PRICE_SET_SQFT_BAND
/**
 * Share off the other candidates' median $/sqft before a price tier is real.
 * Used ONLY when the home has no independent anchor; with one, the price tier
 * is the one 20% line around it (lib/pricing/price-tier.ts).
 */
export const PRICE_TIER_OUTLIER = 0.2
/** Lots at or above an acre: the old lot test (ratio at least 2, or 0.15 acres apart). */
export const LOT_RATIO = 2
export const LOT_ACRES = 0.15
/**
 * The comp search's lot wall (lotCompatible in lib/pricing/classes.ts splits
 * acreage from in-town at one acre). Under it on BOTH sides, a lot difference
 * is disclosed, never a reason to drop a sale.
 */
export const LOT_WALL_ACRES = 1

/**
 * Two lots that actually differ: one at least LOT_RATIO times the other, or
 * LOT_ACRES apart. At an acre and above it is half of a supported lot cut
 * (lotSupported). Under an acre on both sides it is the difference rule 20
 * has the letter state instead of dropping the sale (lib/cma/lot-disclosure.ts).
 */
export function lotsDiffer(a: number, b: number): boolean {
  if (!(a > 0) || !(b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return false
  const ratio = Math.max(a, b) / Math.min(a, b)
  return ratio >= LOT_RATIO || Math.abs(a - b) >= LOT_ACRES
}

export const UNGROUNDED_KEEP_REASON =
  'Kept at half weight. The exclusion cited a threshold or fact these fields do not support.'

export type GroundRule =
  | 'kept'
  | 'contradiction'
  | 'size-floor'
  | 'size-gap'
  | 'price-not-outside'
  | 'price-cluster'
  | 'price-inside-line'
  | 'price-outlier'
  | 'lot'
  | 'lot-under-acre'
  | 'vintage'
  | 'structure'
  | 'location'
  | 'condition'
  | 'rooms'
  | 'qualitative'
  | 'unsupported'

export type GroundResult = {
  verdict: CompVerdict
  /** False when an exclude was rewritten to weak. */
  grounded: boolean
  modelTier: CompVerdict['tier']
  rule: GroundRule
}

// ONE READER FOR THE MULTI-UNIT AND ADU WORDS. The search refuses a sale on
// lib/pricing/classes.ts multiUnitFromRemarks (rule 23, symmetric) and
// aduSaleRefused (an ADU sale against a home without one, Matt 2026-10-08),
// and the review grounds a structure exclusion on those same two readers,
// so a sale the search seats as a plain detached home is never dropped here
// as a duplex, and an ADU sale the search would skip is. 644 Norton ("multi-
// unit property featuring a permitted ADU and both units") was seated by both
// ladders for 1648 Pheasant while a separate word list here backed the
// review's drop in 3 of 3 passes. The words below are only the attached,
// condo and manufactured products this grounding still reads on its own.
const OTHER_PRODUCT =
  /\b(townhomes?|townhouses?|condominiums?|condos?|manufactured|mobile home|shared wall|common wall)\b/i

/**
 * A reason that claims the sale is a different structure or carries a second
 * unit. When the readers above do not back it, it is ignored on any basis,
 * not only "structure-type", so a basis "other" claim with no number cannot
 * slip through as qualitative.
 */
const PRODUCT_CLAIM =
  /\b(structure[- ]type|product type|different product|duplex(?:es)?|tri-?plex|four-?plex|quad-?plex|quadruplex|multi-?unit|multi-?family|both units|two units|second unit|adus?|accessory dwelling|guest ?house|casitas?|guest quarters|in-law|townhomes?|townhouses?|condominiums?|condos?|manufactured|mobile home|shared wall|common wall)\b/i

const LOCATION_TOKENS = ['fairway', 'golf', 'resort', 'highway', 'parkway', 'lakefront', 'riverfront', 'commercial']

const CONDITION_TOKENS = [
  'remodel',
  'renovat',
  'tlc',
  'as-is',
  'as is',
  'fixer',
  'investor',
  'new roof',
  'studs',
  'original condition',
  'teardown',
  'tear down',
  'needs work',
  'updated',
]

type PriceRead = {
  floors: number[]
  ceilings: number[]
  claimed: number[]
}

function nums(re: RegExp, text: string): number[] {
  const out: number[] = []
  for (const m of text.matchAll(re)) {
    const raw = (m[1] ?? '').replace(/,/g, '')
    const n = Number(raw)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

function close(a: number, b: number, absTol: number, relTol: number): boolean {
  const d = Math.abs(a - b)
  return d <= absTol || d <= Math.abs(b) * relTol
}

export function readPriceClaims(reason: string): PriceRead {
  const floors = [
    ...nums(/(?:below|under)\s+(?:a\s+|the\s+)?\$?(\d{2,4}(?:,\d{3})?)/gi, reason),
    ...nums(/\$?(\d{2,4}(?:,\d{3})?)\s*(?:\/\s*sq(?:ft|\.?\s*ft)?|per square foot)?\s+floor/gi, reason),
  ]
  const ceilings = nums(/(?:above|over)\s+(?:a\s+|the\s+)?\$?(\d{2,4}(?:,\d{3})?)/gi, reason)
  const band = reason.match(/\$?(\d{2,4}(?:,\d{3})?)\s+to\s+\$?(\d{2,4}(?:,\d{3})?)\s*(?:\/\s*sq|per square)/i)
  if (band) {
    floors.push(Number(band[1]!.replace(/,/g, '')))
    ceilings.push(Number(band[2]!.replace(/,/g, '')))
  }
  const floorSet = new Set(floors)
  const ceilingSet = new Set(ceilings)
  const claimed = [
    ...nums(/(?:sold\s+at|at)\s+\$?(\d{2,4}(?:,\d{3})?)\s*(?:\/\s*sq|per square foot)/gi, reason),
    ...nums(/\$(\d{2,4}(?:,\d{3})?)\s*\/\s*sq/gi, reason),
  ].filter((n) => !floorSet.has(n) && !ceilingSet.has(n))
  return { floors, ceilings, claimed }
}

function sqftMentions(reason: string): Array<{ n: number; floor: boolean }> {
  const out: Array<{ n: number; floor: boolean }> = []
  const re = /(\d{3,5})\s*(?:sq\.?\s*ft|square feet|sqft)/gi
  for (const m of reason.matchAll(re)) {
    const n = Number(m[1])
    const at = m.index ?? 0
    const before = reason.slice(Math.max(0, at - 18), at).toLowerCase()
    const after = reason.slice(at, at + 28).toLowerCase()
    const floor = /floor/.test(after) || /(?:below|under|above|over)\s+(?:a |the )?$/.test(before)
    out.push({ n, floor })
  }
  return out
}

function sqftGap(subjectSqft: number | null | undefined, compSqft: number): number | null {
  if (subjectSqft == null || subjectSqft <= 0 || compSqft <= 0) return null
  return Math.abs(compSqft - subjectSqft) / subjectSqft
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

function peerMedianPpsf(comp: CmaComp, peers: readonly CmaComp[]): number | null {
  const values = peers
    .filter((p) => p.listingKey !== comp.listingKey)
    .map((p) => ppsf(p))
    .filter((n) => n > 0)
  return median(values)
}

function priceOutside(actual: number, read: PriceRead): boolean | null {
  const floor = read.floors.length ? Math.max(...read.floors) : null
  const ceiling = read.ceilings.length ? Math.min(...read.ceilings) : null
  if (floor == null && ceiling == null) return null
  // A cited band: outside means under the floor or over the ceiling.
  if (floor != null && ceiling != null && floor <= ceiling) return actual < floor || actual > ceiling
  if (floor != null && (ceiling == null || floor > ceiling)) return actual < floor
  if (ceiling != null) return actual > ceiling
  return null
}

function measurementContradiction(reason: string, subject: CmaSubject, comp: CmaComp): boolean {
  const actual = ppsf(comp)
  const price = readPriceClaims(reason)
  if (actual > 0) {
    for (const n of price.claimed) {
      if (!close(n, actual, 5, 0.03)) return true
    }
  }
  const subjectSqft = subject.sqft ?? null
  for (const mention of sqftMentions(reason)) {
    if (mention.floor) continue
    const matchesComp = close(mention.n, comp.sqft, 40, 0.03)
    const matchesSubject = subjectSqft != null && close(mention.n, subjectSqft, 40, 0.03)
    if (!matchesComp && !matchesSubject) return true
  }
  const built = reason.match(/\bbuilt(?:\s+in)?\s+((?:19|20)\d{2})\b/i)
  if (built && comp.yearBuilt != null && Number(built[1]) !== comp.yearBuilt) return true
  for (const m of reason.matchAll(/(\d+(?:\.\d+)?)\s*(?:acres?|ac)\b/gi)) {
    const n = Number(m[1])
    const matchesComp = comp.lotAcres != null && close(n, comp.lotAcres, 0.02, 0.1)
    const matchesSubject = subject.lotAcres != null && close(n, subject.lotAcres, 0.02, 0.1)
    if (!matchesComp && !matchesSubject) return true
  }
  for (const m of reason.matchAll(/(\d)\s*-?\s*(?:bed|bd|br)\b/gi)) {
    const n = Number(m[1])
    if (n !== comp.beds && n !== subject.beds) return true
  }
  for (const m of reason.matchAll(/(\d(?:\.\d)?)\s*-?\s*(?:bath|ba)\b/gi)) {
    const n = Number(m[1])
    if (n !== comp.baths && n !== subject.baths) return true
  }
  return false
}

function sizeSupported(reason: string, subject: CmaSubject, comp: CmaComp): GroundRule | null {
  const gap = sqftGap(subject.sqft, comp.sqft)
  const floors = sqftMentions(reason).filter((m) => m.floor)
  if (floors.length > 0) {
    const floor = floors[0]!.n
    const below = /below|under/i.test(reason)
    const above = /above|over/i.test(reason)
    const onSide = (below && comp.sqft < floor) || (above && comp.sqft > floor) || (!below && !above)
    const onBand = gap != null && gap > SIZE_FLOOR_GAP
    if (!onSide || !onBand) return null
    return 'size-floor'
  }
  if (gap != null && gap > SIZE_FLOOR_GAP) return 'size-gap'
  return null
}

function priceSupported(
  reason: string,
  comp: CmaComp,
  peers: readonly CmaComp[],
  band: { floor: number; ceiling: number } | null,
): GroundRule | null {
  const actual = ppsf(comp)
  if (actual <= 0) return null
  const read = readPriceClaims(reason)
  if (read.floors.length === 0 && read.ceilings.length === 0 && band && band.floor > 0 && band.ceiling > 0) {
    read.floors.push(band.floor)
    read.ceilings.push(band.ceiling)
  }
  const outside = priceOutside(actual, read)
  if (outside === false) return null
  const mid = peerMedianPpsf(comp, peers)
  if (mid != null && mid > 0) {
    const off = Math.abs(actual - mid) / mid
    if (off < PRICE_TIER_OUTLIER) return null
  }
  return 'price-outlier'
}

/** Both lots known and both under the search's one-acre lot wall. */
export function bothUnderAnAcre(subject: CmaSubject, comp: CmaComp): boolean {
  const a = subject.lotAcres
  const b = comp.lotAcres
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return false
  if (a <= 0 || b <= 0) return false
  return a < LOT_WALL_ACRES && b < LOT_WALL_ACRES
}

function lotSupported(reason: string, subject: CmaSubject, comp: CmaComp): boolean {
  if (subject.lotAcres == null || comp.lotAcres == null) return false
  if (subject.lotAcres <= 0 || comp.lotAcres <= 0) return false
  // Under an acre on both sides the search does not separate lots, so the
  // review may not either (Matt 2026-10-08).
  if (bothUnderAnAcre(subject, comp)) return false
  if (!lotsDiffer(subject.lotAcres, comp.lotAcres)) return false
  const cited = nums(/(\d+(?:\.\d+)?)\s*(?:acres?|ac)\b/gi, reason)
  if (cited.length === 0) return true
  return cited.every(
    (n) =>
      close(n, comp.lotAcres!, 0.02, 0.1) || close(n, subject.lotAcres!, 0.02, 0.1),
  )
}

function textOf(subject: CmaSubject, comp: CmaComp): { comp: string; subject: string } {
  return {
    comp: `${comp.publicRemarks ?? ''} ${comp.viewDescription ?? ''}`.toLowerCase(),
    subject: `${subject.publicRemarks ?? ''} ${subject.viewDescription ?? ''} ${subject.propertySubType ?? ''}`.toLowerCase(),
  }
}

function structureSupported(subject: CmaSubject, comp: CmaComp): boolean {
  if (
    subject.propertySubType &&
    comp.propertySubType &&
    !productTypeCompatible(subject.propertySubType, comp.propertySubType)
  ) {
    return true
  }
  // Rule 23, read exactly as both ladders read it: symmetric, null remarks fail open.
  if (multiUnitFromRemarks(comp.publicRemarks) !== multiUnitFromRemarks(subject.publicRemarks)) return true
  // The ADU wall, read exactly as both ladders read it: not symmetric.
  if (aduSaleRefused(subject.publicRemarks, comp.publicRemarks)) return true
  const texts = textOf(subject, comp)
  if (!OTHER_PRODUCT.test(texts.comp)) return false
  return !OTHER_PRODUCT.test(texts.subject)
}

function tokenSupported(reason: string, tokens: readonly string[], subject: CmaSubject, comp: CmaComp): boolean {
  const reasonL = reason.toLowerCase()
  const texts = textOf(subject, comp)
  return tokens.some((t) => reasonL.includes(t) && texts.comp.includes(t) && !texts.subject.includes(t))
}

const ROOMISH = /\b(bed(?:room)?s?|bath(?:room)?s?|bd|br|ba)\b/i

export function isRoomishReason(reason: string | null | undefined): boolean {
  return ROOMISH.test(reason ?? '')
}

/**
 * True when this exclude is a room-count cut the one-room rule is allowed to
 * decide. Condition, structure, lot, vintage, size, location, recency, and
 * price-tier keep their own bases.
 */
export function isRoomCountExclusion(v: CompVerdict): boolean {
  if (v.tier !== 'exclude') return false
  if (v.basis && v.basis !== 'other') return false
  return isRoomishReason(v.reason)
}

function roomsSupported(reason: string, subject: CmaSubject, comp: CmaComp): boolean {
  const rooms = carriedRoomDecision(subject, comp)
  // The rule allows this sale. The review may not exclude it for the room gap.
  if (rooms.ok) return false
  const beds = nums(/(\d)\s*-?\s*(?:bed|bd|br)\b/gi, reason)
  const baths = nums(/(\d(?:\.\d)?)\s*-?\s*(?:bath|ba)\b/gi, reason)
  const bedOk =
    beds.length > 0 &&
    subject.beds != null &&
    comp.beds != null &&
    subject.beds !== comp.beds &&
    beds.every((n) => n === subject.beds || n === comp.beds)
  const bathOk =
    baths.length > 0 &&
    subject.baths != null &&
    comp.baths != null &&
    subject.baths !== comp.baths &&
    baths.every((n) => n === subject.baths || n === comp.baths)
  return bedOk || bathOk || isRoomishReason(reason)
}

function keepForAllowedRoomGap(
  verdict: CompVerdict,
  notes: Array<'beds' | 'baths'>,
  gap?: { beds: number; baths: number } | null,
): GroundResult {
  return {
    verdict: {
      listingKey: verdict.listingKey,
      tier: 'strong',
      reason:
        roomDifferenceSentence(notes, gap) ??
        'Room counts follow the one-room rule. This sale stays.',
    },
    grounded: false,
    modelTier: 'exclude',
    rule: 'rooms',
  }
}

function weakKeep(verdict: CompVerdict, rule: GroundRule, reason: string = UNGROUNDED_KEEP_REASON): GroundResult {
  return {
    verdict: {
      listingKey: verdict.listingKey,
      tier: 'weak',
      reason,
    },
    grounded: false,
    modelTier: verdict.tier,
    rule,
  }
}

function acresText(acres: number): string {
  return `${Number(acres.toFixed(2))} ${acres === 1 ? 'acre' : 'acres'}`
}

/**
 * A price-tier cut of a sale inside the one 20% line: overridden like any
 * unsupported exclusion, with the line it sits inside named.
 */
function keepInsidePriceLine(verdict: CompVerdict, comp: CmaComp, line: PriceTierLine): GroundResult {
  const p = Math.round(salePpsf(comp.closePrice, comp.sqft) ?? 0)
  return weakKeep(
    verdict,
    'price-inside-line',
    `Kept at half weight. It sold at $${p} a square foot, inside ${describePriceTierLine(line)}, this home's price tier, so price alone does not drop it.`,
  )
}

/**
 * A lot-size cut where both lots are under an acre: overridden, the sale kept,
 * the difference stated. The comp matrix prints every sale's lot beside the
 * subject's on the Lot size row, which is how the reader sees it.
 */
function keepSubAcreLot(verdict: CompVerdict, subject: CmaSubject, comp: CmaComp): GroundResult {
  return weakKeep(
    verdict,
    'lot-under-acre',
    `Kept at half weight. Its lot is ${acresText(comp.lotAcres!)} against this home's ${acresText(subject.lotAcres!)}. Both are under an acre, where a lot difference is shown beside the sale and does not drop it.`,
  )
}

/**
 * Accept the exclusion, or rewrite it to a weak keep.
 * `band` is the model's declared $/sqft floor and ceiling for this vote, used
 * when the reason names no number of its own and the home has no anchor.
 * `line` is the one 20% line around the home's independent price anchor
 * (lib/pricing/price-tier.ts), the same line the comp search admitted on.
 * When present it alone decides whether a price-tier cut stands.
 */
export function groundVerdict(
  subject: CmaSubject,
  comp: CmaComp,
  verdict: CompVerdict,
  peers: readonly CmaComp[],
  band: { floor: number; ceiling: number } | null = null,
  line: PriceTierLine | null = null,
): GroundResult {
  if (verdict.tier !== 'exclude') {
    return { verdict: { ...verdict }, grounded: true, modelTier: verdict.tier, rule: 'kept' }
  }
  const reason = verdict.reason ?? ''
  if (measurementContradiction(reason, subject, comp)) return weakKeep(verdict, 'contradiction')

  const basis: ExclusionBasis | 'price-like' | undefined =
    verdict.basis === 'other' && isPriceTierExclusion(verdict) ? 'price-tier' : verdict.basis

  const rooms = carriedRoomDecision(subject, comp)
  if (rooms.ok && isRoomishReason(reason) && (basis == null || basis === 'other')) {
    return keepForAllowedRoomGap(verdict, rooms.notes, rooms.gap)
  }

  const priceRead = readPriceClaims(reason)
  const priceCited = priceRead.floors.length > 0 || priceRead.ceilings.length > 0
  if (priceCited || basis === 'price-tier') {
    const outside = priceCited ? priceOutside(ppsf(comp), priceRead) : null
    if (outside === false) return weakKeep(verdict, 'price-not-outside')
    // A cut that rests on price: the price-tier basis, or no named basis with
    // a price in the reason. A named basis (size, lot, condition) that also
    // quotes a number keeps the old reading below and then its own check.
    const restsOnPrice = basis === 'price-tier' || basis === 'other' || basis == null
    if (line && restsOnPrice) {
      // ONE 20% LINE: outside it the cut stands, inside it the cut is
      // overridden, whatever band the model drew from the sales it kept.
      const position = priceTierPosition(salePpsf(comp.closePrice, comp.sqft), line)
      // No living area on record: nothing to grade, so nothing supports the cut.
      if (position == null) return weakKeep(verdict, 'price-cluster')
      if (position === 'inside') return keepInsidePriceLine(verdict, comp, line)
      return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'price-outlier' }
    } else if (basis === 'price-tier' || priceCited) {
      const supported = priceSupported(reason, comp, peers, basis === 'price-tier' ? band : null)
      if (!supported) return weakKeep(verdict, 'price-cluster')
      if (basis === 'price-tier' || basis === 'other' || basis == null) {
        return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'price-outlier' }
      }
    }
  }

  const sizeFloors = sqftMentions(reason).filter((m) => m.floor)
  if (basis === 'size' || sizeFloors.length > 0) {
    const supported = sizeSupported(reason, subject, comp)
    if (!supported) return weakKeep(verdict, sizeFloors.length > 0 ? 'size-floor' : 'size-gap')
    if (basis === 'size' || basis === 'other' || basis == null) {
      return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: supported }
    }
  }

  if (basis === 'lot') {
    if (bothUnderAnAcre(subject, comp)) return keepSubAcreLot(verdict, subject, comp)
    if (!lotSupported(reason, subject, comp)) return weakKeep(verdict, 'lot')
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'lot' }
  }
  if (basis === 'vintage') {
    // The picker owns year built. This pass does not drop the sale.
    return weakKeep(verdict, 'vintage')
  }
  if (basis === 'structure-type') {
    if (!structureSupported(subject, comp)) return weakKeep(verdict, 'structure')
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'structure' }
  }
  if (basis === 'location') {
    if (!tokenSupported(reason, LOCATION_TOKENS, subject, comp)) return weakKeep(verdict, 'location')
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'location' }
  }
  if (basis === 'condition') {
    if (!tokenSupported(reason, CONDITION_TOKENS, subject, comp)) return weakKeep(verdict, 'condition')
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'condition' }
  }
  if (basis === 'recency') {
    if (!comp.closeDate) return weakKeep(verdict, 'unsupported')
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'qualitative' }
  }

  // Basis other, or a specific basis we already returned from. Rooms and a
  // qualitative note can still carry an `other` exclusion. A checkable claim
  // that failed above already returned.
  if (roomsSupported(reason, subject, comp)) {
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'rooms' }
  }
  if (tokenSupported(reason, LOCATION_TOKENS, subject, comp)) {
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'location' }
  }
  if (structureSupported(subject, comp)) {
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'structure' }
  }
  if (/\b(lot|acre)/i.test(reason)) {
    // A lot cut under another basis is still a lot cut. Under an acre on both
    // sides it does not stand, unless the reason also names a condition the
    // remarks bear out (then the reading below decides, as before).
    if (bothUnderAnAcre(subject, comp) && !tokenSupported(reason, CONDITION_TOKENS, subject, comp)) {
      return keepSubAcreLot(verdict, subject, comp)
    }
    if (lotSupported(reason, subject, comp)) {
      return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'lot' }
    }
  }
  if (/\b(built|vintage|year built)\b/i.test(reason) && /\b(19|20)\d{2}\b/.test(reason)) {
    return weakKeep(verdict, 'vintage')
  }
  // A structure or second-unit claim the readers do not back (checked above).
  if (PRODUCT_CLAIM.test(reason)) return weakKeep(verdict, 'structure')
  const hasNumber = /\d/.test(reason)
  if (!hasNumber) {
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'qualitative' }
  }
  return weakKeep(verdict, 'unsupported')
}

export function groundVote(
  subject: CmaSubject,
  comps: readonly CmaComp[],
  verdicts: readonly CompVerdict[],
  band: { floor: number; ceiling: number } | null,
  line: PriceTierLine | null = null,
): GroundResult[] {
  const byKey = new Map(verdicts.map((v) => [v.listingKey, v]))
  return comps.map((comp) => {
    const verdict = byKey.get(comp.listingKey)
    if (!verdict) {
      return {
        verdict: {
          listingKey: comp.listingKey,
          tier: 'weak' as const,
          reason: 'No comparability verdict was returned for this sale, so it is carried at half weight.',
        },
        grounded: true,
        modelTier: 'weak' as const,
        rule: 'kept' as const,
      }
    }
    return groundVerdict(subject, comp, verdict, comps, band, line)
  })
}
