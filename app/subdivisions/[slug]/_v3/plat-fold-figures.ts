/**
 * SITE-86 — plat fold 30-day alerts count from THIS plat only.
 * REGISTRY §4: subdivision grain publishes counts only — no MOS here.
 * Never borrow a parent city/community pulse.
 */

const DAY_MS = 86_400_000

export type PlatFoldTile = {
  listingKey: string
  onMarketDate?: string | null
  propertyType?: string | null
  propertySubType?: string | null
  status?: string | null
}

/** Houses in this plat's counted set that came on market in the last 30 days. */
export function platNewCount30dFromTiles(
  tiles: ReadonlyArray<PlatFoldTile>,
  inventoryKeys: ReadonlySet<string> | null,
  nowMs: number = Date.now(),
): number | null {
  const cutoff = nowMs - 30 * DAY_MS
  let n = 0
  for (const tile of tiles) {
    if (inventoryKeys && inventoryKeys.size > 0 && !inventoryKeys.has(tile.listingKey)) continue
    if (tile.propertyType != null && tile.propertyType !== 'A') continue
    if (
      tile.propertySubType != null &&
      tile.propertySubType !== '' &&
      tile.propertySubType !== 'Single Family Residence'
    ) {
      continue
    }
    if (!tile.onMarketDate) continue
    const ts = Date.parse(tile.onMarketDate)
    if (!Number.isFinite(ts) || ts < cutoff) continue
    n += 1
  }
  return n > 0 ? n : null
}
