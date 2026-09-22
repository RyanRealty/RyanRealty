/**
 * City map rail ids.
 *
 * Bend's drawn children are neighborhoods. Their boundary slug is
 * `bend-awbrey-butte` and the door is `/cities/bend/awbrey-butte`, so the
 * rail id is the URL slug and the stock slug keeps the city prefix.
 * Other cities draw subdivisions, where the URL slug and the boundary slug
 * are the same.
 */
export function cityChildRailId(region: { id: string; href?: string }): string {
  const fromHref = region.href?.split('/').filter(Boolean).at(-1)?.trim().toLowerCase()
  if (fromHref) return fromHref
  if (region.id.startsWith('subdivision:')) return region.id.slice('subdivision:'.length)
  if (region.id.startsWith('neighborhood:')) return region.id.slice('neighborhood:'.length)
  return region.id
}

export function cityChildStockSlug(
  region: { id: string; kind: string; href?: string },
  citySlug: string,
): string {
  const railId = cityChildRailId(region)
  if (region.kind !== 'neighborhood') return railId
  const city = citySlug.trim().toLowerCase()
  return railId.startsWith(`${city}-`) ? railId : `${city}-${railId}`
}
