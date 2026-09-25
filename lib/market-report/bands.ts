/**
 * The report's price band ladder, declared once.
 *
 * SQL twin: public.market_report_band_idx (migration
 * 20260925010000_market_report_monthly). bands.test.ts holds the two equal at
 * every boundary. A band is [min, max): a $1,000,000 sale is in "$1M to $1.2M".
 *
 *   0       under $100K
 *   1..18   $100K to $1M in $50K steps
 *   19..22  $1M to $1.8M in $200K steps
 *   23..27  $1.8M to $2M, $2M to $2.5M, $2.5M to $3M, $3M to $4M, $4M and up
 *
 * Supply tiers (months of supply by price) are sums of whole bands, so a tier
 * never splits a band and the two views always add up.
 */

export type PriceBand = {
  idx: number
  min: number
  /** Exclusive upper bound; null on the open top band. */
  max: number | null
  label: string
  short: string
}

function money(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)}M`
  }
  return `$${Math.round(n / 1000)}K`
}

function build(): PriceBand[] {
  const edges: number[] = [0, 100_000]
  for (let p = 150_000; p <= 1_000_000; p += 50_000) edges.push(p)
  for (let p = 1_200_000; p <= 1_800_000; p += 200_000) edges.push(p)
  edges.push(2_000_000, 2_500_000, 3_000_000, 4_000_000)
  const bands: PriceBand[] = []
  for (let i = 0; i < edges.length; i++) {
    const min = edges[i]!
    const max = i + 1 < edges.length ? edges[i + 1]! : null
    const label =
      max == null ? `${money(min)} and up` : min === 0 ? `Under ${money(max)}` : `${money(min)} to ${money(max)}`
    const short = max == null ? `${money(min)}+` : min === 0 ? `<${money(max)}` : `${money(min)}–${money(max)}`
    bands.push({ idx: i, min, max, label, short })
  }
  return bands
}

export const PRICE_BANDS: readonly PriceBand[] = build()

/** Same answer as SQL market_report_band_idx. Null for a missing or non-positive price. */
export function bandIdx(price: number | null | undefined): number | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null
  if (price < 100_000) return 0
  if (price < 1_000_000) return 1 + Math.floor((price - 100_000) / 50_000)
  if (price < 1_800_000) return 19 + Math.floor((price - 1_000_000) / 200_000)
  if (price < 2_000_000) return 23
  if (price < 2_500_000) return 24
  if (price < 3_000_000) return 25
  if (price < 4_000_000) return 26
  return 27
}

export type SupplyTier = {
  key: string
  label: string
  /** Inclusive band index range. */
  from: number
  to: number
}

/** Price tiers for months of supply. Each is a run of whole bands. */
export const SUPPLY_TIERS: readonly SupplyTier[] = [
  { key: 'under-400k', label: 'Under $400K', from: 0, to: 6 },
  { key: '400k-500k', label: '$400K to $500K', from: 7, to: 8 },
  { key: '500k-600k', label: '$500K to $600K', from: 9, to: 10 },
  { key: '600k-750k', label: '$600K to $750K', from: 11, to: 13 },
  { key: '750k-1m', label: '$750K to $1M', from: 14, to: 18 },
  { key: '1m-1.4m', label: '$1M to $1.4M', from: 19, to: 20 },
  { key: '1.4m-2m', label: '$1.4M to $2M', from: 21, to: 23 },
  { key: '2m-3m', label: '$2M to $3M', from: 24, to: 25 },
  { key: '3m-plus', label: '$3M and up', from: 26, to: 27 },
]
