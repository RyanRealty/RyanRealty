import type { SEARCH_PRESETS } from '@/lib/search-presets'

type Preset = (typeof SEARCH_PRESETS)[number] | null | undefined

/**
 * Build the geography half of a saved search, in CANONICAL filter keys.
 *
 * SaveSearchButton used to re-derive this from the pathname and label EVERY
 * second segment `subdivision`. But /homes-for-sale/bend/river-west,
 * /bend/west-hills and /bend/multi-family are the same URL shape and resolve to
 * a neighborhood, a subdivision, and a preset respectively. The saved-search
 * alert matcher compares `subdivision` against SubdivisionName, so a
 * neighborhood or a preset matched ZERO rows and the alert silently never
 * fired. Verified on production:
 *   subdivision_lower = 'river-west'     ->     0 rows
 *   subdivision_lower = 'multi-family'   ->     0 rows
 *   boundary_neighborhood = 'River West' -> 7,215 rows
 *
 * The search page resolves the segment already, so it passes the resolved
 * values here instead of the button guessing from the URL.
 */
export function buildSavedSearchPathFilters(input: {
  /** Resolved city DISPLAY name (e.g. "Bend"). */
  city: string | null | undefined
  /** First URL segment (e.g. "bend") — the neighborhood slug is prefixed with it. */
  citySlug: string | null | undefined
  /** Second URL segment, when it is a subdivision or neighborhood. */
  subdivisionSlug: string | null | undefined
  /** Subdivision DISPLAY name — SubdivisionName holds "West Hills", not the slug. */
  subdivisionDisplayName: string | null | undefined
  /** Set when the segment resolved to a known boundary neighborhood. */
  neighborhoodName: string | null | undefined
  /** Set when the segment resolved to a search preset. */
  preset: Preset
}): Record<string, unknown> {
  const filters: Record<string, unknown> = {}
  if (input.city) filters.city = input.city

  if (input.neighborhoodName && input.subdivisionSlug) {
    // The RPC's boundary scope keys on `<citySlug>-<slug>`; the bare slug
    // matches nothing ('bend-river-west' -> 49 actives, 'river-west' -> 0).
    const citySlug = (input.citySlug ?? '').toLowerCase().trim()
    filters.neighborhoodSlug = citySlug
      ? `${citySlug}-${input.subdivisionSlug}`
      : input.subdivisionSlug
  } else if (input.subdivisionDisplayName) {
    filters.subdivision = input.subdivisionDisplayName
  }

  // A preset contributes its real filter params (multi-family -> propertyType).
  if (input.preset?.params) {
    for (const [key, value] of Object.entries(input.preset.params)) {
      if (value != null) filters[key] = value
    }
  }
  return filters
}
