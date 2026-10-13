/**
 * Live leftover HUD and Bend price-drop facts for /buy/alerts.
 * Same helpers the published city, leftover HUD, and price-drop pages use.
 * A failed read publishes no count. Pulse never fills these cells.
 */
import { formatDate } from '@/lib/format/date'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { getPriceDrops, type GetPriceDropsResult } from '@/lib/data'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { getCityDetachedInventory, getCityDetachedMarket } from '@/lib/data/market-truth/getSellBendMarket'
import { medianPositive } from '@/app/price-drops/_v3/drops-constants'

type PriceDropsLoader = (input: {
  city: string
  limit: number
  days: number
}) => Promise<GetPriceDropsResult>

/** Typo-sized cuts (e.g. $16.49M to $1.649M) stay out of the median. */
export const PRICE_DROP_MEDIAN_MAX_PCT = 50

export type BuyAlertsFacts = {
  leftoverStamp: string | null
  dropsStamp: string | null
  newCount30d: number | null
  monthsSupply: number | null
  monthsUnder4: boolean
  dropsCount: number | null
  dropsMedianPct: number | null
}

export const EMPTY_BUY_ALERTS_FACTS: BuyAlertsFacts = {
  leftoverStamp: null,
  dropsStamp: null,
  newCount30d: null,
  monthsSupply: null,
  monthsUnder4: false,
  dropsCount: null,
  dropsMedianPct: null,
}

function stamp(iso: string | null | undefined): string | null {
  if (!iso) return null
  const printed = formatDate(iso)
  return printed === '—' ? null : printed
}

/**
 * Median of positive drop percents, excluding cuts above `maxPct`.
 * Parameter so /price-drops keeps its own unfiltered median.
 */
export function medianDropPctExcludingOutliers(
  values: readonly (number | null | undefined)[],
  maxPct: number = PRICE_DROP_MEDIAN_MAX_PCT,
): number | null {
  return medianPositive(values.filter((n) => typeof n === 'number' && n <= maxPct))
}

export async function loadBuyAlertsFacts(
  loadDrops: PriceDropsLoader = getPriceDrops,
): Promise<BuyAlertsFacts> {
  try {
    const [pace, detached, inventory, dropRead] = await Promise.all([
      getPublicDetachedPace({ geoType: 'city', geoSlug: 'bend' }).catch(() => EMPTY_PUBLIC_PACE),
      getCityDetachedMarket('bend').catch(() => null),
      getCityDetachedInventory('bend').catch(() => null),
      loadDrops({ city: 'Bend', limit: 48, days: 7 }),
    ])
    const hud = leftoverHudKpis({ grain: 'city', headlines: detached, inventory, pace })
    const leftoverStamp = stamp(detached?.computedAt ?? inventory?.computedAt)
    const mos = hud.monthsSupply
    const mosPrinted = mos != null ? formatMonthsOfSupply(mos) : null
    const monthsUnder4 = mos != null && mos < 4 && mosPrinted != null && Number(mosPrinted) < 4
    const dropsStamp = dropRead.degraded ? null : stamp(dropRead.fetchedAt)
    const dropsCount = dropRead.degraded ? null : dropRead.total
    const dropsMedianPct = dropRead.degraded
      ? null
      : medianDropPctExcludingOutliers(dropRead.drops.map((d) => d.lastDropPct))
    return {
      leftoverStamp,
      dropsStamp,
      newCount30d: hud.new30,
      monthsSupply: mos,
      monthsUnder4,
      dropsCount,
      dropsMedianPct,
    }
  } catch {
    return EMPTY_BUY_ALERTS_FACTS
  }
}
