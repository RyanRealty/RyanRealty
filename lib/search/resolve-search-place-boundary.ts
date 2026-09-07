/**
 * Resolve which authoritative GIS boundary to draw for /homes-for-sale Places
 * multi-select (city / neighborhood / community / subdivision).
 *
 * Polygons come only from public.boundaries via getBoundaryGeoJSON — never
 * invented. Multi Places CSV: the primary (first) token of the finest grain
 * drives the ring + camera; listing queries still expand the full CSV.
 *
 * Slug conventions (docs/DATABASE_FOR_AI_AGENTS.md §3):
 *   city          geoType=city,         geoSlug=slugify(city)
 *   Bend district geoType=neighborhood, geoSlug=bend-<district-slug>
 *   resort        geoType=neighborhood, geoSlug=bare registry slug (storage)
 *   plat          geoType=subdivision,  geoSlug=slugify(plat name)
 */

import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/bend-neighborhood-districts'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { slugify } from '@/lib/slug'

export type SearchPlaceBoundaryKind =
  | 'neighborhood'
  | 'community'
  | 'subdivision'
  | 'city'

export type SearchPlaceBoundaryTarget = {
  kind: SearchPlaceBoundaryKind
  /** RPC geo_type for getBoundaryGeoJSON / boundaries table. */
  geoType: 'city' | 'neighborhood' | 'subdivision'
  geoSlug: string
  label: string
  /** PlacesService / map placeQuery string. */
  placeQuery: string
}

function firstCsv(raw: string | null | undefined): string | undefined {
  const t = raw?.split(',')[0]?.trim()
  return t || undefined
}

function bendDistrictByLabel(label: string) {
  const key = label.trim().toLowerCase()
  return BEND_NEIGHBORHOOD_DISTRICTS.find((d) => d.label.toLowerCase() === key) ?? null
}

function resortByLabel(label: string) {
  const key = label.trim().toLowerCase()
  return (
    getAllResortCommunities().find(
      (c) =>
        c.label.toLowerCase() === key ||
        c.slug === slugify(label) ||
        (c.subdivision_aliases ?? []).some((a) => a.trim().toLowerCase() === key),
    ) ?? null
  )
}

/**
 * Pure: pick the boundary target from URL place filters.
 * Returns null when nothing place-scoped is selected (regional camera).
 */
export function resolveSearchPlaceBoundaryTarget(input: {
  city?: string | null
  neighborhood?: string | null
  subdivision?: string | null
}): SearchPlaceBoundaryTarget | null {
  const primaryNeighborhood = firstCsv(input.neighborhood)
  const primarySubdivision = firstCsv(input.subdivision)
  const primaryCity = firstCsv(input.city)

  if (primaryNeighborhood) {
    const district = bendDistrictByLabel(primaryNeighborhood)
    if (district) {
      const city = primaryCity || 'Bend'
      return {
        kind: 'neighborhood',
        geoType: 'neighborhood',
        geoSlug: `bend-${district.slug}`,
        label: district.label,
        placeQuery: `${district.label} ${city} Oregon`,
      }
    }
  }

  if (primarySubdivision) {
    const resort = resortByLabel(primarySubdivision)
    if (resort) {
      return {
        kind: 'community',
        // Resorts are stored as geo_type=neighborhood with the bare registry slug.
        geoType: 'neighborhood',
        geoSlug: resort.slug,
        label: resort.label,
        placeQuery: `${resort.label} ${resort.city} Oregon`,
      }
    }
    const city = primaryCity || 'Bend'
    return {
      kind: 'subdivision',
      geoType: 'subdivision',
      geoSlug: slugify(primarySubdivision),
      label: primarySubdivision,
      placeQuery: `${primarySubdivision} ${city} Oregon`,
    }
  }

  if (primaryCity) {
    return {
      kind: 'city',
      geoType: 'city',
      geoSlug: slugify(primaryCity),
      label: primaryCity,
      placeQuery: `${primaryCity} Oregon`,
    }
  }

  return null
}
