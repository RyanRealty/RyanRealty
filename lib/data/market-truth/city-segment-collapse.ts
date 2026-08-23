/** Latest period_end, then window 0 (point) / 6 (MOS/verdict), else smallest window. */

export const SALE_SEGMENTS = [
  'detached',
  'condo',
  'townhome',
  'manufactured_land',
  'manufactured_park',
  'multifamily_2_4',
  'land',
  'farm',
  'commercial_sale',
  'business',
  'all_residential',
] as const

export const BOARD_STATS = [
  'active_count',
  'median_list_active',
  'months_of_supply',
  'market_verdict',
] as const

export type CitySegmentRow = {
  segment: string
  activeCount: number | null
  medianList: number | null
  monthsOfSupply: number | null
  verdict: string | null
  sampleN: number | null
}

export type RawSegmentCell = {
  segment: string
  stat_id: string
  value: number | string | null
  value_text: string | null
  sample_n: number | string | null
  window_months: number | string
  period_end: string
  computed_at: string
  complete_through: string
  is_publishable: boolean
}

export function preferredWindow(statId: string): number {
  if (statId === 'months_of_supply' || statId === 'market_verdict') return 6
  return 0
}

export function preferSegmentCell(next: RawSegmentCell, prev: RawSegmentCell): boolean {
  const peN = String(next.period_end)
  const peP = String(prev.period_end)
  if (peN !== peP) return peN > peP
  const want = preferredWindow(next.stat_id)
  const wN = Number(next.window_months)
  const wP = Number(prev.window_months)
  if (wN !== wP) {
    if (wN === want) return true
    if (wP === want) return false
    return wN < wP
  }
  return String(next.computed_at) > String(prev.computed_at)
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function pickSampleN(cells: {
  active?: RawSegmentCell
  median?: RawSegmentCell
  mos?: RawSegmentCell
  verdict?: RawSegmentCell
}): number | null {
  return (
    asNumber(cells.mos?.sample_n) ??
    asNumber(cells.active?.sample_n) ??
    asNumber(cells.median?.sample_n) ??
    asNumber(cells.verdict?.sample_n)
  )
}

export function collapseCitySegmentRows(
  rows: RawSegmentCell[],
  opts?: { stale?: (row: RawSegmentCell) => boolean },
): CitySegmentRow[] {
  const stale = opts?.stale
  const best = new Map<string, RawSegmentCell>()
  for (const row of rows) {
    if (!row.is_publishable || row.value == null) continue
    if (stale?.(row)) continue
    const key = `${row.segment}:${row.stat_id}`
    const prev = best.get(key)
    if (!prev || preferSegmentCell(row, prev)) best.set(key, row)
  }

  return SALE_SEGMENTS.map((segment) => {
    const active = best.get(`${segment}:active_count`)
    const median = best.get(`${segment}:median_list_active`)
    const mos = best.get(`${segment}:months_of_supply`)
    const verdict = best.get(`${segment}:market_verdict`)
    const activeCount = asNumber(active?.value)
    const medianList = asNumber(median?.value)
    const monthsOfSupply = asNumber(mos?.value)
    const verdictText =
      verdict?.value_text != null && String(verdict.value_text).trim() !== ''
        ? String(verdict.value_text)
        : null
    return {
      segment,
      activeCount: activeCount == null ? null : Math.round(activeCount),
      medianList,
      monthsOfSupply,
      verdict: verdictText,
      sampleN: pickSampleN({ active, median, mos, verdict }),
    }
  })
}
