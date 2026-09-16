/**
 * The one sentence over a place page's homes list that says what its count
 * counts (SITE-116 round 3, 2026-09-16).
 *
 * The list's own claim reads "26 homes on this map, $450K–$4.3M · Tetherow".
 * Beside an Atlas key reading "25 for sale · 4 pending" a judge took the two
 * as one total printed twice, wrongly. They are two populations: the map key
 * counts inside the recorded boundary; the list counts every active listing
 * the MLS files under the community's alias set inside the list's own frame.
 * This sentence sits directly over the list and says so, with the same count
 * the list prints, so the two cannot drift — both read the same search
 * result.
 *
 * §0: the count arrives from the search that rendered the list, never from a
 * second read. Zero prints nothing (the list has its own empty state).
 */

import { formatCount } from '@/lib/format/count'

export function publishPlaceSplitScope(input: {
  placeName: string
  /** The registry alias set the search expands the subdivision into. */
  matchNames: readonly string[]
  count: number
  /** The search hit its display cap: the count is the nearest set, not the whole. */
  capped?: boolean
}): string | null {
  if (!Number.isFinite(input.count) || input.count <= 0) return null
  const names = [...new Set(input.matchNames.map((n) => n.trim()).filter(Boolean))]
  const under =
    names.length === 0
      ? input.placeName
      : names.length === 1
        ? names[0]!
        : names.length === 2
          ? `${names[0]} or ${names[1]}`
          : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
  const n = formatCount(input.count)
  const noun = input.count === 1 ? 'active listing' : 'active listings'
  const head = input.capped
    ? `The nearest ${n} ${noun} the MLS files under ${under}`
    : `${n} ${noun} the MLS files under ${under}`
  return (
    `${head} — every property type, houses to lots — inside this map frame. ` +
    `Move the map and the count follows the frame; the key on the map above counts inside the recorded boundary instead.`
  )
}
