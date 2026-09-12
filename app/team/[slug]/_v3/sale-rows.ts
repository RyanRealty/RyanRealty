/**
 * Map verified MLS closings onto V3Ledger rows. Prices are recorded ClosePrice
 * (formatPriceExact, not formatPrice, because formatPrice rounds to $1,000).
 * The brokerage feed keeps to Central Oregon zips (977); a broker's OWN
 * record is every MLS closing, wherever it stands, the same set the profile's
 * figures and map count (2026-09-02, C7).
 */

import { formatDate } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { publishCardAddress } from '@/lib/listing/publish-street-line'
import { displaySubdivision, listingTileHref } from '@/lib/slug'
import { v3Text, type V3LedgerFigureRow } from '@/components/site/v3'
import type { BrokerSaleTile, ListingTile } from '@/lib/data'
import type { PriceDropTile } from '@/lib/data/listings/getPriceDropTiles'

function inServiceArea(postal: string | null | undefined): boolean {
  return (postal ?? '').trim().startsWith('977')
}

function addressLine(tile: PriceDropTile): string {
  return (
    publishCardAddress({
      streetNumber: tile.StreetNumber,
      streetName: tile.StreetName,
      streetSuffix: tile.StreetSuffix,
      city: tile.City,
    }) || 'Address withheld'
  )
}

function soldWhen(closeDate: string | null | undefined, saleSide?: 'listed' | 'represented-buyer'): string {
  // A close date is a calendar day. The feed sends it as a UTC-midnight
  // timestamp, which formatDate's date-only guard does not catch, so
  // 2026-09-01 printed as Aug 2026 (evaluator pass two, C4).
  const day = closeDate ? closeDate.slice(0, 10) : ''
  const stamp = day ? formatDate(day, { month: 'short', day: undefined, year: 'numeric' }) : ''
  const verb = saleSide === 'represented-buyer' ? 'Bought' : 'Sold'
  if (!stamp || stamp === '\u2014') return verb
  return `${verb} ${stamp}`
}

export function brokerageTileToRow(tile: PriceDropTile, opts?: { anyArea?: boolean }): V3LedgerFigureRow | null {
  if (!tile.ListingKey) return null
  // The brokerage feed is a Central Oregon ledger; a broker's OWN record is
  // every closing on the MLS, wherever it stands, the same set the figures
  // and the map count (pass two, C7).
  if (!opts?.anyArea && !inServiceArea(tile.PostalCode)) return null
  const price = tile.ClosePrice ?? tile.ListPrice
  if (price == null || !(price > 0)) return null
  // City now lives in `what` (publishCardAddress). detail is the house row:
  // beds · baths · sqft, then subdivision — never the city again.
  const what = addressLine(tile)
  const sub = displaySubdivision(tile.SubdivisionName)
  const detailParts = [houseRowSpecs(tile), sub].filter((part): part is string => Boolean(part && part.trim()))
  const photo = (tile.PhotoURL ?? '').trim()
  return {
    href: listingTileHref({
      listingKey: tile.ListingKey,
      streetNumber: tile.StreetNumber,
      streetName: tile.StreetName,
      city: tile.City,
      subdivisionName: tile.SubdivisionName,
    }),
    when: v3Text(soldWhen(tile.CloseDate)),
    what: v3Text(what),
    detail: detailParts.length > 0 ? v3Text(detailParts.join(' · ')) : undefined,
    value: v3Text(formatPriceExact(price)),
    id: tile.ListingKey,
    media: photo ? { src: photo } : undefined,
  }
}

export function brokerSaleToRow(tile: BrokerSaleTile): V3LedgerFigureRow | null {
  const row = brokerageTileToRow(tile, { anyArea: true })
  if (!row) return null
  return {
    ...row,
    when: v3Text(soldWhen(tile.CloseDate, tile.saleSide)),
  }
}

/**
 * Published closings for a broker page: every MLS closing of the broker's,
 * the same set the record's figures and map count. Do not hide a closing
 * because the photo is missing.
 */
export function publishOwnClosingRows(brokerSales: BrokerSaleTile[]): V3LedgerFigureRow[] {
  return brokerSales
    .map(brokerSaleToRow)
    .filter((row): row is V3LedgerFigureRow => row !== null)
}

/**
 * PAGE_INVENTORY §6: four closings is thin. Do not print as a dashboard.
 * Personal Atlas / Ledger / Instrument only at or above this count.
 */
export const PERSONAL_RECORD_FLOOR = 5

export function hasRealPersonalRecord(count: number): boolean {
  return count >= PERSONAL_RECORD_FLOOR
}

/** Deduplicate MLS rows so a list-side + buy-side hit is one closing. */
export function uniqueListingTiles<T extends { ListingKey?: string | null }>(
  tiles: readonly T[],
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const tile of tiles) {
    const key = (tile.ListingKey ?? '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(tile)
  }
  return out
}

