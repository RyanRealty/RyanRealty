/**
 * Exclusive place filters (Matt 2026-09-16).
 *
 * A community / plat is its own boundary. Selecting Caldera Springs must not
 * also pin parent city Sunriver (or Bend via mls_cities). That auto-expand
 * made Places: 2, the map banner "Caldera Springs · Sunriver", and inventory
 * that included any Sunriver home.
 *
 * Path `/homes-for-sale/{city}/{community}` keeps the city segment for SEO.
 * That city is hierarchy, not a second selected place — drop it from the
 * listing query and Places chrome when it is only the community's parent.
 *
 * Query `?city=Sunriver&subdivision=Caldera Springs` means the user picked
 * both; keep both (OR / AND as the DAL already does). Do not invent the city.
 */

import { getResortCommunityBySubdivisionName } from '@/lib/data/communities/registry'
import { getSubdivisionMatchNames } from '@/lib/subdivision-aliases'
import { slugify } from '@/lib/slug'

export type PlaceKind = 'city' | 'neighborhood' | 'community' | 'subdivision' | 'school_district'

export type SelectedPlace = {
  kind: PlaceKind
  /** Stable id for tests / chips — display label or district slug. */
  id: string
  label: string
}

export type PlaceFilterInput = {
  city?: string | null
  neighborhood?: string | null
  subdivision?: string | null
  schoolDistrict?: string | null
}

