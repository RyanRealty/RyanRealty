/**
 * getSearchMatrixEntries — Supabase-facing assembly for the search-matrix
 * emission (W3.2/3.3). Pure logic lives in ./search-matrix.ts; this file wires
 * the cached DAL reads (ONE aggregate inventory read + curated geo sources)
 * into the matrix build, and exposes:
 *
 *   - getSearchMatrixSitemapEntries(baseUrl, now) — the sitemap spread for
 *     app/sitemap.ts (lane D1 wires the one-line call).
 *   - getMatrixComboNoIndex(city, area, preset) — the render-time robots
 *     decision for app/search/[...slug]/page.tsx generateMetadata.
 *
 * Geo sources (curated only — never every MLS subdivision):
 *   - boundary neighborhoods (public.neighborhoods — the /cities/{city}/{n}
 *     set), depth = a non-empty description
 *   - resort communities (data/resort-communities.json registry), depth = a
 *     registry description/character
 *   - subdivisions passing the D1 lifetime-sales threshold
 *     (SUBDIVISION_INDEX_MIN_LIFETIME_SALES closed sales in that city, via
 *     the get_subdivision_status_counts RPC), depth = a stored
 *     subdivision_descriptions row or a static city-content blurb
 *
 * Precedence for a duplicate (city, area) slug pair mirrors the route's
 * resolveSlug: neighborhood > resort > subdivision.
 *
 * Failure model: every read is resilient-cached with a null fallback. A null
 * inventory read returns null here — the sitemap skips the matrix for that
 * regeneration (safe: transient omission), and the noindex decision fails
 * OPEN (never noindex a live page on a read blip).
 */

import { cache } from 'react'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import {
  getSearchMatrixInventory,
  getSubdivisionLifetimeCounts,
  getSubdivisionDescriptionKeys,
  getMatrixNeighborhoods,
} from '@/lib/data/listings/getSearchMatrixInventory'
import { getAllResortCommunities, getResortCommunityBySubdivisionName } from '@/lib/data/communities/registry'
import { SUBDIVISION_INDEX_MIN_LIFETIME_SALES } from '@/lib/data/subdivisions/subdivision-index'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { getSubdivisionBlurb } from '@/lib/city-content'
import { getSubdivisionMatchNames } from '@/lib/subdivision-aliases'
import { slugify } from '@/lib/slug'
import {
  buildSearchMatrix,
  cityPresetPath,
  citySlugToLowerName,
  matrixPath,
  shouldNoIndexMatrixCombo,
  type MatrixBuildResult,
  type MatrixEntry,
  type MatrixGeo,
} from './search-matrix'

/** Batch width for the per-city subdivision RPC (matches app/sitemap.ts). */
const SUBDIVISION_RPC_BATCH = 6

/** Same 1-hour TTL the raw inventory read used to carry. */
const MATRIX_CACHE_SECONDS = 3600

async function buildSubdivisionGeos(descriptionKeys: ReadonlySet<string>): Promise<MatrixGeo[]> {
  const citySlugs = [...CENTRAL_OREGON_CITY_SLUGS]
  const geos: MatrixGeo[] = []
  for (let i = 0; i < citySlugs.length; i += SUBDIVISION_RPC_BATCH) {
    const batch = citySlugs.slice(i, i + SUBDIVISION_RPC_BATCH)
    const results = await Promise.all(
      batch.map(async (citySlug) => ({
        citySlug,
        rows: await getSubdivisionLifetimeCounts(citySlug),
      })),
    )
    for (const { citySlug, rows } of results) {
      if (!rows) continue // read failed — skip this city's subdivisions
      const seen = new Set<string>()
      for (const row of rows) {
        const name = (row.subdivision_name ?? '').trim()
        if (!name || name === 'N/A') continue
        // D1's threshold: real CLOSED-sale depth in this city, not a listing
        // trickle (aligned with lib/data/subdivisions/subdivision-index.ts).
        if ((row.closed ?? 0) < SUBDIVISION_INDEX_MIN_LIFETIME_SALES) continue
        const areaSlug = slugify(name)
        if (areaSlug === 'unknown' || seen.has(areaSlug)) continue
        seen.add(areaSlug)
        const hasDepthContent =
          descriptionKeys.has(`${citySlug}:${areaSlug}`) || getSubdivisionBlurb(name) != null
        geos.push({
          kind: 'subdivision',
          citySlug,
          areaSlug,
          cityLower: citySlugToLowerName(citySlug),
          subdivisionNamesLower: getSubdivisionMatchNames(name).map((n) => n.toLowerCase()),
          extraCityLowers: (getResortCommunityBySubdivisionName(name)?.mls_cities ?? [])
            .map((c) => c.toLowerCase().trim())
            .filter(Boolean),
          hasDepthContent,
        })
      }
    }
  }
  return geos
}

