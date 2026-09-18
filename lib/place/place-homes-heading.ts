/**
 * Place-page inventory headings. Matt 2026-09-18: the lecture H1
 * "Every home for sale in {Name}" does not ship. The place name plus
 * "homes for sale" is the buyer line. Typed stock sections use the
 * four property-type labels, never a lecture restatement.
 */

export const EVERY_HOME_LECTURE_REFUSE = /\bevery home for sale in\b/i

export function placeHomesForSaleHeading(placeName: string): string {
  const name = placeName.trim()
  if (!name) return 'Homes for sale'
  const heading = `${name} homes for sale`
  if (EVERY_HOME_LECTURE_REFUSE.test(heading)) {
    throw new Error(`[placeHomesForSaleHeading] refused lecture heading: ${heading}`)
  }
  return heading
}

export function isEveryHomeLecture(text: string): boolean {
  return EVERY_HOME_LECTURE_REFUSE.test(text)
}
