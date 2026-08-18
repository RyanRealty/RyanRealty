/**
 * MLS alias match for planned communities that are not cityResorts().
 *
 * Crooked River Ranch homes are tagged Crr / Crr 8 / Crr3_C — not
 * "Crooked River Ranch". cityResorts() stays `is_resort === true` so
 * Three Rivers Oww / Sun Dance cannot over-match the golf ledger.
 *
 * Founding case: /communities/crooked-river-ranch published 0 homes
 * while Terrebonne held live type-A Crr* inventory.
 */

export type CommunityAliasEntry = {
  slug?: string
  label?: string
  is_resort?: boolean
  subdivision_aliases?: string[]
}

export type CommunityAliasTile = {
  subdivisionName?: string | null
}

export function isCrrFamilySubdivisionName(name: string): boolean {
  return /^crr(?:$|[\s\d_])/i.test(name.trim())
}

export function subdivisionMatchesCommunityAlias(
  subdivisionName: string,
  alias: string,
): boolean {
  const sub = subdivisionName.trim().toLowerCase()
  const prefix = alias.trim().toLowerCase()
  if (!sub || !prefix) return false
  if (sub === prefix) return true
  if (sub.startsWith(`${prefix} `)) return true
  if (prefix === 'crr' && isCrrFamilySubdivisionName(sub)) return true
  return false
}

export function communityAliasTilesForEntry<T extends CommunityAliasTile>(
  entry: CommunityAliasEntry,
  tiles: T[],
): T[] {
  const aliases = entry.subdivision_aliases ?? []
  if (aliases.length === 0) return []
  return tiles.filter((tile) =>
    aliases.some((alias) => subdivisionMatchesCommunityAlias(tile.subdivisionName ?? '', alias)),
  )
}

/** Non-resort registry rows whose MLS tags are a Crr-style family. */
export function registryEntryUsesMlsAliasScan(
  entry: CommunityAliasEntry | null | undefined,
): boolean {
  if (!entry || entry.is_resort === true) return false
  return (entry.subdivision_aliases ?? []).some((alias) => isCrrFamilySubdivisionName(alias))
}

/** Roll Crr* ingest keys onto the published community name. */
export function publishCanonicalCommunityName(mlsSubdivisionName: string): string {
  const raw = mlsSubdivisionName.trim()
  if (!raw) return raw
  if (isCrrFamilySubdivisionName(raw)) return 'Crooked River Ranch'
  return raw
}

export function isOrphanCrrIndexSubdivision(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (trimmed.toLowerCase() === 'crooked river ranch') return false
  return isCrrFamilySubdivisionName(trimmed)
}

/** Non-resort Crr-family tiles from a city pull. Empty on timeout / no match. */
export function communityMlsAliasInventory<T extends CommunityAliasTile>(
  entry: CommunityAliasEntry | null | undefined,
  citySfrTiles: T[],
): { tiles: T[]; useAliasTiles: boolean } {
  if (!registryEntryUsesMlsAliasScan(entry) || !entry || citySfrTiles.length === 0) {
    return { tiles: [], useAliasTiles: false }
  }
  const tiles = communityAliasTilesForEntry(entry, citySfrTiles)
  return { tiles, useAliasTiles: tiles.length > 0 }
}

export function topPricedTiles<T extends { listPrice?: number | null }>(tiles: T[], limit = 14): T[] {
  return [...tiles].sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0)).slice(0, limit)
}

/** Count + tiles that must stay paired for the hero median. */
export function publishedAliasAwareSet<T>(input: {
  resortTiles: T[]
  aliasTiles: T[]
  resortCount: number | null
}): { count: number | null; tiles: T[] } {
  if (input.resortCount != null) return { count: input.resortCount, tiles: input.resortTiles }
  if (input.aliasTiles.length > 0) return { count: input.aliasTiles.length, tiles: input.aliasTiles }
  return { count: null, tiles: [] }
}
