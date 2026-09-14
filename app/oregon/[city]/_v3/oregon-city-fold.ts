/**
 * SITE-105 fold helpers for /oregon/[city].
 *
 * Honesty first (layout lock), then a two-bar Instrument drawing + the live
 * ledger — not a three-tile KPI grid and not a static asking-price lollipop.
 * Every number here is a snapshot or tile field the page already fetched.
 */
import { v3Text, type V3ChartProps } from '@/components/site/v3'

/** Fold every figure when a chart is carrying the answer (SITE-24). */
export const OREGON_CITY_FIGURE_FOLD_AFTER = 0 as const

export function buildOregonCityTitle(input: {
  name: string
  activeAllCount: number
}): string {
  const name = input.name.trim()
  if (input.activeAllCount > 0) {
    return `${input.activeAllCount.toLocaleString('en-US')} ${name} homes for sale — outside our market`
  }
  return `${name} homes for sale — outside our market`
}

export function buildOregonCityClaim(input: {
  name: string
  activeAllCount: number
  activeSfrCount: number
  medianAsk: string | null
}): string {
  const name = input.name.trim()
  const live = input.activeAllCount.toLocaleString('en-US')
  const houses = input.activeSfrCount.toLocaleString('en-US')
  if (input.medianAsk) {
    return `${live} live listings in ${name}. ${houses} are houses. Typical ask ${input.medianAsk}.`
  }
  return `${live} live listings in ${name}. ${houses} are houses.`
}

export function buildOregonCityHonestyDescription(input: {
  name: string
  activeAllCount: number
}): string {
  const name = input.name.trim()
  if (input.activeAllCount > 0) {
    return `${input.activeAllCount.toLocaleString('en-US')} live listings below are from the statewide MLS. We work Central Oregon, not ${name}. Ask for a local broker introduction.`
  }
  return `We work Central Oregon, not ${name}. Ask for a local broker introduction.`
}

export function buildOregonCityMixChart(input: {
  name: string
  activeAllCount: number
  activeSfrCount: number
}): V3ChartProps | null {
  if (input.activeAllCount <= 0 || input.activeSfrCount <= 0) return null
  const name = input.name.trim()
  const all = input.activeAllCount
  const houses = input.activeSfrCount
  return {
    caption: v3Text(`${name} listings, houses vs the whole market`),
    claim: v3Text(
      `${all.toLocaleString('en-US')} listings are on the market. ${houses.toLocaleString('en-US')} of them are houses.`,
    ),
    kind: 'bars',
    barLabels: 'all',
    series: [
      {
        name: v3Text('Listings'),
        points: [
          {
            value: all,
            tick: v3Text('On the market'),
            label: v3Text(all.toLocaleString('en-US')),
          },
          {
            value: houses,
            tick: v3Text('Houses'),
            label: v3Text(houses.toLocaleString('en-US')),
          },
        ],
      },
    ],
  }
}

export function buildOregonCityItemListName(input: {
  address: string
  price: string
  detail?: string
}): string {
  const address = input.address.trim()
  const price = input.price.trim()
  const detail = input.detail?.trim()
  return detail ? `${address} · ${price} · ${detail}` : `${address} · ${price}`
}