/**
 * The matrix, serialized for the data cache.
 *
 * CORRECTION, 2026-07-30. The 2026-07-28 version of this cached the two full
 * count maps and its comment claimed that was "a few KB". It was not. That
 * measurement only covered `entries` (241 sitemap rows, 39KB); `countByPath`
 * carries one entry for EVERY geo x preset combination, not just the emitted
 * ones, and the real serialized payload measured **2,405,122 bytes** — still
 * over unstable_cache's 2MB cap. So the write kept failing silently, the cache
 * never populated, and `getMatrixCityPresetNoIndex` rebuilt the whole matrix
 * once per city x preset inside buildAllUrls. That is why a cold sitemap pass
 * cost 194-456s and why both the 600s and 1800s build ceilings were breached.
 *
 * The fix is to stop storing counts at all. `shouldNoIndexMatrixCombo` is
 * `count != null && count <= 0` — the ONLY thing either map is consulted for is
 * "is this combo a VERIFIED ZERO". So we store just the zero paths. Absent from
 * the set means index (a positive count and an unknown combo both fail OPEN,
 * exactly as before); present means noindex. Same decision, a fraction of the
 * bytes.
 */
type SerializedMatrix = {
  entries: MatrixEntry[]
  /**
   * Combos with a POSITIVE count, plus the enumerated key space needed to tell
   * "verified zero" from "never enumerated". Storing the ZEROES instead was the
   * obvious inversion and the wrong one: measured on the real geo set, 35,528 of
   * 41,748 combos are zero, so a zero-list is 1.84MB — under the 2MB cap but
   * with 92% of it consumed and growing with every new subdivision. The positive
   * list is 6,220.
   */
  positivePaths: string[]
  /** "city/area" for every geo the builder enumerated. */
  geoKeys: string[]
  positiveCityPresets: string[]
  cityPresetKeys: string[]
}

function splitByCount(counts: Map<string, number>): { positive: string[]; all: string[] } {
  const positive: string[] = []
  const all: string[] = []
  for (const [k, n] of counts) {
    all.push(k)
    if (!shouldNoIndexMatrixCombo(n)) positive.push(k)
  }
  return { positive, all }
}

async function buildSerializedMatrix(): Promise<SerializedMatrix | null> {
  const built = await assembleSearchMatrix()
  if (!built) return null
  const byPath = splitByCount(built.countByPath)
  const byCityPreset = splitByCount(built.countByCityPreset)
  // The geo key space collapses 41,748 paths to ~1,500 "city/area" pairs: a
  // combo is ENUMERATED when its geo was built and its preset is a real preset.
  const geoKeys = new Set<string>()
  for (const path of byPath.all) {
    const seg = path.split('/') // ['', 'homes-for-sale', city, area, preset]
    if (seg.length >= 5) geoKeys.add(`${seg[2]}/${seg[3]}`)
  }
  return {
    entries: built.entries,
    positivePaths: byPath.positive,
    geoKeys: [...geoKeys],
    positiveCityPresets: byCityPreset.positive,
    cityPresetKeys: byCityPreset.all,
  }
}

// Same TTL + invalidation tag the raw inventory read used to carry, so refresh
// behaviour is unchanged — only WHAT is stored changed. `null` fallback keeps
// the fail-OPEN contract: a failed read must never read as "zero inventory".
const cachedSerializedMatrix = makeResilientCached<[], SerializedMatrix | null>(
  buildSerializedMatrix,
  ['search-matrix-built-v1'],
  { revalidate: MATRIX_CACHE_SECONDS, tags: [cacheTag.listings] },
  null,
)

/**
 * The matrix for this render: one data-cache read, rehydrated, memoized per
 * request by React `cache()`. Returns null when the inventory read failed.
 */
type MatrixDecisions = {
  entries: MatrixEntry[]
  positivePaths: Set<string>
  geoKeys: Set<string>
  positiveCityPresets: Set<string>
  cityPresetKeys: Set<string>
}

const getSearchMatrix = cache(async (): Promise<MatrixDecisions | null> => {
  const s = await cachedSerializedMatrix()
  if (!s) return null
  return {
    entries: s.entries,
    positivePaths: new Set(s.positivePaths),
    geoKeys: new Set(s.geoKeys),
    positiveCityPresets: new Set(s.positiveCityPresets),
    cityPresetKeys: new Set(s.cityPresetKeys),
  }
})

