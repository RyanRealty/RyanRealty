/**
 * Tile → stacked home carousel card props.
 *
 * Honesty: a tile earns a card when it has a price, a street, and a live MLS
 * photo. Badges come only from publishListingCardBadges (kinds we already
 * encode), including open-house labels from the same Field path. No fake
 * personalization labels on the rails themselves.
 */
import type { ListingTile } from '@/lib/data/types/listing'
import { REPORT_CITY_LABELS } from '@/lib/data/geo/report-cities'
import {
  publishListingCardBadges,
  publishListingDropBadge,
} from '@/lib/listing/publish-listing-card-badges'
import { publishCardAddress, publishStreetLine } from '@/lib/listing/publish-street-line'
import { LISTING_FIELD_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { listingTileHref } from '@/lib/slug'
import type { V3ListingRowBadge, V3ListingRowData } from '@/components/site/v3'
import type {
  ListingCardExtras,
  ListingCardPriceDrop,
} from '@/lib/data/listings/attachListingCardExtras'

export type HomeRailCard = {
  listingKey: string
  href: string
  photoUrls: string[]
  price: number | null
  addressLine: string
  cityLine: string
  beds: number | null
  baths: number | null
  sqft: number | null
  pricePerSqft: number | null
  propertyType: string | null
  propertySubType: string | null
  subdivisionName: string | null
  city: string | null
  listNumber: string | null
  badges: Array<{ kind: V3ListingRowBadge; label: string }>
  hasTour: boolean
  tourUrl: string | null
  tourLabel: string
  statusLabel: string | null
}

const BEND_AREA = new Set(
  REPORT_CITY_LABELS.map((s) => s.toLowerCase()),
)

const NEW_WINDOW_DAYS = 7
const RAIL_CARD_CAP = 12

function isPhotographedPriced(tile: ListingTile): boolean {
  if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) return false
  if (!tile.photoUrl || tile.photoUrl.trim().length === 0) return false
  const street = publishStreetLine({
    streetNumber: tile.streetNumber,
    streetName: tile.streetName,
    streetSuffix: tile.streetSuffix,
  })
  return Boolean(street)
}

function statusLabel(status: ListingTile['status']): string | null {
  const t = String(status ?? '').toLowerCase()
  if (t.includes('pending') || t.includes('under contract')) return 'Pending'
  if (t.includes('closed') || t.includes('sold')) return 'Sold'
  return null
}

function currentDrop(
  tile: ListingTile,
  drops: ReadonlyMap<string, ListingCardPriceDrop>,
): ListingCardPriceDrop | null {
  const drop = drops.get(tile.listingKey)
  if (!drop || tile.listPrice == null || !Number.isFinite(tile.listPrice)) return null
  if (drop.previousPrice <= tile.listPrice) return null
  return drop
}

function toCard(
  tile: ListingTile,
  nowMs: number,
  openHouseLabels: Record<string, string>,
  priceDrops: ReadonlyMap<string, ListingCardPriceDrop>,
): HomeRailCard | null {
  if (!isPhotographedPriced(tile)) return null
  const street = publishStreetLine({
    streetNumber: tile.streetNumber,
    streetName: tile.streetName,
    streetSuffix: tile.streetSuffix,
  })
  if (!street) return null

  const drop = currentDrop(tile, priceDrops)
  const badges = publishListingCardBadges({
    nowMs,
    standardStatus: tile.status,
    onMarketDate: tile.onMarketDate,
    listPrice: tile.listPrice,
    originalListPrice: drop?.previousPrice ?? null,
    priceDropAmount: drop ? drop.previousPrice - tile.listPrice! : null,
    lastPriceChangeTimestamp: drop?.at ?? null,
    hasVirtualTour: tile.hasVirtualTour,
    hasTourUrl: Boolean(tile.tourUrl),
    openHouseLabel: openHouseLabels[tile.listingKey] ?? null,
  })

  const cityLine = [tile.city?.trim(), tile.postalCode?.trim()].filter(Boolean).join(' ')

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
    statusLabel: statusLabel(tile.status),
  }
}

