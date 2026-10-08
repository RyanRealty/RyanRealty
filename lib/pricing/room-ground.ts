/**
 * Own ground for the one-room rule, and the single call both the picker and
 * the comparability review use.
 *
 * `lib/pricing/room-counts.ts` is the decision (Matt 2026-09-10, skill 0.1).
 * This file is how a subject and a sale become `{ local }` for it, so the
 * facts ladder, the listings ladder, the judge prompt's post-cut, and the
 * accuracy contract cannot invent a second bath wall.
 *
 * The picker stamps its decision on every sale it admits (`roomDecision`),
 * with the counts it compared. Every check that runs after the picker reads
 * that stamp through `carriedRoomDecision` and re-runs the rule on those
 * counts, so a subject or a sale that reaches a later check without its MLS
 * bath split is not re-decided from fewer inputs. cma-1117-milwaukee
 * (2026-10-08): the picker compared 1 full bath against 852 Columbia's 2 and
 * kept the sale on its own plat; the dry run's contract, handed the totals
 * only, compared 1 against 3 and refused it.
 */
import { sameOrdinaryPhaseFamily } from '@/lib/cma/community-location'
import { resolveMarketArea } from '@/lib/cma/market-area'
import { samePlat, sameStreetPeer } from '@/lib/pricing/price-anchor'
import { normSubdivision } from '@/lib/pricing/classes'
import { roomCountsUsable } from '@/lib/pricing/room-counts'
import { fullBaths, wholeBathPair } from '@/lib/pricing/bath-count'

export type RoomGroundSubject = {
  streetAddress?: string | null
  city?: string | null
  subdivision?: string | null
  subdivisionNorm?: string | null
  latitude?: number | null
  longitude?: number | null
  sqft?: number | null
  marketArea?: string | null
  beds?: number | null
  baths?: number | null
  /** MLS full / half bath split (listings.baths_full / baths_half), when read. */
  bathsFull?: number | null
  bathsHalf?: number | null
  subdivisionSlug?: string | null
}

/** The counts the one-room rule compared for one pair, and on what ground. */
export type RoomCompared = {
  subjectBeds: number | null
  saleBeds: number | null
  subjectBaths: number | null
  saleBaths: number | null
  /** 'full' when both homes carried the MLS split, else the recorded totals. */
  bathBasis: 'full' | 'total'
  local: boolean
  phaseFamily: boolean
}

/** THE one-room decision, with what it compared. */
export type RoomDecision = {
  ok: boolean
  notes: Array<'beds' | 'baths'>
  compared: RoomCompared
}

export type RoomGroundSale = {
  address?: string | null
  city?: string | null
  subdivision?: string | null
  subdivisionNorm?: string | null
  latitude?: number | null
  longitude?: number | null
  sqft?: number | null
  marketArea?: string | null
  ownPlat?: boolean | null
  selectionTier?: string | null
  /** Picker already disclosed a one-room gap on own ground. */
  roomDifference?: Array<'beds' | 'baths'> | null
  /** The picker's decision for this sale, with the counts it compared. */
  roomDecision?: RoomDecision | null
  beds?: number | null
  baths?: number | null
  bathsFull?: number | null
  bathsHalf?: number | null
  subdivisionSlug?: string | null
}

/**
 * The subject's own ground: its plat, its mapped neighborhood, or its street.
 * A broker-picked sale was already treated as local by the selector.
 */
export function saleOnOwnRoomGround(subject: RoomGroundSubject, sale: RoomGroundSale): boolean {
  if (sale.ownPlat === true) return true
  if (sale.selectionTier === 'broker-selected') return true
  if ((sale.roomDifference ?? []).length > 0) return true
  const subjectNorm = subject.subdivisionNorm ?? normSubdivision(subject.subdivision ?? null)
  const saleNorm = sale.subdivisionNorm ?? normSubdivision(sale.subdivision ?? null)
  if (samePlat({ subdivisionNorm: subjectNorm }, { subdivisionNorm: saleNorm })) return true
  const subjectArea = subject.marketArea ?? resolveMarketArea(subject.latitude ?? null, subject.longitude ?? null)
  const saleArea = sale.marketArea ?? resolveMarketArea(sale.latitude ?? null, sale.longitude ?? null)
  if (subjectArea != null && saleArea === subjectArea) return true
  if (
    sameStreetPeer(
      { streetAddress: subject.streetAddress, city: subject.city, sqft: subject.sqft ?? 0 },
      { address: sale.address, city: sale.city, sqft: sale.sqft ?? 0 },
    )
  ) {
    return true
  }
  return false
}

/** The rule, run on recorded counts. */
export function roomDecisionFromCompared(compared: RoomCompared): RoomDecision {
  const verdict = roomCountsUsable(
    { beds: compared.subjectBeds, baths: compared.subjectBaths },
    { beds: compared.saleBeds, baths: compared.saleBaths },
    { local: compared.local, phaseFamily: compared.phaseFamily },
  )
  return { ...verdict, compared }
}

/**
 * THE one-room decision. Picker, review, and contract all call this.
 * `ok` is false as soon as either beds or baths is refused.
 */
export function roomCountsDecision(subject: RoomGroundSubject, sale: RoomGroundSale): RoomDecision {
  const phaseFamily = sameOrdinaryPhaseFamily(subject.subdivisionSlug, sale.subdivisionSlug)
  // Whole baths: full baths when both homes carry the MLS split, so a powder
  // room is never a whole bath (lib/pricing/bath-count.ts).
  const baths = wholeBathPair(subject, sale)
  const bathBasis = fullBaths(subject) != null && fullBaths(sale) != null ? 'full' : 'total'
  return roomDecisionFromCompared({
    subjectBeds: subject.beds ?? null,
    saleBeds: sale.beds ?? null,
    subjectBaths: baths.subject,
    saleBaths: baths.sale,
    bathBasis,
    local: saleOnOwnRoomGround(subject, sale) || phaseFamily,
    phaseFamily,
  })
}

/**
 * The decision a check that runs AFTER the picker reads (rule 4: the picker
 * and the review call the same decision). A sale the picker admitted carries
 * its decision with the counts it compared, and the rule is re-run on those
 * counts, never on whatever subset of the inputs reached this check. A sale
 * with no stamp is decided here from what it carries.
 */
export function carriedRoomDecision(subject: RoomGroundSubject, sale: RoomGroundSale): RoomDecision {
  const stamp = sale.roomDecision
  if (stamp) return roomDecisionFromCompared(stamp.compared)
  return roomCountsDecision(subject, sale)
}
