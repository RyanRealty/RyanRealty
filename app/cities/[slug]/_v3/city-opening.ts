/**
 * City first-fold helpers. Stage media is a place-owned still only:
 * live `cities.hero_image_url`, then a geo-strict library hero. No regional
 * fallback, no Family-4 CDN substitute, no other city's photo.
 */

import { getSurfaceImage } from '@/lib/data'
import { preferPlaceHeroOrNull } from '@/lib/geo-images'

export async function cityLibraryHero(slug: string): Promise<string | null> {
  return getSurfaceImage('hero', {
    geoTags: [slug],
    seed: `city:${slug}`,
    geoOnly: true,
  })
}

export function cityStagePoster(liveHero?: string | null, libraryHero?: string | null): string | null {
  return preferPlaceHeroOrNull(liveHero, libraryHero)
}
