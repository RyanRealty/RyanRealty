import { cache } from 'react'
import {
  getCityFromSlug,
  getSubdivisionNameFromSlug,
  getNeighborhoodNameForCitySlug,
} from '../../actions/listings'
import { homesForSalePath, listingsBrowsePath } from '../../../lib/slug'
import { getPresetBySlug, isPresetSlug } from '../../../lib/search-presets'

export type SearchPreset = ReturnType<typeof getPresetBySlug>

/** Resolve slug segments to city, subdivision (display name), and preset. */
// Request-scoped dedup: resolveSlug runs in both generateMetadata and the page
// body (1-3 sequential DB round trips each). cache() keys by per-arg Object.is,
// so an array arg never dedupes — key on the joined path to collapse the two
// resolutions into one per render.
const _resolveSlugByPath = cache((path: string) => resolveSlugImpl(path ? path.split('/') : []))
export function resolveSlug(slug: string[]) {
  return _resolveSlugByPath(slug.join('/'))
}

export type ResolvedSearchSlug = Awaited<ReturnType<typeof resolveSlug>>

async function resolveSlugImpl(slug: string[]): Promise<{
  city: string | null
  subdivisionSlug: string | null
  subdivisionDisplayName: string | null
  presetSlug: string | null
  preset: ReturnType<typeof getPresetBySlug>
  /** Set when the second segment is a known boundary_neighborhood (e.g. Bend
   *  "Mountain View"). Drives the single-indexed neighborhood fast path. */
  neighborhoodName: string | null
}> {
  const citySlug = slug[0]
  const knownCity = citySlug ? await getCityFromSlug(citySlug) : null
  const resolvedCity = citySlug ? knownCity ?? decodeURIComponent(citySlug).trim() : null
  const city = resolvedCity ?? citySlug ?? null

  if (slug.length === 0) {
    return { city: null, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: null, preset: null, neighborhoodName: null }
  }
  if (slug.length === 1) {
    // A single segment that is NOT a known city but IS a preset slug resolves
    // as an all-cities preset: /homes-for-sale/manufactured is the
    // manufactured search across the service area, not a phantom city page
    // with zero homes (found live 2026-07-31 — the exact dead-end class the
    // audit exists to kill). A real city always wins over a same-named preset,
    // matching the two-segment rule below.
    if (!knownCity && citySlug && isPresetSlug(citySlug)) {
      return {
        city: null, subdivisionSlug: null, subdivisionDisplayName: null,
        presetSlug: citySlug, preset: getPresetBySlug(citySlug), neighborhoodName: null,
      }
    }
    return { city, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: null, preset: null, neighborhoodName: null }
  }
  if (slug.length === 2) {
    const second = slug[1]!
    // A real neighborhood wins over a same-named preset. 'mountain-view' is BOTH
    // the Mountain View neighborhood AND a "mountain view" amenity preset; the
    // preset routed to the slow advanced RPC and timed out to an empty grid,
    // while the neighborhood resolves to one indexed boundary_neighborhood query.
    const neighborhoodName = citySlug ? await getNeighborhoodNameForCitySlug(citySlug, second) : null
    if (neighborhoodName) {
      return { city, subdivisionSlug: second, subdivisionDisplayName: neighborhoodName, presetSlug: null, preset: null, neighborhoodName }
    }
    if (isPresetSlug(second)) {
      return { city, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: second, preset: getPresetBySlug(second), neighborhoodName: null }
    }
    const subdivisionDisplayName = city ? (await getSubdivisionNameFromSlug(city, second)) ?? decodeURIComponent(second) : null
    return { city, subdivisionSlug: second, subdivisionDisplayName, presetSlug: null, preset: null, neighborhoodName: null }
  }
  // slug.length >= 3: [city, subdivision-or-neighborhood, preset]
  const subSlug = slug[1]!
  const nbhd3 = citySlug ? await getNeighborhoodNameForCitySlug(citySlug, subSlug) : null
  const subdivisionDisplayName = nbhd3 ?? (city ? (await getSubdivisionNameFromSlug(city, subSlug)) ?? decodeURIComponent(subSlug) : null)
  const presetSlug = slug[2] ?? null
  const preset = presetSlug ? getPresetBySlug(presetSlug) : null
  return { city, subdivisionSlug: subSlug, subdivisionDisplayName, presetSlug, preset, neighborhoodName: nbhd3 }
}

export function buildCanonicalPath(city: string | null, subdivisionDisplayName: string | null, subdivisionSlug: string | null, presetSlug: string | null): string {
  if (!city) return listingsBrowsePath()
  const base = subdivisionDisplayName ?? subdivisionSlug
    ? homesForSalePath(city, subdivisionDisplayName ?? subdivisionSlug ?? null)
    : homesForSalePath(city, null)
  return presetSlug ? `${base}/${presetSlug}` : base
}
