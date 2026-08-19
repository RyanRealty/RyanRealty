/**
 * Featured plat strip on /subdivisions.
 *
 * First-alias-per-community ranks empty child phases (0 ACTIVE) above
 * sibling plats that have inventory. Featured tiles prefer the highest
 * verified SFR count per parent. Zero-inventory plats stay on the A-Z
 * index, not the featured strip. Do not hull-fill a count.
 *
 * Founding case: /subdivisions featured 7 of 12 tiles as 0 ACTIVE
 * (fleet 85d5a3fa03607cc61dfe981d2da84308).
 */

export type FeaturedPlatSeed = {
  slug: string
  name: string
  parent: string
  parentSlug: string
  city: string
  citySlug: string
}

function platKey(plat: FeaturedPlatSeed): string {
  return `${plat.citySlug}:${plat.slug}`
}

export function featuredPlatCount(
  plat: FeaturedPlatSeed,
  activeCountByKey: ReadonlyMap<string, number>,
): number {
  return activeCountByKey.get(platKey(plat)) ?? 0
}

function comparePlats<T extends FeaturedPlatSeed>(
  a: T,
  b: T,
  activeCountByKey: ReadonlyMap<string, number>,
): number {
  const countDelta = featuredPlatCount(b, activeCountByKey) - featuredPlatCount(a, activeCountByKey)
  if (countDelta !== 0) return countDelta
  const nameDelta = a.name.localeCompare(b.name)
  if (nameDelta !== 0) return nameDelta
  return a.slug.localeCompare(b.slug)
}

function firstPerParent<T extends FeaturedPlatSeed>(children: readonly T[], cap: number): T[] {
  const picked: T[] = []
  const seenParent = new Set<string>()
  for (const child of children) {
    if (seenParent.has(child.parentSlug)) continue
    seenParent.add(child.parentSlug)
    picked.push(child)
    if (picked.length >= cap) break
  }
  return picked
}

/**
 * Rank featured plats by verified inventory when the batch is present.
 * Missing inventory cannot be ranked — keep one plat per parent in
 * registry order so the strip still renders.
 */
export function publishFeaturedPlats<T extends FeaturedPlatSeed>(
  children: readonly T[],
  activeCountByKey: ReadonlyMap<string, number>,
  opts?: { inventoryOk?: boolean; cap?: number },
): T[] {
  const cap = opts?.cap ?? 12
  if (cap <= 0) return []
  if (!opts?.inventoryOk) return firstPerParent(children, cap)

  const parentPicks = new Map<string, T>()
  for (const child of children) {
    const current = parentPicks.get(child.parentSlug)
    if (!current || comparePlats(child, current, activeCountByKey) < 0) {
      parentPicks.set(child.parentSlug, child)
    }
  }

  const liveParentPicks = [...parentPicks.values()]
    .filter((plat) => featuredPlatCount(plat, activeCountByKey) > 0)
    .sort((a, b) => comparePlats(a, b, activeCountByKey))

  const pickedKeys = new Set(liveParentPicks.map((plat) => platKey(plat)))
  const leftover = children
    .filter((plat) => {
      const key = platKey(plat)
      return !pickedKeys.has(key) && featuredPlatCount(plat, activeCountByKey) > 0
    })
    .sort((a, b) => comparePlats(a, b, activeCountByKey))

  return [...liveParentPicks, ...leftover].slice(0, cap)
}
