/**
 * Route-local section builders for /housing-market.
 *
 * WHY THIS FILE EXISTS: the hub sits under the ci:file-size-budget floor (600
 * LOC) and the gate's instruction is to split, not to re-baseline. The page
 * owns the reads, the one months-of-supply derivation, the JSON-LD, and the
 * JSX. This module owns the pure turn from a city snapshot into Ledger rows.
 * Nothing here fetches, reads the clock, or classifies a market.
 *
 * D9 leftover: each city is a door into its own report. A line through cities
 * invents a sequence. V3Chart is a trend atom, not a comparison of places, so
 * this Ledger stays type.
 */

import type { MarketPulseSnapshot } from '@/lib/data'
import { formatPrice } from '@/lib/format/money'
import { v3Text, type V3LedgerFigureRow } from '@/components/site/v3'
import { CITY_LABELS, CITY_SLUG } from './hub-constants'

export type CityFootnote = { label: string; fact: string }

export type CityLedger = {
  rows: V3LedgerFigureRow[]
  stamp: string | undefined
  footnotes: CityFootnote[]
}

/**
 * A city earns a row when the live query returned one AND that row carries a
 * median list price, because the Ledger's value column is a figure and a
 * figure this page cannot source is a figure it does not print. Cities the
 * query did not return keep their link in the closing Quiet block instead.
 *
 * The stamp comes from the returned city rows, not from the region row.
 */
export function buildCityLedger(snapshots: MarketPulseSnapshot[]): CityLedger {
  const snapshotByLabel = new Map(snapshots.map((s) => [s.geo_label, s]))
  const rows: V3LedgerFigureRow[] = []
  const rowed = new Set<string>()

  for (const label of CITY_LABELS) {
    const slug = CITY_SLUG[label]
    const snapshot = snapshotByLabel.get(label)
    if (!slug || !snapshot || snapshot.median_list_price == null) continue
    rowed.add(label)
    rows.push({
      href: `/housing-market/${slug}`,
      when: v3Text(`${snapshot.active_count.toLocaleString('en-US')} for sale`),
      what: v3Text(label),
      detail:
        snapshot.median_days_to_pending != null
          ? v3Text(`${snapshot.median_days_to_pending} days to pending`)
          : undefined,
      value: v3Text(formatPrice(snapshot.median_list_price)),
      id: slug,
    })
  }
  rows.sort((a, b) => String(a.what).localeCompare(String(b.what)))

  const footnotes = CITY_LABELS.filter(
    (label) => CITY_SLUG[label] !== undefined && !rowed.has(label),
  ).map((label) => {
    const snapshot = snapshotByLabel.get(label)
    if (!snapshot) return { label, fact: `${label} returned no market row in the latest sync` }
    if (snapshot.active_count === 0) {
      return { label, fact: `${label} shows no active single-family listings` }
    }
    return {
      label,
      fact: `${label} shows ${snapshot.active_count.toLocaleString('en-US')} active with no published median`,
    }
  })

  const stamp = snapshots
    .map((s) => s.updated_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1)

  return { rows, stamp, footnotes }
}
