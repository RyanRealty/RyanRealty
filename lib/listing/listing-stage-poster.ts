/**
 * Listing Stage media. Imagine / library place stills only — elevated
 * Forked Horn Butte / Redmond, not the MLS street photo. Type never sits
 * on a pale house crop.
 */

import { getSurfaceImage, getSurfaceImages } from '@/lib/data'
import { preferPlaceHeroOrNull } from '@/lib/geo-images'
import { slugify } from '@/lib/slug'

/**
 * Stage is an elevated place still, never a plat outline or a lime
 * parcel drawing. Lot photos and plan renderings live in the Sheet.
 */
export function isListingStagePlatStill(url: string | null | undefined): boolean {
  const value = url?.trim().toLowerCase() ?? ''
  if (!value) return false
  return (
    /\bplat\b/.test(value) ||
    /cadastral|parcel-map|lot-lines|lot-line|survey-plat/.test(value) ||
    /lime[-_ ]?plat|plat[-_ ]?lime/.test(value) ||
    /aerial[-_ ]?(plat|outline)|plat[-_ ]?outline/.test(value)
  )
}

function usableStageStill(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (isListingStagePlatStill(trimmed)) return null
  return trimmed
}

function isImaginePlaceUrl(url: string): boolean {
  return url.includes('imagine-place-') || url.includes('/grok-imagine/')
}

function imaginePlaceStill(...urls: Array<string | null | undefined>): string | null {
  for (const url of urls) {
    const trimmed = usableStageStill(url)
    if (trimmed && isImaginePlaceUrl(trimmed)) return trimmed
  }
  return null
}

/** Prefer a registered Imagine still, then any place-owned library still. */
export function listingStagePosterUrl(
  ...urls: Array<string | null | undefined>
): string | null {
  const imagine = imaginePlaceStill(...urls)
  if (imagine) return imagine
  const first = usableStageStill(urls[0])
  const second = usableStageStill(urls[1])
  return preferPlaceHeroOrNull(first, second)
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
  const placeTags = [subdivision, neighborhood].filter((tag): tag is string => Boolean(tag))
  const geoTags = [...placeTags, city].filter((tag): tag is string => Boolean(tag))
  if (geoTags.length === 0) return null

  // Imagine stills live at /grok-imagine/ (source_id is imagine-place-*).
  // Do not mix city into the same pick: a bend-only exact match beats a
  // neighborhood still that also carries the city tag.
  if (placeTags.length > 0) {
    const pool = await getSurfaceImages('hero')
    const wanted = new Set(placeTags.map((tag) => tag.toLowerCase()))
    const imagineUrls = pool
      .filter((image) => image.geoTags.some((tag) => wanted.has(tag.toLowerCase())))
      .map((image) => image.url)
    const imagine = listingStagePosterUrl(...imagineUrls)
    if (imagine) return imagine

    const place = listingStagePosterUrl(
      await getSurfaceImage('hero', {
        geoTags: placeTags,
        seed: `listing-stage:${input.listingKey ?? placeTags.join(':')}`,
        geoOnly: true,
      }),
    )
    if (place) return place
  }

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
