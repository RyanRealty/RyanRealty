import type { BuyerAnswerDef, BuyerAnswerFigures, SourcedStrFact } from './types'
import {
  BYLINE_HREF,
  BYLINE_NAME,
  fitAnswer,
  formatCount,
  formatDays,
  formatMos,
  formatUsd,
  formatUsdExact,
  mlsCitation,
} from './format'

export const BUY_LINKS = [
  { href: '/buy/first-time-home-buyer', label: 'First-time buyers' },
  { href: '/buy/relocation', label: 'Relocation' },
  { href: '/buy/investment', label: 'Investment' },
] as const

export function buyerAnswerByline() {
  return { href: BYLINE_HREF, label: BYLINE_NAME }
}

function homesClause(count: number | null, name: string): string {
  if (count == null) return `Single-family inventory in ${name} is read from Oregon Data Share MLS.`
  if (count === 0) return `${name} has no single-family homes for sale right now.`
  if (count === 1) return `${name} has 1 single-family home for sale`
  return `${name} has ${formatCount(count)} single-family homes for sale`
}

function priceClause(price: number | null): string | null {
  if (price == null || price <= 0) return null
  return `at a median list price of ${formatUsd(price)}`
}

export function livingAnswer(place: BuyerAnswerFigures, asOf: string | null): string {
  const count = place.activeCount ?? (place.listingCount > 0 ? place.listingCount : null)
  const price = priceClause(place.medianListPrice)
  const days = formatDays(place.medianDaysToPending)
  const mos = formatMos(place.monthsOfSupply)
  const cite = mlsCitation(asOf)
  const required: string[] = []
  if (count === 0) {
    required.push(`${homesClause(0, place.name)} Inventory changes as homes list or go pending. ${cite}.`)
  } else if (count == null) {
    required.push(`${homesClause(null, place.name)} ${cite}.`)
  } else {
    required.push(`${homesClause(count, place.name)}${price ? ` ${price}` : ''}. ${cite}.`)
  }
  const optional: string[] = []
  if (days) optional.push(`Homes have taken a median of ${days} days to go pending.`)
  if (mos) optional.push(`Months of supply is ${mos}.`)
  optional.push('Those figures describe the housing market, not who should live there.')
  optional.push(`See the ${place.name} listings below and the community hub for the full place page.`)
  return fitAnswer(required, optional)
}

export function costAnswer(place: BuyerAnswerFigures, asOf: string | null): string {
  const count = place.activeCount ?? (place.listingCount > 0 ? place.listingCount : null)
  const price = priceClause(place.medianListPrice)
  const cite = mlsCitation(asOf)
  const hoa =
    place.hoaAnnual != null
      ? place.hoaKind === 'measured'
        ? `Measured HOA dues from listings that report them are ${formatUsd(place.hoaAnnual)} a year${place.hoaBasis ? ` (${place.hoaBasis})` : ''}.`
        : `The published master HOA assessment is ${formatUsdExact(place.hoaAnnual)} a year.`
      : null
  const lead =
    count === 0
      ? `Housing cost in ${place.name} starts with the homes: none are for sale right now.`
      : count == null
        ? `Housing cost in ${place.name} is the asking prices on the live MLS list.`
        : `Housing cost in ${place.name} starts with the homes: ${formatCount(count)} active single-family listing${count === 1 ? '' : 's'}${price ? ` ${price}` : ''}.`
  return fitAnswer(
    [`${lead} ${cite}.`],
    [
      hoa,
      'Confirm current dues with the association before you buy.',
      'Groceries, taxes, and other living costs are not in this MLS feed.',
    ].filter((s): s is string => Boolean(s)),
  )
}

export function hoaAnswer(place: BuyerAnswerFigures, asOf: string | null): string {
  if (place.hoaAnnual == null) {
    return fitAnswer(
      [`${place.name} HOA dues are not published as a single sourced figure on this site.`],
      [mlsCitation(asOf) + '.', 'Do not guess a number from nearby plats.'],
    )
  }
  const count = place.activeCount ?? (place.listingCount > 0 ? place.listingCount : null)
  const price = priceClause(place.medianListPrice)
  const hoaLine =
    place.hoaKind === 'measured'
      ? `The published ${place.name} HOA figure is ${formatUsd(place.hoaAnnual)} a year, measured from listings that report dues${place.hoaBasis ? ` (${place.hoaBasis})` : ''}.`
      : `The published ${place.name} master association assessment is ${formatUsdExact(place.hoaAnnual)} a year.`
  const inv =
    count == null
      ? null
      : count === 0
        ? 'No single-family homes are for sale right now.'
        : `${formatCount(count)} single-family home${count === 1 ? ' is' : 's are'} for sale${price ? ` ${price}` : ''}.`
  return fitAnswer(
    [hoaLine, mlsCitation(asOf) + '.'],
    [
      inv,
      'Sub-neighborhood dues can sit on top of a master bill.',
      'Confirm the current amount with the association before you buy.',
    ].filter((s): s is string => Boolean(s)),
  )
}

