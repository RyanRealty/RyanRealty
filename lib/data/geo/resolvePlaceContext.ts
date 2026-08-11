/**
 * resolvePlaceContext — UI place ladder for the Exploration System.
 *
 * Different job from resolveGeoScope (membership / listing predicates).
 * This module answers: "what place nodes should we show and link so the
 * buyer can climb and wander?" See CONTEXT.md PlaceContext.
 *
 * Pure / sync for listing-field inputs (no Supabase). Callers that need
 * market pulse or boundary still fetch those separately; this only
 * assembles the graph of City · Neighborhood · Community · Subdivision.
 */

import { getPlaceLinks } from '@/lib/place-links'
import { getResortCommunityBySubdivisionName } from '@/lib/data/communities/registry'
import { slugify } from '@/lib/slug'

/** MLS / GIS noise that must never become a place node. */
export const PLACE_NOISE_SLUGS = new Set([
  'na',
  'n-a',
  'none',
  'unknown',
  'outside-city-limits',
  'not-applicable',
])

export type PlaceNodeType = 'city' | 'neighborhood' | 'community' | 'subdivision'

export type PlaceNode = {
  type: PlaceNodeType
  slug: string
  label: string
  href: string
}

export type PreferredMarketGrain = 'subdivision' | 'community' | 'neighborhood' | 'city'

export type PlaceContext = {
  city: PlaceNode | null
  neighborhood: PlaceNode | null
  subdivision: PlaceNode | null
  /** Curated resort / master-plan only — never a raw MLS plat. */
  curatedCommunity: PlaceNode | null
  /**
   * Suggested grain for pulse/stats lookups. Callers still fall back when
   * the finer grain has no cache row. Never invent stats for a missing grain.
   */
  preferredMarketGrain: PreferredMarketGrain
  /** City → … → finest place (no Home). Suitable for breadcrumbs / identity. */
  breadcrumb: PlaceNode[]
  /** Coarser nodes only (parents of the finest). */
  parents: PlaceNode[]
  /** Human line: "Valhalla Heights · Northwest Crossing · Bend" */
  identityLine: string
}

export type PlaceContextListingInput = {
  city?: string | null
  citySlug?: string | null
  subdivisionName?: string | null
  subdivisionSlug?: string | null
  /** GIS boundary neighborhood display name */
  neighborhoodName?: string | null
  neighborhoodSlug?: string | null
}

function cleanSlug(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().toLowerCase()
  if (!s || PLACE_NOISE_SLUGS.has(s)) return null
  return s
}

function cleanLabel(raw: string | null | undefined, fallbackSlug: string | null): string | null {
  const t = (raw ?? '').trim()
  if (t) return t
  if (!fallbackSlug) return null
  return fallbackSlug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Build PlaceContext from listing-detail (or tile) fields.
 * Does not hit the database.
 */
export function resolvePlaceContextFromListing(input: PlaceContextListingInput): PlaceContext {
  const citySlug =
    cleanSlug(input.citySlug) ?? (input.city ? cleanSlug(slugify(input.city)) : null)
  const cityLabel = cleanLabel(input.city, citySlug)
  const city: PlaceNode | null =
    citySlug && cityLabel
      ? {
          type: 'city',
          slug: citySlug,
          label: cityLabel,
          href: getPlaceLinks({ type: 'city', slug: citySlug }).placeUrl,
        }
      : null

  const nbhSlug = cleanSlug(input.neighborhoodSlug) ??
    (input.neighborhoodName ? cleanSlug(slugify(input.neighborhoodName)) : null)
  const nbhLabel = cleanLabel(input.neighborhoodName, nbhSlug)
  const neighborhood: PlaceNode | null =
    city && nbhSlug && nbhLabel
      ? {
          type: 'neighborhood',
          slug: nbhSlug,
          label: nbhLabel,
          href: getPlaceLinks({
            type: 'neighborhood',
            slug: nbhSlug,
            citySlug: city.slug,
          }).placeUrl,
        }
      : null

  const subSlug =
    cleanSlug(input.subdivisionSlug) ??
    (input.subdivisionName ? cleanSlug(slugify(input.subdivisionName)) : null)
  const subLabel = cleanLabel(input.subdivisionName, subSlug)
  const subdivision: PlaceNode | null =
    subSlug && subLabel
      ? {
          type: 'subdivision',
          slug: subSlug,
          label: subLabel,
          href: `/subdivisions/${subSlug}`,
        }
      : null

  // Curated Community: registry match on MLS name (aliases), not every plat.
  const resort =
    getResortCommunityBySubdivisionName(input.subdivisionName) ??
    getResortCommunityBySubdivisionName(subLabel) ??
    getResortCommunityBySubdivisionName(subSlug)
  const curatedCommunity: PlaceNode | null = resort
    ? {
        type: 'community',
        slug: resort.slug,
        label: resort.label,
        href: getPlaceLinks({ type: 'community', slug: resort.slug }).placeUrl,
      }
    : null

  // Breadcrumb order: City → Neighborhood → Community → Subdivision
  // Community sits above plat when both exist (buyer mental model: resort → phase/plat).
  // Dedupe: GIS neighborhood and curated community often name the same place
  // (e.g. NorthWest Crossing) — keep the Community node (registry product page).
  const neighborhoodDistinct =
    neighborhood &&
    !(
      curatedCommunity &&
      (curatedCommunity.slug === neighborhood.slug ||
        curatedCommunity.label.trim().toLowerCase() ===
          neighborhood.label.trim().toLowerCase())
    )
      ? neighborhood
      : null

  const subdivisionDistinct =
    subdivision &&
    !(
      curatedCommunity &&
      (curatedCommunity.slug === subdivision.slug ||
        curatedCommunity.label.trim().toLowerCase() ===
          subdivision.label.trim().toLowerCase())
    )
      ? subdivision
      : subdivision && !curatedCommunity
        ? subdivision
        : null

  const breadcrumb: PlaceNode[] = []
  if (city) breadcrumb.push(city)
  if (neighborhoodDistinct) breadcrumb.push(neighborhoodDistinct)
  if (curatedCommunity) breadcrumb.push(curatedCommunity)
  if (subdivisionDistinct) breadcrumb.push(subdivisionDistinct)

  // Parents = everything coarser than the leaf. City-only → no parents.
  const parents = breadcrumb.length > 1 ? breadcrumb.slice(0, -1) : []

  // Market grain preference: curated community when known (alias-aware pulse),
  // else subdivision name (legacy community geoType), else neighborhood, else city.
  let preferredMarketGrain: PreferredMarketGrain = 'city'
  if (curatedCommunity) preferredMarketGrain = 'community'
  else if (subdivision) preferredMarketGrain = 'subdivision'
  else if (neighborhood) preferredMarketGrain = 'neighborhood'
  else preferredMarketGrain = 'city'

  const identityLine = breadcrumb
    .map((n) => n.label)
    .reverse() // finest first for scan: plat · nbhd · city
    .join(' · ')

  return {
    city,
    neighborhood,
    subdivision,
    curatedCommunity,
    preferredMarketGrain,
    breadcrumb,
    parents,
    identityLine,
  }
}