function takeCards(
  tiles: readonly ListingTile[],
  nowMs: number,
  openHouseLabels: Record<string, string>,
  priceDrops: ReadonlyMap<string, ListingCardPriceDrop>,
  limit = RAIL_CARD_CAP,
  /** Keys a more specific shelf already claimed. A house leads one shelf. */
  taken: ReadonlySet<string> = new Set(),
): HomeRailCard[] {
  const out: HomeRailCard[] = []
  const seen = new Set<string>()
  for (const tile of tiles) {
    if (out.length >= limit) break
    if (seen.has(tile.listingKey)) continue
    if (taken.has(tile.listingKey)) continue
    const card = toCard(tile, nowMs, openHouseLabels, priceDrops)
    if (!card) continue
    seen.add(tile.listingKey)
    out.push(card)
  }
  return out
}

export type HomeRailRow = {
  id: string
  heading: string
  /** Omitted when the rail already holds every listing it could link to. */
  seeAll?: { href: string; label: string }
  /** A short line under the heading, e.g. "3 for sale" on a place page. */
  countLabel?: string
  /**
   * Cards whose first photo loads eagerly. Defaults to 2, right for a rail
   * near the top of the page; a rail far down (a place page's inventory)
   * passes 0 so it does not compete with the fold.
   */
  priorityCount?: number
  cards: HomeRailCard[]
}

/**
 * A place page's inventory row as a rail card (Matt 2026-09-23: "carousels of
 * all available property types" on subdivision pages). Unlike the homepage
 * shelves, a place rail keeps every listing it is given: an unphotographed or
 * unpriced listing is still for sale in that place, so it shows with an empty
 * frame or "Price not published" instead of vanishing from the count above it.
 */
export function railCardFromListingRow(row: V3ListingRowData): HomeRailCard {
  const photo = row.photoUrl?.trim()
  return {
    listingKey: row.listingKey,
    href: row.href,
    photoUrls: photo ? [listingRowPhotoSrc(photo, LISTING_FIELD_LEAD_PHOTO_SIZE)] : [],
    price: row.price,
    addressLine: row.addressLine,
    cityLine: row.cityLine,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    pricePerSqft: row.pricePerSqft ?? null,
    propertyType: row.propertyType,
    propertySubType: row.propertySubType,
    subdivisionName: row.subdivisionName,
    city: row.city,
    listNumber: row.listNumber,
    badges: row.badges ?? (row.badge ? [row.badge] : []),
    hasTour: row.hasTour ?? Boolean(row.tourUrl),
    tourUrl: row.tourUrl?.trim() || null,
    tourLabel: '3D Walkthrough',
    statusLabel: row.statusLabel ?? null,
  }
}

/**
 * Build stacked rails from one active tile pool. Rows that cannot fill at
 * least three honest cards are omitted (no lonely two-card shelf).
 */
