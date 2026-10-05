/** Statuses that mean the home is listed. A CMA is not built for one of these. */
export const CMA_ON_MARKET_STATUSES = ['Active', 'Pending', 'Coming Soon', 'Active Under Contract'] as const

/**
 * Live status first. Active, pending, coming soon, or otherwise on the market
 * means no CMA. The newest cycle and any other cycle at the address both count.
 */
export function cmaBlockedBecauseOnMarket(status: string | null | undefined): string | null {
  const s = (status ?? '').trim()
  if (!(CMA_ON_MARKET_STATUSES as readonly string[]).includes(s)) return null
  return `This home is ${s} on the market, so no CMA was built.`
}
