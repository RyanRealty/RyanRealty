/**
 * Live photographed SFR homes for the affordable lead — Parkside, Calaveras,
 * Easton, in that order. Snapshot bands stay in bend-new-construction.ts.
 * This file only turns DAL tiles into rail cards. Townhouses are excluded.
 */
import { attachListingCardExtras } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import { homeRailRows, enrichHomeRailRows, type HomeRailCard } from '@/app/_v3/home-rail-items'
import {
  BEND_NEW_CON_SEARCH_HREF,
  BEND_NEW_CON_STAGE_FALLBACK_POSTER,
  bendNewConSearchHref,
  bendNewConSeeHomesLabel,
  type NewConInventoryRow,
} from '@/lib/site/bend-new-construction'
import type { BendNewConLiveMatch } from './load-live-matches'

export type NewConLeadBand = {
  key: string
  label: string
  row: NewConInventoryRow
  href: string
  seeHomesLabel: string
  liveCount: number | null
  cards: HomeRailCard[]
}

export type NewConLeadShelfData = {
  posterSrc: string
  bands: NewConLeadBand[]
}

const LEAD_CHIP: Record<string, string> = {
  'Parkside Place Phase 1': 'Parkside',
  Calaveras: 'Calaveras',
  Easton: 'Easton',
}

function leadLabel(row: NewConInventoryRow): string {
  return LEAD_CHIP[row.name] ?? row.name
}

export async function buildNewConLeadShelf(
  leads: readonly NewConInventoryRow[],
  tilesByName: readonly (readonly ListingTile[])[],
  matches: readonly BendNewConLiveMatch[] = [],
): Promise<NewConLeadShelfData> {

  const allTiles = tilesByName.flat()
  const rail = homeRailRows(allTiles, {
    nowMs: Date.now(),
    regionalHref: BEND_NEW_CON_SEARCH_HREF,
    bendHref: BEND_NEW_CON_SEARCH_HREF,
    priceCutsHref: '/price-drops',
    newHref: '/homes-for-sale/bend?newConstruction=1&sort=newest',
  })
  const keys = rail.flatMap((row) => row.cards.map((card) => card.listingKey))
  const extras = await attachListingCardExtras(keys).catch(() => new Map())
  const enriched = enrichHomeRailRows(rail, extras)
  const byKey = new Map(enriched.flatMap((row) => row.cards.map((card) => [card.listingKey, card])))

  const bands: NewConLeadBand[] = leads.map((row, i) => {
    const cards = (tilesByName[i] ?? [])
      .filter((tile) => tile.propertySubType === 'Single Family Residence')
      .map((tile) => byKey.get(tile.listingKey))
      .filter((card): card is HomeRailCard => Boolean(card))
    const live = matches[i]
    return {
      key: row.name,
      label: leadLabel(row),
      row,
      href: live?.href ?? bendNewConSearchHref(row.name),
      seeHomesLabel: bendNewConSeeHomesLabel(live?.count),
      liveCount: live?.count ?? null,
      cards,
    }
  })

  const firstPhoto =
    bands.flatMap((band) => band.cards).find((card) => card.photoUrls[0])?.photoUrls[0] ??
    BEND_NEW_CON_STAGE_FALLBACK_POSTER

  return { posterSrc: firstPhoto, bands }
}
