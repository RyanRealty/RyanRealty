/**
 * One Active listing photo per leftover type card.
 * Newest-N across all types leaves condo / land / farm blank; this asks
 * each type on its own. Miss omits. Never invents a stand-in.
 */
import { getListingTiles } from '@/lib/data/listings/getListingTiles'
import { PLACE_TYPE_COVER_SPECS } from '@/lib/place/publish-place-type-cards'

function inAliasSet(
  subdivisionName: string | null | undefined,
  aliases: readonly string[],
): boolean {
  const sub = subdivisionName?.trim().toLowerCase()
  if (!sub) return false
  return aliases.some((alias) => {
    const name = alias.trim().toLowerCase()
    return Boolean(name) && (sub === name || sub.includes(name) || name.includes(sub))
  })
}

export async function loadPlaceTypeCoverPhotos(scope: {
  city?: string
  neighborhood?: string
  subdivision?: string
  aliases?: readonly string[]
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

  const aliases = (scope.aliases ?? []).map((a) => a.trim()).filter(Boolean)
  const missing = PLACE_TYPE_COVER_SPECS.filter((spec) => !covers[spec.key])
  if (aliases.length > 0 && scope.city && missing.length > 0) {
    const extras = await Promise.all(
      missing.map(async (spec) => {
        try {
          const rows = await getListingTiles({
            city: scope.city,
            status: 'active',
            sort: 'newest',
            limit: 40,
            propertyType: spec.propertyType,
            propertySubType: spec.propertySubType,
          })
          const photo =
            rows.find((row) => row.photoUrl && inAliasSet(row.subdivisionName, aliases))?.photoUrl ??
            null
          return [spec.key, photo] as const
        } catch {
          return [spec.key, null] as const
        }
      }),
    )
    for (const [key, photo] of extras) {
      if (photo) covers[key] = photo
    }
  }
  return covers
}
