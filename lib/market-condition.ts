/**
 * Market condition classifier for reporting. Step 15.
 */

export type MarketCondition = 'sellers' | 'buyers' | 'balanced'

export type MarketConditionMetrics = {
  monthsOfInventory: number | null
  avgDom: number | null
  listToSoldRatio: number | null
}

export type MarketConditionResult = {
  condition: MarketCondition
  label: string
  metrics: MarketConditionMetrics
}

/**
 * Classify market as Seller's, Buyer's, or Balanced from key metrics.
 * Logic: inventory < 3 and DOM < 30 and list-to-sold > 0.98 → Seller's;
 * inventory > 6 and DOM > 60 and list-to-sold < 0.95 → Buyer's; else Balanced.
 */
export function classifyMarketCondition(metrics: {
  monthsOfInventory?: number | null
  avgDom?: number | null
  listToSoldRatio?: number | null
}): MarketConditionResult {
  const monthsOfInventory = metrics.monthsOfInventory ?? null
  const avgDom = metrics.avgDom ?? null
  const listToSoldRatio = metrics.listToSoldRatio ?? null

  const m: MarketConditionMetrics = {
    monthsOfInventory,
    avgDom,
    listToSoldRatio,
  }

  if (
    monthsOfInventory != null && monthsOfInventory < 3 &&
    avgDom != null && avgDom < 30 &&
    listToSoldRatio != null && listToSoldRatio > 0.98
  ) {
    return { condition: 'sellers', label: "Seller's Market", metrics: m }
  }
  if (
    monthsOfInventory != null && monthsOfInventory > 6 &&
    avgDom != null && avgDom > 60 &&
    listToSoldRatio != null && listToSoldRatio < 0.95
  ) {
    return { condition: 'buyers', label: "Buyer's Market", metrics: m }
  }
  return { condition: 'balanced', label: 'Balanced Market', metrics: m }
}
