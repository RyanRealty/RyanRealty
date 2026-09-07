/**
 * Resolve which authoritative GIS boundary to draw for /homes-for-sale Places
 * multi-select (school district / neighborhood / community / subdivision / city).
 *
 * Polygons come only from public.boundaries via getBoundaryGeoJSON — never
 * invented. Multi Places CSV: the primary (first) token of the finest grain
 * drives the ring + camera; listing queries still expand the full CSV.
 *
 * Slug conventions (docs/DATABASE_FOR_AI_AGENTS.md §3):
 *   school district  geoType=school_district, geoSlug=districtSlug (registry)
 *   city             geoType=city,            geoSlug=slugify(city)
 *   Bend district    geoType=neighborhood,    geoSlug=bend-<district-slug>
 *   resort           geoType=neighborhood,    geoSlug=bare registry slug (storage)
 *   plat             geoType=subdivision,     geoSlug=slugify(plat name)
 */

import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/bend-neighborhood-districts'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { getSchoolDistrictOptions } from '@/lib/data/schools/getSchools'
import { slugify } from '@/lib/slug'

export type SearchPlaceBoundaryKind =
  | 'school_district'
  | 'neighborhood'
  | 'community'
  | 'subdivision'
  | 'city'

export type SearchPlaceBoundaryTarget = {
  kind: SearchPlaceBoundaryKind
  /** RPC geo_type for getBoundaryGeoJSON / boundaries table. */
  geoType: 'city' | 'neighborhood' | 'subdivision' | 'school_district'
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

function schoolDistrictByToken(token: string) {
  const key = token.trim().toLowerCase()
  const slugKey = slugify(token)
  return (
    getSchoolDistrictOptions().find(
      (d) => d.slug === key || d.slug === slugKey || d.label.toLowerCase() === key,
    ) ?? null
  )
}

/**
 * Pure: pick the boundary target from URL place filters.
 * Returns null when nothing place-scoped is selected (regional camera).
 * Finest grain wins: school district → neighborhood → community/subdivision → city.
 */
export function resolveSearchPlaceBoundaryTarget(input: {
  city?: string | null
  neighborhood?: string | null
  subdivision?: string | null
  schoolDistrict?: string | null
}): SearchPlaceBoundaryTarget | null {
  const primarySchoolDistrict = firstCsv(input.schoolDistrict)
  const primaryNeighborhood = firstCsv(input.neighborhood)
  const primarySubdivision = firstCsv(input.subdivision)
  const primaryCity = firstCsv(input.city)

  if (primarySchoolDistrict) {
    const district = schoolDistrictByToken(primarySchoolDistrict)
    if (district) {
      return {
        kind: 'school_district',
        geoType: 'school_district',
        geoSlug: district.slug,
        label: district.label,
        placeQuery: `${district.label} Oregon`,
      }
    }
  }

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
