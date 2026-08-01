/**
 * search-matrix — PURE emission logic for the 3-segment
 * /homes-for-sale/{city}/{area}/{preset} search matrix (W3.2/3.3, 2026-07-22).
 *
 * The 3-segment pages render fine but had ZERO sitemap entries and zero
 * internal links. This module decides which (curated geo x preset) combos earn
 * a sitemap slot, from ONE aggregate inventory read
 * (lib/data/listings/getSearchMatrixInventory — the slim on-market row set).
 *
 * Emission contract (both must hold):
 *   1. >= SEARCH_MATRIX_MIN_ACTIVE listings verifiably match the combo from
 *      live inventory (§0: a submitted URL is never backed by invented
 *      inventory), AND
 *   2. the geo has real editorial depth content (a stored description /
 *      registry description / static blurb) — a bare listing grid with no
 *      depth never earns an index slot.
 * Zero-inventory combos stay RENDERABLE but are noindexed at render time via
 * shouldNoIndexMatrixCombo (fail-OPEN: an unknown inventory state never
 * noindexes a live page).
 *
 * DERIVABILITY RULE (same principle as lib/data/seo/derive-search-links.ts):
 * a preset is only evaluated at matrix scope when EVERY filter param it
 * carries can be computed from the slim SearchMatrixInventoryRow columns.
 * Partially-evaluable presets (keywords, open house, golf — needs
 * lot_features_arr, new-listings — needs on_market_date) are EXCLUDED rather
 * than mis-counted. Sort-only presets are excluded (duplicate content).
 *
 * ODS COMPLIANCE (G54): presets whose statusFilter is 'closed' or 'all' are
 * REFUSED at matrix scope — sold/closed listing data is VOW-only and never
 * gets an indexable public search page.
 *
 * Everything here is pure + synchronous so thresholds, matcher semantics, and
 * the noindex decision are unit-testable with fixtures
 * (lib/seo/search-matrix.test.ts). The Supabase-facing assembly lives in
 * ./getSearchMatrixEntries.ts.
 */

import type { SearchPreset } from '@/lib/search-presets'
import {
  SEARCH_PRESETS,
  isSortOnlyPreset,
  resolvePresetYearBuiltMin,
  viewContainsMatchesValues,
} from '@/lib/search-presets'
import { propertyTypeFilterToCodes } from '@/lib/property-type'
import { presetSubTypeSet } from '@/lib/data/seo/derive-search-links'
import type { SearchMatrixInventoryRow } from '@/lib/data/listings/getSearchMatrixInventory'
import {
  PUBLIC_ACTIVE_STATUSES,
  PUBLIC_PENDING_STATUSES,
} from '@/lib/listing-status-public'

// ───────────────────────── Constants ─────────────────────────

/** Minimum verified active matches for a combo to earn a sitemap slot. */
export const SEARCH_MATRIX_MIN_ACTIVE = 1

// ───────────────────────── Types ─────────────────────────

export type MatrixGeoKind = 'neighborhood' | 'resort' | 'subdivision'

/**
 * One curated area under a city — a Bend boundary neighborhood, a registry
 * resort community, or a subdivision that passed the D1 lifetime-sales
 * threshold. Carries exactly the fields the row matcher needs so tests can
 * inject fixtures without any DB shape.
 */
export type MatrixGeo = {
  kind: MatrixGeoKind
  /** Canonical city slug — the first URL segment ('bend', 'la-pine'). */
  citySlug: string
  /** Area slug — the second URL segment ('awbrey-butte', 'tetherow'). */
  areaSlug: string
  /** Lowercase MLS city spelling the inventory rows carry ('la pine'). */
  cityLower: string
  /**
   * neighborhood kind: the EXACT boundary_neighborhood label ('Awbrey Butte')
   * — mirrors searchListingsAll's eq('boundary_neighborhood', name).
   */
  neighborhoodName?: string
  /**
   * resort/subdivision kinds: lowercase subdivision_name spellings including
   * MLS aliases — mirrors the page's getSubdivisionMatchNames IN-match.
   */
  subdivisionNamesLower?: readonly string[]
  /** Editorial depth exists (description / blurb) — emission gate #2. */
  hasDepthContent: boolean
}

/** One emitted (geo x preset) combo. `count` is the verified active match. */
export type MatrixEntry = {
  /** Root-relative path: /homes-for-sale/{city}/{area}/{preset}. */
  path: string
  citySlug: string
  areaSlug: string
  presetSlug: string
  count: number
}

