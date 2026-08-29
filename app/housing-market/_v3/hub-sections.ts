/**
 * Route-local section builders for /housing-market.
 *
 * WHY THIS FILE EXISTS: the hub sits under the ci:file-size-budget floor (600
 * LOC) and the gate's instruction is to split, not to re-baseline. The page
 * owns the reads, the one months-of-supply derivation, the JSON-LD, and the
 * JSX. This module owns the pure turn from a city snapshot into Ledger rows.
 * Nothing here fetches, reads the clock, or classifies a market.
 *
 * Each city is a door into its own report. A line through cities invents a
 * sequence. Relate/Rank charts compare cities. This Ledger stays type.
 */

import type { MarketPulseSnapshot } from '@/lib/data'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { listingsBrowsePath } from '@/lib/slug'
import {
  v3Text,
  type V3ChartProps,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
} from '@/components/site/v3'
import type { PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { publicPaceItems } from '@/lib/data/market-truth/public-pace'
import { publicMixItems, type PublicMixRow } from '@/lib/data/market-truth/public-mix'
import {
  publicSegmentBrowseHref,
  publicSegmentDisplayBits,
  publicSegmentNoun,
  type PublicSegmentRow,
} from '@/lib/data/market-truth/public-segments'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { namePulseCityRemainder, pulseCityHrefSlug } from '@/lib/market/pulse-city-remainder'
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

export type CityFootnote = { label: string; fact: string; slug?: string }

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
export function buildCityLedger(
  snapshots: MarketPulseSnapshot[],
  options?: { regionActive?: number | null },
): CityLedger {
  const snapshotByLabel = new Map(snapshots.map((s) => [s.geo_label, s]))
  const rows: V3LedgerFigureRow[] = []
  const rowed = new Set<string>()

  for (const label of CITY_LABELS) {
    const slug = CITY_SLUG[label]
    const snapshot = snapshotByLabel.get(label)
    if (!slug || !snapshot || snapshot.median_list_price == null || snapshot.active_count == null) continue
    rowed.add(label)
    rows.push({
      href: `/housing-market/${slug}`,
      when: v3Text(`${snapshot.active_count.toLocaleString('en-US')} for sale`),
      what: v3Text(label),
      detail:
        snapshot.months_of_supply != null
          ? v3Text(`${formatMonthsOfSupply(snapshot.months_of_supply)} months of supply`)
          : undefined,
      value: v3Text(formatPriceExact(snapshot.median_list_price)),
      id: slug,
    })
  }
  rows.sort((a, b) => String(a.what).localeCompare(String(b.what)))

  const footnotes: CityFootnote[] = CITY_LABELS.filter(
    (label) => CITY_SLUG[label] !== undefined && !rowed.has(label),
  ).map((label) => {
    const snapshot = snapshotByLabel.get(label)
    const slug = CITY_SLUG[label]
    if (!snapshot) {
      return { label, slug, fact: `${label} returned no market row in the latest sync` }
    }
    if (snapshot.active_count == null) {
      return { label, slug, fact: `${label} has no published active single-family count` }
    }
    if (snapshot.active_count === 0) {
      return { label, slug, fact: `${label} shows no active single-family listings` }
    }
    return {
      label,
      slug,
      fact: `${label} shows ${snapshot.active_count.toLocaleString('en-US')} active with no published median`,
    }
  })
  const remainder = namePulseCityRemainder({
    regionActive: options?.regionActive,
    displayedLabels: CITY_LABELS,
    allCities: snapshots.map((s) => ({
      label: s.geo_label,
      active: s.active_count,
      slug: pulseCityHrefSlug(s.geo_slug || s.geo_label),
    })),
  })
  for (const city of remainder.omitted) {
    footnotes.push({
      label: city.label,
      slug: city.slug,
      fact: `${city.label} has ${city.active.toLocaleString('en-US')} active single-family listings not in the table above`,
    })
  }
  for (const fact of remainder.facts) {
    if (fact.includes('regional count and not in the table')) continue
    if (fact.includes('houses sit outside these town rows')) continue
    footnotes.push({ label: 'Outside city rows', fact })
  }

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
 * The level-2 closed-year KPIs: ALL-TYPE volume, ALL-TYPE closes, composition.
 * ONE POPULATION, ONE CLOCK (2026-08-27 hero-reorder fix, parity.json
 * market-report openDefects item 1): this used to also carry the live
 * months-of-supply figure, sourced from a different clock than closed.computedAt.
 * publishInstrumentStamp(hub page.tsx) only prints a stamp when every clock it
 * is handed agrees, so mixing a live refreshedAt in here is what produced a
 * stamped Ledger sitting under an unstamped hero (item 2's defect on the sibling
 * region report). Months of supply now lives on buildSfrFollowFigures, the
 * live-figures Instrument, where it belongs with its own clock.
 */
export function buildHubLead(closedYear: CoMarketAnnualRow | null | undefined): HubLead {
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

  const parts = closed ? compositionParts(closed.propertyTypeBreakdown) : []
  const leadType = parts[0] ?? null
  const leadTypePct =
    closed && leadType ? ((100 * leadType.n) / closed.soldCount).toFixed(1) : null

  const sourceBits: string[] = []
  if (closed) sourceBits.push(closedMartSource(closed.year))
  else if (closedYear) sourceBits.push(closedMartMissingBody(closedYear.year))

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

/** Pace keys already printed as decision figures. */
const PACE_ON_DECISION = new Set(['pending', 'closed', 'medClose', 'sto'])

export const HUB_DECISION_FOLD_AFTER = 8

export const CITY_LEDGER_TRACE =
  'Oregon Data Share MLS, Central Oregon, single-family, active listings, one row per city'

export function hubMarketTrace(opts: { hasMos: boolean; hasFloorMix: boolean }): string {
  const floor = opts.hasFloorMix
    ? ' Feature shares other than garage are floors: the printed percent is at least that share of closes.'
    : ''
  return (
    `Oregon Data Share MLS, Central Oregon, single-family.` +
    ` Every figure names its own window. A miss omits.` +
    floor +
    (opts.hasMos ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : '')
  )
}

export function alignHubFaqWindows(
  faqs: readonly { question: string; answer: string }[],
): { question: string; answer: string }[] {
  return faqs.map((item) => {
    if (/median home price/i.test(item.question)) {
      return {
        ...item,
        answer: item.answer.replace(
          /is (\$[\d,]+)(?: as of .+?)?, based on/,
          'is $1 now, from the active list, based on',
        ),
      }
    }
    if (/take to sell/i.test(item.question) && !/90 days/.test(item.answer)) {
      return {
        ...item,
        answer: item.answer.replace('to go pending', 'to go pending over the last 90 days'),
      }
    }
    return item
  })
}

/**
 * Live SFR figures for the level-1 hero: 6 to 8 decision stats first, then
 * the long tail. Every median names its window. "at least" stays in the
 * source, never in a headline number.
 */
export function buildSfrFollowFigures(
  hud: {
    medianList: number | null
    active: number | null
    daysToPending: number | null
    pending?: number | null
    sold12mo?: number | null
    saleToList?: number | null
  } | null,
  mosText: string | null,
  extras?: {
    pace?: PublicPaceRow
    mix?: PublicMixRow
    segments?: readonly PublicSegmentRow[]
  },
): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  if (hud?.medianList != null && hud.medianList > 0) {
    figures.push({
      value: v3Text(formatPriceExact(hud.medianList)),
      label: v3Text('median list price · now, single-family'),
      href: '/housing-market/central-oregon',
    })
  }
  if (hud != null && hud.active != null && hud.active > 0) {
    figures.push({
      value: v3Text(hud.active.toLocaleString('en-US')),
      label: v3Text('homes for sale · now, single-family'),
      href: listingsBrowsePath(),
    })
  }
  if (mosText) {
    figures.push({
      value: v3Text(mosText),
      label: v3Text('months of supply, single-family'),
      href: '/months-of-supply',
    })
  }
  if (hud?.daysToPending != null && hud.daysToPending > 0) {
    figures.push({
      value: v3Text(String(hud.daysToPending)),
      label: v3Text('median to pending · 90 days, single-family'),
      href: '/housing-market/central-oregon',
    })
  }
  if (hud?.pending != null && hud.pending > 0) {
    figures.push({
      value: v3Text(hud.pending.toLocaleString('en-US')),
      label: v3Text('pending · now'),
    })
  }
  if (hud?.sold12mo != null && hud.sold12mo > 0) {
    figures.push({
      value: v3Text(hud.sold12mo.toLocaleString('en-US')),
      label: v3Text('closed sales · 12 months'),
    })
  }
  if (extras?.pace?.medianClose != null && extras.pace.medianClose > 0) {
    figures.push({
      value: v3Text(formatPriceExact(extras.pace.medianClose)),
      label: v3Text('median close · 12 months'),
    })
  }
  if (hud?.saleToList != null) {
    figures.push({
      value: v3Text(`${hud.saleToList.toFixed(1)}%`),
      label: v3Text('sale to original list · 12 months'),
    })
  }

  if (extras?.pace) {
    for (const item of publicPaceItems(extras.pace)) {
      if (PACE_ON_DECISION.has(item.key)) continue
      figures.push({
        value: v3Text(item.value),
        label: v3Text(item.label),
      })
    }
  }
  if (extras?.mix) {
    for (const item of publicMixItems(extras.mix)) {
      figures.push({
        value: v3Text(item.value.replace(/^at least /, '')),
        label: v3Text(item.label),
      })
    }
  }
  if (extras?.segments) {
    for (const row of extras.segments) {
      if (row.activeCount == null || row.activeCount <= 0) continue
      const bits = publicSegmentDisplayBits(row).slice(0, 3)
      figures.push({
        value: v3Text(row.activeCount.toLocaleString('en-US')),
        label: v3Text(
          [`${publicSegmentNoun(row.segment, row.activeCount)} for sale`, ...bits].join(' · '),
        ),
        href: publicSegmentBrowseHref(null, row.segment),
      })
    }
  }
  return figures
}

export function hubMixHasFloors(mix: PublicMixRow | null | undefined): boolean {
  return Boolean(mix?.features.some((bit) => bit.floor))
}
