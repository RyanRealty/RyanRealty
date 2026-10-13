/**
 * Area-market helpers for the content-engine detail pages.
 *
 * The moat (docs/CONTENT_ENGINE_SPEC.md §3): every event/venue page carries a
 * LIVE, honest market read for its city — median list price, active inventory,
 * months of supply, and the typical days to a signed contract. Data comes from
 * leftover HUD membership. A leftover miss omits. Pulse does not fill. Nothing
 * here is invented (CLAUDE.md §0).
 */
import { publicSupplyLine } from '@/lib/format/months-of-supply'

export type AreaMarket = {
  city: string
  medianListPrice: number | null
  /** Null when unknown. Unknown is not zero. */
  activeCount: number | null
  monthsOfSupply: number | null
  medianDaysToPending: number | null
}

export type MarketClass = 'seller' | 'balanced' | 'buyer'

export function marketClass(monthsOfSupply: number | null): MarketClass | null {
  if (monthsOfSupply == null) return null
  if (monthsOfSupply <= 4) return 'seller'
  if (monthsOfSupply < 6) return 'balanced'
  return 'buyer'
}

export function marketClassLabel(c: MarketClass): string {
  return c
}

/** Round to the nearest thousand and format as $X,XXX,000 (brand-voice currency). */
export function money(n: number | null): string | null {
  if (n == null) return null
  return `$${(Math.round(n / 1000) * 1000).toLocaleString()}`
}

/**
 * One honest sentence summarizing the city's market, for the detail-page prose.
 * Returns null when there isn't enough data to say something true.
 */
export function marketSentence(m: AreaMarket): string | null {
  const cls = marketClass(m.monthsOfSupply)
  const price = money(m.medianListPrice)
  if (!price && (m.activeCount == null || m.activeCount === 0)) return null

  const parts: string[] = []
  if (cls && m.monthsOfSupply != null) {
    parts.push(`${m.city} has ${publicSupplyLine(m.monthsOfSupply)} right now`)
  } else {
    parts.push(`Here is where the ${m.city} market stands right now`)
  }
  if (price) parts.push(`a median list price around ${price}`)
  if (m.activeCount) parts.push(`${m.activeCount.toLocaleString()} active single-family homes`)
  if (m.medianDaysToPending != null) {
    parts.push(`and a typical ${m.medianDaysToPending} days to a signed contract`)
  }
  return parts.join(', ').replace(/, and /, ', and ') + '.'
}
