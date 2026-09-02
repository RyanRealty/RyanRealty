/**
 * Canonical place / browse / market URLs for a geo entity.
 * Presentation-only — does not change cache slug dialects.
 */
import { homesForSalePath, slugify } from '@/lib/slug'
import { RESORT_SLUG_TO_CITY } from '@/lib/community-slug'
import { cityHref, cityNeighborhoodHref } from '@/lib/site/place-href'

export type PlaceType = 'city' | 'neighborhood' | 'community'

export type PlaceLinks = {
  placeUrl: string
  browseUrl: string
  marketUrl: string
  label: string
}

function titleFromSlug(s: string): string {
  return s
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Prefer bare resort slug over city-prefixed compound (bend-tetherow → tetherow). */
export function canonicalCommunitySlug(slug: string): string {
  const normalised = slug.trim().toLowerCase()
  if (RESORT_SLUG_TO_CITY[normalised]) return normalised
  // compound: bend-tetherow / sunriver-crosswater
  const parts = normalised.split('-')
  for (let i = 1; i < parts.length; i++) {
    const rest = parts.slice(i).join('-')
    if (RESORT_SLUG_TO_CITY[rest]) return rest
  }
  return normalised
}

export function getPlaceLinks(input: {
  type: PlaceType
  slug: string
  citySlug?: string
}): PlaceLinks {
  const slug = input.slug.trim().toLowerCase()

  if (input.type === 'city') {
    return {
      // An out-of-area city's page is /oregon/<slug>; /cities/<slug> 308s there.
      placeUrl: cityHref(slug) ?? `/cities/${slug}`,
      browseUrl: homesForSalePath(titleFromSlug(slug)),
      marketUrl: `/housing-market/${slug}`,
      label: titleFromSlug(slug),
    }
  }

  if (input.type === 'neighborhood') {
    const citySlug = (input.citySlug ?? 'bend').toLowerCase()
    return {
      // A registry community used as a neighborhood slug (Northwest Crossing,
      // Eagle Crest) has its own /communities page; the two-segment path 308s.
      placeUrl: cityNeighborhoodHref(citySlug, slug) ?? `/cities/${citySlug}/${slug}`,
      browseUrl: `/homes-for-sale/${citySlug}/${slug}`,
      marketUrl: `/housing-market/${citySlug}/${slug}`,
      label: titleFromSlug(slug),
    }
  }

  // community
  const bare = canonicalCommunitySlug(slug)
  const cityName = RESORT_SLUG_TO_CITY[bare]
  const citySlug = cityName ? slugify(cityName) : (input.citySlug ?? 'bend')
  const label = titleFromSlug(bare)
  return {
    placeUrl: `/communities/${bare}`,
    browseUrl: homesForSalePath(cityName ?? titleFromSlug(citySlug), label),
    marketUrl: `/housing-market/${citySlug}/${bare}`,
    label,
  }
}
