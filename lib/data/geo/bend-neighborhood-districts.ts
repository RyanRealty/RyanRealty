/**
 * Bend NA district list — pure constants only.
 *
 * Kept free of Supabase / next/headers so client components (e.g. SearchFilters)
 * can import without pulling `@/lib/data/client` → `@/lib/supabase/server`.
 *
 * Server inventory / ledger modules re-export from here (one source of truth).
 */

/** Bend NA districts. Label = display name; slug = URL + `bend-{slug}` geo_slug. */
export const BEND_NEIGHBORHOOD_DISTRICTS: ReadonlyArray<{ label: string; slug: string }> = [
  { label: 'Awbrey Butte', slug: 'awbrey-butte' },
  { label: 'Boyd Acres', slug: 'boyd-acres' },
  { label: 'Century West', slug: 'century-west' },
  { label: 'Larkspur', slug: 'larkspur' },
  { label: 'Mountain View', slug: 'mountain-view' },
  { label: 'Old Bend', slug: 'old-bend' },
  { label: 'Old Farm District', slug: 'old-farm-district' },
  { label: 'Orchard District', slug: 'orchard-district' },
  { label: 'River West', slug: 'river-west' },
  { label: 'Southeast Bend', slug: 'southeast-bend' },
  { label: 'Southern Crossing', slug: 'southern-crossing' },
  { label: 'Southwest Bend', slug: 'southwest-bend' },
  { label: 'Summit West', slug: 'summit-west' },
]