/** Newest firm closings for the shared house-row ledger on /about and /team/[slug]. */
export function publishFirmClosingRows(
  tiles: readonly PriceDropTile[],
  limit = 8,
): V3LedgerFigureRow[] {
  return uniqueListingTiles(tiles)
    .filter((t) => t.ClosePrice != null && (t.CloseDate != null || /clos|sold/i.test(t.StandardStatus ?? '')))
    .sort((a, b) => new Date(b.CloseDate ?? 0).getTime() - new Date(a.CloseDate ?? 0).getTime())
    .map((t) => brokerageTileToRow(t))
    .filter((row): row is V3LedgerFigureRow => row !== null)
    .slice(0, limit)
}

function houseRowSpecs(tile: PriceDropTile): string | null {
  const parts: string[] = []
  if (typeof tile.BedroomsTotal === 'number' && Number.isFinite(tile.BedroomsTotal)) {
    parts.push(`${Math.round(tile.BedroomsTotal)} bd`)
  }
  if (typeof tile.BathroomsTotal === 'number' && Number.isFinite(tile.BathroomsTotal)) {
    const baths = tile.BathroomsTotal
    const bathsLabel = Number.isInteger(baths) ? String(baths) : String(Math.round(baths * 10) / 10)
    parts.push(`${bathsLabel} ba`)
  }
  if (typeof tile.TotalLivingAreaSqFt === 'number' && tile.TotalLivingAreaSqFt > 0) {
    parts.push(`${Math.round(tile.TotalLivingAreaSqFt).toLocaleString('en-US')} sqft`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}


/** Active listings for a broker profile — existing house-row Ledger cards only. */
export function publishActiveListingRows(
  tiles: readonly ListingTile[],
  limit = 8,
): V3LedgerFigureRow[] {
  return tiles
    .filter((t) => t.listingKey && t.listPrice != null && Number(t.listPrice) > 0)
    .slice(0, limit)
    .map((tile): V3LedgerFigureRow | null => {
      const what =
        publishCardAddress({
          streetNumber: tile.streetNumber,
          streetName: tile.streetName,
          streetSuffix: tile.streetSuffix,
          city: tile.city,
        }) || 'Address withheld'
      const sub = displaySubdivision(tile.subdivisionName)
      const detailParts = [
        houseRowSpecsFromListing(tile),
        sub,
      ].filter((part): part is string => Boolean(part && part.trim()))
      const photo = (tile.photoUrl ?? '').trim()
      // SITE-52: the section heading is already "Active listings" — the DOM
      // count is the context line worth printing; a bare 'Active' with no DOM
      // would only repeat the heading, so the row carries no when at all.
      const when =
        typeof tile.dom === 'number' && Number.isFinite(tile.dom) && tile.dom >= 0
          ? `${Math.round(tile.dom)} DOM`
          : null
      return {
        href: listingTileHref({
          listingKey: tile.listingKey,
          streetNumber: tile.streetNumber,
          streetName: tile.streetName,
          city: tile.city,
          subdivisionName: tile.subdivisionName,
        }),
        ...(when ? { when: v3Text(when) } : {}),
        what: v3Text(what),
        detail: detailParts.length > 0 ? v3Text(detailParts.join(' · ')) : undefined,
        value: v3Text(formatPriceExact(Number(tile.listPrice))),
        id: tile.listingKey,
        media: photo ? { src: photo } : undefined,
      }
    })
    .filter((row): row is V3LedgerFigureRow => row !== null)
}

function houseRowSpecsFromListing(tile: ListingTile): string | null {
  const parts: string[] = []
  if (typeof tile.beds === 'number' && Number.isFinite(tile.beds)) {
    parts.push(`${Math.round(tile.beds)} bd`)
  }
  if (typeof tile.baths === 'number' && Number.isFinite(tile.baths)) {
    const baths = tile.baths
    const bathsLabel = Number.isInteger(baths) ? String(baths) : String(Math.round(baths * 10) / 10)
    parts.push(`${bathsLabel} ba`)
  }
  if (typeof tile.sqft === 'number' && tile.sqft > 0) {
    parts.push(`${Math.round(tile.sqft).toLocaleString('en-US')} sqft`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export function factualFallbackBio(opts: {
  displayName: string
  firstName: string
  closings: number
  phone: string | null
}): string {
  if (hasRealPersonalRecord(opts.closings)) {
    return `${opts.firstName} has closed ${opts.closings} homes across Central Oregon for buyers and sellers, and takes care of every client from the first conversation through closing.`
  }
  if (opts.phone) {
    return `${opts.displayName} is a local expert who helps buyers and sellers across Bend, Redmond, Sisters, and Sunriver. Call or text ${opts.phone}.`
  }
  return `${opts.displayName} is a local expert who helps buyers and sellers across Bend, Redmond, Sisters, and Sunriver.`
}

export const HEADSHOT: Record<string, string> = {
  'matthew-ryan': '/images/brokers/ryan-matt.png',
  'matt-ryan': '/images/brokers/ryan-matt.png',
  'paul-stevenson': '/images/brokers/stevenson-paul.png',
  'rebecca-peterson': '/images/brokers/peterson-rebecca.png',
  'rebecca-ryser-peterson': '/images/brokers/peterson-rebecca.png',
}
