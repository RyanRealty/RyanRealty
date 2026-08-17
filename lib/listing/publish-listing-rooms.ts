/**
 * One published beds / baths / living-area set for a listing.
 *
 * MLS can stamp lodge-scale room counts on a tiny living area. 7800 Rogue
 * River (220208750) is 23 beds / 22 baths / 1,000 sqft — 43 sqft per bedroom.
 * Hero, Facts, and JSON-LD all printed that pair. Keep the page and the
 * living area. Withhold the room counts.
 *
 * A large home with many bedrooms stays public when living area can hold
 * them (8+ beds at ≥ 150 sqft/bed, or 8+ baths at ≥ 80 sqft/bath).
 */

export type PublishedListingRooms = {
  beds: number | null
  baths: number | null
  sqft: number | null
}

const DENSE_ROOM_FLOOR = 8
const MIN_SQFT_PER_BED = 150
const MIN_SQFT_PER_BATH = 80

function asPositive(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function publishListingRooms(input: {
  beds?: number | null
  baths?: number | null
  sqft?: number | null
}): PublishedListingRooms {
  const beds = asPositive(input.beds)
  const baths = asPositive(input.baths)
  const sqft = asPositive(input.sqft)
  const denseBeds = beds != null && sqft != null && beds >= DENSE_ROOM_FLOOR && sqft / beds < MIN_SQFT_PER_BED
  const denseBaths =
    baths != null && sqft != null && baths >= DENSE_ROOM_FLOOR && sqft / baths < MIN_SQFT_PER_BATH
  if (denseBeds || denseBaths) return { beds: null, baths: null, sqft }
  return { beds, baths, sqft }
}
