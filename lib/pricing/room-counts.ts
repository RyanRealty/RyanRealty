/**
 * ONE ROOM RULE, for bedrooms and bathrooms alike (Matt 2026-09-10, revised
 * 2026-10-09: a room gap weighs less, it does not throw the sale out).
 *
 * Same whole count travels anywhere. ONE bedroom apart, ONE bathroom apart,
 * or one apart on both, stays in the set wherever the search already reached.
 * The closed-comp weight counts that sale for less (a bedroom off at 0.85 of
 * the room step, a bathroom off at 0.90, and both multiply). Location still
 * outranks the room: a same-subdivision sale with a room gap outweighs an
 * adjacent sale with the same room count. No dollar value is applied to the
 * room. Paired sales in this market do not support one.
 *
 * Two or more whole rooms apart on either count is still refused everywhere.
 * That is a different house, not a lighter weight. A half bath never decides.
 *
 * WHY THERE IS NO DOLLAR ADJUSTMENT HERE. The obvious implementation is to
 * price the missing room and adjust. This market does not support a number.
 * Paired sales over `sale_pricing_facts` (detached, closed on or after
 * 2024-01-01, 10,582 rows read 2026-09-10), matched on size within 3% and
 * closed within six months of each other, bath floors exactly one apart:
 *
 *   same city ......... 115,993 pairs | median -6.5% | quartiles -24.0% / +18.9%
 *   same subdivision .... 1,232 pairs | median -1.9% | quartiles -14.2% /  +9.6%
 *
 * In both pairings the home with the EXTRA bathroom sold for slightly LESS per
 * square foot at the median, and fewer than half of the pairs (41.4% citywide,
 * 44.0% inside a plat) went the other way. There is no defensible dollar value
 * to apply, so we apply none. What the extra room buys is disclosed as a
 * comparability note beside the sale, which is the same doctrine the rest of
 * lib/cma/pricing.ts follows for lot, condition and story: adjust only time and
 * size, disclose the rest.
 *
 * Baths are compared on the WHOLE count, so a half bath never decides whether a
 * sale is usable. Picker and review both call `roomCountsDecision`
 * (lib/pricing/room-ground.ts), which is this function plus own-ground.
 */

/** One whole room apart stays. Two or more is refused. */
export const ROOM_GAP_LOCAL_MAX = 1

export type RoomVerdict = 'match' | 'noted' | 'refuse'

/** Whole rooms. A 3.5-bath house is a 3-bath house for this comparison. */
function whole(count: number | null | undefined): number | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null
  return Math.floor(count)
}

/**
 * `match` — same whole count, usable anywhere with nothing to say.
 * `noted`  — one room apart; usable, disclosed, and weighed less.
 * `refuse` — two or more whole rooms apart.
 */
export function roomCountVerdict(
  subjectCount: number | null | undefined,
  compCount: number | null | undefined,
  opts: { local: boolean },
): RoomVerdict {
  // Ground used to decide admission. It no longer does. The weight, not a
  // wall, is how a one-room gap counts for less (Matt 2026-10-09). Callers
  // still pass `local` so the stamp can record where the sale sits.
  void opts
  const a = whole(subjectCount)
  const b = whole(compCount)
  // An unknown count is not evidence of a difference. The old rule read it the
  // same way, and a missing bath count is a data gap, not a mismatch.
  if (a == null || b == null) return 'match'
  const gap = Math.abs(a - b)
  if (gap === 0) return 'match'
  if (gap <= ROOM_GAP_LOCAL_MAX) return 'noted'
  return 'refuse'
}

/**
 * Both counts at once. One apart on both counts stays. The weight multiplies
 * the two room factors, so that sale counts for less than either gap alone.
 * `ok` is false only when either count is two or more apart. `notes` names
 * every count that differs on a sale we still use.
 */
export function roomCountsUsable(
  subject: { beds: number | null | undefined; baths: number | null | undefined },
  comp: { beds: number | null | undefined; baths: number | null | undefined },
  opts: { local: boolean; phaseFamily?: boolean },
): { ok: boolean; notes: Array<'beds' | 'baths'> } {
  const beds = roomCountVerdict(subject.beds, comp.beds, opts)
  const baths = roomCountVerdict(subject.baths, comp.baths, opts)
  if (beds === 'refuse' || baths === 'refuse') return { ok: false, notes: [] }
  const notes: Array<'beds' | 'baths'> = []
  if (beds === 'noted') notes.push('beds')
  if (baths === 'noted') notes.push('baths')
  return { ok: true, notes }
}

/**
 * The sentence that must sit beside a sale used one room apart, on the document
 * itself. Short, because it prints under the comp, and it always states that no
 * dollar value was applied — that is the part a reader is owed.
 */
export function roomDifferenceSentence(notes: Array<'beds' | 'baths'> | null | undefined): string | null {
  if (!notes || notes.length === 0) return null
  const parts = notes.map((n) => (n === 'beds' ? 'bedroom' : 'bathroom'))
  const list = parts.length === 1 ? parts[0]! : `${parts[0]} and ${parts[1]}`
  return `One ${list} different from yours. It counts for less than a sale with the same rooms. No dollar value is applied to the room.`
}
