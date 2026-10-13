/**
 * Live leftover HUD + 12-month pace + this week's Bend cuts for /buy/leverage.
 * leftoverHudKpis is the MOS gate (ci:publish-months-of-supply). Formatters
 * match /housing-market/bend, /cities/bend, and /price-drops/bend same-day.
 * Pulse active counts and unpublished pulse MOS stay off this page.
 */
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { EMPTY_PUBLIC_PACE, formatPaceShare, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import type { DetachedOverlay } from '@/lib/data/market-truth/getSellBendMarket'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatCount } from '@/lib/format/count'
import { formatDate, zonedDateKey } from '@/lib/format/date'
import { medianPositive } from '@/app/price-drops/_v3/drops-constants'
import { areaNote } from './leverage-copy'
import {
  LEVERAGE_AREA_DEFS,
  MLS_SOURCE,
  REGION_OVERLAY_KEY,
  type LeverageAreaSlug,
} from './leverage-constants'
import type {
  LeverageAreaRow,
  LeverageBendStats,
  LeverageRegionStats,
  LeverageSnapshot,
  LeverageWeekDrops,
} from './leverage-types'

export type LeverageWeekDropInput = {
  drops: ReadonlyArray<{ lastDropPct: number | null }>
  total: number
  fetchedAt: string
  degraded: boolean
}

export function asOfFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null
  const label = formatDate(iso)
  return label === '—' ? null : label
}

export function asOfIsoFromInstant(iso: string | null | undefined): string | null {
  if (!iso) return null
  const key = zonedDateKey(iso)
  return key || null
}

export function shareLabel(share: number | null | undefined): string | null {
  if (share == null || !(share > 0)) return null
  return formatPaceShare(share)
}

export function mosLabel(mos: number | null | undefined): string | null {
  if (mos == null || !Number.isFinite(mos) || mos <= 0) return null
  return formatMonthsOfSupply(mos)
}

export function daysNumber(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null
  return Math.round(n)
}

export function daysLabel(n: number | null | undefined): string | null {
  const whole = daysNumber(n)
  if (whole == null) return null
  const label = formatCount(whole)
  return label || null
}

function overlayAsOf(overlay: DetachedOverlay | undefined): { label: string | null; iso: string | null } {
  const iso = overlay?.headlines?.computedAt ?? overlay?.inventory?.computedAt ?? null
  return { label: asOfFromIso(iso), iso: asOfIsoFromInstant(iso) }
}

function overlayKey(geoType: 'city' | 'region', slug: string): string {
  return `${geoType}:${slug}`
}

function statsFrom(
  grain: 'city' | 'region',
  overlay: DetachedOverlay | undefined,
  pace: PublicPaceRow,
): {
  monthsSupply: number | null
  monthsSupplyLabel: string | null
  priceCutShareLabel: string | null
  medianPriceCutLabel: string | null
  saleToFirstAskLabel: string | null
  saleToFinalListLabel: string | null
  daysToOffer90: number | null
  daysToOffer12mo: number | null
  daysToClose12mo: number | null
  medianAgeActive: number | null
} {
  const hud = leftoverHudKpis({
    grain,
    headlines: overlay?.headlines ?? null,
    inventory: overlay?.inventory ?? null,
    pace,
  })
  return {
    monthsSupply: hud.monthsSupply,
    monthsSupplyLabel: mosLabel(hud.monthsSupply),
    priceCutShareLabel: shareLabel(pace.priceCutShare),
    medianPriceCutLabel: shareLabel(pace.medianPriceCut),
    saleToFirstAskLabel: shareLabel(pace.saleToOriginal),
    saleToFinalListLabel: shareLabel(pace.saleToFinal),
    daysToOffer90: daysNumber(pace.daysToPending90d),
    daysToOffer12mo: daysNumber(pace.daysToContract),
    daysToClose12mo: daysNumber(pace.daysToClose),
    medianAgeActive: daysNumber(pace.medianAgeActive),
  }
}

