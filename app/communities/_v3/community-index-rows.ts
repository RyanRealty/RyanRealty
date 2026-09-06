/**
 * Communities index rows. Live for-sale count is the figure on the door.
 * Dedicated communityImage() only, never a city-fallback photo.
 */

import { v3Text, type V3LedgerFigureRow } from '@/components/site/v3'
import { firstSentence, liveForSaleLabel } from '@/app/cities/_v3/cities-index-constants'
import type { ResortCommunityContent } from '@/lib/resort-community-content'

export function belongingLine(content: ResortCommunityContent | null): string | null {
  const tier = (content?.membershipTiers ?? [])
    .map((item) => String(item.name ?? item.tier ?? item.label ?? '').trim())
    .find(Boolean)
  const amenity = (content?.amenities ?? []).map((item) => item.name?.trim()).find(Boolean)
  if (tier && amenity) return `${tier}. ${amenity}.`
  if (tier) return tier
  if (amenity) return amenity
  const prose = content?.aboutProse?.[0]?.trim()
  if (!prose) return null
  return firstSentence(prose)
}

export function resortIndexRow(input: {
  slug: string
  name: string
  city: string
  belonging: string | null
  photoSrc: string | null
  activeCount: number
  medianLine: string | null
  weight?: number
}): V3LedgerFigureRow | null {
  const name = input.name.trim()
  if (!name) return null
  const city = input.city.trim()
  const bits = [input.medianLine, input.belonging].filter(Boolean)
  return {
    href: `/communities/${input.slug}`,
    when: v3Text(city || 'Oregon'),
    what: v3Text(name),
    detail: bits.length > 0 ? v3Text(bits.join(' · ')) : undefined,
    value: v3Text(liveForSaleLabel(input.activeCount)),
    weight: input.weight,
    id: input.slug,
    media: input.photoSrc ? { src: input.photoSrc } : undefined,
    ariaLabel: v3Text(`${name} guide, ${city || 'Oregon'}`),
  }
}
