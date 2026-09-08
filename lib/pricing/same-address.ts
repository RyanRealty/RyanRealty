/**
 * One home, one sale.
 *
 * cma-19968's price grid printed "60924 Targee" twice — $455,000 on 2026-06-26
 * and $287,500 on 2026-03-17, rows two and four of the same table, no unit
 * number, no note. A reader sees one house selling twice at a $167,500
 * difference and has no way to tell whether the document is wrong or the market
 * is (tasteReview round three, §3).
 *
 * Traced: two ListingKeys, 20260527193628217804000000 and
 * 20260216224417444083000000, same address, same 1,394 square feet, three
 * months apart. That is one home bought and resold, not two units, and the
 * March close is a PRIOR sale of the June comp. Weighting both counts one house
 * twice and prices the subject partly off what the flipper paid.
 *
 * THE RULE. Two priced sales that normalize to the same street address are the
 * same property unless the record distinguishes them — a unit number on either
 * side, or a living area that differs by more than a rounding difference. When
 * they are the same property the MOST RECENT close is the comp and every older
 * one is dropped as a prior sale of it. When the record does distinguish them
 * both are kept, because two units in one building are two sales.
 *
 * Pure. It decides nothing about which sales were selected, only that a
 * selected set never prints one home twice.
 */

/** What the rule needs off a candidate sale. Everything else rides along. */
export interface SameAddressCandidate {
  listingKey: string
  address: string
  closeDate: string
  sqft?: number | null
  unitNumber?: string | null
}

export interface SameAddressDrop {
  listingKey: string
  address: string
  /** The key that was kept: the most recent close at that address. */
  keptListingKey: string
  /** Seller language, for `pricing.rejected`. */
  reason: string
}

export interface SameAddressResult<T> {
  kept: T[]
  dropped: SameAddressDrop[]
}

/** Case, spacing and trailing punctuation are not part of an address. */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]+$/, '')
}

/** Living areas this far apart are different homes, not one home remeasured. */
const SQFT_TOLERANCE = 0.02

/**
 * Two rows at one normalized address are the same property unless the record
 * says otherwise. A unit number on either side says otherwise. So does a
 * living area more than 2 percent apart, which is wider than any remeasure and
 * narrower than any second unit worth calling a comp.
 */
export function isSameProperty(a: SameAddressCandidate, b: SameAddressCandidate): boolean {
  if (normalizeAddress(a.address) !== normalizeAddress(b.address)) return false
  const unitA = (a.unitNumber ?? '').trim()
  const unitB = (b.unitNumber ?? '').trim()
  if (unitA || unitB) return unitA.toLowerCase() === unitB.toLowerCase()
  const sqA = a.sqft ?? 0
  const sqB = b.sqft ?? 0
  if (sqA > 0 && sqB > 0 && Math.abs(sqA - sqB) / Math.max(sqA, sqB) > SQFT_TOLERANCE) return false
  return true
}

/** "sold at this address again on 2026-06-26, so the earlier sale is not counted twice". */
function dropReason(keptCloseDate: string): string {
  const day = keptCloseDate.slice(0, 10)
  return `an earlier sale of the same home, which sold again on ${day} and is already in this analysis`
}

/**
 * Keep one sale per property: the most recent close. Input order is preserved
 * for everything kept, so the grid, the weights and the range stay aligned.
 */
export function dropPriorSalesOfSameHome<T extends SameAddressCandidate>(
  sales: readonly T[],
): SameAddressResult<T> {
  const dropped: SameAddressDrop[] = []
  const drop = new Set<string>()

  for (let i = 0; i < sales.length; i++) {
    const a = sales[i]!
    if (drop.has(a.listingKey)) continue
    for (let j = i + 1; j < sales.length; j++) {
      const b = sales[j]!
      if (drop.has(b.listingKey)) continue
      if (!isSameProperty(a, b)) continue
      // Ties resolve on the key, so the choice does not depend on input order.
      const aWins =
        a.closeDate > b.closeDate ||
        (a.closeDate === b.closeDate && a.listingKey >= b.listingKey)
      const loser = aWins ? b : a
      const winner = aWins ? a : b
      drop.add(loser.listingKey)
      dropped.push({
        listingKey: loser.listingKey,
        address: loser.address,
        keptListingKey: winner.listingKey,
        reason: dropReason(winner.closeDate),
      })
      if (!aWins) break
    }
  }

  return { kept: sales.filter((s) => !drop.has(s.listingKey)), dropped }
}
