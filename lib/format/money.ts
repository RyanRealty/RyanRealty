/**
 * Canonical money formatting (audit p1.4).
 *
 * The repo had ~58 inline `Intl.NumberFormat(... currency ...)` call sites and
 * THREE divergent `formatPriceCompact` definitions (the two LP copies differed
 * only in their millions rounding branch). This is the single source; the
 * `ci:currency-format` gate ratchets new bare currency formatters toward zero.
 */
const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** Full price, rounded to the nearest $1,000 per brand voice ($895,000 not $894,750). */
export function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return USD0.format(Math.round(n / 1000) * 1000)
}

/** Compact price for tight UI: `$1.2M` / `$895K`. One agreed rounding rule. */
export function formatPriceCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m.toFixed(m >= 10 ? 0 : 1)}M`
  }
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return USD0.format(n)
}
