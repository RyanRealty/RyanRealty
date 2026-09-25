/**
 * THE COUNT OVER A PLACE PAGE'S HOMES (SITE-193, Matt 2026-09-24 via the
 * orchestrator: "the map says 700 for sale while the homes block says 705 on
 * /cities/bend ... make both read the same definition from one source").
 *
 * The homes under a place map hold every listing a visitor may see as on the
 * market: Active, and Active Under Contract (an accepted offer, still
 * showing). The map above them draws Active as for sale and puts Active Under
 * Contract with the pending marks. Both now read publicCountState
 * (lib/listing-status-public), so "for sale" is Active on the map, in the
 * homes block's count, and in every buyer group's count; a listing under
 * contract is counted as under contract, never as for sale.
 *
 * Client-safe: PlaceSubdivisionHomes (a client component) and the server-side
 * section builders call it alike.
 */
import { formatCount } from '@/lib/format/count'
import { publicCountState } from '@/lib/listing-status-public'

export type PlaceCountRow = { standardStatus?: string | null }

export type PlaceHomesCount = { forSale: number; underContract: number }

/** How many of the rows are for sale and how many are under contract. */
export function placeHomesCount(rows: readonly PlaceCountRow[]): PlaceHomesCount {
  let forSale = 0
  let underContract = 0
  for (const row of rows) {
    // A row read with no status is what the public status policy treats as
    // on the market (isPubliclyDisplayableStatus), so it counts for sale.
    if (publicCountState(row.standardStatus) === 'under-contract') underContract += 1
    else forSale += 1
  }
  return { forSale, underContract }
}

/**
 * "700 for sale", "533 for sale · 5 under contract", "2 under contract", or
 * null for no rows. Never "0 for sale": a group with no listing for sale says
 * only what it holds.
 */
export function placeHomesCountLabel(rows: readonly PlaceCountRow[]): string | null {
  const { forSale, underContract } = placeHomesCount(rows)
  const parts: string[] = []
  if (forSale > 0) parts.push(`${formatCount(forSale)} for sale`)
  if (underContract > 0) parts.push(`${formatCount(underContract)} under contract`)
  return parts.length > 0 ? parts.join(' · ') : null
}
