/**
 * ALL-TYPE closed-sales KPIs for the market family (hub, region, history).
 *
 * Tremor density: the dollar volume and the type mix are figures, not a cream
 * caption. Nothing here fetches, reads the clock, or classifies a market.
 * A mart row with source === 'missing' is missing. Zeros are not facts.
 */

import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import { PUBLIC_CLOSED_SALES_METHODOLOGY } from '@/lib/market/publish-public-methodology'
import { labelPropertyType } from '@/lib/data/analytics/property-type-labels'
import { formatPriceExact } from '@/lib/format/money'
import { v3Text, type V3InstrumentFigure } from '@/components/site/v3'

/** Explorer type filter codes. Any other code would drop the filter on arrival. */
export const CLOSED_TYPE_CODES = new Set(['A', 'B', 'C', 'D'])

export type CompositionPart = {
  code: string
  n: number
  label: string
}

/**
 * Compact dollar volume for a KPI. Billions keep three decimals so a mart
 * figure of $3.931B does not print as $3.93B. Trailing zeros drop.
 */
export function volumeCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 1e9) {
    const raw = (n / 1e9).toFixed(3).replace(/\.?0+$/, '')
    return `$${raw}B`
  }
  if (n >= 1e6) {
    const raw = (n / 1e6).toFixed(1).replace(/\.0$/, '')
    return `$${raw}M`
  }
  return formatPriceExact(n)
}

/** Sentence form for FAQ / JSON-LD. Same rounding as volumeCompact, spelled out. */
export function volumeSentence(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null
  if (n >= 1e9) {
    const raw = (n / 1e9).toFixed(3).replace(/\.?0+$/, '')
    return `$${raw} billion`
  }
  if (n >= 1e6) {
    const raw = (n / 1e6).toFixed(1).replace(/\.0$/, '')
    return `$${raw} million`
  }
  return formatPriceExact(n)
}

export function medianCloseLabel(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** Present mart year only. Absent is not zero. */
export function closedMartRow(
  row: CoMarketAnnualRow | null | undefined,
): CoMarketAnnualRow | null {
  if (!row || row.source !== 'mart') return null
  if (!(row.year > 0 && row.soldCount > 0 && row.totalVolume > 0)) return null
  return row
}

export function pickLatestMartYear(
  rows: readonly CoMarketAnnualRow[],
): CoMarketAnnualRow | null {
  const mart = rows.filter((row) => closedMartRow(row))
  if (!mart.length) return null
  return [...mart].sort((a, b) => b.year - a.year)[0] ?? null
}

/**
 * Type mix from propertyTypeBreakdown. Omit zero types. An empty or missing
 * object is absent, not a row of zeros.
 */
export function compositionParts(
  breakdown: Record<string, number> | null | undefined,
): CompositionPart[] {
  if (!breakdown) return []
  return Object.entries(breakdown)
    .map(([code, n]) => ({
      code,
      n: Number(n) || 0,
      label: labelPropertyType(code),
    }))
    .filter((part) => part.n > 0 && part.label.length > 0)
    .sort((a, b) => b.n - a.n)
}

export function buildAllTypeFigures(opts: {
  soldCount: number
  totalVolume: number
  historyHref: string
  medianClose?: number | null
  includeMedian?: boolean
}): V3InstrumentFigure[] {
  const volume = volumeCompact(opts.totalVolume)
  const figures: V3InstrumentFigure[] = []
  if (volume) {
    figures.push({
      value: v3Text(volume),
      label: v3Text('Closed volume, every type'),
      href: opts.historyHref,
    })
  }
  if (opts.soldCount > 0) {
    figures.push({
      value: v3Text(opts.soldCount.toLocaleString('en-US')),
      label: v3Text('Closed sales, every type'),
      href: opts.historyHref,
    })
  }
  const median = opts.includeMedian ? medianCloseLabel(opts.medianClose) : null
  if (median) {
    figures.push({
      value: v3Text(median),
      label: v3Text('Median close, every type'),
      href: opts.historyHref,
    })
  }
  return figures
}

export function buildCompositionFigures(opts: {
  parts: readonly CompositionPart[]
  historyHref: string
}): V3InstrumentFigure[] {
  return opts.parts.map((part) => {
    const href = CLOSED_TYPE_CODES.has(part.code)
      ? `${opts.historyHref}${opts.historyHref.includes('?') ? '&' : '?'}type=${part.code}`
      : opts.historyHref
    return {
      value: v3Text(part.n.toLocaleString('en-US')),
      label: v3Text(`${part.label} closes`),
      href,
    }
  })
}

export function closedMartSource(year: number): string {
  return (
    `Closed MLS sales through Oregon Data Share, Central Oregon service-area cities, ` +
    `all property types, calendar year ${year}. Not active inventory. ${PUBLIC_CLOSED_SALES_METHODOLOGY}`
  )
}

export function closedMartMissingBody(year: number): string {
  return (
    `The ALL-TYPE closed-sales mart row for calendar year ${year} did not return on this refresh. ` +
    `This page is not printing a close count or a dollar volume.`
  )
}
