/**
 * The figures on the city index's door board (SITE-92 round 5) — pure.
 *
 * Every door on the board carries the count it opens onto, or nothing. These
 * helpers turn a count the page read into the three strings the board prints
 * (the number for the digit primitive, its formatted face, and what it counts)
 * and refuse to invent one: null in, null out, never a zero for an unread
 * count (CLAUDE.md §0). The reads themselves live in cities-doors.ts; this
 * file holds no I/O so the rule is testable without a database.
 */
import { formatCount } from '@/lib/format/count'

/** Today through six days out — the window /open-houses/[city] reads. */
export const OPEN_HOUSE_WINDOW_DAYS = 6

/** The list-price floor /luxury-homes-bend redirects onto (/homes-for-sale/bend?minPrice=1500000). */
export const LUXURY_FLOOR_USD = 1_500_000
export const LUXURY_FLOOR_LABEL = '$1.5M'

export type DoorFigure = { value: number; formatted: string; unit: string }

function whole(count: number | null | undefined): number | null {
  if (count == null || !Number.isFinite(count) || count < 0) return null
  return Math.round(count)
}

/** The tile's own figure: the city's live single-family count, the same one the ledger prints. */
export function tileFigure(activeCount: number | null | undefined): DoorFigure | null {
  const n = whole(activeCount)
  if (n == null) return null
  return { value: n, formatted: formatCount(n), unit: 'single-family for sale' }
}

/**
 * The open-house door's figure: how many homes in the city hold a public open
 * house in the calendar's window. A published zero is a fact about the week
 * and prints as one; an unread count prints nothing.
 */
export function openHouseDoorFigure(count: number | null | undefined): DoorFigure | null {
  const n = whole(count)
  if (n == null) return null
  return { value: n, formatted: formatCount(n), unit: 'this week' }
}

/** The Bend luxury door's figure: active listings at or above the floor the page filters on. */
export function luxuryDoorFigure(count: number | null | undefined): DoorFigure | null {
  const n = whole(count)
  if (n == null) return null
  return { value: n, formatted: formatCount(n), unit: `at ${LUXURY_FLOOR_LABEL} and up` }
}

/** The §0 trace for the open-house doors, in the words the board's disclosure prints. */
export const OPEN_HOUSE_DOOR_TRACE =
  'Open houses: live MLS through Oregon Data Share — active listings in the city holding a public open house today through six days out (Pacific), one soonest open house per listing, builder model homes excluded; the same read /open-houses/<city> makes, so the door prints the calendar it opens'

/** The §0 trace for the Bend luxury door. */
export const LUXURY_DOOR_TRACE =
  'Luxury homes in Bend: live MLS through Oregon Data Share — active listings of every type in Bend with a list price at or above $1,500,000, the filter /luxury-homes-bend opens onto'

/**
 * The tile with the largest published figure leads the board. Ties go to the
 * first in the caller's order; a board with no figure at all has no lead.
 */
export function leadTileId<T extends { id: string; count: number | null }>(tiles: readonly T[]): string | null {
  let lead: T | null = null
  for (const t of tiles) {
    if (t.count == null) continue
    if (lead == null || (lead.count != null && t.count > lead.count)) lead = t
  }
  return lead?.id ?? null
}
