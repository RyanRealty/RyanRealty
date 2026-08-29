/**
 * Subdivision first-fold helpers. Stage media is a place-owned still only:
 * Imagine of this neighborhood or its parent resort (Eagle Crest / the Ridge
 * as an elevated course or rim), else a geo-strict library still, else the
 * resort's owned community photo. No Unsplash, no Google pixels, no plat
 * outline, no street crop as the Stage.
 */

import { getSurfaceImage, getSurfaceImages } from '@/lib/data'
import { communityImage, preferPlaceHeroOrNull } from '@/lib/geo-images'
import { isListingStagePlatStill } from '@/lib/listing/listing-stage-poster'

function isImaginePlaceUrl(url: string): boolean {
  return url.includes('imagine-place-') || url.includes('/grok-imagine/')
}

function isStockOrMapPixel(url: string): boolean {
  return /unsplash|images\.unsplash|maps\.googleapis|maps\.gstatic|googleusercontent|lh3\.google|streetviewpixels|khms|mt[01]\.google/i.test(
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

export async function subdivisionLibraryHero(
  slug: string,
  resortSlug: string | null,
): Promise<string | null> {
  const placeTags = [slug, resortSlug].filter((tag): tag is string => Boolean(tag))
  if (placeTags.length === 0) return null
  const pool = await getSurfaceImages('hero')
  const wanted = new Set(placeTags.map((tag) => tag.toLowerCase()))
  const imagineUrls = pool
    .filter((image) => image.geoTags.some((tag) => wanted.has(tag.toLowerCase())))
    .map((image) => image.url)
  const imagine = imaginePlaceStill(...imagineUrls)
  if (imagine) return imagine
  return getSurfaceImage('hero', {
    geoTags: placeTags,
    seed: `subdivision:${slug}`,
    geoOnly: true,
  })
}

export function subdivisionStagePoster(
  liveHero?: string | null,
  libraryHero?: string | null,
  resortSlug?: string | null,
): string | null {
  return (
    imaginePlaceStill(libraryHero, liveHero) ??
    preferPlaceHeroOrNull(usableStageStill(liveHero), usableStageStill(libraryHero)) ??
    usableStageStill(resortSlug ? communityImage(resortSlug) : null)
  )
}

export function subdivisionHeadline(displayName: string): string {
  return `Homes for sale in ${displayName}`
}
