/**
 * SITE-100 — how the market hub opens.
 *
 * The first viewport is the live answer (verdict + MOS two-bar + paged city
 * pace), not the report chooser. MOS publishes at city grain through
 * publishMonthsOfSupply; a miss omits. Nothing here fetches.
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md §3a / leftover HUD: region figures stay
 * on the leftover MarketPulse overlay the page already reads. City MOS uses
 * the same city snapshots the Ledger prints.
 */

import type { MarketPulseSnapshot } from '@/lib/data'
import type { MarketKind } from '@/lib/market/classify'
import { MOS_PLAIN_LABEL } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { publishMonthsOfSupply } from '@/lib/market/publish-months-of-supply'
import { marketHubChooser } from '@/lib/market/report-doors'
import { v3Text, type V3InstrumentFigure, type V3QuietItem } from '@/components/site/v3'
import { CITY_LABELS, CITY_SLUG } from './hub-constants'
import type { CityLedger } from './hub-sections'
import { MARKET_FOLD_LABEL } from './opening'

/** Fold label: names the tail, no integer, short enough for 375. */
export const HUB_FOLD_LABEL = MARKET_FOLD_LABEL

export type HubCityMosPage = {
  id: string
  label: string
  href: string
  caption: string
  plainLabel: string
  homesName: string
  homesLabel: string
  homesValue: number
  salesName: string
  salesLabel: string
  salesValue: number
  mosText: string
  source: string
  asOf: string | null
  tooltip: { homes: string; sales: string; source: string }
}

/**
 * Monthly closing pace implied by MOS: active / months of supply.
 * Counted integer — a tenth of a closing is spreadsheet precision (SITE-88).
 * Miss omits.
 */
export function monthlyPaceFromMos(
  active: number | null | undefined,
  mosRaw: number | null | undefined,
): number | null {
  if (active == null || !(active > 0) || mosRaw == null || !(mosRaw > 0)) return null
  const pace = Math.round(active / mosRaw)
  return pace > 0 ? pace : null
}