export function splitPlaceCsv(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export function joinPlaceCsv(parts: string[]): string | undefined {
  return parts.length ? parts.join(',') : undefined
}

export function csvHasPlace(raw: string | null | undefined, value: string): boolean {
  const needle = value.trim().toLowerCase()
  return splitPlaceCsv(raw).some((s) => s.toLowerCase() === needle)
}

export function togglePlaceCsv(raw: string | null | undefined, value: string): string | undefined {
  const needle = value.trim()
  if (!needle) return joinPlaceCsv(splitPlaceCsv(raw))
  const cur = splitPlaceCsv(raw)
  const exists = cur.some((s) => s.toLowerCase() === needle.toLowerCase())
  const next = exists
    ? cur.filter((s) => s.toLowerCase() !== needle.toLowerCase())
    : [...cur, needle]
  return joinPlaceCsv(next)
}

function norm(value: string): string {
  return value.trim().toLowerCase()
}

function samePlaceName(a: string, b: string): boolean {
  const left = norm(a)
  const right = norm(b)
  if (!left || !right) return false
  if (left === right) return true
  return slugify(a) === slugify(b)
}

/** Registry community for a Places token (label, slug, or alias). */
export function communityForPlaceToken(token: string) {
  return getResortCommunityBySubdivisionName(token)
}

/** True when `city` is the registry parent of this community token. */
export function isImpliedParentCity(city: string | null | undefined, communityToken: string): boolean {
  if (!city?.trim() || !communityToken.trim()) return false
  const community = communityForPlaceToken(communityToken)
  if (!community) return false
  return samePlaceName(city, community.city) || samePlaceName(city, community.city_slug)
}

/**
 * Registry parent cities of the selected community tokens.
 * Used to strip path-hierarchy city, not mls_cities (those were never written
 * by the Places menu — adding them as a city pin is the same auto-expand).
 */
export function impliedParentCities(subdivisionCsv: string | null | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const token of splitPlaceCsv(subdivisionCsv)) {
    const community = communityForPlaceToken(token)
    if (!community) continue
    for (const name of [community.city, community.city_slug]) {
      const key = norm(name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(community.city)
    }
  }
  return out
}

/**
 * Drop cities that exist only as the parent of a selected community.
 * Path `/homes-for-sale/sunriver/caldera-springs` → city omitted.
 * Query `?city=Bend&subdivision=Caldera Springs` keeps Bend (not the parent).
 * Query `?city=Sunriver&subdivision=Caldera Springs` keeps Sunriver — that
 * encoding is how explicit multi-select is spelled after the user clicks both.
 */
export function stripImpliedParentCities(
  cityCsv: string | null | undefined,
  subdivisionCsv: string | null | undefined,
  options?: { source: 'path' | 'query' },
): string | undefined {
  const cities = splitPlaceCsv(cityCsv)
  if (cities.length === 0) return undefined
  const source = options?.source ?? 'query'
  if (source === 'query') return joinPlaceCsv(cities)
  const kept = cities.filter((city) =>
    !splitPlaceCsv(subdivisionCsv).some((token) => isImpliedParentCity(city, token)),
  )
  return joinPlaceCsv(kept)
}

/**
 * Path city + community → community-only filters.
 * Path city alone → city filter.
 * Generic plat (not a registry community) keeps city AND plat (disambiguate).
 */
export function pathPlaceFilters(
  pathCity: string | null | undefined,
  pathSubdivision: string | null | undefined,
): { city: string | undefined; subdivision: string | undefined } {
  const city = pathCity?.trim() || undefined
  const subdivision = pathSubdivision?.trim() || undefined
  if (!subdivision) return { city, subdivision: undefined }
  if (city && isImpliedParentCity(city, subdivision)) {
    return { city: undefined, subdivision }
  }
  return { city, subdivision }
}

export type ExclusivePlaceQuery = {
  city?: string
  cities?: string[]
  subdivision?: string
  subdivisions?: string[]
}

/**
 * Listing-query shape: expand community aliases, do not invent parent / MLS cities.
 * City pins are only the cities the caller already chose.
 */
export function toExclusivePlaceQuery(input: {
  city?: string | null
  subdivision?: string | null
}): ExclusivePlaceQuery {
  const cityParts = splitPlaceCsv(input.city)
  const subdivisionParts = splitPlaceCsv(input.subdivision)
  const subdivisionNames = [
    ...new Set(subdivisionParts.flatMap((name) => getSubdivisionMatchNames(name))),
  ]
  const out: ExclusivePlaceQuery = {}
  if (cityParts.length > 1) out.cities = cityParts
  else if (cityParts.length === 1) out.city = cityParts[0]
  if (subdivisionNames.length > 1) out.subdivisions = subdivisionNames
  else if (subdivisionNames.length === 1) out.subdivision = subdivisionNames[0]
  return out
}

export function selectedPlaces(input: PlaceFilterInput): SelectedPlace[] {
  const places: SelectedPlace[] = []
  for (const city of splitPlaceCsv(input.city)) {
    places.push({ kind: 'city', id: city, label: city })
  }
  for (const hood of splitPlaceCsv(input.neighborhood)) {
    places.push({ kind: 'neighborhood', id: hood, label: hood })
  }
  for (const sub of splitPlaceCsv(input.subdivision)) {
    const community = communityForPlaceToken(sub)
    places.push({
      kind: community ? 'community' : 'subdivision',
      id: community?.slug ?? sub,
      label: community?.label ?? sub,
    })
  }
  for (const district of splitPlaceCsv(input.schoolDistrict)) {
    places.push({ kind: 'school_district', id: district, label: district })
  }
  return places
}

/** Places chrome label: "Places" / "Places: Caldera Springs" / "Places: 2". */
export function placesChipLabel(input: PlaceFilterInput): string {
  const places = selectedPlaces(input)
  if (places.length === 0) return 'Places'
  if (places.length === 1) return `Places: ${places[0]!.label}`
  return `Places: ${places.length}`
}

/**
 * Map "Showing X only" copy. Finest exclusive grain wins. A parent city that
 * is only hierarchy next to a community is omitted so the banner does not
 * say "Caldera Springs · Sunriver" for a Caldera-only search.
 *
 * Explicit extra cities (not the community's parent) still join with · .
 */
export function exclusiveGeoScopeParts(input: PlaceFilterInput & { postalCode?: string | null }): string[] {
  const first = (raw: string | null | undefined) => raw?.split(',')[0]?.trim() || null
  const school = first(input.schoolDistrict)
  const hood = first(input.neighborhood)
  const subRaw = first(input.subdivision)
  const city = first(input.city)
  const zip = first(input.postalCode)

  const parts: string[] = []
  if (school) parts.push(school)
  if (hood) parts.push(hood)
  if (subRaw) parts.push(subRaw)
  if (city && !(subRaw && isImpliedParentCity(city, subRaw))) {
    parts.push(city)
  }
  if (zip) parts.push(zip)
  return parts
}

/** Toggle a community in subdivision CSV. Never writes the parent city. */
export function applyCommunityToggle(
  current: { city?: string | null; subdivision?: string | null },
  communityLabel: string,
): { city: string | undefined; subdivision: string | undefined } {
  return {
    city: joinPlaceCsv(splitPlaceCsv(current.city)),
    subdivision: togglePlaceCsv(current.subdivision, communityLabel),
  }
}

/** Toggle a plat in subdivision CSV. Never writes a guessed parent city. */
export function applySubdivisionToggle(
  current: { city?: string | null; subdivision?: string | null },
  platName: string,
): { city: string | undefined; subdivision: string | undefined } {
  return {
    city: joinPlaceCsv(splitPlaceCsv(current.city)),
    subdivision: togglePlaceCsv(current.subdivision, platName),
  }
}
