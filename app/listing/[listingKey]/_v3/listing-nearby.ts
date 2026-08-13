import { v3Text, type V3LedgerFigureRow, type V3QuietItem } from '@/components/site/v3'
import { formatPrice } from '@/lib/format/money'
import { listingTileHref, slugify } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import type { ListingTile } from '@/lib/data/types/listing'

function streetLine(tile: ListingTile): string {
  return [tile.streetNumber, tile.streetName, tile.streetSuffix].filter(Boolean).join(' ').trim()
}

export function listingSimilarLedgerRows(tiles: ListingTile[]): V3LedgerFigureRow[] {
  const rows: V3LedgerFigureRow[] = []
  for (const tile of tiles) {
    const street = streetLine(tile)
    if (!street) continue
    if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) continue
    const price = formatPrice(tile.listPrice)
    if (!price.startsWith('$')) continue
    const beds = tile.beds != null ? `${tile.beds} bed` : null
    const baths = tile.baths != null ? `${tile.baths} bath` : null
    const sqft = tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sq ft` : null
    const detail = [beds, baths, sqft].filter(Boolean).join(' · ')
    const city = tile.city?.trim()
    rows.push({
      what: v3Text(street),
      value: v3Text(price),
      href: listingTileHref(tile),
      when: v3Text(city || 'For sale'),
      detail: detail ? v3Text(detail) : undefined,
    })
  }
  return rows
}

export function listingQuietLinks(input: {
  canonicalPath: string
  listingKey: string
  cityHref: string | null
  cityName: string | null
  parentPlaces: Array<{ href: string; label: string }>
  nearbyTrails: Array<{ href: string; name: string }>
  nearbyGolf: Array<{ href: string; name: string }>
  builderName: string | null
}): V3QuietItem[] {
  const seen = new Set<string>()
  const items: V3QuietItem[] = []
  const push = (href: string, label: string) => {
    const nextHref = href.trim()
    const nextLabel = label.trim()
    if (!nextHref || !nextLabel || seen.has(nextHref)) return
    seen.add(nextHref)
    items.push({ href: nextHref, label: nextLabel })
  }

  push(valuationHref(input.canonicalPath), 'Value my home')
  push(`/contact?listingKey=${encodeURIComponent(input.listingKey)}`, 'Ask about this home')
  push(
    `/login?returnUrl=${encodeURIComponent('/account/saved-searches')}`,
    'Manage saved alerts',
  )
  if (input.cityHref && input.cityName) {
    push(input.cityHref, `${input.cityName} homes for sale`)
  }
  push('/housing-market/central-oregon', 'Central Oregon housing market')
  for (const place of input.parentPlaces) push(place.href, place.label)
  for (const trail of input.nearbyTrails) push(trail.href, trail.name)
  for (const course of input.nearbyGolf) push(course.href, course.name)
  if (input.builderName?.trim()) {
    const name = input.builderName.trim()
    push(`/builders/${slugify(name)}`, `${name} homes`)
  }
  return items
}
