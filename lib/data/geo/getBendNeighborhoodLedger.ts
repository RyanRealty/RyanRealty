/**
 * getBendNeighborhoodLedger — live per-neighborhood active count + median
 * list price for the v6 homepage ledger.
 *
 * Data source: `listing_tile_mv` (hourly MV refresh) filtered to the
 * SFR convention (property_type='A', Single Family Residence) and
 * Active/Coming Soon inventory, grouped by `boundary_neighborhood` — the
 * polygon-assigned Bend neighborhood-association district on every tile.
 *
 * Why not market_pulse_live: as of 2026-06-12 the live pulse table carries
 * ONLY city + region rows (refresh_market_pulse iterates 16 cities + the
 * region — verified against the live function definition). The neighborhood
 * rows the older homepage map expected no longer exist, so this function
 * computes the same two figures directly from the tile MV instead. ~160
 * rows fetched, aggregated in Node, cached 15 min.
 *
 * Per CLAUDE.md §0: every figure traces to listing_tile_mv rows; medians
 * are computed here (lower-median over sorted prices, matching the
 * percentile_cont(0.5) discrete neighbor for small n). Neighborhoods with
 * zero active SFR inventory are omitted (honest empty, no dash-fill).
 */

import { makeResilientCached } from '@/lib/data/cache/resilient'
import { supabaseAnon } from '@/lib/data/client'
import { cacheTag } from '@/lib/data/cache/unstable-cache'

/** Bend NA districts shown on the v6 homepage ledger (label = boundary_neighborhood value). */
const LEDGER_NEIGHBORHOODS: ReadonlyArray<{ label: string; slug: string }> = [
  { label: 'Awbrey Butte', slug: 'awbrey-butte' },
  { label: 'Summit West', slug: 'summit-west' },
  { label: 'Century West', slug: 'century-west' },
  { label: 'River West', slug: 'river-west' },
  { label: 'Old Bend', slug: 'old-bend' },
]

export type NeighborhoodLedgerRow = {
  /** Display label, e.g. 'Awbrey Butte'. */
  label: string
  /** Active + Coming Soon SFR listing count. */
  activeCount: number
  /** Median list price in dollars (null when no priced rows). */
  medianListPrice: number | null
  /** Href for the neighborhood page. */
  href: string
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor((sorted.length - 1) / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid]! + sorted[mid + 1]!) / 2
}

async function _fetchBendNeighborhoodLedger(): Promise<NeighborhoodLedgerRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  const { data, error } = await sb
    .from('listing_tile_mv')
    .select('boundary_neighborhood, list_price')
    .in('standard_status', ['Active', 'Coming Soon'])
    .eq('property_type', 'A')
    .eq('property_sub_type', 'Single Family Residence')
    .in(
      'boundary_neighborhood',
      LEDGER_NEIGHBORHOODS.map((n) => n.label),
    )
    .limit(2000)

  if (error) {
    throw new Error(
      `[getBendNeighborhoodLedger] listing_tile_mv query failed: ${error.message ?? JSON.stringify(error)}`,
    )
  }

  const byLabel = new Map<string, number[]>()
  for (const row of (data ?? []) as Array<{
    boundary_neighborhood: string | null
    list_price: number | null
  }>) {
    if (!row.boundary_neighborhood) continue
    const prices = byLabel.get(row.boundary_neighborhood) ?? []
    if (row.list_price != null && Number.isFinite(Number(row.list_price)) && Number(row.list_price) > 0) {
      prices.push(Number(row.list_price))
    } else {
      // unpriced rows still count toward inventory; track via sentinel-free length below
      prices.push(NaN)
    }
    byLabel.set(row.boundary_neighborhood, prices)
  }

  return LEDGER_NEIGHBORHOODS.flatMap((n) => {
    const all = byLabel.get(n.label) ?? []
    if (all.length === 0) return []
    const priced = all.filter((p) => Number.isFinite(p)).sort((a, b) => a - b)
    return [
      {
        label: n.label,
        activeCount: all.length,
        medianListPrice: median(priced),
        href: `/cities/bend/${n.slug}`,
      },
    ]
  })
}

/**
 * Cached ledger rows (15 min — the MV refreshes hourly, the shorter TTL just
 * bounds staleness after an MV refresh lands). Falls back to [] on transient
 * errors — the homepage hides the ledger rather than rendering dashes.
 */
export const getBendNeighborhoodLedger = makeResilientCached(
  _fetchBendNeighborhoodLedger,
  ['bend-neighborhood-ledger-v1'],
  {
    revalidate: 900,
    tags: [cacheTag.city('bend'), cacheTag.market],
  },
  [],
)
