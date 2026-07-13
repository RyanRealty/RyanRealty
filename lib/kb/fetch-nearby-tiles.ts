import { getListingTiles } from '@/lib/data'

type Tiles = Awaited<ReturnType<typeof getListingTiles>>

const MIN_NEARBY_TILES = 4
const TARGET_TILES = 14

/**
 * "Similar homes" tile fetch, ranked by PRICE PROXIMITY to the subject listing
 * so a $550K home shows other ~$550K homes — not the county's most expensive
 * estates (design-audit CNV-7; the old rail sorted price-desc and widened to
 * city-wide still price-desc, so a mid-market buyer's only onward rail was the
 * $4M–$12M estates). Falls back to a wider scope when the tight price band is
 * thin, and ALWAYS re-ranks by proximity after widening.
 */
export async function fetchNearbyTiles(
  scope: { subdivision?: string; neighborhood?: string; city?: string },
  excludeListingKey: string,
  excludeListNumber: string | null,
  subjectPrice?: number | null,
): Promise<Tiles> {
  const exclude = (tiles: Tiles) =>
    tiles.filter((t) => t.listingKey !== excludeListingKey && t.listNumber !== excludeListNumber)

  const rankByProximity = (tiles: Tiles): Tiles => {
    if (!subjectPrice) return tiles
    return [...tiles].sort(
      (a, b) =>
        Math.abs((a.listPrice ?? subjectPrice) - subjectPrice) -
        Math.abs((b.listPrice ?? subjectPrice) - subjectPrice),
    )
  }

  // Asymmetric band (a little more upside headroom); proximity rank does the rest.
  const band = subjectPrice
    ? { minPrice: Math.max(1, Math.round(subjectPrice * 0.6)), maxPrice: Math.round(subjectPrice * 1.6) }
    : {}

  // 1. Same scope, in-band, newest — then re-rank by proximity.
  const primary = exclude(
    await getListingTiles({ ...scope, ...band, status: 'active', propertyType: 'A', sort: 'newest', limit: 24 }),
  )
  if (primary.length >= MIN_NEARBY_TILES) return rankByProximity(primary).slice(0, TARGET_TILES)

  // 2. Widen to city scope, same band.
  if (scope.subdivision || scope.neighborhood) {
    const wideBand = exclude(
      await getListingTiles({ city: scope.city, ...band, status: 'active', propertyType: 'A', sort: 'newest', limit: 24 }),
    )
    if (wideBand.length >= MIN_NEARBY_TILES) return rankByProximity(wideBand).slice(0, TARGET_TILES)
  }

  // 3. Last resort: city scope, no band — still proximity-ranked so the closest-
  //    priced homes lead even when inventory is thin.
  const wide = exclude(
    await getListingTiles({ city: scope.city, status: 'active', propertyType: 'A', sort: 'newest', limit: 40 }),
  )
  return rankByProximity(wide).slice(0, TARGET_TILES)
}