export function homeRailRows(
  tiles: readonly ListingTile[],
  opts: {
    nowMs: number
    regionalHref: string
    bendHref: string
    priceCutsHref: string
    newHref: string
    openHouseLabels?: Record<string, string>
    /** Latest current activity_events price drops. Stale tile.priceDropCount is not a drop. */
    priceDrops?: ReadonlyMap<string, ListingCardPriceDrop>
  },
): HomeRailRow[] {
  const openHouseLabels = opts.openHouseLabels ?? {}
  const priceDrops = opts.priceDrops ?? new Map()

  // ONE HOUSE, ONE SHELF (2026-09-08 evaluator: 3027 Polarstar Avenue led both
  // the nearby rail and the price-cuts rail, so the page opened with the same
  // photograph twice). The narrower claim wins the house: a price cut is a
  // fact about that listing, "near Bend" is true of hundreds. So the specific
  // shelves are built first and the local shelf is built from what is left —
  // it draws from the whole active pool and loses nothing but the repeats.
  const cuts = takeCards(
    tiles.filter((t) => currentDrop(t, priceDrops) != null),
    opts.nowMs,
    openHouseLabels,
    priceDrops,
  )
  const cutKeys = new Set(cuts.map((c) => c.listingKey))

  const fresh = takeCards(
    tiles.filter((t) => {
      if (!t.onMarketDate) return false
      const days = (opts.nowMs - new Date(t.onMarketDate).getTime()) / 86_400_000
      return Number.isFinite(days) && days >= 0 && days <= NEW_WINDOW_DAYS
    }),
    opts.nowMs,
    openHouseLabels,
    priceDrops,
    RAIL_CARD_CAP,
    cutKeys,
  )

  const claimed = new Set([...cutKeys, ...fresh.map((c) => c.listingKey)])
  const bendArea = tiles.filter((t) => BEND_AREA.has((t.city ?? '').trim().toLowerCase()))
  const localPool = bendArea.length >= 3 ? bendArea : tiles
  const deduped = takeCards(localPool, opts.nowMs, openHouseLabels, priceDrops, RAIL_CARD_CAP, claimed)
  // The lead shelf is the one that may not go missing. The live pool is 3,000
  // tiles (HOME_TILE_FETCH) against at most 24 claimed keys, so the exclusion
  // never bites there; on a pool small enough that it does, a repeated house
  // beats no shelf at all, and the page says so by having one rail instead of
  // three.
  const local =
    deduped.length >= 3
      ? deduped
      : takeCards(localPool, opts.nowMs, openHouseLabels, priceDrops)

  const rows: HomeRailRow[] = []
  if (local.length >= 3) {
    rows.push({
      id: 'homes-local',
      heading: bendArea.length >= 3 ? 'Homes in Bend and nearby' : 'Homes for sale',
      seeAll: {
        href: bendArea.length >= 3 ? opts.bendHref : opts.regionalHref,
        label: 'See all homes',
      },
      cards: local,
    })
  }

  if (cuts.length >= 3) {
    rows.push({
      id: 'homes-price-cuts',
      heading: 'Price cuts',
      seeAll: { href: opts.priceCutsHref, label: 'See price cuts' },
      cards: cuts,
    })
  }

  if (fresh.length >= 3) {
    // The old near-duplicate guard here (skip this row when 80% of it already
    // led the local rail) is gone: the shelves are disjoint by construction
    // now, so the overlap it measured is always zero.
    rows.push({
      id: 'homes-new',
      heading: 'New this week',
      seeAll: { href: opts.newHref, label: 'See new listings' },
      cards: fresh,
    })
  }

  // Always ship at least one rail when any photographed inventory exists.
  if (rows.length === 0 && local.length > 0) {
    rows.push({
      id: 'homes-local',
      heading: 'Homes for sale',
      seeAll: { href: opts.regionalHref, label: 'See all homes' },
      cards: local,
    })
  }

  return rows
}

/** Merge Field/search card extras onto rail cards (full photo stack + tour URL). */
export function enrichHomeRailRows(
  rows: HomeRailRow[],
  extras: Map<string, ListingCardExtras>,
): HomeRailRow[] {
  if (extras.size === 0) return rows
  const mapped = rows.map((row) => ({
    ...row,
    cards: row.cards.map((card) => {
      const extra = extras.get(card.listingKey)
      if (!extra) return card
      const photoUrls = extra.photoUrls.length > 0 ? extra.photoUrls : card.photoUrls
      const tourUrl = (extra.tourUrl?.trim() || card.tourUrl) ?? null
      const hasTour = card.hasTour || Boolean(tourUrl)
      let tourLabel = card.tourLabel
      if (tourUrl) {
        const lower = tourUrl.toLowerCase()
        const mp4 = /\.mp4(\?|$)/.test(lower)
        if (mp4 && !lower.includes('matterport') && !lower.includes('view-imx')) {
          tourLabel = 'Video tour'
        }
      }
      const drop =
        extra.priceDrop &&
        card.price != null &&
        Number.isFinite(card.price) &&
        extra.priceDrop.previousPrice > card.price
          ? extra.priceDrop
          : null
      const dropLabel = drop
        ? publishListingDropBadge({
            lastPriceChangeTimestamp: drop.at,
            priceDropAmount: drop.previousPrice - card.price!,
            listPrice: card.price,
            originalListPrice: drop.previousPrice,
          })
        : null
      const badges = card.badges.filter((b) => b.kind !== 'drop')
      if (dropLabel) {
        const videoIdx = badges.findIndex((b) => b.kind === 'video')
        const next = { kind: 'drop' as const, label: dropLabel }
        if (videoIdx >= 0) badges.splice(videoIdx, 0, next)
        else badges.push(next)
      }
      return {
        ...card,
        photoUrls,
        tourUrl,
        hasTour,
        tourLabel,
        badges: badges.slice(0, 3),
      }
    }),
  }))
  return mapped
    .map((row) =>
      row.id === 'homes-price-cuts'
        ? { ...row, cards: row.cards.filter((c) => c.badges.some((b) => b.kind === 'drop')) }
        : row,
    )
    .filter((row) => row.id !== 'homes-price-cuts' || row.cards.length >= 3)
}
