/**
 * SITE-129 — plat fold Atlas + typed inventory.
 *
 * SFR counted face (getPlatPublicInventory) stays the MOS / median / 30-day
 * house figure. Mixed stock on the map and in V3PlaceInventory uses every
 * live type inside the plat, the same way /communities/tetherow already does.
 * Empty type buckets omit.
 */

export type PlatAtlasDot = {
  k?: string | null
  t: string
  s?: string | null
}

export type PlatAtlasType = {
  key: string
  label: string
}

export function platAtlasListingKeys(dots: readonly PlatAtlasDot[]): string[] {
  return [...new Set(dots.map((dot) => dot.k).filter((key): key is string => Boolean(key)))]
}

export function platFoldHasMixedTypes(dots: readonly PlatAtlasDot[]): boolean {
  const types = new Set(
    dots.filter((dot) => dot.s !== 'sold').map((dot) => dot.t).filter(Boolean),
  )
  return types.size > 1
}

export function platFoldAtlasView<TDot extends PlatAtlasDot, TType extends PlatAtlasType>(input: {
  dots: readonly TDot[]
  types: readonly TType[]
}): { dots: readonly TDot[]; types: readonly TType[] } {
  if (platFoldHasMixedTypes(input.dots)) {
    return { dots: input.dots, types: input.types }
  }
  const houseDots = input.dots.filter((dot) => dot.t === 'house')
  const houseTypes = input.types.filter((type) => type.key === 'house')
  return {
    dots: houseDots.length > 0 ? houseDots : input.dots,
    types: houseTypes.length > 0 ? houseTypes : input.types,
  }
}

export function platFoldListedCount(dots: readonly PlatAtlasDot[]): number {
  return dots.filter((dot) => dot.s !== 'sold').length
}
