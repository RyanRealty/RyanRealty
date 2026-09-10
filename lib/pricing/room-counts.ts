/**
 * ONE ROOM RULE, for bedrooms and bathrooms alike (Matt 2026-09-10:
 * "adjust inside, wall outside").
 *
 * Same whole count travels anywhere. ONE room apart is used only on the
 * subject's own ground — its plat, its mapped neighborhood, or its own street
 * — and the document says so on the sale. Two or more apart is refused
 * everywhere.
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
 * sale is usable — the same convention `bathCountCompatible` has always used.
 */

/** How far apart two room counts may be on the subject's own ground. */
export const ROOM_GAP_LOCAL_MAX = 1

export type RoomVerdict = 'match' | 'noted' | 'refuse'

/** Whole rooms. A 3.5-bath house is a 3-bath house for this comparison. */
function whole(count: number | null | undefined): number | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null
  return Math.floor(count)
}

/**
 * `match` — same whole count, usable anywhere with nothing to say.
 * `noted`  — one room apart on the subject's own ground; usable, disclosed.
 * `refuse` — one room apart away from home, or two or more apart anywhere.
 */
export function roomCountVerdict(
  subjectCount: number | null | undefined,
  compCount: number | null | undefined,
  opts: { local: boolean },
): RoomVerdict {
  const a = whole(subjectCount)
  const b = whole(compCount)
  // An unknown count is not evidence of a difference. The old rule read it the
  // same way, and a missing bath count is a data gap, not a mismatch.
  if (a == null || b == null) return 'match'
  const gap = Math.abs(a - b)
  if (gap === 0) return 'match'
  if (gap <= ROOM_GAP_LOCAL_MAX && opts.local) return 'noted'
  return 'refuse'
}

/**
 * Both counts at once. `ok` is false as soon as either is refused; `notes`
 * names every room count that differs on a sale we are still using, so the
 * selector can stamp it on the comp and the document can print it.
 */
export function roomCountsUsable(
  subject: { beds: number | null | undefined; baths: number | null | undefined },
  comp: { beds: number | null | undefined; baths: number | null | undefined },
  opts: { local: boolean },
): { ok: boolean; notes: Array<'beds' | 'baths'> } {
  const beds = roomCountVerdict(subject.beds, comp.beds, opts)
  const baths = roomCountVerdict(subject.baths, comp.baths, opts)
  if (beds === 'refuse' || baths === 'refuse') return { ok: false, notes: [] }
  const notes: Array<'beds' | 'baths'> = []
  if (beds === 'noted') notes.push('beds')
  if (baths === 'noted') notes.push('baths')
  return { ok: true, notes }
}

/** "one bedroom and one bathroom different from yours", for the document. */
export function roomDifferenceSentence(notes: Array<'beds' | 'baths'> | null | undefined): string | null {
  if (!notes || notes.length === 0) return null
  const parts = notes.map((n) => (n === 'beds' ? 'bedroom' : 'bathroom'))
  const list = parts.length === 1 ? parts[0]! : `${parts[0]} and ${parts[1]}`
  return `One ${list} different from yours. It sits on this home's own ground, so it still prices the house; no dollar value is applied to the room, because paired sales in this market do not support one.`
}
