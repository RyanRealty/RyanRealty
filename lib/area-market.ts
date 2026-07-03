/**
 * Area-market helpers for the content-engine detail pages.
 *
 * The moat (docs/CONTENT_ENGINE_SPEC.md §3): every event/venue page carries a
 * LIVE, honest market read for its city — median list price, active inventory,
 * months of supply + the seller/balanced/buyer classification, and the typical
 * days to a signed contract. Data comes from getMarketPulse (market_pulse_live,
 * ~10-min freshness); nothing here is invented (CLAUDE.md §0).
 *
 * Months-of-supply thresholds are the canonical ones (CLAUDE.md §0):
 *   ≤ 4  seller's market · 4–6  balanced · ≥ 6  buyer's market
 */

export type AreaMarket = {
  city: string
  medianListPrice: number | null
  activeCount: number
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
  return c === 'seller' ? "a seller's market" : c === 'buyer' ? "a buyer's market" : 'a balanced market'
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
  if (!price && m.activeCount === 0) return null

  const parts: string[] = []
  if (cls && m.monthsOfSupply != null) {
    parts.push(
      `${m.city} is ${marketClassLabel(cls)} right now, with about ${m.monthsOfSupply.toFixed(1)} months of inventory`,
    )
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
