/**
 * /sell Bend instrument — the three figures EXECUTE Step 5 migrates.
 *
 * MLS City Bend, detached (D1). Not the city-limits polygon. Never fall
 * back to pulse: a miss withholds rather than reprinting 488 / 3.54.
 */
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { marketVerdict, type MarketKind } from '@/lib/market/classify'
import { getMetric } from '@/lib/data/market-truth/getMetric'

const BEND_DETACHED = {
  geoType: 'city',
  geoSlug: 'bend',
  segment: 'detached',
} as const

export type SellBendMarket = {
  activeCount: number
  monthsOfSupply: number
  mosLabel: string
  verdictKind: MarketKind
  verdictLabel: string
  medianListPrice: number | null
  computedAt: string
  completeThrough: string
}

function storedVerdictKind(valueText: string | null): MarketKind {
  if (valueText === 'seller') return 'sellers'
  if (valueText === 'buyer') return 'buyers'
  if (valueText === 'balanced') return 'balanced'
  return 'unknown'
}

export async function getSellBendMarket(): Promise<SellBendMarket | null> {
  const [active, mos, verdict, medianList] = await Promise.all([
    getMetric({ stat: 'active_count', ...BEND_DETACHED }),
    getMetric({ stat: 'months_of_supply', ...BEND_DETACHED }),
    getMetric({ stat: 'market_verdict', ...BEND_DETACHED }),
    getMetric({ stat: 'median_list_active', ...BEND_DETACHED }),
  ])
  if (!active?.isPublishable || active.value == null) return null
  if (!mos?.isPublishable || mos.value == null) return null
  if (!verdict?.isPublishable || verdict.value == null) return null

  const classified = marketVerdict(mos.value)
  if (classified.kind === 'unknown') return null
  if (storedVerdictKind(verdict.valueText) !== classified.kind) return null

  return {
    activeCount: Math.round(active.value),
    monthsOfSupply: mos.value,
    mosLabel: formatMonthsOfSupply(mos.value),
    verdictKind: classified.kind,
    verdictLabel: classified.label,
    medianListPrice:
      medianList?.isPublishable && medianList.value != null ? medianList.value : null,
    computedAt: mos.provenance.computedAt,
    completeThrough: mos.provenance.completeThrough,
  }
}
