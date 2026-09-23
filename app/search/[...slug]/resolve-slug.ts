import { cache } from 'react'
import {
  getCityFromSlug,
  getSubdivisionNameFromSlug,
  getNeighborhoodNameForCitySlug,
} from '../../actions/listings'
import { homesForSalePath, listingsBrowsePath } from '../../../lib/slug'
import { getPresetBySlug, isPresetSlug } from '../../../lib/search-presets'
import { getResortCommunityBySlug } from '@/lib/data/communities/registry'
import { getBrowsePairDecision } from '@/lib/seo/getBrowsePairDecision'
import type { BrowsePairDecision, BrowsePairFacts } from '@/lib/seo/browse-pair-decision'

/**
 * FILTER name for an area slug no source could name, used ONLY in the
 * `unknown` state (a failed inventory read): the listings query still needs a
 * subdivision string to run. It is never printed — the page and its metadata
 * print `area.publicName`, which is null in that state (SEO-1: until
 * 2026-09-23 this title-cased value WAS the printed place name, so any made-up
 * second segment rendered as an indexable page about an invented place).
 * The registry label covers a community whose listings carry a different MLS
 * City (Caldera Springs: page city Sunriver, MLS City Bend).
 */
function subdivisionNameFromSlugFallback(subSlug: string): string {
  const registry = getResortCommunityBySlug(subSlug)
  if (registry?.label) return registry.label
  return safeDecode(subSlug)
    .trim()
    .replace(/-+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export type SearchPreset = ReturnType<typeof getPresetBySlug>

/** A malformed escape (/homes-for-sale/bend/%E0) is not an area; keep the raw text. */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * The browse-pair decision for a subdivision-family area segment (not a
 * neighborhood, not a preset). One shared decision with app/sitemap.ts —
 * lib/seo/browse-pair-decision.ts.
 */
async function resolveArea(
  citySlug: string,
  city: string | null,
  areaSlug: string,
): Promise<{ decision: BrowsePairDecision; facts: BrowsePairFacts; filterName: string | null }> {
  const { decision, facts } = await getBrowsePairDecision(
    safeDecode(citySlug).trim().toLowerCase(),
    safeDecode(areaSlug).trim().toLowerCase(),
    () => (city ? getSubdivisionNameFromSlug(city, areaSlug) : Promise.resolve(null)),
  )
  const filterName =
    decision.filterName ?? (decision.kind === 'unknown' ? subdivisionNameFromSlugFallback(areaSlug) : null)
  return { decision, facts, filterName }
}

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
  /**
   * The subdivision string the LISTINGS FILTER runs on. Not a display name:
   * print `area.publicName` (null when the area is unresolved, unknown, or
   * named only by an MLS code).
   */
  subdivisionDisplayName: string | null
  presetSlug: string | null
  preset: ReturnType<typeof getPresetBySlug>
  /** Set when the second segment is a known boundary_neighborhood (e.g. Bend
   *  "Mountain View"). Drives the single-indexed neighborhood fast path. */
  neighborhoodName: string | null
  /**
   * The shared browse-pair decision when the area segment is a subdivision-
   * family slug (not a neighborhood, not a preset); null otherwise.
   */
  area: BrowsePairDecision | null
  /** The facts that decision was made from (counts for the sold-history section). */
  areaFacts: BrowsePairFacts | null
}> {
  const citySlug = slug[0]
  const knownCity = citySlug ? await getCityFromSlug(citySlug) : null
  const resolvedCity = citySlug ? knownCity ?? decodeURIComponent(citySlug).trim() : null
  const city = resolvedCity ?? citySlug ?? null
  const noArea = { area: null, areaFacts: null } as const

  if (slug.length === 0) {
    return { city: null, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: null, preset: null, neighborhoodName: null, ...noArea }
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
        presetSlug: citySlug, preset: getPresetBySlug(citySlug), neighborhoodName: null, ...noArea,
      }
    }
    return { city, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: null, preset: null, neighborhoodName: null, ...noArea }
  }
  if (slug.length === 2) {
    const second = slug[1]!
    // A real neighborhood wins over a same-named preset. 'mountain-view' is BOTH
    // the Mountain View neighborhood AND a "mountain view" amenity preset; the
    // preset routed to the slow advanced RPC and timed out to an empty grid,
    // while the neighborhood resolves to one indexed boundary_neighborhood query.
    const neighborhoodName = citySlug ? await getNeighborhoodNameForCitySlug(citySlug, second) : null
    if (neighborhoodName) {
      return { city, subdivisionSlug: second, subdivisionDisplayName: neighborhoodName, presetSlug: null, preset: null, neighborhoodName, ...noArea }
    }
    if (isPresetSlug(second)) {
      return { city, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: second, preset: getPresetBySlug(second), neighborhoodName: null, ...noArea }
    }
    // SEO-1: the area must exist. The shared decision reads the lifetime MV,
    // the registry and the plat set; the active-listing name lookup runs only
    // when the MV does not know the pair.
    const { decision, facts, filterName } = await resolveArea(citySlug!, city, second)
    return {
      city, subdivisionSlug: second, subdivisionDisplayName: filterName, presetSlug: null, preset: null,
      neighborhoodName: null, area: decision, areaFacts: facts,
    }
  }
  // slug.length >= 3: [city, subdivision-or-neighborhood, preset]
  const subSlug = slug[1]!
  const nbhd3 = citySlug ? await getNeighborhoodNameForCitySlug(citySlug, subSlug) : null
  const presetSlug = slug[2] ?? null
  const preset = presetSlug ? getPresetBySlug(presetSlug) : null
  if (nbhd3) {
    return { city, subdivisionSlug: subSlug, subdivisionDisplayName: nbhd3, presetSlug, preset, neighborhoodName: nbhd3, ...noArea }
  }
  const { decision, facts, filterName } = await resolveArea(citySlug!, city, subSlug)
  return {
    city, subdivisionSlug: subSlug, subdivisionDisplayName: filterName, presetSlug, preset,
    neighborhoodName: null, area: decision, areaFacts: facts,
  }
}

/**
 * The name the page may PRINT for its area segment: the neighborhood name, or
 * the decision's public name. null = print no place name (unresolved, unknown,
 * or an MLS code publishPlatDisplayName withholds).
 */
export function printableAreaName(resolved: Pick<ResolvedSearchSlug, 'neighborhoodName' | 'area'>): string | null {
  if (resolved.neighborhoodName) return resolved.neighborhoodName
  return resolved.area?.publicName ?? null
}

/**
 * The place phrase for an area with no printable name, read as the object of
 * "Homes for sale in …". A withheld MLS code says what it is (a real filing,
 * not a named place) without printing the code; the transient `unknown` state
 * names only the city it is sure of.
 */
export function unnamedAreaPhrase(
  city: string | null | undefined,
  kind: BrowsePairDecision['kind'] | null | undefined,
): string {
  const c = (city ?? '').trim()
  if (kind === 'withheld-name') return c ? `an MLS-coded area of ${c}` : 'an MLS-coded area'
  return c ? `this area of ${c}` : 'this area'
}

export function buildCanonicalPath(city: string | null, subdivisionDisplayName: string | null, subdivisionSlug: string | null, presetSlug: string | null): string {
  if (!city) return listingsBrowsePath()
  const base = subdivisionDisplayName ?? subdivisionSlug
    ? homesForSalePath(city, subdivisionDisplayName ?? subdivisionSlug ?? null)
    : homesForSalePath(city, null)
  return presetSlug ? `${base}/${presetSlug}` : base
}
