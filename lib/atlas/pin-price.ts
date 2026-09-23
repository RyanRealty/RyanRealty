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
 * The word a cluster pill prints above its figure, so the figure is never
 * read as one home's ask. Plain English, lower case (UXLIVE-6, 2026-09-23).
 */
export const ATLAS_CLUSTER_PIN_LABEL = 'median'

/**
 * The median ask of the homes a cluster bubble holds — the figure the pill
 * prints (UXLIVE-6, 2026-09-23).
 *
 * The face used to be the LOWEST ask in the pile with a "+": over Bend the
 * bubbles read "$50k+", "$74k+", "$99k+" because one land lot sat in each
 * pile, and a buyer read a wrong price for a neighborhood of $700k houses.
 * The median is the ask a reader can take as "what homes here list for";
 * the pill labels it (ATLAS_CLUSTER_PIN_LABEL) and the hover line still
 * prints the full span. The members are the pins already on screen, so the
 * visitor's type toggles and price scrubber narrow the median too.
 *
 * Token asks (under ATLAS_PIN_MIN_USD) are skipped: they are not prices.
 * Even count: the mean of the two middle asks, to the dollar. Null when no
 * member carries a real ask.
 */
export function atlasClusterMedianAsk(prices: readonly (number | null | undefined)[]): number | null {
  const asks: number[] = []
  for (const p of prices) {
    if (p == null || !formatAtlasPinPrice(p)) continue
    asks.push(p)
  }
  if (asks.length === 0) return null
  asks.sort((a, b) => a - b)
  const mid = Math.floor(asks.length / 2)
  return asks.length % 2 === 1 ? asks[mid]! : Math.round((asks[mid - 1]! + asks[mid]!) / 2)
}

/**
 * Cluster pill face: the median ask in the same $795k / $1.2M language as a
 * lone pin. Never a bare count, never a low ask with "+". Empty when the
 * pile holds no real ask.
 */
export function formatAtlasClusterMedian(prices: readonly (number | null | undefined)[]): string {
  return formatAtlasPinPrice(atlasClusterMedianAsk(prices))
}

/**
 * Lowest and highest asks that can print a pin, for the cluster's hover
 * line ("$185k to $5.3M"). Token MLS prices stay out, so a span never
 * opens on $0k.
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
