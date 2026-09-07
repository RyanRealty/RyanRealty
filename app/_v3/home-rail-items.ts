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
import { publishListingCardBadges } from '@/lib/listing/publish-listing-card-badges'
import { publishCardAddress, publishStreetLine } from '@/lib/listing/publish-street-line'
import { listingDetailPath } from '@/lib/slug'
import type { V3ListingRowBadge } from '@/components/site/v3'
import type { ListingCardExtras } from '@/lib/data/listings/attachListingCardExtras'

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

function toCard(
  tile: ListingTile,
  nowMs: number,
  openHouseLabels: Record<string, string>,
): HomeRailCard | null {
  if (!isPhotographedPriced(tile)) return null
  const street = publishStreetLine({
    streetNumber: tile.streetNumber,
    streetName: tile.streetName,
    streetSuffix: tile.streetSuffix,
  })
  if (!street) return null

  const badges = publishListingCardBadges({
    nowMs,
    standardStatus: tile.status,
    onMarketDate: tile.onMarketDate,
    priceDropCount: tile.priceDropCount,
    hasVirtualTour: tile.hasVirtualTour,
    hasTourUrl: Boolean(tile.tourUrl),
    openHouseLabel: openHouseLabels[tile.listingKey] ?? null,
  })

  const cityLine = [tile.city?.trim(), tile.postalCode?.trim()].filter(Boolean).join(' ')

  return {
    listingKey: tile.listingKey,
    href: listingDetailPath(
      tile.listingKey,
      { streetNumber: tile.streetNumber, streetName: tile.streetName, city: tile.city },
      { city: tile.city, subdivision: tile.subdivisionName },
      { mlsNumber: tile.listNumber },
    ),
    photoUrls: [tile.photoUrl!.trim()],
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
  limit = RAIL_CARD_CAP,
): HomeRailCard[] {
  const out: HomeRailCard[] = []
  const seen = new Set<string>()
  for (const tile of tiles) {
    if (out.length >= limit) break
    if (seen.has(tile.listingKey)) continue
    const card = toCard(tile, nowMs, openHouseLabels)
    if (!card) continue
    seen.add(tile.listingKey)
    out.push(card)
  }
  return out
}

export type HomeRailRow = {
  id: string
  heading: string
  seeAll: { href: string; label: string }
  cards: HomeRailCard[]
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
  },
): HomeRailRow[] {
  const openHouseLabels = opts.openHouseLabels ?? {}
  const bendArea = tiles.filter((t) => BEND_AREA.has((t.city ?? '').trim().toLowerCase()))
  const localPool = bendArea.length >= 3 ? bendArea : tiles
  const local = takeCards(localPool, opts.nowMs, openHouseLabels)

  const cuts = takeCards(
    tiles.filter((t) => (t.priceDropCount ?? 0) > 0),
    opts.nowMs,
    openHouseLabels,
  )

  const fresh = takeCards(
    tiles.filter((t) => {
      if (!t.onMarketDate) return false
      const days = (opts.nowMs - new Date(t.onMarketDate).getTime()) / 86_400_000
      return Number.isFinite(days) && days >= 0 && days <= NEW_WINDOW_DAYS
    }),
    opts.nowMs,
    openHouseLabels,
  )

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
    // Avoid a near-duplicate of the local rail when the same newest set won both.
    const localKeys = new Set(local.map((c) => c.listingKey))
    const overlap = fresh.filter((c) => localKeys.has(c.listingKey)).length
    if (overlap < fresh.length * 0.8 || rows.length === 0) {
      rows.push({
        id: 'homes-new',
        heading: 'New this week',
        seeAll: { href: opts.newHref, label: 'See new listings' },
        cards: fresh,
      })
    }
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
  return rows.map((row) => ({
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
      return { ...card, photoUrls, tourUrl, hasTour, tourLabel }
    }),
  }))
}
