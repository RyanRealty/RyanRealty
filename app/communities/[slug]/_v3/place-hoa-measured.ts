/**
 * The measured-HOA input shared by every publishPlaceHoa caller on this route
 * (community-opening.ts's glance figure, place-knowledge.ts's belonging row).
 * One derivation so the annual and its basis cannot drift between the two
 * places this page prints an HOA figure. (§0, D103 2026-08-27.)
 *
 * getPlaceCharacter's `dues` already cleared DUES_MIN_REPORTED and windows to
 * a recent 36 months (PLACE_CONTENT_RULES R2); this module only converts the
 * monthly median to an annual figure and states the sample in the words the
 * FAQ and the Living in row both print (SEO & AEO Desk 2026-10-08): detached
 * listings since October 2023, not "current listings".
 */

import type { PlaceCharacter } from '@/lib/data/places/getPlaceCharacter'

/**
 * The sitewide measured-HOA sentence. `place` is the public name ("Tetherow").
 * Monthly, annual, and N are the same dues row V3PlaceCharacter prints.
 */
export function measuredHoaSentence(
  place: string,
  monthly: number,
  annual: number,
  reported: number,
): string {
  const name = place.trim()
  const month = monthly.toLocaleString('en-US')
  const year = annual.toLocaleString('en-US')
  const n = reported.toLocaleString('en-US')
  return (
    `Detached ${name} listings that reported dues since October 2023 show a median of $${month} a month ($${year} a year), across ${n} listings. ` +
    `Dues vary by property. Confirm the current amount with the association before you buy.`
  )
}

export function measuredPlaceHoaInput(
  character: PlaceCharacter | null | undefined,
  placeName?: string,
): {
  measuredAnnual: number | null
  measuredMonthly: number | null
  measuredReported: number | null
  measuredBasis: string | null
} {
  const dues = character?.dues
  if (!dues || dues.medianMonthly <= 0 || dues.reported <= 0) {
    return {
      measuredAnnual: null,
      measuredMonthly: null,
      measuredReported: null,
      measuredBasis: null,
    }
  }
  const measuredAnnual = Math.round(dues.medianMonthly * 12)
  const name = placeName?.trim()
  return {
    measuredAnnual,
    measuredMonthly: dues.medianMonthly,
    measuredReported: dues.reported,
    measuredBasis: name
      ? measuredHoaSentence(name, dues.medianMonthly, measuredAnnual, dues.reported)
      : `detached listings that reported dues since October 2023, across ${dues.reported.toLocaleString('en-US')} listings`,
  }
}
