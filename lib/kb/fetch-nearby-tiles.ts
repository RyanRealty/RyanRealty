import { getListingTiles } from '@/lib/data'

const MIN_NEARBY_TILES = 4

/**
 * "Similar homes" tile fetch with a widen-on-thin-scope fallback. A
 * subdivision- or neighborhood-scoped pull that comes back with too few
 * OTHER active homes (after excluding the current listing) re-fetches at
 * city scope instead of leaving the rail empty (design-audit P2 — verified
 * live against a listing whose subdivision had exactly one active row, the
 * listing itself).
 */
export async function fetchNearbyTiles(
  scope: { subdivision?: string; neighborhood?: string; city?: string },
  excludeListingKey: string,
  excludeListNumber: string | null
) {
  const exclude = (tiles: Awaited<ReturnType<typeof getListingTiles>>) =>
    tiles.filter((t) => t.listingKey !== excludeListingKey && t.listNumber !== excludeListNumber)

  const primary = await getListingTiles({ ...scope, status: 'active', propertyType: 'A', sort: 'price-desc', limit: 14 })
  const filtered = exclude(primary)
  if (filtered.length >= MIN_NEARBY_TILES || (!scope.subdivision && !scope.neighborhood)) return filtered

  const wide = await getListingTiles({ city: scope.city, status: 'active', propertyType: 'A', sort: 'price-desc', limit: 14 })
  return exclude(wide)
}
