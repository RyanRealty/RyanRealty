/**
 * Neighborhood first-fold helpers. Stage media is a place-owned still only:
 * the registered Imagine place still when one exists, else a geo-strict
 * library hero for this neighborhood. No regional fallback, no Unsplash,
 * no Google pixels, no street crop, no plat outline.
 */

import { getSurfaceImage, getSurfaceImages } from '@/lib/data'
import { preferPlaceHeroOrNull } from '@/lib/geo-images'
import { isListingStagePlatStill } from '@/lib/listing/listing-stage-poster'

function isImaginePlaceUrl(url: string): boolean {
  return url.includes('imagine-place-') || url.includes('/grok-imagine/')
}

function isStockOrMapPixel(url: string): boolean {
  return /unsplash|images\.unsplash|maps\.googleapis|maps\.gstatic|googleusercontent|lh3\.google/i.test(
    url,
  )
}

function usableStageStill(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (isListingStagePlatStill(trimmed)) return null
  if (isStockOrMapPixel(trimmed)) return null
  return trimmed
}

function imaginePlaceStill(...urls: Array<string | null | undefined>): string | null {
  for (const url of urls) {
    const trimmed = usableStageStill(url)
    if (trimmed && isImaginePlaceUrl(trimmed)) return trimmed
  }
  return null
}

export async function neighborhoodLibraryHero(
  citySlug: string,
  neighborhoodSlug: string,
): Promise<string | null> {
  const placeTags = [neighborhoodSlug, `${citySlug}-${neighborhoodSlug}`]
  const pool = await getSurfaceImages('hero')
  const wanted = new Set(placeTags.map((tag) => tag.toLowerCase()))
  const imagineUrls = pool
    .filter((image) => image.geoTags.some((tag) => wanted.has(tag.toLowerCase())))
    .map((image) => image.url)
  const imagine = imaginePlaceStill(...imagineUrls)
  if (imagine) return imagine
  return getSurfaceImage('hero', {
    geoTags: placeTags,
    seed: `neighborhood:${citySlug}:${neighborhoodSlug}`,
    geoOnly: true,
  })
}

export function neighborhoodStagePoster(
  liveHero?: string | null,
  libraryHero?: string | null,
): string | null {
  return (
    imaginePlaceStill(libraryHero, liveHero) ??
    preferPlaceHeroOrNull(usableStageStill(liveHero), usableStageStill(libraryHero))
  )
}