/**
 * Asking-price cuts larger than this are treated as typo corrections
 * (e.g. $16.49M listed as $1.649M) and do not set the week median.
 * Pass a higher cap to keep /price-drops behavior; this page defaults to 50.
 */
export const WEEK_DROP_MAX_PCT = 50

export function weekDropPctsForMedian(
  drops: ReadonlyArray<{ lastDropPct: number | null }>,
  maxDropPct: number = WEEK_DROP_MAX_PCT,
): Array<number | null> {
  return drops.map((d) => {
    const n = d.lastDropPct
    if (n == null || !Number.isFinite(n) || n <= 0 || n > maxDropPct) return null
    return n
  })
}

function weekFrom(
  input: LeverageWeekDropInput | null | undefined,
  maxDropPct: number = WEEK_DROP_MAX_PCT,
): LeverageWeekDrops | null {
  if (!input) return null
  if (input.degraded) {
    return { count: 0, medianDropLabel: null, asOfLabel: null, degraded: true }
  }
  const median = medianPositive(weekDropPctsForMedian(input.drops, maxDropPct))
  return {
    count: input.total,
    medianDropLabel: median == null ? null : `${median.toFixed(1)}%`,
    asOfLabel: asOfFromIso(input.fetchedAt),
    degraded: false,
  }
}

export function buildLeverageSnapshot(input: {
  overlays: ReadonlyMap<string, DetachedOverlay>
  paces: ReadonlyMap<string, PublicPaceRow>
  weekDrops: LeverageWeekDropInput | null
  maxDropPct?: number
}): LeverageSnapshot {
  const bendKey = overlayKey('city', 'bend')
  const bendOverlay = input.overlays.get(bendKey)
  const bendPace = input.paces.get(bendKey) ?? EMPTY_PUBLIC_PACE
  const bendStats = statsFrom('city', bendOverlay, bendPace)
  const bendAsOf = overlayAsOf(bendOverlay)
  const bend: LeverageBendStats = {
    asOfLabel: bendAsOf.label,
    asOfIso: bendAsOf.iso,
    ...bendStats,
  }

  const regionOverlay = input.overlays.get(REGION_OVERLAY_KEY)
  const regionPace = input.paces.get(REGION_OVERLAY_KEY) ?? EMPTY_PUBLIC_PACE
  const regionStats = statsFrom('region', regionOverlay, regionPace)
  const regionAsOf = overlayAsOf(regionOverlay)
  const region: LeverageRegionStats = {
    monthsSupplyLabel: regionStats.monthsSupplyLabel,
    priceCutShareLabel: regionStats.priceCutShareLabel,
    daysToOffer90: regionStats.daysToOffer90,
    asOfLabel: regionAsOf.label,
  }

  const areas: LeverageAreaRow[] = LEVERAGE_AREA_DEFS.map((def) => {
    const key = overlayKey('city', def.slug)
    const overlay = input.overlays.get(key)
    const pace = input.paces.get(key) ?? EMPTY_PUBLIC_PACE
    const stats = statsFrom('city', overlay, pace)
    const note = areaNote({
      slug: def.slug,
      monthsSupply: stats.monthsSupply,
      monthsSupplyLabel: stats.monthsSupplyLabel,
      daysToOffer90: stats.daysToOffer90,
    })
    return {
      slug: def.slug as LeverageAreaSlug,
      name: def.name,
      href: def.href,
      monthsSupply: stats.monthsSupply,
      monthsSupplyLabel: stats.monthsSupplyLabel,
      priceCutShareLabel: stats.priceCutShareLabel,
      daysToOffer90: stats.daysToOffer90,
      daysToOffer90Label: daysLabel(stats.daysToOffer90),
      note,
    }
  })

  const methodAsOf = bend.asOfLabel
  const methodLine = methodAsOf
    ? `${MLS_SOURCE}, leftover HUD and 12-month pace, as of ${methodAsOf}`
    : `${MLS_SOURCE}, leftover HUD and 12-month pace`

  return {
    bend,
    region,
    areas,
    weekDrops: weekFrom(input.weekDrops, input.maxDropPct ?? WEEK_DROP_MAX_PCT),
    methodLine,
  }
}
