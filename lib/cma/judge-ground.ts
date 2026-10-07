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
 *     area gap is at least SIZE_FLOOR_GAP (35%, past the selector's widest
 *     band). A smaller gap is the invented 1600 sqft floor: the sale is a bit
 *     smaller, not a different size class.
 *  3. A direct size comparison that names the real sqft, with no floor, needs
 *     the same gap as a floor: SIZE_FLOOR_GAP (35%, the picker's living-area
 *     band). A tighter cut dropped sales the picker kept. There is one size
 *     cutoff, and it is the picker's.
 *  4. A $/sqft floor, ceiling, or band is supported only when the comp's actual
 *     $/sqft is outside it. "Below $419" when the sale is at $430 is ignored.
 *  5. A price-tier cut that does clear the cited number is still ignored when
 *     the sale sits within PRICE_TIER_OUTLIER (20%) of the median $/sqft of the
 *     other candidates. That is a line drawn through the cluster, not a
 *     different tier. A sale 20% or more off that median is a real price tier.
 *  6. Lot: the cited acres must match, and the lots must actually differ
 *     (ratio at least 2, or at least 0.15 acres). A 0.34 acre lot against a
 *     0.14 acre lot is a real difference. A "1 acre floor" both lots miss is not.
 *  7. Vintage is not a second cut. The picker already applied year built, and
 *     it widens closed-sale age and date when the first location search is
 *     short of 3. A 15-year wall here dropped sales the picker kept, so a
 *     vintage exclusion is kept.
 *  8. Structure type: a different MLS sub-type, or remarks that name a
 *     different product (duplex, condo, townhouse, manufactured). "Split-level"
 *     is a story, not a different product.
 *  9. Location: a place word in the reason (fairway, golf, resort, highway)
 *     must be in the comp remarks or view and not in the subject's.
 * 10. Condition: a condition word in the reason must appear in the comp remarks.
 * 11. Beds or baths: the one-room rule (lib/pricing/room-counts.ts, skill 0.1)
 *     is the only room wall. Cited counts must match the fields. An exclusion
 *     for a gap that rule allows (same whole count, or one apart on own ground)
 *     is ignored. An exclusion for a gap that rule refuses (one apart off
 *     ground, or two or more anywhere) stays.
 * 12. Basis `other` with no checkable claim is kept. An exclusion we cannot
 *     disprove is not thrown out. An exclusion we can disprove is.
 *
 * Legitimate exclusions stay: a real duplex in the remarks, a living area gap
 * of 35% or more, a $/sqft outlier of 20% or more, a doubled lot, a room gap
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
import { roomCountsDecision } from '@/lib/pricing/room-ground'
import { roomDifferenceSentence } from '@/lib/pricing/room-counts'

/** Past the selector's widest living-area band. The only size cutoff. */
export const SIZE_FLOOR_GAP = 0.35
/** Share off the other candidates' median $/sqft before a price tier is real. */
export const PRICE_TIER_OUTLIER = 0.2
export const LOT_RATIO = 2
export const LOT_ACRES = 0.15

export const UNGROUNDED_KEEP_REASON =
  'Kept at half weight. The exclusion cited a threshold or fact these fields do not support.'

export type GroundRule =
  | 'kept'
  | 'contradiction'
  | 'size-floor'
  | 'size-gap'
  | 'price-not-outside'
  | 'price-cluster'
  | 'price-outlier'
  | 'lot'
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

// The three readers agree on the multi-unit words (lib/pricing/classes.ts
// multiUnitFromRemarks, lib/cma/judgment-prune.ts PRODUCT_REASON, this).
const OTHER_PRODUCT =
  /\b(duplex|tri-?plex|four-?plex|quad-?plex|quadruplex|multi-?unit|both units|townhomes?|townhouses?|condominiums?|condos?|manufactured|mobile home|multi-?family|shared wall|common wall)\b/i

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
    const onBand = gap != null && gap >= SIZE_FLOOR_GAP
    if (!onSide || !onBand) return null
    return 'size-floor'
  }
  if (gap != null && gap >= SIZE_FLOOR_GAP) return 'size-gap'
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

