/**
 * Short price on an Atlas pin — Redfin's map mark, navy on cream.
 *
 * SITE-127: place maps print the ask on the mark itself. Under a million
 * the dollar sign drops so a dense city frame stays readable (`735K`);
 * a million and up keep `$1.5M`. One function, one rounding rule, so the
 * pin and the hover blow-up never disagree.
 *
 * Import-free so `ci:atlas-price-pins` can transpile and run the matrix.
 */

/** Compact pin label. Empty when the ask is missing or not a positive number. */
export function formatAtlasPinPrice(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return ''
  const thousands = Math.round(usd / 1_000)
  if (usd >= 1_000_000 || thousands >= 1_000) {
    const m = usd / 1_000_000
    const body = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '')
    return `$${body}M`
  }
  return `${thousands}K`
}

/** For-sale and pending marks with an ask become price pills. Sold stays a dot. */
export function atlasPinShouldPaint(dot: {
  s: 'active' | 'pending' | 'sold' | 'closed'
  p: number | null
}): boolean {
  if (dot.p == null || !(dot.p > 0)) return false
  return dot.s === 'active' || dot.s === 'pending'
}
