/**
 * The source line under a place page's homes (SITE-193, 2026-09-24).
 *
 * It used to read "every publicly active listing inside Bend: Active and
 * Active Under Contract, every property type. Coming Soon is excluded." A
 * separate voice read (VOICE.md) failed it: MLS StandardStatus values are this
 * shop's identifiers, not a reader's words, and "Coming Soon is excluded"
 * explains a rule instead of naming a source. The set is unchanged
 * (PUBLIC_ACTIVE_STATUSES, every property type, leases apart); only the words
 * are the reader's, and they are the words the count over the homes uses
 * (placeHomesCountLabel): for sale, or under contract and still showing.
 *
 * `where` is the place clause as the page reads it: "inside the recorded Bend
 * boundary" for a city, community or neighborhood (a boundary read), "inside
 * Porter James" for a plat (its recorded shape and the MLS name filed to it).
 */
export function placeInventorySource(where: string): string {
  return `regional MLS through Oregon Data Share: every listing ${where} that is for sale, or under contract and still showing, every property type.`
}

/** The boundary clause a city, community or neighborhood page reads with. */
export function placeBoundaryClause(placeName: string): string {
  return `inside the recorded ${placeName} boundary`
}
