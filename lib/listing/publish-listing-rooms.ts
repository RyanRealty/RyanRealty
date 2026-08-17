/**
 * One published bedroom / bathroom pair for a listing.
 *
 * Hero printed MLS BedroomsTotal / BathroomsTotal with no density check.
 * 7800 Rogue River (Agness) is 23 bd · 22 ba · 1,000 sqft at $850,000.
 * Those room counts cannot be living area. Keep the page; withhold the rooms.
 * Fleet listing-detail punch 2026-08-17.
 *
 * A count prints when it is positive and, when living area is known, can
 * fit that area. Eight-plus rooms need at least 100 sqft per bedroom and
 * 80 sqft per bathroom. Sixteen-plus rooms without living area withhold.
 */

export type PublishedListingRooms = {
  beds: number | null
  baths: number | null
}

function asPositiveCount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

function publishCount(
  value: number | null | undefined,
  livingSqft: number | null,
  minSqftPer: number,
): number | null {
  const count = asPositiveCount(value)
  if (count == null) return null
  if (livingSqft != null && livingSqft > 0) {
    if (count >= 8 && livingSqft / count < minSqftPer) return null
    return count
  }
  if (count >= 16) return null
  return count
}

export function publishListingRooms(input: {
  beds?: number | null
  baths?: number | null
  livingSqft?: number | null
}): PublishedListingRooms {
  const livingSqft = asPositiveCount(input.livingSqft)
  return {
    beds: publishCount(input.beds, livingSqft, 100),
    baths: publishCount(input.baths, livingSqft, 80),
  }
}
