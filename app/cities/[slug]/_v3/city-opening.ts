/**
 * City first-fold helpers. Stage media is a place-owned still only:
 * the registered Imagine place still when one exists, else live
 * `cities.hero_image_url`, else a geo-strict library hero. No regional
 * fallback, no Family-4 CDN substitute, no other city's photo.
 */

import { getSurfaceImage } from '@/lib/data'
import { preferPlaceHeroOrNull } from '@/lib/geo-images'

function imaginePlaceStill(...urls: Array<string | null | undefined>): string | null {
  for (const url of urls) {
    const trimmed = url?.trim()
    if (trimmed && trimmed.includes('imagine-place-')) return trimmed
  }
  return null
}

export async function cityLibraryHero(slug: string): Promise<string | null> {
  return getSurfaceImage('hero', {
    geoTags: [slug],
    seed: `city:${slug}`,
    geoOnly: true,
  })
}

export function cityStagePoster(liveHero?: string | null, libraryHero?: string | null): string | null {
  return imaginePlaceStill(libraryHero, liveHero) ?? preferPlaceHeroOrNull(liveHero, libraryHero)
}
