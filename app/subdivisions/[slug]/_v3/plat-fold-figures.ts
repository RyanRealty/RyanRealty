/**
 * SITE-86 — plat fold MOS pace and 30-day alerts count from THIS plat only.
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

/**
 * Months of supply from this plat's active homes vs its own 12-month closed pace.
 * MOS = active / (closed12 / 12). Caller still runs buildPlaceMosView / publishPlaceMos
 * so implied six-month closes under 6 withhold.
 */
export function platMonthsSupplyFromPace(
  active: number | null | undefined,
  closed12: number | null | undefined,
): number | null {
  if (active == null || !Number.isFinite(active) || active <= 0) return null
  if (closed12 == null || !Number.isFinite(closed12) || closed12 <= 0) return null
  const monthOfSales = closed12 / 12
  if (!(monthOfSales > 0)) return null
  return active / monthOfSales
}

/**
 * Prefer Market Truth recorded-plat closed_count (12mo), else last complete
 * calendar year from the plat's own sales-history / closed-by-year series.
 */
export function platClosedPace12mo(input: {
  mtClosed12: number | null | undefined
  salesYears: ReadonlyArray<{ year: number; closedCount: number }>
  closedByYear?: Record<number, number> | null
  nowYear?: number
}): number | null {
  if (input.mtClosed12 != null && Number.isFinite(input.mtClosed12) && input.mtClosed12 > 0) {
    return Math.round(input.mtClosed12)
  }
  const nowYear = input.nowYear ?? new Date().getFullYear()
  const fromHistory = [...input.salesYears]
    .filter((row) => row.year < nowYear && row.closedCount > 0)
    .sort((a, b) => b.year - a.year)[0]
  if (fromHistory) return fromHistory.closedCount
  if (input.closedByYear) {
    const years = Object.entries(input.closedByYear)
      .map(([y, n]) => ({ year: Number(y), closedCount: Number(n) }))
      .filter((row) => row.year < nowYear && row.closedCount > 0)
      .sort((a, b) => b.year - a.year)
    if (years[0]) return years[0].closedCount
  }
  return null
}

/**
 * Sales-a-month face label. One decimal when the pace is fractional so the
 * visitor's homes÷sales arithmetic matches the months caption (SITE-86).
 * Lives here so the page never calls `.toFixed` on a Mos-named identifier
 * (ci:market-formula).
 */
export function formatPlatSalesPaceLabel(monthOfSales: number): string {
  if (!Number.isFinite(monthOfSales) || monthOfSales <= 0) return '0'
  if (monthOfSales >= 10 || Number.isInteger(monthOfSales)) {
    return String(Math.round(monthOfSales))
  }
  const tenths = Math.round(monthOfSales * 10) / 10
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)
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