export type MatrixBuildResult = {
  /** Sitemap set: hasDepthContent AND count >= minActive, path-sorted. */
  entries: MatrixEntry[]
  /**
   * Verified count for EVERY curated geo x derivable preset (zeros included)
   * keyed by path — the render-time noindex lookup. A path absent from this
   * map means the combo could not be verified (uncurated geo or
   * non-derivable preset) — callers fail OPEN.
   */
  countByPath: Map<string, number>
  /**
   * W3.1 — verified CITY-WIDE active count for every (service-area city ×
   * derivable preset), zeros included, keyed by cityPresetPath. Drives the
   * 2-segment /homes-for-sale/{city}/{preset} noindex + sitemap emission. A path
   * absent means unverifiable (city not in inventory or non-derivable preset) —
   * callers fail OPEN, exactly like countByPath.
   */
  countByCityPreset: Map<string, number>
}

// ───────────────────────── Helpers ─────────────────────────

/** 'la-pine' -> 'la pine' (the lowercase MLS City spelling on the MV). */
export function citySlugToLowerName(citySlug: string): string {
  return citySlug.replace(/-/g, ' ').trim().toLowerCase()
}

/** Canonical 3-segment matrix path. */
export function matrixPath(citySlug: string, areaSlug: string, presetSlug: string): string {
  return `/homes-for-sale/${citySlug}/${areaSlug}/${presetSlug}`
}

/** Canonical 2-segment city×preset path — /homes-for-sale/{city}/{preset}. */
export function cityPresetPath(citySlug: string, presetSlug: string): string {
  return `/homes-for-sale/${citySlug}/${presetSlug}`
}

/** MLS city_lower ('la pine') -> canonical city slug ('la-pine'). Inverse of
 *  citySlugToLowerName for the service-area cities (slug = name, spaces→hyphens). */
export function cityLowerToSlug(cityLower: string): string {
  return cityLower.trim().toLowerCase().replace(/\s+/g, '-')
}

const ACTIVE_SET = new Set<string>(PUBLIC_ACTIVE_STATUSES)
const PENDING_SET = new Set<string>(PUBLIC_PENDING_STATUSES)

// ─────────────────── Preset row matcher ───────────────────

/**
 * Param keys evaluable from SearchMatrixInventoryRow columns. `sort` is
 * routing-only. Anything else ⇒ the preset is not derivable at matrix scope:
 *   - keywords: public_remarks deliberately excluded from the slim read
 *   - hasOpenHouse: has_open_house not projected
 *   - hasGolfCourse: needs lot_features_arr (view_types alone undercounts)
 *   - newListingsDays: on_market_date not projected — and a 7/30-day window
 *     at area scope flickers combos in and out of the sitemap
 */
const SUPPORTED_PARAM_KEYS = new Set([
  'maxPrice',
  'minPrice',
  'statusFilter',
  'yearBuiltMin',
  'yearBuiltMinOffset',
  'lotAcresMin',
  'propertyType',
  'propertySubType',
  'propertySubTypes',
  'hasPool',
  'hasFireplace',
  'hasWaterfront',
  'hasView',
  'viewContains',
  'gatedCommunity',
  'sort',
])

/** statusFilter values allowed at matrix scope. 'closed'/'all' = ODS refuse. */
const SUPPORTED_STATUS_FILTERS = new Set(['active', 'active_and_pending', 'pending'])

function rowStatusMatches(
  status: string | null,
  filter: 'active' | 'active_and_pending' | 'pending',
): boolean {
  if (!status) return false
  if (filter === 'pending') return PENDING_SET.has(status)
  if (filter === 'active_and_pending') return ACTIVE_SET.has(status) || PENDING_SET.has(status)
  return ACTIVE_SET.has(status)
}

/**
 * Build a row predicate for a preset, or null when the preset cannot be FULLY
 * evaluated from the slim columns (derivability rule above). Null-guarded
 * conservatively: a row missing a needed field does NOT match. Semantics
 * mirror searchListingsAll 1:1 (EXACT property_sub_type value sets — the
 * substring contract is gone, plan §4.8.4 — Gated in hoa_amenities OR
 * parking_features, view_types beyond bare 'Neighborhood').
 */
