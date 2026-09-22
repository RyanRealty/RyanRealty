/**
 * Photographed live Bend-proper new-construction homes for the market shelf.
 * Snapshot bands stay in bend-new-construction.ts. This file turns DAL tiles
 * into rail cards and attaches per-home concessions from public remarks or
 * the named builder page. Public remarks only.
 */
import { attachListingCardExtras, getListingDetail } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import type { HomeRailCard } from '@/app/_v3/home-rail-items'
import { publishListingCardBadges } from '@/lib/listing/publish-listing-card-badges'
import { publishCardAddress, publishStreetLine } from '@/lib/listing/publish-street-line'
import { LISTING_FIELD_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { listingTileHref } from '@/lib/slug'
import { publishListingSaleAsk } from '@/lib/listing/publish-listing-ask'
import {
  BEND_NEW_CON_STAGE_FALLBACK_POSTER,
  bendNewConHomeConcession,
  type NewConHomeConcession,
} from '@/lib/site/bend-new-construction'
import type { BendNewConLiveMarket } from './load-live-market'

export type NewConHomeCard = HomeRailCard & {
  builderName: string | null
  concession: NewConHomeConcession | null
}

export type NewConLeadShelfData = {
  posterSrc: string
  cards: NewConHomeCard[]
}

const MARKET_CARD_CAP = 24

function isPhotographedPriced(tile: ListingTile): boolean {
  if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) return false
  if (!publishListingSaleAsk({ price: tile.listPrice, propertyType: tile.propertyType })) return false
  if (!tile.photoUrl || tile.photoUrl.trim().length === 0) return false
  const street = publishStreetLine({
    streetNumber: tile.streetNumber,
    streetName: tile.streetName,
    streetSuffix: tile.streetSuffix,
  })
  return Boolean(street)
}

function tileToCard(tile: ListingTile): HomeRailCard | null {
  if (!isPhotographedPriced(tile)) return null
  const street = publishStreetLine({
    streetNumber: tile.streetNumber,
    streetName: tile.streetName,
    streetSuffix: tile.streetSuffix,
  })
  if (!street) return null
  const cityLine = [tile.city?.trim(), tile.postalCode?.trim()].filter(Boolean).join(' ')
  const badges = publishListingCardBadges({
    nowMs: Date.now(),
    standardStatus: tile.status,
    onMarketDate: tile.onMarketDate,
    listPrice: tile.listPrice,
    originalListPrice: null,
    priceDropAmount: null,
    lastPriceChangeTimestamp: null,
    hasVirtualTour: tile.hasVirtualTour,
    hasTourUrl: Boolean(tile.tourUrl),
    openHouseLabel: null,
  })
  return {
    listingKey: tile.listingKey,
    href: listingTileHref(tile),
    photoUrls: [listingRowPhotoSrc(tile.photoUrl!.trim(), LISTING_FIELD_LEAD_PHOTO_SIZE)],
    price: tile.listPrice,
    addressLine: street,
    cityLine:
      cityLine ||
      publishCardAddress({
        streetNumber: tile.streetNumber,
        streetName: tile.streetName,
        streetSuffix: tile.streetSuffix,
        city: tile.city,
      }),
    beds: tile.beds,
    baths: tile.baths,
    sqft: tile.sqft,
    pricePerSqft: tile.pricePerSqft,
    propertyType: tile.propertyType,
    propertySubType: tile.propertySubType,
    subdivisionName: tile.subdivisionName,
    city: tile.city,
    listNumber: tile.listNumber,
    badges,
    hasTour: tile.hasVirtualTour === true || Boolean(tile.tourUrl),
    tourUrl: tile.tourUrl?.trim() || null,
    tourLabel: '3D Walkthrough',
    statusLabel: null,
  }
}

async function loadPublicFacts(
  keys: readonly string[],
): Promise<Map<string, { builderName: string | null; publicRemarks: string | null }>> {
  const out = new Map<string, { builderName: string | null; publicRemarks: string | null }>()
  const unique = [...new Set(keys)]
  const details = await Promise.all(
    unique.map(async (key) => {
      try {
        const detail = await getListingDetail(key)
        return { key, detail }
      } catch (err) {
        console.error('[loadPublicFacts]', key, err)
        return { key, detail: null }
      }
    }),
  )
  for (const { key, detail } of details) {
    if (!detail) continue
    out.set(key, {
      builderName: detail.builderName ?? null,
      publicRemarks: detail.publicRemarks ?? null,
    })
  }
  return out
}

export async function buildNewConMarketShelf(
  market: BendNewConLiveMarket,
): Promise<NewConLeadShelfData> {
  const priced = market.bendTiles
    .filter(isPhotographedPriced)
    .slice()
    .sort((a, b) => (a.listPrice ?? 0) - (b.listPrice ?? 0))

  const seen = new Set<string>()
  const baseCards: HomeRailCard[] = []
  for (const tile of priced) {
    if (baseCards.length >= MARKET_CARD_CAP) break
    if (seen.has(tile.listingKey)) continue
    const card = tileToCard(tile)
    if (!card) continue
    seen.add(tile.listingKey)
    baseCards.push(card)
  }

  const keys = baseCards.map((card) => card.listingKey)
  const extras = await attachListingCardExtras(keys).catch(() => new Map())
  const merged = baseCards.map((card) => {
    const extra = extras.get(card.listingKey)
    return {
      ...card,
      photoUrls: extra?.photoUrls && extra.photoUrls.length > 0 ? extra.photoUrls : card.photoUrls,
      tourUrl: extra?.tourUrl ?? card.tourUrl,
      hasTour: Boolean(extra?.tourUrl) || card.hasTour,
    }
  })

  const facts = await loadPublicFacts(merged.map((card) => card.listingKey))
  const cards: NewConHomeCard[] = merged.map((card) => {
    const fact = facts.get(card.listingKey)
    return {
      ...card,
      builderName: fact?.builderName ?? null,
      concession: bendNewConHomeConcession({
        subdivisionName: card.subdivisionName,
        builderName: fact?.builderName ?? null,
        publicRemarks: fact?.publicRemarks ?? null,
      }),
    }
  })

  const firstPhoto =
    cards.find((card) => card.photoUrls[0])?.photoUrls[0] ?? BEND_NEW_CON_STAGE_FALLBACK_POSTER

  return { posterSrc: firstPhoto, cards }
}