export function strAnswer(
  place: BuyerAnswerFigures,
  str: SourcedStrFact,
  asOf: string | null,
): string {
  const count = place.activeCount ?? (place.listingCount > 0 ? place.listingCount : null)
  const inv =
    count == null
      ? null
      : count === 0
        ? 'No single-family homes are for sale there right now.'
        : `${formatCount(count)} single-family home${count === 1 ? ' is' : 's are'} for sale.`
  return fitAnswer(
    [str.summary, `${mlsCitation(asOf)}.`],
    [inv, 'Rules vary by lot and by association. Confirm before you buy.'].filter(
      (s): s is string => Boolean(s),
    ),
  )
}

export function vsAnswer(
  left: BuyerAnswerFigures,
  right: BuyerAnswerFigures,
  asOf: string | null,
): string {
  const leftCount = left.activeCount ?? (left.listingCount > 0 ? left.listingCount : null)
  const rightCount = right.activeCount ?? (right.listingCount > 0 ? right.listingCount : null)
  const leftPrice = left.medianListPrice != null ? formatUsd(left.medianListPrice) : null
  const rightPrice = right.medianListPrice != null ? formatUsd(right.medianListPrice) : null
  const leftDays = formatDays(left.medianDaysToPending)
  const rightDays = formatDays(right.medianDaysToPending)
  const leftInv =
    leftCount == null
      ? `${left.name} inventory is on the live MLS list`
      : leftCount === 0
        ? `${left.name} has no single-family homes for sale`
        : `${left.name} has ${formatCount(leftCount)} single-family home${leftCount === 1 ? '' : 's'} for sale${leftPrice ? ` at a median ask of ${leftPrice}` : ''}`
  const rightInv =
    rightCount == null
      ? `${right.name} inventory is on the live MLS list`
      : rightCount === 0
        ? `${right.name} has none`
        : `${right.name} has ${formatCount(rightCount)}${rightPrice ? ` at ${rightPrice}` : ''}`
  return fitAnswer(
    [`${leftInv}. ${rightInv}. ${mlsCitation(asOf)}.`],
    [
      leftDays && rightDays ? `Days to pending are ${leftDays} and ${rightDays}.` : null,
      'Those are live inventory figures, not a ranking of the two places.',
    ].filter((s): s is string => Boolean(s)),
  )
}

export function presetAnswer(input: {
  city: string
  plural: string
  count: number
  medianListPrice: number | null
  medianDaysToPending: number | null
  asOf: string | null
}): string {
  const { city, plural, count, medianListPrice, medianDaysToPending, asOf } = input
  const cite = mlsCitation(asOf)
  const lead =
    count === 0
      ? `No ${plural} are on the market in ${city} right now.`
      : `${formatCount(count)} ${count === 1 ? plural.replace(/s$/, '') : plural} ${count === 1 ? 'is' : 'are'} on the market in ${city} right now.`
  const price =
    medianListPrice != null && medianListPrice > 0
      ? `Across ${city} as a whole, the median single-family list price is ${formatUsd(medianListPrice)}.`
      : null
  const days = formatDays(medianDaysToPending)
  return fitAnswer(
    [`${lead} ${cite}.`],
    [
      price,
      days ? `City-wide, homes take a median of ${days} days to go pending.` : null,
      'The grid below is this search, not the whole city.',
    ].filter((s): s is string => Boolean(s)),
  )
}

export function buildAnswer(input: {
  def: BuyerAnswerDef
  place: BuyerAnswerFigures
  other?: BuyerAnswerFigures | null
  str?: SourcedStrFact | null
  asOf: string | null
}): string {
  switch (input.def.kind) {
    case 'living':
      return livingAnswer(input.place, input.asOf)
    case 'cost':
      return costAnswer(input.place, input.asOf)
    case 'hoa':
      return hoaAnswer(input.place, input.asOf)
    case 'str':
      return input.str
        ? strAnswer(input.place, input.str, input.asOf)
        : livingAnswer(input.place, input.asOf)
    case 'vs':
      return input.other
        ? vsAnswer(input.place, input.other, input.asOf)
        : livingAnswer(input.place, input.asOf)
    case 'preset':
    case 'new-construction':
      return livingAnswer(input.place, input.asOf)
    default: {
      const _never: never = input.def.kind
      return livingAnswer(input.place, input.asOf)
    }
  }
}
