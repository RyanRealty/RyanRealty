/**
 * SITE-105 fold helpers for /oregon/[city].
 *
 * Honesty first (layout lock), then one claim + the live ledger — not a
 * three-tile KPI grid and not a static asking-price lollipop. Every number
 * here is a snapshot or tile field the page already fetched.
 */

export const OREGON_CITY_FIGURE_FOLD_AFTER = 1 as const

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
  const sfr = input.activeSfrCount.toLocaleString('en-US')
  if (input.medianAsk) {
    return `${live} live listings in ${name}. ${sfr} are single-family. Median ask ${input.medianAsk}.`
  }
  return `${live} live listings in ${name}. ${sfr} are single-family.`
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
