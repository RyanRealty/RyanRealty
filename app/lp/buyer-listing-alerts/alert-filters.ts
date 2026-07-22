/**
 * alert-filters — pure mapping from the buyer LP's submission fields
 * (budget / areas / beds) to normalized listing-alert filter sets.
 *
 * The LP advertises "listing alerts" but historically only created the lead —
 * no listing_alerts row ever existed, so no alert email ever went out (funnel
 * gap closed 2026-07-21). This module builds the filters the alert cron
 * actually honors, through the SAME normalizeSavedSearchFilters vocabulary the
 * guest /search capture and the broker send center use, so every alert row in
 * the system hashes and matches identically.
 *
 * Pure (no I/O, no server-only imports) so the mapping is unit-testable and
 * safely importable from both the client form (area list) and the server
 * action (filter sets).
 */

import {
  normalizeSavedSearchFilters,
  hasNarrowingFilter,
  getSavedSearchHash,
  getFilterNameFallback,
} from '@/lib/search-filters'

/**
 * The areas the LP form offers, each mapped to its canonical filter predicate:
 * Bend districts + resort communities carry the canonical `neighborhoodSlug`
 * (boundaries.geo_slug values — see lib/neighborhood-areas.ts), outlying towns
 * carry the MLS `city` spelling. 'other' is a sentiment, not a geography — it
 * maps to no predicate and never mints a geographic alert.
 */
export const BUYER_LP_SEARCH_AREAS: ReadonlyArray<{
  slug: string
  label: string
  filter: Record<string, unknown> | null
}> = [
  { slug: 'northwest-crossing', label: 'NW Crossing', filter: { neighborhoodSlug: 'northwest-crossing' } },
  { slug: 'bend-river-west', label: 'River West (Bend)', filter: { neighborhoodSlug: 'bend-river-west' } },
  { slug: 'bend-old-bend', label: 'Old Bend', filter: { neighborhoodSlug: 'bend-old-bend' } },
  { slug: 'bend-awbrey-butte', label: 'Awbrey Butte', filter: { neighborhoodSlug: 'bend-awbrey-butte' } },
  { slug: 'tetherow', label: 'Tetherow', filter: { neighborhoodSlug: 'tetherow' } },
  { slug: 'broken-top', label: 'Broken Top', filter: { neighborhoodSlug: 'broken-top' } },
  { slug: 'sunriver', label: 'Sunriver', filter: { neighborhoodSlug: 'sunriver' } },
  { slug: 'crosswater', label: 'Crosswater', filter: { neighborhoodSlug: 'crosswater' } },
  { slug: 'caldera-springs', label: 'Caldera Springs', filter: { neighborhoodSlug: 'caldera-springs' } },
  { slug: 'redmond', label: 'Redmond', filter: { city: 'Redmond' } },
  { slug: 'sisters', label: 'Sisters', filter: { city: 'Sisters' } },
  { slug: 'la-pine', label: 'La Pine', filter: { city: 'La Pine' } },
  { slug: 'other', label: 'Open to other Central Oregon areas', filter: null },
]

const AREA_BY_SLUG = new Map(BUYER_LP_SEARCH_AREAS.map((a) => [a.slug, a]))

/** Cap alerts minted per submission so a checkbox sweep can't mass-insert rows. */
export const MAX_LP_ALERTS_PER_SUBMISSION = 5

export type BuyerAlertFilterSet = {
  /** Normalized (allowlisted + coerced) filters, ready to persist. */
  filters: Record<string, unknown>
  /** Stable hash for the (email, filters_hash) dedupe key. */
  filtersHash: string
  /** Human name for the alert row ("River West homes", "Redmond $400K-$600K"). */
  name: string
}

function positiveFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

/**
 * Build the alert filter sets for one LP submission: one per recognized area
 * (each carrying the shared budget/beds), or a single geography-free set when
 * no recognized area was picked but budget/beds still narrow the feed.
 *
 * Guarantees, mirroring app/actions/search-alert-capture.ts:
 *   - every set passes hasNarrowingFilter (never a whole-MLS alert)
 *   - every set is normalized through normalizeSavedSearchFilters
 *   - sets are deduped by hash and capped at MAX_LP_ALERTS_PER_SUBMISSION
 *
 * Returns [] when the submission carries nothing to alert on — the caller
 * skips alert creation entirely (the lead itself is still captured).
 */
export function buildBuyerAlertFilterSets(input: {
  budgetMin?: number
  budgetMax?: number
  bedsMin?: number
  searchAreas?: string[]
}): BuyerAlertFilterSet[] {
  const base: Record<string, unknown> = {}
  const minPrice = positiveFinite(input.budgetMin)
  const maxPrice = positiveFinite(input.budgetMax)
  const beds = positiveFinite(input.bedsMin)
  if (minPrice !== undefined) base.minPrice = minPrice
  if (maxPrice !== undefined) base.maxPrice = maxPrice
  if (beds !== undefined) base.beds = Math.floor(beds)

  // Recognized geographies only, deduped, order-preserving, capped.
  const areaFilters: Record<string, unknown>[] = []
  const seenSlugs = new Set<string>()
  for (const raw of input.searchAreas ?? []) {
    const slug = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
    if (!slug || seenSlugs.has(slug)) continue
    seenSlugs.add(slug)
    const area = AREA_BY_SLUG.get(slug)
    if (area?.filter) areaFilters.push(area.filter)
    if (areaFilters.length >= MAX_LP_ALERTS_PER_SUBMISSION) break
  }

  const candidates: Record<string, unknown>[] =
    areaFilters.length > 0 ? areaFilters.map((f) => ({ ...f, ...base })) : [base]

  const out: BuyerAlertFilterSet[] = []
  const seenHashes = new Set<string>()
  for (const candidate of candidates) {
    const filters = normalizeSavedSearchFilters(candidate)
    // Never sign someone up for "every home" (attack finding 2026-07-11).
    if (!hasNarrowingFilter(filters)) continue
    const filtersHash = getSavedSearchHash(filters)
    if (seenHashes.has(filtersHash)) continue
    seenHashes.add(filtersHash)
    out.push({ filters, filtersHash, name: getFilterNameFallback(filters) })
  }
  return out
}