function lotSupported(reason: string, subject: CmaSubject, comp: CmaComp): boolean {
  if (subject.lotAcres == null || comp.lotAcres == null) return false
  if (subject.lotAcres <= 0 || comp.lotAcres <= 0) return false
  const ratio = Math.max(subject.lotAcres, comp.lotAcres) / Math.min(subject.lotAcres, comp.lotAcres)
  const abs = Math.abs(subject.lotAcres - comp.lotAcres)
  if (ratio < LOT_RATIO && abs < LOT_ACRES) return false
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

function structureSupported(reason: string, subject: CmaSubject, comp: CmaComp): boolean {
  if (
    subject.propertySubType &&
    comp.propertySubType &&
    !productTypeCompatible(subject.propertySubType, comp.propertySubType)
  ) {
    return true
  }
  const texts = textOf(subject, comp)
  const inComp = OTHER_PRODUCT.test(texts.comp) || OTHER_PRODUCT.test(reason) && OTHER_PRODUCT.test(texts.comp)
  if (!OTHER_PRODUCT.test(texts.comp)) return false
  if (OTHER_PRODUCT.test(texts.subject)) return false
  return inComp
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
  const rooms = roomCountsDecision(subject, comp)
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

function keepForAllowedRoomGap(verdict: CompVerdict, notes: Array<'beds' | 'baths'>): GroundResult {
  return {
    verdict: {
      listingKey: verdict.listingKey,
      tier: 'strong',
      reason:
        roomDifferenceSentence(notes) ??
        'Room counts follow the one-room rule. This sale stays.',
    },
    grounded: false,
    modelTier: 'exclude',
    rule: 'rooms',
  }
}

function weakKeep(verdict: CompVerdict, rule: GroundRule): GroundResult {
  return {
    verdict: {
      listingKey: verdict.listingKey,
      tier: 'weak',
      reason: UNGROUNDED_KEEP_REASON,
    },
    grounded: false,
    modelTier: verdict.tier,
    rule,
  }
}

/**
 * Accept the exclusion, or rewrite it to a weak keep.
 * `band` is the model's declared $/sqft floor and ceiling for this vote, used
 * when the reason names no number of its own.
 */
export function groundVerdict(
  subject: CmaSubject,
  comp: CmaComp,
  verdict: CompVerdict,
  peers: readonly CmaComp[],
  band: { floor: number; ceiling: number } | null = null,
): GroundResult {
  if (verdict.tier !== 'exclude') {
    return { verdict: { ...verdict }, grounded: true, modelTier: verdict.tier, rule: 'kept' }
  }
  const reason = verdict.reason ?? ''
  if (measurementContradiction(reason, subject, comp)) return weakKeep(verdict, 'contradiction')

  const basis: ExclusionBasis | 'price-like' | undefined =
    verdict.basis === 'other' && isPriceTierExclusion(verdict) ? 'price-tier' : verdict.basis

  const rooms = roomCountsDecision(subject, comp)
  if (rooms.ok && isRoomishReason(reason) && (basis == null || basis === 'other')) {
    return keepForAllowedRoomGap(verdict, rooms.notes)
  }

  const priceRead = readPriceClaims(reason)
  const priceCited = priceRead.floors.length > 0 || priceRead.ceilings.length > 0
  if (priceCited || basis === 'price-tier') {
    const outside = priceCited ? priceOutside(ppsf(comp), priceRead) : null
    if (outside === false) return weakKeep(verdict, 'price-not-outside')
    if (basis === 'price-tier' || priceCited) {
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
    if (!lotSupported(reason, subject, comp)) return weakKeep(verdict, 'lot')
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'lot' }
  }
  if (basis === 'vintage') {
    // The picker owns year built. This pass does not drop the sale.
    return weakKeep(verdict, 'vintage')
  }
  if (basis === 'structure-type') {
    if (!structureSupported(reason, subject, comp)) return weakKeep(verdict, 'structure')
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
  if (structureSupported(reason, subject, comp)) {
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'structure' }
  }
  if (lotSupported(reason, subject, comp) && /\b(lot|acre)/i.test(reason)) {
    return { verdict: { ...verdict }, grounded: true, modelTier: 'exclude', rule: 'lot' }
  }
  if (/\b(built|vintage|year built)\b/i.test(reason) && /\b(19|20)\d{2}\b/.test(reason)) {
    return weakKeep(verdict, 'vintage')
  }
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
    return groundVerdict(subject, comp, verdict, comps, band)
  })
}
