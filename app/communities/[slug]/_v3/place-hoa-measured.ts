/**
 * The measured-HOA input shared by every publishPlaceHoa caller on this route
 * (community-opening.ts's glance figure, place-knowledge.ts's belonging row).
 * One derivation so the annual and its basis cannot drift between the two
 * places this page prints an HOA figure. (§0, D103 2026-08-27.)
 *
 * getPlaceCharacter's `dues` already cleared DUES_MIN_REPORTED and windows to
 * a recent 36 months (PLACE_CONTENT_RULES R2); this module only converts the
 * monthly median to an annual figure and states the sample count in the exact
 * words this route's Quiet and FAQ rows use.
 */

import type { PlaceCharacter } from '@/lib/data/places/getPlaceCharacter'

export function measuredPlaceHoaInput(
  character: PlaceCharacter | null | undefined,
): { measuredAnnual: number | null; measuredBasis: string | null } {
  const dues = character?.dues
  if (!dues || dues.medianMonthly <= 0 || dues.reported <= 0) {
    return { measuredAnnual: null, measuredBasis: null }
  }
  return {
    measuredAnnual: Math.round(dues.medianMonthly * 12),
    measuredBasis: `median of the ${dues.reported} current listings that report dues`,
  }
}
