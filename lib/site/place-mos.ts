/**
 * Compact months-of-supply drawing for a place opening (SITE-43).
 *
 * DATA_GRAPHICS: homes for sale vs a month of sales, never a "3.9 MOS" tile.
 * Inputs are leftoverHudKpis.active and leftoverHudKpis.monthsSupply — the same
 * pile the city door already prints. Monthly pace = active / MOS. Omit when
 * implied six-month closes sit under the chart floor. Formatting lives here,
 * not in the barrel (ci:public-v3 rule 3).
 */

import { MOS_METHODOLOGY_CLAUSE, MOS_PLAIN_LABEL, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { impliedSixMonthCloses } from '@/lib/market/publish-months-of-supply'
import { formatCount } from '@/lib/format/count'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'

/** DATA_GRAPHICS: fewer than 6 closes in the window is not a typical. */
export const PLACE_MOS_MIN_CLOSES = 6

export type PlaceMosGrain = 'city' | 'neighborhood' | 'community'

export type PublishedPlaceMos = {
  homesForSale: number
  monthOfSales: number
  impliedSixMonthCloses: number
  mos: number
}

export type PlaceMosView = {
  homesForSale: number
  monthOfSales: number
  mos: number
  homesValue: number
  salesValue: number
  homesLabel: string
  salesLabel: string
  homesName: string
  salesName: string
  caption: string
  plainLabel: string
  asOf: string | null
  source: string
  tooltip: { homes: string; sales: string; source: string }
}

const PACE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function asFinitePositive(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function monthOfSalesFromHud(active: number, monthsSupply: number): number | null {
  const homes = asFinitePositive(active)
  const mos = asFinitePositive(monthsSupply)
  if (homes == null || mos == null) return null
  return homes / mos
}

export function publishPlaceMos(input: {
  active: number | null | undefined
  monthsSupply: number | null | undefined
}): PublishedPlaceMos | null {
  const homesForSale = asFinitePositive(input.active)
  const mos = asFinitePositive(input.monthsSupply)
  if (homesForSale == null || mos == null) return null
  const monthOfSales = monthOfSalesFromHud(homesForSale, mos)
  if (monthOfSales == null || !(monthOfSales > 0)) return null
  const implied = impliedSixMonthCloses(homesForSale, mos)
  if (implied == null || implied < PLACE_MOS_MIN_CLOSES) return null
  return { homesForSale, monthOfSales, impliedSixMonthCloses: implied, mos }
}

function formatPace(n: number): string {
  return PACE.format(n)
}

export function placeMosSource(input: {
  grain: PlaceMosGrain
  geoSlug: string
  homesForSale: number
  monthOfSales: number
  impliedSixMonthCloses: number
  mosText: string
  asOf: string | null
}): string {
  const n = Math.round(input.impliedSixMonthCloses)
  const body =
    `leftoverHudKpis via public.market_metric, ${input.grain}:${input.geoSlug}, ` +
    `segment=detached, ${MOS_PLAIN_LABEL}: ${formatCount(input.homesForSale)} homes for sale vs ` +
    `${formatPace(input.monthOfSales)} sales a month (${input.mosText} months). ` +
    `${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE} ` +
    `n=${formatCount(n)} implied six-month closes.`
  return input.asOf ? `${body} · updated ${input.asOf}` : body
}

export function buildPlaceMosView(input: {
  active: number | null | undefined
  monthsSupply: number | null | undefined
  grain: PlaceMosGrain
  geoSlug: string
  asOf: string | null
}): PlaceMosView | null {
  const published = publishPlaceMos({ active: input.active, monthsSupply: input.monthsSupply })
  if (!published) return null
  const mosText = formatMonthsOfSupply(published.mos)
  const homesLabel = formatCount(published.homesForSale)
  const salesLabel = formatPace(published.monthOfSales)
  const source = placeMosSource({
    grain: input.grain,
    geoSlug: input.geoSlug,
    homesForSale: published.homesForSale,
    monthOfSales: published.monthOfSales,
    impliedSixMonthCloses: published.impliedSixMonthCloses,
    mosText,
    asOf: input.asOf,
  })
  const tipSource = input.asOf
    ? `Oregon Data Share via leftoverHudKpis, ${input.grain}:${input.geoSlug}, segment=detached. as of ${input.asOf}`
    : `Oregon Data Share via leftoverHudKpis, ${input.grain}:${input.geoSlug}, segment=detached.`
  return {
    homesForSale: published.homesForSale,
    monthOfSales: published.monthOfSales,
    mos: published.mos,
    homesValue: published.homesForSale,
    salesValue: published.monthOfSales,
    homesLabel,
    salesLabel,
    homesName: 'Homes for sale',
    salesName: 'A month of sales',
    caption: `About ${mosText} months of homes on the market.`,
    plainLabel: MOS_PLAIN_LABEL,
    asOf: input.asOf,
    source,
    tooltip: { homes: homesLabel, sales: salesLabel, source: tipSource },
  }
}
