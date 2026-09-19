/**
 * Search document title + description. Shared by generateMetadata, the
 * visually-hidden H1, and WebPage JSON-LD so the three cannot drift.
 *
 * SITE-110: the title used to drop the price band the URL already carried
 * ("3+ Bedroom Tetherow Homes for Sale" while the query was under $800K).
 * That is an SEO miss and an honesty miss — the SERP must name the filter.
 */

export type SearchTitleFilters = {
  city?: string
  subdivision?: string
  beds?: number
  baths?: number
  minPrice?: number
  maxPrice?: number
}

export function formatSearchPriceBand(min?: number, max?: number): string | null {
  const lo = Number.isFinite(min) ? (min as number) : undefined
  const hi = Number.isFinite(max) ? (max as number) : undefined
  if (lo == null && hi == null) return null
  const short = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
    return `$${n}`
  }
  if (lo != null && hi != null) return `${short(lo)} to ${short(hi)}`
  if (lo != null) return `${short(lo)}+`
  return `under ${short(hi as number)}`
}

export function buildSearchTitle(filters: SearchTitleFilters): string {
  const parts: string[] = []
  if (filters.beds != null && filters.beds > 0) parts.push(`${filters.beds}+ Bedroom`)
  if (filters.baths != null && filters.baths > 0) parts.push(`${filters.baths}+ Bath`)
  const loc = [filters.subdivision, filters.city].filter(Boolean).join(', ')
  if (loc) parts.push(loc)
  const price = formatSearchPriceBand(filters.minPrice, filters.maxPrice)
  if (price) parts.push(price)
  if (parts.length === 0) return 'Central Oregon homes for sale'
  return `${parts.join(' ')} Homes for Sale`
}

export function buildSearchDescription(filters: SearchTitleFilters): string {
  const place = [filters.subdivision, filters.city].filter(Boolean).join(', ') || 'Central Oregon'
  const price = formatSearchPriceBand(filters.minPrice, filters.maxPrice)
  const band = price ? ` ${price}.` : '.'
  return filters.city || filters.subdivision
    ? `Homes for sale in ${place}${band} Live from the regional MLS, with price, beds, baths, and the map.`
    : `Homes for sale in Central Oregon${band} Live from the regional MLS, with city, price, beds, baths, and the map.`
}
