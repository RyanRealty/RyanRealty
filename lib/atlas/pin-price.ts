/**
 * House compact ask — place-map chips, search pins, and listing cards.
 *
 * SITE-139: one publisher so an Active listing prints the same string on
 * its chip and its card. Always `$`. Thousands use a lowercase k
 * (`$795k`); a million and up keep `$1.2M` / `$1M`. Nearest thousand;
 * never invent an ask. Token MLS prices stay empty.
 *
 * Import-free so `ci:atlas-price-pins` can transpile and run the matrix.
 */

/**
 * MLS token / call-for-price asks ($1.32, $3,000) are not pin language.
 * Live Bend NC 2026-09-19: those two Active rows made a 209-home cluster
 * print `0K+` (Math.round(1.32 / 1000) === 0). A pin needs at least 1K.
 */
export const ATLAS_PIN_MIN_USD = 10_000

/** Compact pin / card label. Empty when the ask is missing or below a real 1K mark. */
export function formatAtlasPinPrice(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd) || usd < ATLAS_PIN_MIN_USD) return ''
  const thousands = Math.round(usd / 1_000)
  if (thousands < 1) return ''
  if (usd >= 1_000_000 || thousands >= 1_000) {
    const m = usd / 1_000_000
    const body = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '')
    return `$${body}M`
  }
  return `$${thousands}k`
}

/** Hover line for a cluster: one ask, or the span the bubble holds. */
export function formatAtlasClusterRange(minUsd: number, maxUsd: number): string {
  const lo = formatAtlasPinPrice(minUsd)
  const hi = formatAtlasPinPrice(maxUsd)
  if (!lo || !hi) return lo || hi
  if (lo === hi) return lo
  return `${lo} to ${hi}`
}

/**
 * Cluster pill face — same $795k / $1.2M language as a lone pin.
 * A mixed pile prints the low ask with +. Never a bare count.
 */
export function formatAtlasClusterPin(minUsd: number, maxUsd: number): string {
  const lo = formatAtlasPinPrice(minUsd)
  if (!lo) return ''
  const hi = formatAtlasPinPrice(maxUsd)
  if (!hi || lo === hi) return lo
  return `${lo}+`
}

/**
 * Lowest and highest asks that can print a pin. Token MLS prices stay out
 * so a city-scale bubble reads $185k+ / $735k, never $0k+.
 */
export function atlasClusterAskSpan(
  prices: readonly (number | null | undefined)[],
): { min: number; max: number } | null {
  let min = Infinity
  let max = -Infinity
  for (const p of prices) {
    if (p == null || !formatAtlasPinPrice(p)) continue
    if (p < min) min = p
    if (p > max) max = p
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return { min, max }
}

/** For-sale and pending marks with an ask become price pills. Sold stays a dot. */
export function atlasPinShouldPaint(dot: {
  s: 'active' | 'pending' | 'sold' | 'closed'
  p: number | null
}): boolean {
  if (!formatAtlasPinPrice(dot.p)) return false
  return dot.s === 'active' || dot.s === 'pending'
}