export function presetMatrixMatcher(
  preset: SearchPreset,
  now: Date = new Date(),
): ((row: SearchMatrixInventoryRow) => boolean) | null {
  if (isSortOnlyPreset(preset)) return null
  const params = preset.params as Record<string, unknown>
  const filterKeys = Object.keys(params).filter((k) => params[k] !== undefined && k !== 'sort')
  if (filterKeys.length === 0) return null
  if (!filterKeys.every((k) => SUPPORTED_PARAM_KEYS.has(k))) return null

  const p = preset.params
  // ODS G54: sold/closed searches never become indexable matrix pages.
  const statusFilter = p.statusFilter ?? 'active'
  if (!SUPPORTED_STATUS_FILTERS.has(statusFilter)) return null
  const effectiveStatus = statusFilter as 'active' | 'active_and_pending' | 'pending'

  const yearMin = resolvePresetYearBuiltMin(preset, now)
  const ptCodes = p.propertyType ? propertyTypeFilterToCodes(p.propertyType) : null
  // An unmapped propertyType would silently match everything — refuse.
  if (p.propertyType && (!ptCodes || ptCodes.length === 0)) return null
  const subTypeSet = presetSubTypeSet(p)
  const viewNeedle = p.viewContains ? p.viewContains.trim().toLowerCase() : null

  return (row: SearchMatrixInventoryRow): boolean => {
    if (!rowStatusMatches(row.standard_status, effectiveStatus)) return false
    if (p.maxPrice != null && !(row.list_price != null && row.list_price <= p.maxPrice)) return false
    if (p.minPrice != null && !(row.list_price != null && row.list_price >= p.minPrice)) return false
    if (yearMin != null && !(row.year_built != null && row.year_built >= yearMin)) return false
    if (p.lotAcresMin != null && !(row.lot_size_acres != null && row.lot_size_acres >= p.lotAcresMin)) return false
    if (subTypeSet != null && !(row.property_sub_type != null && subTypeSet.has(row.property_sub_type.toLowerCase()))) return false
    if (ptCodes != null && !(row.property_type != null && ptCodes.includes(row.property_type.toUpperCase()))) return false
    if (p.hasPool === true && row.pool_yn !== true) return false
    if (p.hasFireplace === true && row.fireplace_yn !== true) return false
    if (p.hasWaterfront === true && row.waterfront_yn !== true) return false
    if (p.hasView === true) {
      const views = row.view_types
      const hasRealView =
        Array.isArray(views) &&
        views.length > 0 &&
        !(views.length === 1 && views[0] === 'Neighborhood')
      if (!hasRealView) return false
    }
    if (viewNeedle != null) {
      // ONE viewContains semantics, shared with the DAL (lib/search/view-contains):
      // resolved vocabulary values UNION the raw substring test. Sitemap
      // emission and the page's own query must answer the same question — a
      // matrix that says "0 matches" for a page the DAL fills is how a
      // reachable page goes unsubmitted.
      if (!viewContainsMatchesValues(viewNeedle, row.view_types)) return false
    }
    if (p.gatedCommunity === true) {
      const gated =
        (Array.isArray(row.hoa_amenities) && row.hoa_amenities.includes('Gated')) ||
        (Array.isArray(row.parking_features) && row.parking_features.includes('Gated'))
      if (!gated) return false
    }
    return true
  }
}

/** The subset of a preset pool that is derivable at matrix scope. */
export function matrixEmittablePresets(
  presets: readonly SearchPreset[] = SEARCH_PRESETS,
  now: Date = new Date(),
): SearchPreset[] {
  return presets.filter((preset) => presetMatrixMatcher(preset, now) !== null)
}

// ─────────────────── Matrix build ───────────────────

export type BuildMatrixOptions = {
  /** Preset pool (tests inject fixtures). Default SEARCH_PRESETS. */
  presets?: readonly SearchPreset[]
  /** Minimum verified matches for a sitemap slot. Default SEARCH_MATRIX_MIN_ACTIVE. */
  minActive?: number
  now?: Date
}

/**
 * Evaluate every curated geo x derivable preset against the inventory rows.
 * ONE pass buckets rows into geos; each preset then counts inside the bucket.
 * Deterministic: entries sorted by path, first geo wins a duplicate
 * (city, area) key — callers order geos neighborhood > resort > subdivision,
 * matching the route's resolveSlug precedence.
 */
