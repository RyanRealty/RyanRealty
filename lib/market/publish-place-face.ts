/**
 * What a place page may print on its FACE strip.
 *
 * Leftover HUD is the pile. This filter is the grain. City may show MOS,
 * verdict, and DTP. Neighborhood / community / subdivision show count +
 * median list only. Miss omits. Do not invent a number.
 */
import { leftoverHudKpis, type LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { marketVerdict } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPriceExact } from '@/lib/format/money'
import { publishDaysFigure } from '@/lib/market/publish-days-figure'
import type { MarketGrain } from '@/lib/market/geo-grain-trust'

export type PlaceFaceGrain = Extract<MarketGrain, 'city' | 'neighborhood' | 'community' | 'subdivision'>

export type PlaceFaceStat = {
  id: 'active' | 'medianList' | 'monthsOfSupply' | 'verdict' | 'daysToPending'
  value: string
  label: string
}

export type PlaceFace = {
  stats: PlaceFaceStat[]
  monthsOfSupply: number | null
  verdict: { kind: string; label: string } | null
}

function asPositiveCount(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

function asPositivePrice(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

/**
 * Face stats for a place page. `active` / `medianList` may override leftover
 * when a tighter SoR exists (neighborhood polygon inventory, plat inventory).
 * MOS/verdict/DTP only print at city.
 */
export function publishPlaceFace(input: {
  grain: PlaceFaceGrain
  hud: LeftoverHudKpis | null | undefined
  active?: number | null
  medianList?: number | null
}): PlaceFace {
  const hud = input.hud
  const active = asPositiveCount(
    input.active !== undefined ? input.active : (hud?.active ?? null),
  )
  const medianList = asPositivePrice(
    input.medianList !== undefined ? input.medianList : (hud?.medianList ?? null),
  )
  const stats: PlaceFaceStat[] = []

  if (active != null) {
    stats.push({
      id: 'active',
      value: active.toLocaleString('en-US'),
      label: active === 1 ? 'home for sale' : 'homes for sale',
    })
  }
  if (medianList != null) {
    stats.push({
      id: 'medianList',
      value: formatPriceExact(medianList),
      label: 'median list',
    })
  }

  if (input.grain !== 'city') {
    return { stats, monthsOfSupply: null, verdict: null }
  }

  const mos = hud?.monthsSupply != null && hud.monthsSupply > 0 ? hud.monthsSupply : null
  const verdict = mos != null ? marketVerdict(mos) : null
  if (verdict && verdict.kind !== 'unknown') {
    stats.push({ id: 'verdict', value: verdict.label, label: 'market' })
  }
  if (mos != null) {
    stats.push({
      id: 'monthsOfSupply',
      value: formatMonthsOfSupply(mos),
      label: 'months of supply',
    })
  }
  const dtp = publishDaysFigure(hud?.daysToPending ?? null)
  if (dtp) {
    stats.push({
      id: 'daysToPending',
      value: dtp,
      label: 'median days to pending',
    })
  }

  return {
    stats,
    monthsOfSupply: mos,
    verdict: verdict && verdict.kind !== 'unknown' ? verdict : null,
  }
}

/** Re-export so callers do not import leftoverHudKpis only to throw it away. */
export { leftoverHudKpis }
