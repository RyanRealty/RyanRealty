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
    hasWaterfront?: boolean
    /** View type keyword (details.View ILIKE %viewContains%) */
    viewContains?: string
    /** Minimum lot size in acres (details.LotSizeAcres >= value) */
    lotAcresMin?: number
    /** Minimum year built. Use yearBuiltMinOffset for a year relative to "now". */
    yearBuiltMin?: number
    /**
     * Year-built floor expressed as an offset from the current year (e.g. 2 ⇒
     * "built in the last ~2 years"). Resolved at request time by
     * resolvePresetYearBuiltMin so "new construction" stays current without a
     * hard-coded year drifting stale in the source.
     */
    yearBuiltMinOffset?: number
    /** Property subtype keyword (details.PropertySubType ILIKE %value%) */
    propertySubType?: string
    /** Free-text keyword matched against the listing's PublicRemarks. */
    keywords?: string
    sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc'
  }
}

/**
 * Resolve the effective yearBuiltMin for a preset. When a preset uses
 * yearBuiltMinOffset (e.g. "new construction" = built in the last 2 years),
 * compute the floor relative to the current year so the filter never goes
 * stale. An explicit yearBuiltMin always wins.
 */
export function resolvePresetYearBuiltMin(preset: SearchPreset, now: Date = new Date()): number | undefined {
  if (preset.params.yearBuiltMin != null) return preset.params.yearBuiltMin
  if (preset.params.yearBuiltMinOffset != null) {
    return now.getFullYear() - preset.params.yearBuiltMinOffset
  }
  return undefined
}

export const SEARCH_PRESETS: SearchPreset[] = [
  // Price tiers
  { slug: 'under-300k', shortLabel: 'Under $300K', label: 'Homes Under $300,000', params: { maxPrice: 300_000, sort: 'newest' } },
  { slug: 'under-400k', shortLabel: 'Under $400K', label: 'Homes Under $400,000', params: { maxPrice: 400_000, sort: 'newest' } },
  { slug: 'under-500k', shortLabel: 'Under $500K', label: 'Homes Under $500,000', params: { maxPrice: 500_000, sort: 'newest' } },
  { slug: 'under-600k', shortLabel: 'Under $600K', label: 'Homes Under $600,000', params: { maxPrice: 600_000, sort: 'newest' } },
  { slug: 'under-750k', shortLabel: 'Under $750K', label: 'Homes Under $750,000', params: { maxPrice: 750_000, sort: 'newest' } },
  { slug: 'under-1m', shortLabel: 'Under $1M', label: 'Homes Under $1 Million', params: { maxPrice: 1_000_000, sort: 'newest' } },
  { slug: 'under-1-5m', shortLabel: 'Under $1.5M', label: 'Homes Under $1.5 Million', params: { maxPrice: 1_500_000, sort: 'newest' } },
  { slug: 'luxury', shortLabel: 'Luxury', label: 'Luxury Homes', params: { minPrice: 1_000_000, sort: 'newest' } },
  // Status / recency
  { slug: 'pending', shortLabel: 'Pending', label: 'Pending / Under Contract', params: { statusFilter: 'pending', sort: 'newest' } },
  { slug: 'new-listings', shortLabel: 'New Listings', label: 'New Listings (Last 7 Days)', params: { newListingsDays: 7, sort: 'newest' } },
  { slug: 'new-listings-30', shortLabel: 'New This Month', label: 'New Listings (Last 30 Days)', params: { newListingsDays: 30, sort: 'newest' } },
  { slug: 'open-house', shortLabel: 'Open House', label: 'Open House', params: { hasOpenHouse: true, sort: 'newest' } },
  // New construction — yearBuiltMinOffset keeps the floor current (built in the last ~2 years)
  { slug: 'new-construction', shortLabel: 'New Construction', label: 'New Construction Homes', params: { yearBuiltMinOffset: 2, sort: 'newest' } },
  // Land / lot
  { slug: 'acreage', shortLabel: 'Acreage', label: 'Homes on Acreage (1+ Acres)', params: { lotAcresMin: 1, sort: 'newest' } },
  { slug: 'acreage-5', shortLabel: '5+ Acres', label: 'Homes on 5+ Acres', params: { lotAcresMin: 5, sort: 'newest' } },
  // Property types
  { slug: 'condos', shortLabel: 'Condos', label: 'Condos for Sale', params: { propertySubType: 'Condo', sort: 'newest' } },
  { slug: 'townhomes', shortLabel: 'Townhomes', label: 'Townhomes for Sale', params: { propertySubType: 'Townhouse', sort: 'newest' } },
  // Layout / lifestyle (PublicRemarks keyword match)
  { slug: 'single-level', shortLabel: 'Single Level', label: 'Single-Level Homes', params: { keywords: 'single level', sort: 'newest' } },
  { slug: 'with-shop', shortLabel: 'With Shop', label: 'Homes with a Shop', params: { keywords: 'shop', sort: 'newest' } },
  { slug: 'rv-parking', shortLabel: 'RV Parking', label: 'Homes with RV Parking', params: { keywords: 'RV', sort: 'newest' } },
  // Features
  { slug: 'with-pool', shortLabel: 'With Pool', label: 'Homes with Pool', params: { hasPool: true, sort: 'newest' } },
  { slug: 'with-view', shortLabel: 'With View', label: 'Homes with View', params: { hasView: true, sort: 'newest' } },
  { slug: 'with-fireplace', shortLabel: 'With Fireplace', label: 'Homes with Fireplace', params: { hasFireplace: true, sort: 'newest' } },
  { slug: 'on-golf-course', shortLabel: 'On Golf Course', label: 'Homes on Golf Course', params: { hasGolfCourse: true, sort: 'newest' } },
  // View types (details.View keyword match)
  { slug: 'mountain-view', shortLabel: 'Mountain View', label: 'Homes with Mountain View', params: { viewContains: 'Mountain', sort: 'newest' } },
  { slug: 'water-view', shortLabel: 'Water View', label: 'Homes with Water View', params: { viewContains: 'Water', sort: 'newest' } },
  { slug: 'river-view', shortLabel: 'River View', label: 'Homes with River View', params: { viewContains: 'River', sort: 'newest' } },
  { slug: 'golf-course-view', shortLabel: 'Golf Course View', label: 'Homes with Golf Course View', params: { viewContains: 'Golf', sort: 'newest' } },
  { slug: 'lake-view', shortLabel: 'Lake View', label: 'Homes with Lake View', params: { viewContains: 'Lake', sort: 'newest' } },
  // Sorts
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
