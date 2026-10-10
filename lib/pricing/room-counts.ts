/**
 * ONE ROOM RULE, for bedrooms and bathrooms alike (Matt 2026-09-10, revised
 * 2026-10-09: a room gap weighs less, it does not throw the sale out).
 *
 * Same whole count travels anywhere. Up to TWO bedrooms off, up to TWO
 * bathrooms off, or both, stays wherever the search already reached (Matt
 * 2026-10-09). The closed-comp weight counts that sale for less: one bedroom
 * off is 0.85 of the room step, two bedrooms off is 0.70, one bathroom off is
 * 0.90, two bathrooms off is 0.75, and the two counts multiply. Location still
 * outranks the room. No dollar value is applied to the room. Paired sales in
 * this market do not support one.
 *
 * Three or more whole rooms apart on either count is refused everywhere.
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

/** Up to two whole rooms apart stays. Three or more is refused. */
export const ROOM_GAP_LOCAL_MAX = 2

export type RoomVerdict = 'match' | 'noted' | 'refuse'

/** Whole-room gap on each count. Zero when the count is unknown or the same. */
export type RoomGap = { beds: number; baths: number }

/** Whole rooms. A 3.5-bath house is a 3-bath house for this comparison. */
function whole(count: number | null | undefined): number | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null
  return Math.floor(count)
}

/**
 * `match` — same whole count, usable anywhere with nothing to say.
 * `noted`  — one or two rooms apart; usable, disclosed, and weighed less.
 * `refuse` — three or more whole rooms apart.
 */
export function roomCountVerdict(
  subjectCount: number | null | undefined,
  compCount: number | null | undefined,
  opts: { local: boolean },
): RoomVerdict {
  // Ground used to decide admission. It no longer does. The weight, not a
  // wall, is how a room gap counts for less (Matt 2026-10-09). Callers still
  // pass `local` so the stamp can record where the sale sits.
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

function countedGap(a: number | null | undefined, b: number | null | undefined): number {
  const left = whole(a)
  const right = whole(b)
  if (left == null || right == null) return 0
  return Math.abs(left - right)
}

/**
 * Both counts at once. Up to two apart on both counts stays. The weight
 * multiplies the two room factors, so a wider gap counts for less. `ok` is
 * false only when either count is three or more apart. `notes` names every
 * count that differs on a sale we still use. `gap` is the whole-room distance.
 */
export function roomCountsUsable(
  subject: { beds: number | null | undefined; baths: number | null | undefined },
  comp: { beds: number | null | undefined; baths: number | null | undefined },
  opts: { local: boolean; phaseFamily?: boolean },
): { ok: boolean; notes: Array<'beds' | 'baths'>; gap: RoomGap } {
  const beds = roomCountVerdict(subject.beds, comp.beds, opts)
  const baths = roomCountVerdict(subject.baths, comp.baths, opts)
  const gap = { beds: countedGap(subject.beds, comp.beds), baths: countedGap(subject.baths, comp.baths) }
  if (beds === 'refuse' || baths === 'refuse') return { ok: false, notes: [], gap }
  const notes: Array<'beds' | 'baths'> = []
  if (beds === 'noted') notes.push('beds')
  if (baths === 'noted') notes.push('baths')
  return { ok: true, notes, gap }
}

/** "one bedroom", "two bathrooms", or both, in that order. A missing gap reads as one. */
export function roomOffPhrase(
  notes: readonly ('beds' | 'baths')[],
  gap?: Partial<RoomGap> | null,
): string {
  const parts = notes.map((n) => {
    const off = gap?.[n]
    if (n === 'beds') return off === 2 ? 'two bedrooms' : 'one bedroom'
    return off === 2 ? 'two bathrooms' : 'one bathroom'
  })
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts[0]} and ${parts[1]}`
}

/**
 * The sentence that sits beside a sale whose rooms are off, on the document
 * itself. It names one or two, says the sale counts for less, and states that
 * no dollar value was applied.
 */
export function roomDifferenceSentence(
  notes: Array<'beds' | 'baths'> | null | undefined,
  gap?: Partial<RoomGap> | null,
): string | null {
  if (!notes || notes.length === 0) return null
  const list = roomOffPhrase(notes, gap)
  const phrase = list.charAt(0).toUpperCase() + list.slice(1)
  return `${phrase} different from yours. It counts for less than a sale with the same rooms. No dollar value is applied to the room.`
}
