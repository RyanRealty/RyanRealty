/**
 * Predefined search presets for SEO-friendly, indexable pages.
 * Used for: /homes-for-sale/[city]/[preset] and /homes-for-sale/[city]/[subdivision]/[preset].
 * Each preset maps to search params and a human-readable label for titles and breadcrumbs.
 */

export type SearchPreset = {
  slug: string
  label: string
  /** Short label for "in {place}" e.g. "Under $500K", "Pending" */
  shortLabel: string
  params: {
    maxPrice?: number
    minPrice?: number
    statusFilter?: 'active' | 'active_and_pending' | 'pending' | 'closed' | 'all'
    newListingsDays?: number
    hasOpenHouse?: boolean
    hasPool?: boolean
    hasView?: boolean
    hasFireplace?: boolean
    hasGolfCourse?: boolean
    /** View type keyword (details.View ILIKE %viewContains%) */
    viewContains?: string
    sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc'
  }
}

export const SEARCH_PRESETS: SearchPreset[] = [
  { slug: 'under-300k', shortLabel: 'Under $300K', label: 'Homes Under $300,000', params: { maxPrice: 300_000, sort: 'newest' } },
  { slug: 'under-500k', shortLabel: 'Under $500K', label: 'Homes Under $500,000', params: { maxPrice: 500_000, sort: 'newest' } },
  { slug: 'under-750k', shortLabel: 'Under $750K', label: 'Homes Under $750,000', params: { maxPrice: 750_000, sort: 'newest' } },
  { slug: 'under-1m', shortLabel: 'Under $1M', label: 'Homes Under $1 Million', params: { maxPrice: 1_000_000, sort: 'newest' } },
  { slug: 'under-1-5m', shortLabel: 'Under $1.5M', label: 'Homes Under $1.5 Million', params: { maxPrice: 1_500_000, sort: 'newest' } },
  { slug: 'luxury', shortLabel: 'Luxury', label: 'Luxury Homes', params: { minPrice: 1_000_000, sort: 'newest' } },
  { slug: 'pending', shortLabel: 'Pending', label: 'Pending / Under Contract', params: { statusFilter: 'pending', sort: 'newest' } },
  { slug: 'new-listings', shortLabel: 'New Listings', label: 'New Listings (Last 7 Days)', params: { newListingsDays: 7, sort: 'newest' } },
  { slug: 'new-listings-30', shortLabel: 'New This Month', label: 'New Listings (Last 30 Days)', params: { newListingsDays: 30, sort: 'newest' } },
  { slug: 'open-house', shortLabel: 'Open House', label: 'Open House', params: { hasOpenHouse: true, sort: 'newest' } },
  { slug: 'with-pool', shortLabel: 'With Pool', label: 'Homes with Pool', params: { hasPool: true, sort: 'newest' } },
  { slug: 'with-view', shortLabel: 'With View', label: 'Homes with View', params: { hasView: true, sort: 'newest' } },
  { slug: 'with-fireplace', shortLabel: 'With Fireplace', label: 'Homes with Fireplace', params: { hasFireplace: true, sort: 'newest' } },
  { slug: 'on-golf-course', shortLabel: 'On Golf Course', label: 'Homes on Golf Course', params: { hasGolfCourse: true, sort: 'newest' } },
  { slug: 'mountain-view', shortLabel: 'Mountain View', label: 'Homes with Mountain View', params: { viewContains: 'Mountain', sort: 'newest' } },
  { slug: 'water-view', shortLabel: 'Water View', label: 'Homes with Water View', params: { viewContains: 'Water', sort: 'newest' } },
  { slug: 'golf-course-view', shortLabel: 'Golf Course View', label: 'Homes with Golf Course View', params: { viewContains: 'Golf', sort: 'newest' } },
  { slug: 'lake-view', shortLabel: 'Lake View', label: 'Homes with Lake View', params: { viewContains: 'Lake', sort: 'newest' } },
  { slug: 'price-low-to-high', shortLabel: 'Price: Low to High', label: 'Homes by Price (Low to High)', params: { sort: 'price_asc' } },
  { slug: 'price-high-to-low', shortLabel: 'Price: High to Low', label: 'Homes by Price (High to Low)', params: { sort: 'price_desc' } },
]

const PRESET_BY_SLUG = new Map(SEARCH_PRESETS.map((p) => [p.slug, p]))

export function getPresetBySlug(slug: string): SearchPreset | null {
  if (!slug?.trim()) return null
  const key = slug.trim().toLowerCase()
  return PRESET_BY_SLUG.get(key) ?? null
}

export function isPresetSlug(slug: string): boolean {
  return getPresetBySlug(slug) !== null
}

/** All preset slugs (for sitemap and link generation). */
export function getAllPresetSlugs(): string[] {
  return SEARCH_PRESETS.map((p) => p.slug)
}