/** The uncached assembly — inventory + geos → matrix. Runs on a cache miss only. */
const assembleSearchMatrix = async (): Promise<MatrixBuildResult | null> => {
  const [inventory, neighborhoods, descriptionKeys] = await Promise.all([
    getSearchMatrixInventory(),
    getMatrixNeighborhoods(),
    getSubdivisionDescriptionKeys(),
  ])
  if (!inventory) return null

  const descKeySet = new Set(descriptionKeys ?? [])
  const geos: MatrixGeo[] = []

  // 1. Boundary neighborhoods (resolveSlug precedence: neighborhood first).
  for (const n of neighborhoods ?? []) {
    geos.push({
      kind: 'neighborhood',
      citySlug: n.citySlug,
      areaSlug: n.slug,
      cityLower: citySlugToLowerName(n.citySlug),
      neighborhoodName: n.name,
      hasDepthContent: n.hasDescription,
    })
  }

  // 2. Resort-community registry (label + MLS aliases).
  for (const resort of getAllResortCommunities()) {
    const names = new Set<string>([resort.label.toLowerCase().trim()])
    for (const alias of resort.subdivision_aliases ?? []) {
      const lower = alias.toLowerCase().trim()
      if (lower) names.add(lower)
    }
    geos.push({
      kind: 'resort',
      citySlug: resort.city_slug,
      areaSlug: slugify(resort.label),
      cityLower: citySlugToLowerName(resort.city_slug),
      subdivisionNamesLower: [...names],
      // A resort's homes can file under its own MLS City (mls_cities) — count
      // them, or the matrix noindexes a page that plainly has inventory.
      extraCityLowers: (resort.mls_cities ?? []).map((c) => c.toLowerCase().trim()).filter(Boolean),
      hasDepthContent: Boolean(resort.description?.trim() || resort.character?.trim()),
    })
  }

  // 3. Threshold-passing subdivisions.
  geos.push(...(await buildSubdivisionGeos(descKeySet)))

  return buildSearchMatrix(inventory, geos)
}

export type MatrixSitemapEntry = {
  url: string
  lastModified: Date
  changeFrequency: 'weekly'
  priority: number
}

/**
 * Sitemap entries for the emitted (geo x preset) combos. Empty on a failed
 * inventory read — a transiently thinner sitemap is safe; a fabricated one
 * is not.
 */
export async function getSearchMatrixSitemapEntries(
  baseUrl: string,
  now: Date,
): Promise<MatrixSitemapEntry[]> {
  const matrix = await getSearchMatrix()
  if (!matrix) return []
  const base = baseUrl.replace(/\/$/, '')
  return matrix.entries.map((entry) => ({
    url: `${base}${entry.path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.55,
  }))
}

/**
 * Render-time robots decision for a 3-segment combo: true = noindex.
 * Noindex ONLY on a VERIFIED zero-inventory combo. Unknown states (failed
 * inventory read, uncurated geo, non-derivable preset) fail OPEN.
 */
export async function getMatrixComboNoIndex(
  citySlug: string,
  areaSlug: string,
  presetSlug: string,
): Promise<boolean> {
  const city = (citySlug ?? '').trim().toLowerCase()
  const area = (areaSlug ?? '').trim().toLowerCase()
  const preset = (presetSlug ?? '').trim().toLowerCase()
  if (!city || !area || !preset) return false
  const matrix = await getSearchMatrix()
  if (!matrix) return false
  const path = matrixPath(city, area, preset)
  if (matrix.positivePaths.has(path)) return false // has inventory -> index
  // Fail OPEN on a combo the builder never enumerated (unknown != zero).
  if (!matrix.geoKeys.has(`${city}/${area}`)) return false
  return true // enumerated and not positive -> VERIFIED zero
}

/**
 * W3.1 — the 2-segment /homes-for-sale/{city}/{preset} decision, used by BOTH
 * the render-time robots tag AND the sitemap emission (one source of truth):
 *   true  = VERIFIED city-wide zero → noindex the page AND omit it from the
 *           sitemap (never submit a zero-inventory indexable URL, §0).
 *   false = >= 1 verified match, OR unverifiable (non-serviceable city /
 *           non-derivable preset / failed read) → index + emit, failing OPEN so
 *           a transient read blip never hides a live page.
 */
export async function getMatrixCityPresetNoIndex(citySlug: string, presetSlug: string): Promise<boolean> {
  const city = (citySlug ?? '').trim().toLowerCase()
  const preset = (presetSlug ?? '').trim().toLowerCase()
  if (!city || !preset) return false
  const matrix = await getSearchMatrix()
  if (!matrix) return false
  const path = cityPresetPath(city, preset)
  if (matrix.positiveCityPresets.has(path)) return false
  if (!matrix.cityPresetKeys.has(path)) return false // never enumerated -> index
  return true
}

/**
 * The single render-time noindex decision for a preset search route, across both
 * the 3-segment {city}/{area}/{preset} (W3.2) and 2-segment {city}/{preset}
 * (W3.1) scopes. Returns false (index) for a non-preset route or any unknown
 * state — fail OPEN. Kept here (not inline in the page) so the search route
 * god-file stays lean and the branch is testable.
 */
export async function resolveMatrixNoIndex(
  slug: string[],
  presetSlug: string | null,
  hasInvalidPresetSegment: boolean,
): Promise<boolean> {
  if (!presetSlug) return false
  if (slug.length >= 3 && !hasInvalidPresetSegment) return getMatrixComboNoIndex(slug[0]!, slug[1]!, presetSlug)
  if (slug.length === 2) return getMatrixCityPresetNoIndex(slug[0]!, presetSlug)
  return false
}
