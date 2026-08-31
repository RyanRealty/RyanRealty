/**
 * One Active listing photo per leftover type card.
 * Newest-N across all types leaves condo / land / farm blank; this asks
 * each type on its own. Miss omits. Never invents a stand-in.
 */
import { getListingTiles } from '@/lib/data/listings/getListingTiles'
import { PLACE_TYPE_COVER_SPECS } from '@/lib/place/publish-place-type-cards'

export async function loadPlaceTypeCoverPhotos(scope: {
  city?: string
  neighborhood?: string
  subdivision?: string
}): Promise<Record<string, string>> {
  const covers: Record<string, string> = {}
  const settled = await Promise.all(
    PLACE_TYPE_COVER_SPECS.map(async (spec) => {
      try {
        const rows = await getListingTiles({
          city: scope.city,
          neighborhood: scope.neighborhood,
          subdivision: scope.subdivision,
          status: 'active',
          sort: 'newest',
          limit: 8,
          propertyType: spec.propertyType,
          propertySubType: spec.propertySubType,
        })
        const photo = rows.find((row) => row.photoUrl)?.photoUrl ?? null
        return [spec.key, photo] as const
      } catch {
        return [spec.key, null] as const
      }
    }),
  )
  for (const [key, photo] of settled) {
    if (photo) covers[key] = photo
  }
  return covers
}
