import type { ListingTile } from '@/lib/data'

/**
 * curateFeaturedTiles — the homepage "Featured homes" mix.
 *
 * Raw price-desc served six $5.9M–$11.9M homes to a $740K-median audience,
 * two of them on the same street (design-audit P2, conversion). The mix:
 *   1. two luxury heroes (highest price, deduped),
 *   2. one mid-market pick per town — the active home closest to that town's
 *      live median, so the typical buyer sees homes they can actually buy,
 *   3. price-desc fill to the limit.
 * Order (Matt 2026-08-27): town-median picks lead, the two highest asks follow.
 * Dedupe key is street + subdivision so one development can't fill the grid.
 * Every tile is live MLS data (§0); no curation ever fabricates an entry.
 */
export function curateFeaturedTiles(
  tiles: ListingTile[],
  townMedians: ReadonlyArray<{ name: string; medianPrice: number | null }>,
  limit = 14,
): ListingTile[] {
  const withPhoto = tiles.filter((t) => t.photoUrl && t.listPrice != null)
  if (withPhoto.length === 0) return tiles.slice(0, limit)

  const out: ListingTile[] = []
  const seen = new Set<string>()
  const dedupeKey = (t: ListingTile) =>
    `${(t.streetName ?? '').toLowerCase().trim()}|${(t.subdivisionName ?? '').toLowerCase().trim()}`
  const take = (t: ListingTile) => {
    seen.add(dedupeKey(t))
    out.push(t)
  }

  const byPriceDesc = [...withPhoto].sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))

  // 1 — the MARKET leads (Matt 2026-08-27): each town's home nearest its live
  // median. Leading with the two luxury heroes put an $8.75M outlier as the
  // first home every visitor saw when the region's median is ~$939K.
  for (const town of townMedians) {
    if (out.length >= limit) break
    if (town.medianPrice == null) continue
    const pick = withPhoto
      .filter((t) => (t.city ?? '').toLowerCase() === town.name.toLowerCase() && !seen.has(dedupeKey(t)))
      .sort(
        (a, b) =>
          Math.abs((a.listPrice ?? 0) - (town.medianPrice as number)) -
          Math.abs((b.listPrice ?? 0) - (town.medianPrice as number)),
      )[0]
    if (pick) take(pick)
  }

  // 2 — then the two highest asks, still in the set, never the opener
  const luxTarget = Math.min(limit, out.length + 2)
  for (const t of byPriceDesc) {
    if (out.length >= luxTarget) break
    if (!seen.has(dedupeKey(t))) take(t)
  }

  // 3 — fill
  for (const t of byPriceDesc) {
    if (out.length >= limit) break
    if (!seen.has(dedupeKey(t))) take(t)
  }

  return out.slice(0, limit)
}
