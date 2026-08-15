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

import type { MarketPulse, MarketPulseSnapshot } from '@/lib/data'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import { formatPrice } from '@/lib/format/money'
import { listingsBrowsePath } from '@/lib/slug'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import {
  v3Text,
  type V3ChartProps,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
} from '@/components/site/v3'
import { CITY_LABELS, CITY_SLUG, HISTORY_PATH } from './hub-constants'
import {
  buildAllTypeFigures,
  buildCompositionFigures,
  closedMartMissingBody,
  closedMartRow,
  closedMartSource,
  compositionParts,
  medianCloseLabel,
  volumeSentence,
} from './closed-kpis'
import { buildCompositionChart } from './market-charts'

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

export type HubLead = {
  closed: CoMarketAnnualRow | null
  figures: V3InstrumentFigure[]
  source: string
  historyPath: string
  volumeSentence: string | null
  medianLabel: string | null
  leadType: { code: string; n: number } | null
  leadTypePct: string | null
  chart: V3ChartProps | undefined
}

/**
 * First-screen KPIs: ALL-TYPE volume, ALL-TYPE closes, composition, and the
 * SFR pulse months-of-supply figure so the verdict stays next to its number.
 */
export function buildHubLead(
  closedYear: CoMarketAnnualRow | null | undefined,
  mosText: string | null,
): HubLead {
  const closed = closedMartRow(closedYear)
  const historyPath = closed ? `${HISTORY_PATH}?year=${closed.year}` : HISTORY_PATH
  const figures: V3InstrumentFigure[] = []
  if (closed) {
    figures.push(
      ...buildAllTypeFigures({
        soldCount: closed.soldCount,
        totalVolume: closed.totalVolume,
        historyHref: historyPath,
      }),
    )
    figures.push(
      ...buildCompositionFigures({
        parts: compositionParts(closed.propertyTypeBreakdown),
        historyHref: historyPath,
      }),
    )
  }
  if (mosText) {
    figures.push({
      value: v3Text(mosText),
      label: v3Text('months of supply, SFR pulse'),
      href: '/months-of-supply',
    })
  }

  const parts = closed ? compositionParts(closed.propertyTypeBreakdown) : []
  const leadType = parts[0] ?? null
  const leadTypePct =
    closed && leadType ? ((100 * leadType.n) / closed.soldCount).toFixed(1) : null

  const sourceBits: string[] = []
  if (closed) sourceBits.push(closedMartSource(closed.year))
  else if (closedYear) sourceBits.push(closedMartMissingBody(closedYear.year))
  if (mosText) {
    sourceBits.push(
      `Months of supply is live MLS, single-family (SFR pulse), Central Oregon region. ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}`,
    )
  }

  return {
    closed,
    figures,
    source:
      sourceBits.join(' ') ||
      'Central Oregon market figures did not return on this refresh.',
    historyPath,
    volumeSentence: closed ? volumeSentence(closed.totalVolume) : null,
    medianLabel: closed ? medianCloseLabel(closed.medianClose) : null,
    leadType,
    leadTypePct,
    chart: closed
      ? buildCompositionChart(
          compositionParts(closed.propertyTypeBreakdown),
          `ALL-TYPE composition, ${closed.year}`,
        )
      : undefined,
  }
}

/** SFR pulse leftovers after the first screen already printed months of supply. */
export function buildSfrFollowFigures(pulse: MarketPulse | null): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  if (pulse?.medianListPrice != null && pulse.medianListPrice > 0) {
    figures.push({
      value: v3Text(formatPrice(pulse.medianListPrice)),
      label: v3Text('median list price, SFR pulse'),
      href: '/housing-market/central-oregon',
    })
  }
  if (pulse != null && pulse.activeCount > 0) {
    figures.push({
      value: v3Text(pulse.activeCount.toLocaleString('en-US')),
      label: v3Text('homes for sale, SFR pulse'),
      href: listingsBrowsePath(),
    })
  }
  if (pulse?.medianDaysToPending != null && pulse.medianDaysToPending > 0) {
    figures.push({
      value: v3Text(String(pulse.medianDaysToPending)),
      label: v3Text('median days to pending, SFR pulse'),
      href: '/housing-market/central-oregon',
    })
  }
  return figures
}
