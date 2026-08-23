/**
 * derive-search-links — PURE derivation of the auto internal-link layer (W3.4).
 *
 * Replaces the hand-curated popular-searches snapshot (lib/popular-searches.ts,
 * counts frozen 2026-06-03) with link sets derived from LIVE inventory:
 *   - city browse links ranked by active SFR count (geo_snapshot_mv via DAL)
 *   - city + preset search links ranked by how many active tiles actually match
 *     the preset's filters (listing_tile_mv columns — §0: a link is only
 *     emitted when live inventory verifiably backs it)
 *   - community links ranked by community active counts
 *   - top subdivision browse links ranked by active counts
 *
 * Everything in this file is pure + synchronous so ranking, caps, thresholds,
 * and matcher semantics are unit-testable with fixtures. The Supabase-facing
 * wrapper lives in ./getSiteIndexLinks.ts.
 *
 * DERIVABILITY RULE: a preset is only counted when EVERY filter param it
 * carries can be evaluated from listing_tile_mv columns. A preset with a
 * partially-evaluable filter (keywords, viewContains, golf, gated, open house,
 * pending status, fireplace, waterfront) is EXCLUDED rather than over-counted —
 * a link backed by an inflated match count would point at emptier results than
 * the ranking implied. Sort-only presets are excluded (duplicate content,
 * same rule the sitemap applies via isSortOnlyPreset).
 */

import type { SearchPreset } from '@/lib/search-presets'
import {
  SEARCH_PRESETS,
  isSortOnlyPreset,
  resolvePresetYearBuiltMin,
} from '@/lib/search-presets'
import { propertyTypeFilterToCodes } from '@/lib/property-type'
import { resolveLegacyPropertySubType } from '@/lib/data/listings/searchPredicates'
import { CENTRAL_OREGON_CITY_SLUGS, citySlugForScope } from '@/lib/central-oregon'
import { slugify } from '@/lib/slug'

// ───────────────────────── Types ─────────────────────────

/** Minimal projection of one active listing_tile_mv row (nulls preserved). */
export type ActiveTileLite = {
  city: string | null
  listPrice: number | null
  /** MLS PropertyType code A–H. */
  propertyType: string | null
  propertySubType: string | null
  lotAcres: number | null
  yearBuilt: number | null
  hasPool: boolean | null
  /** ISO timestamp. */
  onMarketDate: string | null
}

/** One derived internal link. `count` is the ranking signal, not display copy. */
export type DerivedLink = {
  href: string
  label: string
  count: number
}

/** One derived preset link (keeps the preset slug for consumers/tests). */
export type DerivedPresetLink = DerivedLink & { presetSlug: string }

/** A city with a real page, ranked by live active count. */
export type CityIndexLink = {
  slug: string
  name: string
  count: number
  /** Canonical browse hub, e.g. /homes-for-sale/bend */
  browseHref: string
  /** City guide hub, e.g. /cities/bend */
  hubHref: string
}

/** Minimal projection of a geo_snapshot_mv row (via the DAL snapshot types). */
export type GeoCountLite = {
  /** city rows: "la pine" · community rows: "bend:awbrey butte" */
  geoKey: string
  geoLabel: string
  activeSfrCount: number | null
}

export type CommunityRef = {
  slug: string
  label: string
  city: string
}

// ─────────────────────── Helpers ───────────────────────

