/**
 * Round list price to 25k band edges for "homes like this" listing alerts.
 * Pure util — safe for server and client.
 */
export function priceBandAroundListPrice(listPrice: number | null | undefined): {
  minPrice?: string
  maxPrice?: string
} {
  if (listPrice == null || !Number.isFinite(listPrice) || listPrice <= 0) return {}
  const step = 25_000
  const low = Math.max(step, Math.floor((listPrice * 0.85) / step) * step)
  const high = Math.ceil((listPrice * 1.15) / step) * step
  if (high <= low) return { maxPrice: String(high) }
  return { minPrice: String(low), maxPrice: String(high) }
}
