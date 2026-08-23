/**
 * City detached snapshot from Market Truth (D1, MLS City text).
 * /sell Bend and CMA city-grain MoS share this so they cannot disagree.
 * A miss withholds rather than falling back to the pulse polygon series.
 */
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { marketVerdict, type MarketKind } from '@/lib/market/classify'
import { getMetric } from '@/lib/data/market-truth/getMetric'

export function cityDetachedSlug(geoSlug: string): string {
  return geoSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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

export async function getCityDetachedMarket(geoSlug: string): Promise<SellBendMarket | null> {
  const slug = cityDetachedSlug(geoSlug)
  if (!slug) return null
  const geo = { geoType: 'city', geoSlug: slug, segment: 'detached' } as const
  const [active, mos, verdict, medianList] = await Promise.all([
    getMetric({ stat: 'active_count', ...geo }),
    getMetric({ stat: 'months_of_supply', ...geo }),
    getMetric({ stat: 'market_verdict', ...geo }),
    getMetric({ stat: 'median_list_active', ...geo }),
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

export async function getSellBendMarket(): Promise<SellBendMarket | null> {
  return getCityDetachedMarket('bend')
}