export function formatHubPace(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/**
 * City-grain MOS pages for the InsightPager. Trusted grain only; miss omits.
 * Same snapshots the city Ledger renders — no second query.
 */
export function buildCityMosPages(
  snapshots: readonly MarketPulseSnapshot[],
): HubCityMosPage[] {
  const byLabel = new Map(snapshots.map((s) => [s.geo_label, s]))
  const pages: HubCityMosPage[] = []
  for (const label of CITY_LABELS) {
    const slug = CITY_SLUG[label]
    const snapshot = byLabel.get(label)
    if (!slug || !snapshot) continue
    const active = snapshot.active_count
    const mos = publishMonthsOfSupply({
      grain: 'city',
      source: 'market-truth',
      pulseMos: snapshot.months_of_supply,
      pulseActiveCount: snapshot.active_count,
      displayedActiveCount: snapshot.active_count,
    })
    const sales = monthlyPaceFromMos(active, mos)
    if (active == null || !(active > 0) || mos == null || sales == null) continue
    const homesLabel = active.toLocaleString('en-US')
    const salesLabel = formatHubPace(sales)
    const mosText = formatMonthsOfSupply(mos)
    const href = `/housing-market/${slug}`
    const asOf = snapshot.updated_at
    const tipSource = asOf
      ? `Oregon Data Share · ${label} single-family · as of ${asOf}`
      : `Oregon Data Share · ${label} single-family`
    pages.push({
      id: slug,
      label,
      href,
      caption: `${label}: about ${mosText} months of homes on the market.`,
      plainLabel: MOS_PLAIN_LABEL,
      homesName: 'Homes for sale',
      homesLabel,
      homesValue: active,
      salesName: 'A month of sales',
      salesLabel,
      salesValue: sales,
      mosText,
      source: `Oregon Data Share. ${homesLabel} homes for sale in ${label} vs ${salesLabel} sales a month.`,
      asOf,
      tooltip: {
        homes: homesLabel,
        sales: salesLabel,
        source: tipSource,
      },
    })
  }
  return pages
}

/**
 * Document title. Layer A (ci:seo-shell) locks the head term. Live counts
 * go in the description and the H1, never a second title.
 */
export function hubLiveTitle(_active?: number | null): string {
  return 'Central Oregon Housing Market'
}

export function hubLiveDescription(
  active: number | null | undefined,
  mosText: string | null | undefined,
): string {
  if (active != null && active > 0 && mosText) {
    return `${active.toLocaleString('en-US')} single-family homes for sale in Central Oregon. Homes vs a month of sales: ${mosText} months. City reports from Oregon Data Share / MarketPulse.`
  }
  if (active != null && active > 0) {
    return `${active.toLocaleString('en-US')} single-family homes for sale in Central Oregon. City reports and weekly snapshots from Oregon Data Share / MarketPulse.`
  }
  return 'Live single-family inventory and pace by city in Central Oregon. City reports and weekly snapshots from Oregon Data Share / MarketPulse.'
}

export function buildHubCityItemList(
  rows: CityLedger['rows'],
): ReadonlyArray<{ name: string; url: string }> {
  return rows.map((row) => ({
    name: `${String(row.what)} housing market`,
    url: row.href,
  }))
}

export function hubOpeningNote(
  verdictKind: MarketKind,
  cityPageCount: number,
): string {
  const cityBit =
    cityPageCount > 1
      ? 'Page a city to see its own homes for sale against a month of sales.'
      : cityPageCount === 1
        ? "The city drawing is that city's own homes for sale against a month of sales."
        : 'A city with no published pace is omitted.'
  if (verdictKind === 'unknown') {
    return `Live single-family inventory for Central Oregon. ${cityBit}`
  }
  return `Homes for sale against a month of sales. ${cityBit}`
}

export type HubChooserInput = {
  active: number | null
  cityRowCount: number
  closedSoldCount: number | null
  closedYear: number | null
  mosText: string | null
  verdictLabel: string
  verdictKind: MarketKind
  newestWeeklyLabel: string | null
  refreshedAt: string | null
  cityRefreshedAt: string | null
}

const CHOOSER_SOURCE_NAME = 'Oregon Data Share / MarketPulse'

/**
 * Report doors after the city Ledger — not in the first viewport (SITE-100).
 * Figures match the sections they point at. Absent is not zero.
 */
export function buildHubChooserItems(input: HubChooserInput): V3QuietItem[] {
  return marketHubChooser().map((door) => {
    if (door.label === 'Live market') {
      return {
        ...door,
        href: '#market',
        lead: true,
        mark: 'market' as const,
        detail: 'The verdict, the inventory, and the chart, on this page.',
        ...(input.active != null && input.active > 0
          ? {
              figure: {
                value: input.active.toLocaleString('en-US'),
                unit: 'single-family homes for sale',
                source: CHOOSER_SOURCE_NAME,
                sourceName: CHOOSER_SOURCE_NAME,
                updatedAt: input.refreshedAt,
              },
            }
          : {}),
      }
    }
    if (door.label === 'By city') {
      return {
        ...door,
        mark: 'map' as const,
        detail: 'One live row per city, each with its own median and its own pace.',
        ...(input.cityRowCount > 0
          ? {
              figure: {
                value: String(input.cityRowCount),
                unit: 'cities with a live row',
                source: CHOOSER_SOURCE_NAME,
                sourceName: CHOOSER_SOURCE_NAME,
                updatedAt: input.cityRefreshedAt,
              },
            }
          : {}),
      }
    }
    if (door.label === 'Every closed sale') {
      return {
        ...door,
        mark: 'history' as const,
        detail: 'Every closed sale we hold, by city, type, and year.',
        ...(input.closedSoldCount != null &&
        input.closedSoldCount > 0 &&
        input.closedYear != null
          ? {
              figure: {
                value: input.closedSoldCount.toLocaleString('en-US'),
                unit: `closed sales in ${input.closedYear}, all types`,
                source: `Oregon Data Share closed sales, ${input.closedYear}`,
                sourceName: `Central Oregon MLS closed sales, ${input.closedYear}`,
              },
            }
          : {}),
      }
    }
    if (door.label === 'Months of supply') {
      return {
        ...door,
        mark: 'supply' as const,
        detail:
          input.verdictKind === 'unknown'
            ? 'What the number means, and how it is worked out.'
            : `Central Oregon reads as a ${input.verdictLabel} at that pace.`,
        ...(input.mosText != null
          ? {
              figure: {
                value: input.mosText,
                unit: 'months of supply',
                source: CHOOSER_SOURCE_NAME,
                sourceName: CHOOSER_SOURCE_NAME,
                updatedAt: input.refreshedAt,
              },
            }
          : {}),
      }
    }
    return {
      ...door,
      mark: 'page' as const,
      detail: 'Published sales reports and the dated weekly snapshots.',
      ...(input.newestWeeklyLabel
        ? {
            figure: {
              value: input.newestWeeklyLabel,
              unit: 'newest weekly snapshot',
              source: 'Published weekly snapshots on Oregon Data Share dates',
              sourceName: 'Published weekly snapshots',
            },
          }
        : {}),
    }
  })
}

const LEAD_LABELS = new Set(['homes for sale, single-family', 'a month of sales'])

export function isHubLeadFigure(figure: V3InstrumentFigure): boolean {
  return LEAD_LABELS.has(String(figure.label))
}

/** Whole-number face for beui-number. Percents and money stay static. */
export function wholeCountFromLabel(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('%') || trimmed.includes('$')) return undefined
  const n = Number(trimmed.replace(/,/g, ''))
  if (!Number.isInteger(n) || n <= 0) return undefined
  return n
}

