/**
 * Recently sold (6 mo) table for /communities/[slug].
 *
 * Pure: the page fetches closed tiles through getListingTiles (DAL). This
 * module keeps a row only when the MLS recorded a close date inside the
 * window, a close price, and an address. A miss omits the row. An empty
 * set omits the table. Nothing here invents a sale or a dollar (§0).
 */

import { v3Text, type V3LedgerFigureRow } from '@/components/site/v3'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatCalendarDay, zonedDateKey } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { listingTileHref } from '@/lib/slug'
import { publishStreetLine } from '@/lib/listing/publish-street-line'

export const COMMUNITY_SOLD_WINDOW_MONTHS = 6
export const COMMUNITY_SOLD_TABLE_CAP = 40
/** Own names plus a few child plats. The neighborhood query carries the rest. */
export const COMMUNITY_SOLD_ALIAS_CAP = 8

export function communitySoldAliasList(aliases: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const alias of aliases) {
    const name = alias.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length >= COMMUNITY_SOLD_ALIAS_CAP) break
  }
  return out
}

export type CommunitySoldRow = {
  listingKey: string
  href: string
  address: string
  closePriceLabel: string
  closeDateLabel: string
  closeDay: string
  detail: string | null
  photoSrc: string | null
}

export function communitySoldWindowStart(asOf: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(asOf)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  const shifted = new Date(Date.UTC(year, month - 1 - COMMUNITY_SOLD_WINDOW_MONTHS, day, 12, 0, 0))
  return zonedDateKey(shifted)
}

export function tileMatchesCommunityName(
  subdivisionName: string | null | undefined,
  aliases: readonly string[],
): boolean {
  const sub = subdivisionName?.trim().toLowerCase()
  if (!sub) return false
  return aliases.some((alias) => {
    const name = alias.trim().toLowerCase()
    return Boolean(name) && (sub === name || sub.includes(name) || name.includes(sub))
  })
}

function closeDay(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const day = value.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

function soldDetail(tile: ListingTile): string | null {
  const parts = [
    tile.beds != null ? `${tile.beds} bd` : null,
    tile.baths != null ? `${tile.baths} ba` : null,
    tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

export function communitySoldRows(input: {
  tiles: readonly ListingTile[]
  aliases: readonly string[]
  windowStart: string
  windowEnd: string
}): CommunitySoldRow[] {
  const start = input.windowStart.trim()
  const end = input.windowEnd.trim()
  if (!start || !end) return []

  const seen = new Set<string>()
  const rows: CommunitySoldRow[] = []
  for (const tile of input.tiles) {
    if (!tile.listingKey || seen.has(tile.listingKey)) continue
    if (!tileMatchesCommunityName(tile.subdivisionName, input.aliases)) continue
    const day = closeDay(tile.closeDate)
    if (!day || day < start || day > end) continue
    if (tile.closePrice == null || !Number.isFinite(tile.closePrice) || tile.closePrice <= 0) continue
    const price = formatPriceExact(tile.closePrice)
    if (!price.startsWith('$')) continue
    const address =
      publishStreetLine({
        streetNumber: tile.streetNumber,
        streetDirPrefix: tile.streetDirPrefix,
        streetName: tile.streetName,
        streetSuffix: tile.streetSuffix,
        streetDirSuffix: tile.streetDirSuffix,
      }) ?? tile.listNumber
    if (!address?.trim()) continue
    const when = formatCalendarDay(day)
    if (!when) continue
    seen.add(tile.listingKey)
    rows.push({
      listingKey: tile.listingKey,
      href: listingTileHref(tile),
      address: address.trim(),
      closePriceLabel: price,
      closeDateLabel: when,
      closeDay: day,
      detail: soldDetail(tile),
      photoSrc: tile.photoUrl?.trim() || null,
    })
  }
  return rows
    .sort((a, b) => b.closeDay.localeCompare(a.closeDay) || a.address.localeCompare(b.address))
    .slice(0, COMMUNITY_SOLD_TABLE_CAP)
}

export function communitySoldLedgerRows(
  rows: readonly CommunitySoldRow[],
): readonly [V3LedgerFigureRow, ...V3LedgerFigureRow[]] | null {
  const first = rows[0]
  if (!first) return null
  const mapped = rows.map((row) => ({
    id: row.listingKey,
    href: row.href,
    what: v3Text(row.address),
    value: v3Text(row.closePriceLabel),
    when: v3Text(row.closeDateLabel),
    detail: row.detail ? v3Text(row.detail) : undefined,
    media: row.photoSrc ? { src: row.photoSrc } : undefined,
  }))
  return [mapped[0]!, ...mapped.slice(1)]
}
