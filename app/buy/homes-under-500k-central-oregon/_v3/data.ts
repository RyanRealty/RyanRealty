/**
 * Assemble the under-$500K hub snapshot. Inventory counts and SFR medians
 * come from getUnder500kCityInventory (listing_search_mv). Days to an offer
 * and months of supply come from the same leftover HUD + 90-day pace the
 * housing-market pages print. Pulse median_list_price stays off this page
 * so the Bend $745K mixed-type cell cannot ship.
 */
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { EMPTY_PUBLIC_PACE, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import type { DetachedOverlay } from '@/lib/data/market-truth/getSellBendMarket'
import type { Under500kCityInventory, Under500kTownCounts } from '@/lib/data/listings/getUnder500kCityInventory'
import { formatDate, zonedDateKey } from '@/lib/format/date'
import { UNDER_500K_TOWNS, type Under500kTownSlug } from '@/lib/data/listings/under-500k-classify'
import { CELL_UNPUBLISHED } from './constants'

export type Under500kTownRow = {
  slug: Under500kTownSlug
  name: string
  footnote: boolean
  listingsHref: string
  marketHref: string
  lotsHref: string
  under400Href: string
  under300Href: string
  residential: number
  sfr: number
  townhouse: number
  condo: number
  condoTownhome: number
  manufacturedOnLand: number
  sharedOrLeased: number
  otherResidential: number
  sfrMedianList: number | null
  sfrMedianN: number
  daysToOffer90: number | null
  monthsSupply: number | null
  priceCutShare: number | null
}

export type Under500kSnapshot = {
  published: boolean
  asOfIso: string
  asOfLabel: string | null
  headlineResidential: number
  headlineSfr: number
  towns: Under500kTownRow[]
  headlineTowns: Under500kTownRow[]
  footnoteTowns: Under500kTownRow[]
}

export function asOfLabelFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null
  const label = formatDate(iso)
  return label === '—' ? null : label
}

export function asOfIsoDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  return zonedDateKey(iso) || null
}

function overlayKey(slug: string): string {
  return `city:${slug}`
}

function daysNumber(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null
  return Math.round(n)
}

function attachPace(
  town: Under500kTownCounts,
  overlay: DetachedOverlay | undefined,
  pace: PublicPaceRow,
): Under500kTownRow {
  const hud = leftoverHudKpis({
    grain: 'city',
    headlines: overlay?.headlines ?? null,
    inventory: overlay?.inventory ?? null,
    pace,
  })
  return {
    slug: town.slug,
    name: town.name,
    footnote: town.footnote,
    listingsHref: `/homes-for-sale/${town.slug}/under-500k`,
    marketHref: `/housing-market/${town.slug}`,
    lotsHref: `/homes-for-sale/${town.slug}/lots-and-land`,
    under400Href: `/homes-for-sale/${town.slug}/under-400k`,
    under300Href: `/homes-for-sale/${town.slug}/under-300k`,
    residential: town.residential,
    sfr: town.sfr,
    townhouse: town.townhouse,
    condo: town.condo,
    condoTownhome: town.condoTownhome,
    manufacturedOnLand: town.manufacturedOnLand,
    sharedOrLeased: town.sharedOrLeased,
    otherResidential: town.otherResidential,
    sfrMedianList: town.sfrMedianList,
    sfrMedianN: town.sfrMedianN,
    daysToOffer90: daysNumber(pace.daysToPending90d),
    monthsSupply: hud.monthsSupply,
    priceCutShare: pace.priceCutShare,
  }
}

export const EMPTY_UNDER_500K_INVENTORY: Under500kCityInventory = {
  asOfIso: '',
  towns: [],
  headlineResidential: 0,
  headlineSfr: 0,
}

export function buildUnder500kSnapshot(input: {
  inventory: Under500kCityInventory | null
  overlays: ReadonlyMap<string, DetachedOverlay>
  paces: ReadonlyMap<string, PublicPaceRow>
}): Under500kSnapshot {
  const published = input.inventory != null
  const inventory = input.inventory ?? EMPTY_UNDER_500K_INVENTORY
  const towns = UNDER_500K_TOWNS.map((def) => {
    const counted = inventory.towns.find((t) => t.slug === def.slug)
    const base: Under500kTownCounts = counted ?? {
      slug: def.slug,
      name: def.name,
      cityLower: def.cityLower,
      footnote: def.slug === 'sisters' || def.slug === 'sunriver',
      residential: 0,
      sfr: 0,
      townhouse: 0,
      condo: 0,
      condoTownhome: 0,
      manufacturedOnLand: 0,
      sharedOrLeased: 0,
      otherResidential: 0,
      sfrMedianList: null,
      sfrMedianN: 0,
    }
    return attachPace(
      base,
      input.overlays.get(overlayKey(def.slug)),
      input.paces.get(overlayKey(def.slug)) ?? { ...EMPTY_PUBLIC_PACE },
    )
  })
  return {
    published,
    asOfIso: inventory.asOfIso,
    asOfLabel: published ? asOfLabelFromIso(inventory.asOfIso) : null,
    headlineResidential: inventory.headlineResidential,
    headlineSfr: inventory.headlineSfr,
    towns,
    headlineTowns: towns.filter((t) => !t.footnote),
    footnoteTowns: towns.filter((t) => t.footnote),
  }
}

export function unpublishedOr(value: string | null | undefined): string {
  return value && value.trim() ? value : CELL_UNPUBLISHED
}