/** "la pine" → "La Pine" (display fallback when the MV label is lowercase). */
export function titleCaseWords(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** Slugs that must never become a URL segment (mirror of the sitemap rule —
 *  'N/A' slugifies to 'na'; 'n-a' kept for defense in depth). */
const BANNED_SUB_SLUGS = new Set(['', 'unknown', 'n-a', 'na'])

// ─────────────────── Preset tile matcher ───────────────────

/**
 * Param keys presetTileMatcher can evaluate from listing_tile_mv columns.
 * `sort` is routing-only (no filter). Anything else ⇒ preset not derivable.
 */
const SUPPORTED_PARAM_KEYS = new Set([
  'maxPrice',
  'minPrice',
  'yearBuiltMin',
  'yearBuiltMinOffset',
  'lotAcresMin',
  'propertySubType',
  'propertySubTypes',
  'propertyType',
  'hasPool',
  'newListingsDays',
  'sort',
])

const DAY_MS = 86_400_000

/**
 * A preset's sub-type filter as a lowercase EXACT-value set, or null when the
 * preset has none. Mirrors searchListingsAll 1:1 (plan §4.8.4): the enumerated
 * `propertySubTypes` array is used verbatim; the legacy scalar resolves
 * through the same resolveLegacyPropertySubType table the DAL uses — never a
 * substring needle.
 */
export function presetSubTypeSet(params: {
  propertySubType?: string
  propertySubTypes?: string[]
}): ReadonlySet<string> | null {
  const values: string[] = []
  if (Array.isArray(params.propertySubTypes)) values.push(...params.propertySubTypes)
  if (params.propertySubType) {
    const resolved = resolveLegacyPropertySubType(params.propertySubType)
    if (resolved.kind === 'in') values.push(...resolved.values)
    else if (resolved.kind === 'ciEquals') values.push(resolved.value)
  }
  if (values.length === 0) return null
  return new Set(values.map((v) => v.toLowerCase()))
}

/**
 * Build a tile predicate for a preset, or null when the preset cannot be
 * FULLY evaluated from tile columns (see the derivability rule above).
 * Null-guarded conservatively: a tile missing a needed field does NOT match.
 */
export function presetTileMatcher(
  preset: SearchPreset,
  now: Date = new Date(),
): ((tile: ActiveTileLite) => boolean) | null {
  if (isSortOnlyPreset(preset)) return null
  const params = preset.params as Record<string, unknown>
  const filterKeys = Object.keys(params).filter(
    (k) => params[k] !== undefined && k !== 'sort',
  )
  if (filterKeys.length === 0) return null
  if (!filterKeys.every((k) => SUPPORTED_PARAM_KEYS.has(k))) return null

  const p = preset.params
  const yearMin = resolvePresetYearBuiltMin(preset, now)
  const ptCodes = p.propertyType ? propertyTypeFilterToCodes(p.propertyType) : null
  // An unmapped propertyType value would silently match everything — refuse.
  if (p.propertyType && (!ptCodes || ptCodes.length === 0)) return null
  const subTypeSet = presetSubTypeSet(p)
  const newSinceMs =
    p.newListingsDays != null ? now.getTime() - p.newListingsDays * DAY_MS : null

  return (tile: ActiveTileLite): boolean => {
    if (p.maxPrice != null && !(tile.listPrice != null && tile.listPrice <= p.maxPrice)) return false
    if (p.minPrice != null && !(tile.listPrice != null && tile.listPrice >= p.minPrice)) return false
    if (yearMin != null && !(tile.yearBuilt != null && tile.yearBuilt >= yearMin)) return false
    if (p.lotAcresMin != null && !(tile.lotAcres != null && tile.lotAcres >= p.lotAcresMin)) return false
    if (subTypeSet != null && !(tile.propertySubType != null && subTypeSet.has(tile.propertySubType.toLowerCase()))) return false
    if (ptCodes != null && !(tile.propertyType != null && ptCodes.includes(tile.propertyType.toUpperCase()))) return false
    if (p.hasPool === true && tile.hasPool !== true) return false
    if (newSinceMs != null) {
      const t = tile.onMarketDate != null ? Date.parse(tile.onMarketDate) : NaN
      if (!(Number.isFinite(t) && t >= newSinceMs)) return false
    }
    return true
  }
}

// ─────────────────── City + preset ranking ───────────────────

export type CityPresetOptions = {
  /** Max derived links per city. Default 10 (matches the old curated depth). */
  perCity?: number
  /** Minimum live matches for a link to earn a slot. Default 3. */
  minCount?: number
  /** Preset pool (tests inject fixtures). Default SEARCH_PRESETS. */
  presets?: SearchPreset[]
  now?: Date
}

/**
 * Rank each city's preset search URLs by live match count.
 * Returns citySlug → ranked links (count desc, preset-pool order tiebreak).
 */
export function deriveCityPresetLinks(
  tiles: ActiveTileLite[],
  cities: Array<{ slug: string; name: string }>,
  options: CityPresetOptions = {},
): Map<string, DerivedPresetLink[]> {
  const perCity = options.perCity ?? 10
  const minCount = options.minCount ?? 3
  const presets = options.presets ?? SEARCH_PRESETS
  const now = options.now ?? new Date()

  const matchers: Array<{ preset: SearchPreset; match: (t: ActiveTileLite) => boolean }> = []
  for (const preset of presets) {
    const match = presetTileMatcher(preset, now)
    if (match) matchers.push({ preset, match })
  }

  const tilesByCity = new Map<string, ActiveTileLite[]>()
  for (const tile of tiles) {
    if (!tile.city) continue
    const slug = citySlugForScope(tile.city)
    if (!slug) continue
    const bucket = tilesByCity.get(slug)
    if (bucket) bucket.push(tile)
    else tilesByCity.set(slug, [tile])
  }

  const out = new Map<string, DerivedPresetLink[]>()
  for (const city of cities) {
    const cityTiles = tilesByCity.get(city.slug) ?? []
    const ranked: DerivedPresetLink[] = []
    for (const { preset, match } of matchers) {
      let count = 0
      for (const tile of cityTiles) {
        if (match(tile)) count += 1
      }
      if (count < minCount) continue
      ranked.push({
        href: `/homes-for-sale/${city.slug}/${preset.slug}`,
        label: preset.shortLabel,
        presetSlug: preset.slug,
        count,
      })
    }
    // Stable sort: count desc; ties keep preset-pool order (Array.prototype.sort
    // is stable per spec, and ranked was built in pool order).
    ranked.sort((a, b) => b.count - a.count)
    out.set(city.slug, ranked.slice(0, perCity))
  }
  return out
}

// ─────────────────── City ranking ───────────────────

/**
 * Rank the cities that have a REAL page (allowedSlugs, e.g. SITE_CITY_SLUGS)
 * by live active count. A city missing a snapshot row still gets its links
 * (its page exists) — it just ranks last with count 0.
 */
export function deriveCityLinks(
  snapshots: GeoCountLite[],
  allowedSlugs: readonly string[],
): CityIndexLink[] {
  const bySlug = new Map<string, GeoCountLite>()
  for (const snap of snapshots) {
    bySlug.set(citySlugForScope(snap.geoKey), snap)
  }
  const links: CityIndexLink[] = allowedSlugs.map((slug) => {
    const snap = bySlug.get(slug)
    const n = snap?.activeSfrCount
    const count = n != null && Number.isFinite(n) && n > 0 ? n : 0
    const name = snap?.geoLabel?.trim()
      ? titleCaseWords(snap.geoLabel)
      : titleCaseWords(slug.replace(/-/g, ' '))
    return {
      slug,
      name,
      count,
      browseHref: `/homes-for-sale/${slug}`,
      hubHref: `/cities/${slug}`,
    }
  })
  links.sort((a, b) => b.count - a.count)
  return links
}

// ─────────────────── Community ranking ───────────────────

/**
 * Rank the curated resort-community registry by live active count. Every
 * registry entry keeps its link (the page always exists) — ranking only.
 * countByGeoKey keys are geo_snapshot_mv community keys: "<city>:<label>"
 * lowercase (the exact form the community detail page builds).
 */
export function deriveCommunityLinks(
  entries: CommunityRef[],
  countByGeoKey: Map<string, number>,
): DerivedLink[] {
  const links = entries.map((entry) => {
    const geoKey = `${entry.city.toLowerCase().trim()}:${entry.label.toLowerCase().trim()}`
    const raw = countByGeoKey.get(geoKey)
    const count = raw != null && Number.isFinite(raw) && raw > 0 ? raw : 0
    return {
      href: `/communities/${entry.slug}`,
      label: `${entry.label} · ${entry.city}`,
      count,
    }
  })
  links.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return links
}

// ─────────────────── Subdivision ranking ───────────────────

export type SubdivisionOptions = {
  /** Max links. Default 50. */
  cap?: number
  /** Minimum active count. Default 3. */
  minCount?: number
  /** Subdivision slugs to skip (e.g. resort communities already linked). */
  excludeSubSlugs?: ReadonlySet<string>
}

/**
 * Rank (city, subdivision) browse URLs by live active count from the community
 * snapshot rows. Scoped to Central Oregon cities, junk slugs dropped, deduped
 * by href (max count wins), capped.
 */
export function deriveSubdivisionLinks(
  snapshots: GeoCountLite[],
  options: SubdivisionOptions = {},
): DerivedLink[] {
  const cap = options.cap ?? 50
  const minCount = options.minCount ?? 3
  const exclude = options.excludeSubSlugs ?? new Set<string>()

  const byHref = new Map<string, DerivedLink>()
  for (const snap of snapshots) {
    const sep = snap.geoKey.indexOf(':')
    if (sep <= 0) continue
    const cityPart = snap.geoKey.slice(0, sep).trim()
    const subPart = snap.geoKey.slice(sep + 1).trim()
    if (!cityPart || !subPart) continue
    const citySlug = citySlugForScope(cityPart)
    if (!CENTRAL_OREGON_CITY_SLUGS.has(citySlug)) continue
    const subSlug = slugify(subPart)
    if (BANNED_SUB_SLUGS.has(subSlug) || exclude.has(subSlug)) continue
    const count = snap.activeSfrCount != null && Number.isFinite(snap.activeSfrCount) ? snap.activeSfrCount : 0
    if (count < minCount) continue
    const href = `/homes-for-sale/${citySlug}/${subSlug}`
    const label = `${titleCaseWords(snap.geoLabel?.trim() ? snap.geoLabel : subPart)} · ${titleCaseWords(cityPart)}`
    const existing = byHref.get(href)
    if (!existing || count > existing.count) byHref.set(href, { href, label, count })
  }

  const links = [...byHref.values()]
  links.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return links.slice(0, cap)
}
