/**
 * Own ground for the one-room rule, and the single call both the picker and
 * the comparability review use.
 *
 * `lib/pricing/room-counts.ts` is the decision (Matt 2026-09-10, skill 0.1).
 * This file is how a subject and a sale become `{ local }` for it, so the
 * facts ladder, the listings ladder, the judge prompt's post-cut, and the
 * accuracy contract cannot invent a second bath wall.
 */
import { sameOrdinaryPhaseFamily } from '@/lib/cma/community-location'
import { resolveMarketArea } from '@/lib/cma/market-area'
import { samePlat, sameStreetPeer } from '@/lib/pricing/price-anchor'
import { normSubdivision } from '@/lib/pricing/classes'
import { roomCountsUsable } from '@/lib/pricing/room-counts'
import { wholeBathPair } from '@/lib/pricing/bath-count'

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

/**
 * THE one-room decision. Picker, review, and contract all call this.
 * `ok` is false as soon as either beds or baths is refused.
 */
export function roomCountsDecision(subject: RoomGroundSubject, sale: RoomGroundSale) {
  const phaseFamily = sameOrdinaryPhaseFamily(subject.subdivisionSlug, sale.subdivisionSlug)
  // Whole baths: full baths when both homes carry the MLS split, so a powder
  // room is never a whole bath (lib/pricing/bath-count.ts).
  const baths = wholeBathPair(subject, sale)
  return roomCountsUsable(
    { beds: subject.beds, baths: baths.subject },
    { beds: sale.beds, baths: baths.sale },
    { local: saleOnOwnRoomGround(subject, sale) || phaseFamily, phaseFamily },
  )
}
