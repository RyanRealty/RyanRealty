/**
 * Public place page links for the CMA product bar + cover.
 * Miss → omit. Never invent a slug or URL.
 *
 * Fallback when the subject sits outside mapped neighborhood polygons:
 *   subdivision → community (registry alias) → city
 * Neighborhood polygon hits take priority over that chain.
 */

import registry from '@/data/resort-communities.json' assert { type: 'json' }
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { resolveSubdivisionAreaRedirect } from '@/lib/subdivision-area-redirects'
import { neighborhoodPagePath, slugify } from '@/lib/slug'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export type CmaPlaceLink = { label: string; href: string }

type RegistryEntry = {
  slug: string
  label: string
  city: string
  city_slug: string
  subdivision_aliases?: string[]
}

const ENTRIES = (registry as unknown as { communities: RegistryEntry[] }).communities

const ENTRY_BY_NAME_SLUG: ReadonlyMap<string, RegistryEntry> = (() => {
  const map = new Map<string, RegistryEntry>()
  for (const entry of ENTRIES) {
    for (const name of [entry.label, ...(entry.subdivision_aliases ?? [])]) {
      const key = slugify(name)
      if (key && key !== 'unknown' && !map.has(key)) map.set(key, entry)
    }
  }
  return map
})()

const MLS_MISSING = /^(n\/?a|none|null|undefined|—|-|other|not available)$/i

function clean(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  if (!t) return null
  if (MLS_MISSING.test(t)) return null
  return t
}

function abs(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function pushUnique(out: CmaPlaceLink[], link: CmaPlaceLink | null): void {
  if (!link) return
  if (!link.label.trim() || !link.href.trim()) return
  if (out.some((x) => x.href === link.href || x.label.toLowerCase() === link.label.toLowerCase())) return
  out.push(link)
}

/** City page when the city is in the Central Oregon service set. */
export function cmaCityHref(city: string | null | undefined): string | null {
  const c = clean(city)
  if (!c) return null
  const slug = slugify(c)
  if (!CENTRAL_OREGON_CITY_SLUGS.has(slug)) return null
  return abs(`/cities/${slug}`)
}

export function cmaCommunityHref(slug: string | null | undefined): string | null {
  const s = clean(slug)
  if (!s) return null
  const key = slugify(s)
  if (!key || key === 'unknown') return null
  const entry = ENTRY_BY_NAME_SLUG.get(key)
  return abs(`/communities/${entry?.slug ?? key}`)
}

/**
 * Subdivision / plat public path. Prefer registry community when the name is
 * an alias (Deschutes River Recreation Homesites → Three Rivers). Otherwise
 * /subdivisions/<slug>, honoring marketing → area redirects.
 */
export function cmaSubdivisionHref(subdivisionName: string | null | undefined): string | null {
  const label = clean(subdivisionName)
  if (!label) return null
  const key = slugify(label)
  if (!key || key === 'unknown') return null
  const entry = ENTRY_BY_NAME_SLUG.get(key)
  if (entry) return abs(`/communities/${entry.slug}`)
  const redirected = resolveSubdivisionAreaRedirect(key)
  if (redirected) return abs(redirected)
  return abs(`/subdivisions/${key}`)
}

export function cmaNeighborhoodHref(
  city: string | null | undefined,
  neighborhoodSlug: string | null | undefined,
): string | null {
  const citySlug = clean(city) ? slugify(city!) : null
  const nSlug = clean(neighborhoodSlug) ? slugify(neighborhoodSlug!) : null
  if (!citySlug || !nSlug || citySlug === 'unknown' || nSlug === 'unknown') return null
  if (citySlug !== 'bend') return null
  return abs(neighborhoodPagePath(citySlug, nSlug))
}

/**
 * Resolve place links for the product bar and cover.
 * When inMappedNeighborhood is true, neighborhood is first.
 * Otherwise fallback: subdivision → community → city.
 */
export function resolveCmaPlaceLinks(input: {
  city?: string | null
  communitySlug?: string | null
  communityName?: string | null
  neighborhoodSlug?: string | null
  neighborhoodName?: string | null
  inMappedNeighborhood?: boolean | null
  subdivisionName?: string | null
  subdivisionSlug?: string | null
}): CmaPlaceLink[] {
  const out: CmaPlaceLink[] = []
  const city = clean(input.city)
  const cityHref = cmaCityHref(city)

  const nLabel = clean(input.neighborhoodName)
  const nHref = cmaNeighborhoodHref(city, input.neighborhoodSlug)
  const cLabel = clean(input.communityName)
  const cHref =
    cmaCommunityHref(input.communitySlug) ??
    (cLabel ? cmaCommunityHref(cLabel) : null)

  const sLabel = clean(input.subdivisionName)
  const sHref =
    (clean(input.subdivisionSlug) ? cmaSubdivisionHref(input.subdivisionSlug) : null) ??
    cmaSubdivisionHref(sLabel)

  const inNabe = Boolean(input.inMappedNeighborhood && nLabel && nHref)

  if (inNabe) {
    pushUnique(out, { label: nLabel!, href: nHref! })
    if (sLabel && sHref) pushUnique(out, { label: sLabel, href: sHref })
    if (cLabel && cHref) pushUnique(out, { label: cLabel, href: cHref })
    if (city && cityHref) pushUnique(out, { label: city, href: cityHref })
    return out
  }

  if (sLabel && sHref) pushUnique(out, { label: sLabel, href: sHref })
  if (cLabel && cHref) pushUnique(out, { label: cLabel, href: cHref })
  if (city && cityHref) pushUnique(out, { label: city, href: cityHref })
  return out
}

/** Primary place link for cover hyperlink (first in the fallback chain). */
export function primaryCmaPlaceLink(
  input: Parameters<typeof resolveCmaPlaceLinks>[0],
): CmaPlaceLink | null {
  return resolveCmaPlaceLinks(input)[0] ?? null
}
