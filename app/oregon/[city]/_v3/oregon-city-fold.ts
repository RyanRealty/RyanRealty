/**
 * SITE-105 fold helpers for /oregon/[city].
 *
 * Honesty first, then an interactive two-bar drawing (homes for sale vs a
 * month of sales when the city pulse publishes MOS; otherwise the snapshot
 * pair with hover). Listing rows use buyer language and a tap/hover reveal.
 * Every number is a snapshot, pulse, or tile field the page already fetched.
 */
import type { V3DrawingFigure } from '@/components/site/v3'
import { displaySubdivision } from '@/lib/slug'
import { formatPriceExact } from '@/lib/format/money'

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

export function buildOregonCityClaim(input: { name: string }): string {
  const name = input.name.trim()
  return `Live listings from the statewide MLS. We work Central Oregon, not ${name}. Hover a bar for the window and the stamp.`
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

/** MLS plat tails a buyer does not say. */
const PLAT_TAIL =
  /\s+(?:subdivision|addition|estates?|plat|unit\s+no\.?\s*\d+|phase\s+\d+)\s*$/i

function titleCasePlace(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(^|[\s'/.-])([a-z])/g, (_, edge: string, letter: string) => edge + letter.toUpperCase())
}

/**
 * Buyer-facing place line. Drops ALL-CAPS plat suffixes and title-cases
 * what remains. Returns null when the place is the city itself — the
 * address already names the city, so a repeated MEDFORD eyebrow is noise.
 */
export function buildOregonCityBuyerPlace(input: {
  subdivisionName: string | null | undefined
  city: string
}): string | null {
  const city = input.city.trim()
  const place = displaySubdivision(input.subdivisionName) ?? ''
  if (!place) return null
  let next = place.trim()
  for (let i = 0; i < 4; i += 1) {
    const stripped = next.replace(PLAT_TAIL, '').trim()
    if (stripped === next) break
    next = stripped
  }
  const labeled = titleCasePlace(next)
  if (!labeled || labeled.toLowerCase() === city.toLowerCase()) return null
  return labeled
}

export function buildOregonCityListingReveal(input: {
  yearBuilt: number | null
  lotSizeAcres: number | null
  garageSpaces: number | null
  pricePerSqft: number | null
  city: string
}): string | null {
  if (input.yearBuilt != null && input.yearBuilt > 1800 && input.yearBuilt < 2100) {
    return `Built in ${input.yearBuilt}`
  }
  if (input.lotSizeAcres != null && Number.isFinite(input.lotSizeAcres) && input.lotSizeAcres > 0) {
    return `${input.lotSizeAcres.toFixed(2)} acres`
  }
  if (input.garageSpaces != null && Number.isFinite(input.garageSpaces) && input.garageSpaces >= 1) {
    return `${Math.round(input.garageSpaces)}-car garage`
  }
  if (input.pricePerSqft != null && Number.isFinite(input.pricePerSqft) && input.pricePerSqft >= 1) {
    return `${formatPriceExact(Math.round(input.pricePerSqft))} / sqft`
  }
  return null
}

/**
 * Snapshot pair when the city has no pulse MOS. Same two counts the page
 * already prints — hover deepens each bar. Do not label this month-of-sales.
 */
export function buildOregonCitySupplyDrawing(input: {
  name: string
  activeAllCount: number
  activeSfrCount: number
  source: string
  asOf?: string | null
  medianAsk?: string | null
}): V3DrawingFigure | null {
  if (input.activeAllCount <= 0 || input.activeSfrCount <= 0) return null
  const name = input.name.trim()
  const all = input.activeAllCount
  const houses = input.activeSfrCount
  const allLabel = all.toLocaleString('en-US')
  const housesLabel = houses.toLocaleString('en-US')
  const stamp = input.asOf?.trim()
  const typical = input.medianAsk?.trim()
  return {
    key: 'oregon-city-supply',
    draw: 'pair',
    claim: `The snapshot splits everything on the market in ${name} from the houses on their own lots.`,
    caption: 'On the market vs houses',
    source: input.source,
    bars: [
      {
        name: 'On the market',
        value: all,
        label: allLabel,
        note: stamp ? `${allLabel} · all types · ${stamp}` : `${allLabel} · all types`,
      },
      {
        name: 'Houses',
        value: houses,
        label: housesLabel,
        note: typical ? `${housesLabel} · houses · ${typical}` : `${housesLabel} · houses`,
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
