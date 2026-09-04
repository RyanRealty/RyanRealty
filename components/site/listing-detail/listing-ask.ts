/**
 * The listing instrument's one claim: how this ask sits versus leftover
 * median list at the finest leftover grain that publishes.
 *
 * Two operands, one sentence. This ask is publishListingSaleAsk. The median
 * is leftoverHudKpis.medianList. A fractional share (ask is not the whole
 * home) and a lease rate (no sale ask) withhold rather than compare unlike
 * things. HouseMe / listing_pricing_reads is a second claim and stays off
 * this sentence.
 */
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { v3Text, type V3InstrumentFigure, type V3InstrumentFigures } from '@/components/site/v3'

const NO_DATE = /^[\s\u002D\u2010-\u2015\u2212]*$/

export type ListingAskGrain = {
  name: string
  hubHref: string
}

export type ListingAskClaim = {
  eyebrow: string
  headline: string
  figures: V3InstrumentFigures
  source: string
  updated?: string
  action: { label: string; href: string }
}

export function publishAskVsMedianPct(ask: number, median: number): number | null {
  if (!(ask > 0) || !(median > 0)) return null
  return ((ask - median) / median) * 100
}

/** Absolute percent for the headline, one tenth. Sub-tenth deltas use dollars. */
export function formatAskVsMedianDelta(
  ask: number,
  median: number,
): { kind: 'match' } | { kind: 'over' | 'under'; label: string } | null {
  if (!(ask > 0) || !(median > 0)) return null
  if (ask === median) return { kind: 'match' }
  const pct = publishAskVsMedianPct(ask, median)
  if (pct == null) return null
  const kind = pct > 0 ? 'over' : 'under'
  const tenths = Math.round(Math.abs(pct) * 10) / 10
  if (tenths === 0) {
    return { kind, label: formatPriceExact(Math.abs(ask - median)) }
  }
  return { kind, label: `${tenths.toFixed(1)}%` }
}

export function buildListingAskHeadline(grainName: string, ask: number, median: number): string | null {
  const name = grainName.trim()
  if (!name) return null
  const delta = formatAskVsMedianDelta(ask, median)
  if (!delta) return null
  if (delta.kind === 'match') return `This ask matches the ${name} median list`
  return `This ask sits ${delta.label} ${delta.kind} the ${name} median list`
}

function stampFrom(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const printed = formatDate(iso)
  if (!printed || NO_DATE.test(printed)) return undefined
  return printed
}

export function buildListingAskClaim(input: {
  ask: number | null
  wholePropertyPrice: number | null
  hud: LeftoverHudKpis | null
  grain: ListingAskGrain | null
  updatedAt?: string | null
}): ListingAskClaim | null {
  const ask = input.ask
  const median = input.hud?.medianList ?? null
  const grain = input.grain
  const name = grain?.name.trim() ?? ''
  if (ask == null || !(ask > 0)) return null
  if (median == null || !(median > 0)) return null
  if (!grain || !name || !grain.hubHref) return null
  // A share ask is not the leftover pile's whole-home median.
  if (input.wholePropertyPrice != null && input.wholePropertyPrice !== ask) return null

  const headline = buildListingAskHeadline(name, ask, median)
  if (!headline) return null

  const figures: V3InstrumentFigure[] = [
    { value: v3Text(formatPriceExact(ask)), label: v3Text('this ask') },
    {
      value: v3Text(formatPriceExact(median)),
      label: v3Text(`${name} median list`),
      href: grain.hubHref,
    },
  ]
  const active = input.hud?.active
  if (active != null && active > 0) {
    figures.push({
      value: v3Text(active.toLocaleString('en-US')),
      label: v3Text('homes for sale'),
      href: grain.hubHref,
    })
  }
  const mos = input.hud?.monthsSupply
  if (mos != null && mos > 0) {
    figures.push({
      value: v3Text(formatMonthsOfSupply(mos)),
      label: v3Text('months of supply'),
      href: '/months-of-supply',
    })
  }

  const [first, ...rest] = figures
  if (!first) return null

  const mosPrints = mos != null && mos > 0
  const source = [
    `leftover membership, active single-family houses in ${name}. This ask is the published list price.`,
    mosPrints ? MOS_METHODOLOGY_CLAUSE : '',
    mosPrints ? MOS_THRESHOLD_CLAUSE : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    eyebrow: name,
    headline,
    figures: [first, ...rest],
    source,
    updated: stampFrom(input.updatedAt),
    action: { label: `See homes in ${name}`, href: grain.hubHref },
  }
}