export type HubExtraItem = {
  value: string
  label: string
  count?: number
  href?: string
}

export type HubExtraPage = {
  id: string
  label: string
  claim: string
  items: HubExtraItem[]
}

function extraItemsFromFigures(figures: readonly V3InstrumentFigure[]): HubExtraItem[] {
  const items: HubExtraItem[] = []
  for (const figure of figures) {
    const value = String(figure.value)
    const label = String(figure.label)
    if (!value || !label) continue
    items.push({
      value,
      label,
      ...(figure.count != null && Number.isFinite(figure.count) && figure.count > 0
        ? { count: figure.count }
        : wholeCountFromLabel(value) != null
          ? { count: wholeCountFromLabel(value) }
          : {}),
      ...(figure.href ? { href: figure.href } : {}),
    })
  }
  return items
}

/**
 * Extra leftover tiles become InsightPager pages, not a closed cream fold.
 * Miss omits a page. Claims carry no figure — the items do.
 */
export function buildHubExtraPages(input: {
  priceAndWait: readonly V3InstrumentFigure[]
  types: readonly V3InstrumentFigure[]
  pace: readonly V3InstrumentFigure[]
  mix: readonly V3InstrumentFigure[]
}): HubExtraPage[] {
  const pages: HubExtraPage[] = []
  const priceItems = extraItemsFromFigures(input.priceAndWait)
  if (priceItems.length > 0) {
    pages.push({
      id: 'price',
      label: 'Price and wait',
      claim: 'Median list and days to an offer, from Oregon Data Share.',
      items: priceItems,
    })
  }
  const typeItems = extraItemsFromFigures(input.types)
  if (typeItems.length > 0) {
    pages.push({
      id: 'types',
      label: 'Types',
      claim: 'Single-family inventory by type, when a type has a live row.',
      items: typeItems,
    })
  }
  const paceItems = extraItemsFromFigures(input.pace)
  if (paceItems.length > 0) {
    pages.push({
      id: 'pace',
      label: 'Sale pace',
      claim: 'How the recent closed and pending pace reads, from Oregon Data Share.',
      items: paceItems,
    })
  }
  const mixItems = extraItemsFromFigures(input.mix)
  if (mixItems.length > 0) {
    pages.push({
      id: 'features',
      label: 'Features',
      claim: 'What a typical recent closed house had, when a share published.',
      items: mixItems,
    })
  }
  return pages
}

/**
 * Lead tiles under the MOS drawing. Integer month-of-sales face.
 * Sentences say what each figure means; no second number in a sentence.
 */
export function buildOpeningFigures(input: {
  follow: V3InstrumentFigure[]
  monthOfSales: number | null
}): V3InstrumentFigure[] {
  const { follow, monthOfSales } = input
  if (monthOfSales == null) return follow
  const salesLabel = formatHubPace(monthOfSales)
  return [
    ...follow.filter((figure) => String(figure.label) === 'homes for sale, single-family'),
    {
      value: v3Text(salesLabel),
      label: v3Text('a month of sales'),
      href: '/months-of-supply',
      count: monthOfSales,
      sentence: v3Text('How many single-family houses have been selling in a typical recent month.'),
    },
    ...follow.filter(
      (figure) =>
        String(figure.label) !== 'homes for sale, single-family' &&
        String(figure.label) !== MOS_PLAIN_LABEL,
    ),
  ]
}

