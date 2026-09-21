/**
 * Index-row stills for /communities and /subdivisions.
 *
 * Letter tiles (V3Ledger glyphs) appear when a row has no owned photo while
 * another row in the same list does. City-fallback photography is not an
 * owned still — it clones Sisters or Bend onto a different place. This
 * resolver only returns a still of THIS place:
 *
 *   1. geo-strict asset_library hero (grok-imagine place stills included)
 *   2. communityImage() for the slug, then the parent slug on a plat row
 *   3. null — honest empty; the ledger may draw a glyph, never a city photo
 *
 * Live `hero_image_url` is merged by the caller via preferPlaceHeroOrNull so
 * G30 keeps living on the page. Imagine stills outrank a leftover live crop
 * (same ladder as community Stage). SITE-140 is the homepage NWC rail; this
 * module is the INDEX.
 */

import {
  publicCommunitySlug,
  registryCommunityByAnyKey,
} from '@/lib/communities/community-public-pair'
import { pickSurfaceImage, type SurfaceImage } from '@/lib/data/media/getSurfaceImages'
import { communityImage, preferPlaceHeroOrNull } from '@/lib/geo-images'
import { slugify } from '@/lib/slug'

const REGION_TAG = 'central-oregon'

export function indexImagineStill(
  ...urls: Array<string | null | undefined>
): string | null {
  for (const url of urls) {
    const trimmed = url?.trim()
    if (trimmed && trimmed.includes('imagine-place-')) return trimmed
  }
  return null
}

export function indexPlaceGeoTags(slugs: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (raw: string | null | undefined) => {
    const value = (raw ?? '').trim().toLowerCase()
    if (!value || value === REGION_TAG) return
    if (!seen.has(value)) {
      seen.add(value)
      out.push(value)
    }
    const dashed = slugify(value)
    if (dashed !== 'unknown' && dashed !== REGION_TAG && !seen.has(dashed)) {
      seen.add(dashed)
      out.push(dashed)
    }
  }

  for (const slug of slugs) {
    const entry = registryCommunityByAnyKey(slug)
    if (!entry) {
      add(slug)
      continue
    }
    add(entry.slug)
    add(publicCommunitySlug(entry))
    add(entry.label)
    for (const alias of entry.subdivision_aliases ?? []) add(alias)
    for (const former of entry.former_labels ?? []) add(former)
  }
  return out
}

/**
 * Owned library or curated still for an index row. Never a city or regional
 * clone. `parentSlug` is the registry community a plat sits inside.
 */
export function resolveIndexPlacePhoto(input: {
  slug: string
  parentSlug?: string | null
  pool: readonly SurfaceImage[]
}): string | null {
  const slug = input.slug.trim()
  if (!slug) return null
  const parent = input.parentSlug?.trim() || null
  const tags = indexPlaceGeoTags(parent ? [slug, parent] : [slug])
  const library = pickSurfaceImage([...input.pool], {
    geoTags: tags,
    seed: `index:${slug}`,
    geoOnly: true,
  })
  const curated = communityImage(slug) ?? (parent ? communityImage(parent) : null)
  return preferPlaceHeroOrNull(library, curated)
}

/** Live crop, then owned still — unless an Imagine place still is in either. */
export function preferIndexPlaceHero(
  liveHero: string | null | undefined,
  owned: string | null | undefined,
): string | null {
  return (
    indexImagineStill(owned, liveHero) ?? preferPlaceHeroOrNull(liveHero, owned)
  )
}
