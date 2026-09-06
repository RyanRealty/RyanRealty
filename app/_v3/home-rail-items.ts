/**
 * Tile → stacked home carousel card props.
 *
 * Honesty: a tile earns a card when it has a price, a street, and a live MLS
 * photo. Badges come only from publishListingCardBadges (kinds we already
 * encode). No fake personalization labels on the rails themselves.
 */
import type { ListingTile } from '@/lib/data/types/listing'
import { publishListingCardBadges } from '@/lib/listing/publish-listing-card-badges'
import { publishCardAddress, publishStreetLine } from '@/lib/listing/publish-street-line'
import { listingDetailPath } from '@/lib/slug'
import type { V3ListingRowBadge } from '@/components/site/v3'

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
  tourLabel: string
  statusLabel: string | null
}

const BEND_AREA = new Set(
  ['bend', 'redmond', 'sisters', 'sunriver', 'la pine', 'terrebonne', 'tumalo'].map((s) =>
    s.toLowerCase(),
  ),
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

function toCard(tile: ListingTile, nowMs: number): HomeRailCard | null {
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
    tourLabel: '3D Walkthrough',
    statusLabel: statusLabel(tile.status),
  }
}

function takeCards(tiles: readonly ListingTile[], nowMs: number, limit = RAIL_CARD_CAP): HomeRailCard[] {
  const out: HomeRailCard[] = []
  const seen = new Set<string>()
  for (const tile of tiles) {
    if (out.length >= limit) break
    if (seen.has(tile.listingKey)) continue
    const card = toCard(tile, nowMs)
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
  },
): HomeRailRow[] {
  const bendArea = tiles.filter((t) => BEND_AREA.has((t.city ?? '').trim().toLowerCase()))
  const localPool = bendArea.length >= 3 ? bendArea : tiles
  const local = takeCards(localPool, opts.nowMs)

  const cuts = takeCards(
    tiles.filter((t) => (t.priceDropCount ?? 0) > 0),
    opts.nowMs,
  )

  const fresh = takeCards(
    tiles.filter((t) => {
      if (!t.onMarketDate) return false
      const days = (opts.nowMs - new Date(t.onMarketDate).getTime()) / 86_400_000
      return Number.isFinite(days) && days >= 0 && days <= NEW_WINDOW_DAYS
    }),
    opts.nowMs,
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
