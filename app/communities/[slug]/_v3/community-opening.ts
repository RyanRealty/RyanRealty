/**
 * Master-plan opening helpers. Stage uses an owned community photo when
 * communityImage() has one. No owned asset → belonging figures from authored
 * config only. Nothing here fetches or invents a picture.
 */

import { v3Text, type V3FieldItem, type V3InstrumentFigure } from '@/components/site/v3'
import { communityImage } from '@/lib/geo-images'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { listingTileHref } from '@/lib/slug'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import type { ListingTile } from '@/lib/data/types/listing'
import { publishPlaceHoa } from '@/lib/market/publish-place-hoa'

export function stagePoster(slug: string): string | null {
  return communityImage(slug)
}

export function belongingHeadline(name: string, content: ResortCommunityContent | null): string {
  const hasMembership = (content?.membershipTiers ?? []).some((tier) =>
    String(tier.name ?? tier.tier ?? tier.label ?? '').trim(),
  )
  if (hasMembership) return 'Membership is separate from the home.'
  const hoa = publishPlaceHoa({ masterAnnual: content?.hoaMasterAnnual })
  if (hoa?.kind === 'master') {
    return `Master HOA is $${hoa.annual.toLocaleString('en-US')} a year.`
  }
  const amenity = content?.amenities?.[0]?.name?.trim()
  if (amenity) return amenity
  return name
}

export function belongingFigures(content: ResortCommunityContent | null): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  const hoa = publishPlaceHoa({ masterAnnual: content?.hoaMasterAnnual })
  if (hoa) {
    figures.push({
      value: v3Text(`$${hoa.annual.toLocaleString('en-US')}`),
      label: v3Text(hoa.kind === 'master' ? 'master HOA a year' : 'HOA estimate a year'),
    })
  }
  const tiers = (content?.membershipTiers ?? []).filter((tier) =>
    String(tier.name ?? tier.tier ?? tier.label ?? '').trim(),
  )
  if (tiers.length > 0) {
    figures.push({
      value: v3Text(String(tiers.length)),
      label: v3Text(tiers.length === 1 ? 'membership tier' : 'membership tiers'),
    })
  }
  if (content?.acres) {
    figures.push({
      value: v3Text(content.acres.toLocaleString('en-US')),
      label: v3Text('acres'),
    })
  }
  const amenityCount = (content?.amenities ?? []).length
  if (figures.length === 0 && amenityCount > 0) {
    figures.push({
      value: v3Text(String(amenityCount)),
      label: v3Text(amenityCount === 1 ? 'amenity on file' : 'amenities on file'),
    })
  }
  return figures
}

export function belongingTrace(name: string): string {
  return `Authored ${name} facts on file: membership, HOA, and the size of the plan. Not live inventory.`
}

/** The counted set as Field rows. Photo is optional. Map and list are this set. */
export function communityFieldItems(tiles: readonly ListingTile[], cap?: number): V3FieldItem[] {
  const items = [...tiles]
    .sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
    .flatMap((tile) => {
      if (!tile.listingKey) return []
      const street = [tile.streetNumber, tile.streetName, tile.streetSuffix].filter(Boolean).join(' ').trim()
      const meta = [
        tile.beds != null ? `${tile.beds} bd` : null,
        tile.baths != null ? `${tile.baths} ba` : null,
        tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      return [
        {
          id: tile.listingKey,
          href: listingTileHref(tile),
          priceLabel: formatPublishedAsk(tile.listPrice) ?? 'Price not published',
          title: street || 'Listing',
          photoSrc: tile.photoUrl?.trim() || undefined,
          meta: meta || undefined,
          lat: tile.lat,
          lng: tile.lng,
        } satisfies V3FieldItem,
      ]
    })
  return cap == null ? items : items.slice(0, cap)
}
