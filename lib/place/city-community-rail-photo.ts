/**
 * City #communities rail stills (SITE-140).
 *
 * A leftover `banners/` hero that 404s is the gray hole: V3Ledger places
 * still mounts an <img>, the photo never decodes (naturalWidth 0), and the
 * wash behind it reads as an empty block. Owned stills (asset_library geo
 * pick, communityImage, curated Area Guide / LP) outrank that crop. Missing
 * is honest empty so the ledger can draw a glyph — never a city clone.
 */

import {
  publicCommunitySlug,
  registryCommunityByAnyKey,
} from '@/lib/communities/community-public-pair'
import { pickSurfaceImage, type SurfaceImage } from '@/lib/data/media/getSurfaceImages'
import { communityImage } from '@/lib/geo-images'
import { indexImagineStill, indexPlaceGeoTags } from '@/lib/geo/index-place-photo'
import { slugify } from '@/lib/slug'
import { bareCityPlaceSlug } from './city-place-grain'

const BANNERS_MARKER = '/storage/v1/object/public/banners/'

export function isFragileBannerUrl(url: string | null | undefined): boolean {
  const value = url?.trim() ?? ''
  return value.includes(BANNERS_MARKER)
}

export function cityCommunityRailSlugs(
  slug: string,
  name?: string | null,
  citySlug?: string | null,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (raw: string | null | undefined) => {
    const value = (raw ?? '').trim().toLowerCase()
    if (!value || seen.has(value)) return
    seen.add(value)
    out.push(value)
    const bare = bareCityPlaceSlug(value, citySlug)
    if (bare && !seen.has(bare)) {
      seen.add(bare)
      out.push(bare)
    }
  }

  add(slug)
  add(name ? slugify(name) : null)
  const entry = registryCommunityByAnyKey(slug) ?? (name ? registryCommunityByAnyKey(name) : null)
  if (entry) {
    add(entry.slug)
    add(publicCommunitySlug(entry))
  }
  return out
}

function communityImageFromSlugs(slugs: readonly string[]): string | null {
  for (const slug of slugs) {
    const owned = communityImage(slug)
    if (owned) return owned
  }
  return null
}

export function resolveCityCommunityRailPhoto(input: {
  slug: string
  name?: string | null
  citySlug?: string | null
  liveHero?: string | null
  curated?: string | null
  pool?: readonly SurfaceImage[]
}): string | null {
  const slugs = cityCommunityRailSlugs(input.slug, input.name, input.citySlug)
  if (slugs.length === 0) return null

  const live = input.liveHero?.trim() || null
  const curated = input.curated?.trim() || null
  const owned = communityImageFromSlugs(slugs)
  const library = pickSurfaceImage([...(input.pool ?? [])], {
    geoTags: indexPlaceGeoTags(slugs),
    seed: `city-rail:${slugs[0]}`,
    geoOnly: true,
  })

  const imagine = indexImagineStill(library, live, owned, curated)
  if (imagine) return imagine
  if (owned) return owned
  if (library) return library
  if (curated && !isFragileBannerUrl(curated)) return curated
  if (live && !isFragileBannerUrl(live)) return live
  return null
}
