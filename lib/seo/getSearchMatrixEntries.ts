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
import {
  getSearchMatrixInventory,
  getSubdivisionLifetimeCounts,
  getSubdivisionDescriptionKeys,
  getMatrixNeighborhoods,
} from '@/lib/data/listings/getSearchMatrixInventory'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { SUBDIVISION_INDEX_MIN_LIFETIME_SALES } from '@/lib/data/subdivisions/subdivision-index'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { getSubdivisionBlurb } from '@/lib/city-content'
import { getSubdivisionMatchNames } from '@/lib/subdivision-aliases'
import { slugify } from '@/lib/slug'
import {
  buildSearchMatrix,
  citySlugToLowerName,
  matrixPath,
  shouldNoIndexMatrixCombo,
  type MatrixBuildResult,
  type MatrixGeo,
} from './search-matrix'

/** Batch width for the per-city subdivision RPC (matches app/sitemap.ts). */
const SUBDIVISION_RPC_BATCH = 6

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
          hasDepthContent,
        })
      }
    }
  }
  return geos
}

/**
 * Assemble the full matrix once per render (React cache) on top of the
 * hourly-cached DAL reads. Returns null when the inventory read failed.
 */
const getSearchMatrix = cache(async (): Promise<MatrixBuildResult | null> => {
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
      hasDepthContent: Boolean(resort.description?.trim() || resort.character?.trim()),
    })
  }

  // 3. Threshold-passing subdivisions.
  geos.push(...(await buildSubdivisionGeos(descKeySet)))

  return buildSearchMatrix(inventory, geos)
})

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
  const count = matrix.countByPath.get(matrixPath(city, area, preset))
  return shouldNoIndexMatrixCombo(count ?? null)
}
