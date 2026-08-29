/**
 * Listing Stage media. Imagine / library place stills only — elevated
 * Forked Horn Butte / Redmond, not the MLS street photo. Type never sits
 * on a pale house crop.
 */

import { getSurfaceImage } from '@/lib/data'
import { preferPlaceHeroOrNull } from '@/lib/geo-images'
import { slugify } from '@/lib/slug'

function imaginePlaceStill(...urls: Array<string | null | undefined>): string | null {
  for (const url of urls) {
    const trimmed = url?.trim()
    if (trimmed && trimmed.includes('imagine-place-')) return trimmed
  }
  return null
}

/** Prefer a registered Imagine still, then any place-owned library still. */
export function listingStagePosterUrl(
  ...urls: Array<string | null | undefined>
): string | null {
  return imaginePlaceStill(...urls) ?? preferPlaceHeroOrNull(urls[0], urls[1] ?? null)
}

export async function listingStagePoster(input: {
  citySlug?: string | null
  subdivisionName?: string | null
  neighborhoodSlug?: string | null
  listingKey?: string | null
}): Promise<string | null> {
  const city = input.citySlug?.trim() || null
  const subdivision =
    input.subdivisionName && input.subdivisionName !== 'N/A'
      ? slugify(input.subdivisionName)
      : null
  const neighborhood = input.neighborhoodSlug?.trim() || null
  const geoTags = [subdivision, neighborhood, city].filter((tag): tag is string => Boolean(tag))
  if (geoTags.length === 0) return null

  const library = await getSurfaceImage('hero', {
    geoTags,
    seed: `listing-stage:${input.listingKey ?? geoTags.join(':')}`,
    geoOnly: true,
  })
  const first = listingStagePosterUrl(library)
  if (first) return first
  if (city && !geoTags.includes('central-oregon')) {
    const regional = await getSurfaceImage('hero', {
      geoTags: [city, 'central-oregon'],
      seed: `listing-stage-regional:${input.listingKey ?? city}`,
      geoOnly: true,
    })
    return listingStagePosterUrl(regional)
  }
  return null
}
