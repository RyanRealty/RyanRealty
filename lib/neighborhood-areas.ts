import resortCommunities from '@/data/resort-communities.json'

/**
 * Canonical neighborhood-area helpers — shared by the saved-search filter
 * model, the market-report engine, and the CRM default-subscription
 * provisioning (Matt directive 2026-07-06: every CRM neighborhood list gets a
 * default saved search + market report).
 *
 * A "neighborhood slug" here is the canonical boundaries.geo_slug /
 * crm_people.neighborhood_slug value:
 *   - Bend districts carry the 'bend-' prefix ('bend-river-west')
 *   - resort/area communities are bare registry slugs ('tetherow')
 *
 * Client-safe (no server-only imports) so lib/search-filters.ts can use it.
 */

/**
 * The 13 Bend neighborhood districts (boundaries geo_type='neighborhood',
 * 'bend-' prefixed). Kept in lockstep with the crm_report_areas seed in
 * supabase/migrations/20260707101000_crm_report_areas_bend_districts.sql —
 * the report-areas-seed parity test asserts the two match.
 */
export const BEND_DISTRICTS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'bend-awbrey-butte', label: 'Awbrey Butte' },
  { slug: 'bend-boyd-acres', label: 'Boyd Acres' },
  { slug: 'bend-century-west', label: 'Century West' },
  { slug: 'bend-larkspur', label: 'Larkspur' },
  { slug: 'bend-mountain-view', label: 'Mountain View' },
  { slug: 'bend-old-bend', label: 'Old Bend' },
  { slug: 'bend-old-farm-district', label: 'Old Farm District' },
  { slug: 'bend-orchard-district', label: 'Orchard District' },
  { slug: 'bend-river-west', label: 'River West' },
  { slug: 'bend-southeast-bend', label: 'Southeast Bend' },
  { slug: 'bend-southern-crossing', label: 'Southern Crossing' },
  { slug: 'bend-southwest-bend', label: 'Southwest Bend' },
  { slug: 'bend-summit-west', label: 'Summit West' },
] as const

type RegistryCommunity = { slug?: unknown; label?: unknown }

function registryLabel(slug: string): string | null {
  const communities = Array.isArray((resortCommunities as { communities?: unknown }).communities)
    ? ((resortCommunities as { communities: RegistryCommunity[] }).communities)
    : []
  const match = communities.find((c) => c.slug === slug)
  return match && typeof match.label === 'string' ? match.label : null
}

function titleize(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** Display label for a canonical neighborhood slug ('bend-river-west' → 'River West'). */
export function labelForNeighborhoodSlug(slug: string): string {
  const trimmed = slug.trim()
  const district = BEND_DISTRICTS.find((d) => d.slug === trimmed)
  if (district) return district.label
  return registryLabel(trimmed) ?? titleize(trimmed.replace(/^bend-/, ''))
}

/**
 * Canonical landing page for a neighborhood slug: Bend districts live under
 * /cities/bend/<district>; resort/area communities under /communities/<slug>.
 */
export function hrefForNeighborhoodSlug(slug: string): string {
  const trimmed = slug.trim()
  if (trimmed.startsWith('bend-')) return `/cities/bend/${trimmed.slice('bend-'.length)}`
  return `/communities/${trimmed}`
}