export function buildSearchMatrix(
  rows: readonly SearchMatrixInventoryRow[],
  geos: readonly MatrixGeo[],
  options: BuildMatrixOptions = {},
): MatrixBuildResult {
  const presets = options.presets ?? SEARCH_PRESETS
  const minActive = options.minActive ?? SEARCH_MATRIX_MIN_ACTIVE
  const now = options.now ?? new Date()

  const matchers: Array<{ preset: SearchPreset; match: (row: SearchMatrixInventoryRow) => boolean }> = []
  for (const preset of presets) {
    const match = presetMatrixMatcher(preset, now)
    if (match) matchers.push({ preset, match })
  }

  // First geo wins a duplicate (city, area) key — resolveSlug precedence.
  const geoByKey = new Map<string, MatrixGeo>()
  for (const geo of geos) {
    const key = `${geo.citySlug}/${geo.areaSlug}`
    if (!geoByKey.has(key)) geoByKey.set(key, geo)
  }
  const dedupedGeos = [...geoByKey.values()]

  // Bucket rows per geo in one inventory pass.
  const byNeighborhood = new Map<string, MatrixGeo[]>()
  const bySubdivision = new Map<string, MatrixGeo[]>()
  for (const geo of dedupedGeos) {
    if (geo.kind === 'neighborhood') {
      if (!geo.neighborhoodName) continue
      const key = `${geo.cityLower}|${geo.neighborhoodName}`
      const list = byNeighborhood.get(key)
      if (list) list.push(geo)
      else byNeighborhood.set(key, [geo])
    } else {
      for (const name of geo.subdivisionNamesLower ?? []) {
        const key = `${geo.cityLower}|${name}`
        const list = bySubdivision.get(key)
        if (list) list.push(geo)
        else bySubdivision.set(key, [geo])
      }
    }
  }

  const buckets = new Map<MatrixGeo, SearchMatrixInventoryRow[]>()
  const pushRow = (geo: MatrixGeo, row: SearchMatrixInventoryRow) => {
    const bucket = buckets.get(geo)
    if (bucket) bucket.push(row)
    else buckets.set(geo, [row])
  }
  for (const row of rows) {
    const cityLower = (row.city_lower ?? '').trim().toLowerCase()
    if (!cityLower) continue
    const nbhd = (row.boundary_neighborhood ?? '').trim()
    if (nbhd) {
      const geosForNbhd = byNeighborhood.get(`${cityLower}|${nbhd}`)
      if (geosForNbhd) for (const geo of geosForNbhd) pushRow(geo, row)
    }
    const subLower = (row.subdivision_lower ?? '').trim().toLowerCase()
    if (subLower) {
      const geosForSub = bySubdivision.get(`${cityLower}|${subLower}`)
      if (geosForSub) for (const geo of geosForSub) pushRow(geo, row)
    }
  }

  const entries: MatrixEntry[] = []
  const countByPath = new Map<string, number>()
  for (const geo of dedupedGeos) {
    const bucket = buckets.get(geo) ?? []
    for (const { preset, match } of matchers) {
      let count = 0
      for (const row of bucket) {
        if (match(row)) count += 1
      }
      const path = matrixPath(geo.citySlug, geo.areaSlug, preset.slug)
      countByPath.set(path, count)
      if (!geo.hasDepthContent) continue
      if (count < minActive) continue
      entries.push({
        path,
        citySlug: geo.citySlug,
        areaSlug: geo.areaSlug,
        presetSlug: preset.slug,
        count,
      })
    }
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

  // W3.1 — city-wide (city × preset) counts, independent of the curated-geo
  // buckets above. Initialize 0 for every service-area city present in the
  // inventory × derivable preset so a VERIFIED zero (city has rows, preset
  // derivable, no match) is distinguishable from an unverifiable ABSENT (city
  // not in inventory / non-derivable preset → caller fails OPEN), then count
  // every matching active row city-wide.
  const countByCityPreset = new Map<string, number>()
  const cityLowersSeen = new Set<string>()
  for (const row of rows) {
    const cl = (row.city_lower ?? '').trim().toLowerCase()
    if (cl) cityLowersSeen.add(cl)
  }
  for (const cl of cityLowersSeen) {
    const citySlug = cityLowerToSlug(cl)
    for (const { preset } of matchers) countByCityPreset.set(cityPresetPath(citySlug, preset.slug), 0)
  }
  for (const row of rows) {
    const cl = (row.city_lower ?? '').trim().toLowerCase()
    if (!cl) continue
    const citySlug = cityLowerToSlug(cl)
    for (const { preset, match } of matchers) {
      if (match(row)) {
        const key = cityPresetPath(citySlug, preset.slug)
        countByCityPreset.set(key, (countByCityPreset.get(key) ?? 0) + 1)
      }
    }
  }

  return { entries, countByPath, countByCityPreset }
}

/** Absolute sitemap URLs for the emitted set. */
export function searchMatrixSitemapUrls(
  entries: readonly MatrixEntry[],
  baseUrl: string,
): string[] {
  const base = baseUrl.replace(/\/$/, '')
  return entries.map((entry) => `${base}${entry.path}`)
}

// ─────────────────── Render-time noindex decision ───────────────────

/**
 * The 3-segment page's robots decision for a matrix combo.
 *
 *   verifiedActiveCount = the countByPath lookup for the combo, or null when
 *   the count could NOT be verified (inventory read failed, uncurated geo, or
 *   a non-derivable preset).
 *
 * noindex ONLY on a VERIFIED zero — an unknown state fails OPEN (never
 * noindex a live page on a transient read blip; see the DAL docstring).
 * Depth content gates sitemap SUBMISSION, not indexability: a combo with
 * real inventory but no editorial depth simply is not submitted.
 */
export function shouldNoIndexMatrixCombo(verifiedActiveCount: number | null): boolean {
  return verifiedActiveCount != null && verifiedActiveCount <= 0
}
