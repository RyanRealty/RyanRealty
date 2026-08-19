/**
 * Map verified MLS closings onto V3Ledger rows. Prices are recorded ClosePrice
 * (formatPriceExact, not formatPrice, because formatPrice rounds to $1,000).
 * Out-of-area zips (not 977) are dropped so a Central Oregon claim is not
 * sitting next to an Ashland closing (design-audit #171).
 */

import { formatDate } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { displaySubdivision, listingTileHref } from '@/lib/slug'
import { v3Text, type V3LedgerFigureRow } from '@/components/site/v3'
import type { BrokerSaleTile } from '@/lib/data'
import type { PriceDropTile } from '@/lib/data/listings/getPriceDropTiles'

function inServiceArea(postal: string | null | undefined): boolean {
  return (postal ?? '').trim().startsWith('977')
}

function addressLine(tile: PriceDropTile): string {
  return (
    publishStreetLine({
      streetNumber: tile.StreetNumber,
      streetName: tile.StreetName,
      streetSuffix: tile.StreetSuffix,
    }) || 'Address withheld'
  )
}

function soldWhen(closeDate: string | null | undefined, saleSide?: 'listed' | 'represented-buyer'): string {
  const stamp = closeDate ? formatDate(closeDate, { month: 'short', day: undefined, year: 'numeric' }) : ''
  const verb = saleSide === 'represented-buyer' ? 'Bought' : 'Sold'
  if (!stamp || stamp === '\u2014') return verb
  return `${verb} ${stamp}`
}

export function brokerageTileToRow(tile: PriceDropTile): V3LedgerFigureRow | null {
  if (!tile.ListingKey || !inServiceArea(tile.PostalCode)) return null
  const price = tile.ClosePrice ?? tile.ListPrice
  if (price == null || !(price > 0)) return null
  const what = addressLine(tile)
  const city = (tile.City ?? '').trim()
  const sub = displaySubdivision(tile.SubdivisionName)
  const detailParts = [city, sub].filter((part): part is string => Boolean(part && part.trim()))
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
    detail: detailParts.length > 0 ? v3Text(detailParts.join(', ')) : undefined,
    value: v3Text(formatPriceExact(price)),
    id: tile.ListingKey,
    media: photo ? { src: photo } : undefined,
  }
}

export function brokerSaleToRow(tile: BrokerSaleTile): V3LedgerFigureRow | null {
  const row = brokerageTileToRow(tile)
  if (!row) return null
  return {
    ...row,
    when: v3Text(soldWhen(tile.CloseDate, tile.saleSide)),
  }
}

/**
 * Published closings for a broker page. Count and ledger rows are the same
 * set: 977-zip sales that map to a row. Do not hide a closing because the
 * photo is missing, and do not slice the ledger below the published count.
 */
export function publishOwnClosingRows(brokerSales: BrokerSaleTile[]): V3LedgerFigureRow[] {
  return brokerSales
    .map(brokerSaleToRow)
    .filter((row): row is V3LedgerFigureRow => row !== null)
}

export function factualFallbackBio(opts: {
  displayName: string
  firstName: string
  closings: number
  phone: string | null
}): string {
  if (opts.closings > 0) {
    return `${opts.firstName} has closed ${opts.closings} homes across Central Oregon, for both buyers and sellers.`
  }
  if (opts.phone) {
    return `${opts.displayName} works with buyers and sellers across Bend, Redmond, Sisters, and Sunriver. Call or text ${opts.phone}.`
  }
  return `${opts.displayName} works with buyers and sellers across Bend, Redmond, Sisters, and Sunriver.`
}

export const HEADSHOT: Record<string, string> = {
  'matthew-ryan': '/images/brokers/ryan-matt.png',
  'matt-ryan': '/images/brokers/ryan-matt.png',
  'paul-stevenson': '/images/brokers/stevenson-paul.png',
  'rebecca-peterson': '/images/brokers/peterson-rebecca.png',
  'rebecca-ryser-peterson': '/images/brokers/peterson-rebecca.png',
}
