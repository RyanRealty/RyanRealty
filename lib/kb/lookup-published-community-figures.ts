import { slugify } from '@/lib/slug'
import { lookupRegistryResortFigures } from '@/lib/market/publish-resort-index-figures'
import type { RegistryResortPublicFigures } from '@/lib/kb/registry-resort-public-figures'

type OverlayRow = {
  slug: string
  citySlug?: string
  name?: string
  entityKey?: string
}

export async function loadPublishedCommunityFigureMaps(): Promise<{
  resort: Map<string, RegistryResortPublicFigures>
  alias: Map<string, RegistryResortPublicFigures>
}> {
  const { getRegistryResortPublicFigures } = await import('@/lib/kb/registry-resort-public-figures')
  const { getRegistryAliasPublicFigures } = await import('@/lib/kb/registry-alias-public-figures')
  const [resort, alias] = await Promise.all([
    getRegistryResortPublicFigures(),
    getRegistryAliasPublicFigures(),
  ])
  return { resort, alias }
}

export function lookupPublishedCommunityFigures(
  maps: { resort: Map<string, RegistryResortPublicFigures>; alias: Map<string, RegistryResortPublicFigures> },
  row: OverlayRow,
): RegistryResortPublicFigures | null {
  return lookupRegistryResortFigures(maps.resort, row) ?? lookupRegistryResortFigures(maps.alias, row)
}

export function indexOverlayRow(row: { slug: string; city: string; subdivision: string; entityKey: string }): OverlayRow {
  return {
    slug: row.slug,
    citySlug: slugify(row.city),
    name: row.subdivision,
    entityKey: row.entityKey,
  }
}
