/**
 * Public index medians (cities / neighborhoods / subdivisions cards).
 * Exact whole dollars — same as city/neighborhood hero `kbMoneyFull` /
 * `formatPriceExact`. Thousand-rounding ($499,900 → $500,000) is a
 * visitor-visible lie against the place page.
 */

export function formatIndexMedianUsd(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return `$${Math.round(n).toLocaleString('en-US')}`
}
