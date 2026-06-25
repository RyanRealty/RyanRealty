/**
 * Pure label maps + formatters shared by the record-card presentational
 * components. Kept framework-free so they unit-test under the node vitest env
 * (no DOM). The components import these; never inline the maps in JSX.
 */

/**
 * Friendly labels for raw lead-source slugs. Anything not in the map gets
 * title-cased so an unknown slug still reads cleanly instead of leaking a
 * raw token like "inbound_sms".
 */
const SOURCE_LABELS: Record<string, string> = {
  'seller-lp': 'Seller landing page',
  'seller_lp': 'Seller landing page',
  'buyer-lp': 'Buyer landing page',
  'buyer_lp': 'Buyer landing page',
  'expired-listing': 'Expired listing',
  'expired_listing': 'Expired listing',
  'inbound-sms': 'Inbound text',
  'inbound_sms': 'Inbound text',
  'inbound-call': 'Inbound call',
  'inbound_call': 'Inbound call',
  'outbound-call': 'Outbound call',
  'cma-request': 'CMA request',
  'cma_request': 'CMA request',
  'newsletter': 'Newsletter',
  'home-valuation': 'Home valuation',
  'home_valuation': 'Home valuation',
  'listing-alert': 'Listing alert',
  'listing_alert': 'Listing alert',
  'facebook': 'Facebook',
  'facebook-ad': 'Facebook ad',
  'facebook_ad': 'Facebook ad',
  'instagram': 'Instagram',
  'google': 'Google',
  'google-ads': 'Google ads',
  'organic': 'Organic search',
  'referral': 'Referral',
  'sphere': 'Sphere',
  'walk-in': 'Walk in',
  'open-house': 'Open house',
  'open_house': 'Open house',
  'zillow': 'Zillow',
  'realtor': 'Realtor.com',
  'fub': 'Follow Up Boss',
  'import': 'Imported',
  'manual': 'Added by broker',
}

/** Title-case a slug like "some_thing-here" into "Some Thing Here". */
export function titleCaseSlug(raw: string): string {
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Resolve a human-readable source label. Falls back, in order, to:
 * the explicit source slug, then the first-touch source, then a fixed
 * "Source unknown". Returns the label string only (the badge prefixes "Source:").
 */
export function resolveSourceLabel(
  source: string | null | undefined,
  firstTouch?: { source?: string | null } | null,
): string {
  const candidate =
    (source && source.trim()) || (firstTouch?.source && firstTouch.source.trim()) || ''
  if (!candidate) return 'Source unknown'
  const key = candidate.toLowerCase()
  return SOURCE_LABELS[key] ?? titleCaseSlug(candidate)
}

/** Format an integer count with US thousands separators (1850 -> "1,850"). */
export function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

/**
 * Round currency to the nearest thousand and render with a $ and thousands
 * separators per brand voice ($895,000 not $894,750). Returns null for
 * non-finite or non-positive inputs so callers can omit the line entirely.
 */
export function formatPricePaid(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null
  const rounded = Math.round(price / 1000) * 1000
  return `$${formatInt(rounded)}`
}

/**
 * Build the spec summary line fragments. Each present spec contributes one
 * fragment ("3 bed", "2 bath", "1,850 sqft", neighborhood). The caller joins
 * with the brand middle-dot separator. Returns [] when nothing is known.
 */
export function homeSpecFragments(spec: {
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  neighborhood?: string | null
}): string[] {
  const parts: string[] = []
  if (spec.beds != null && Number.isFinite(spec.beds) && spec.beds > 0) {
    parts.push(`${formatInt(spec.beds)} bed`)
  }
  if (spec.baths != null && Number.isFinite(spec.baths) && spec.baths > 0) {
    parts.push(`${formatInt(spec.baths)} bath`)
  }
  if (spec.sqft != null && Number.isFinite(spec.sqft) && spec.sqft > 0) {
    parts.push(`${formatInt(spec.sqft)} sqft`)
  }
  if (spec.neighborhood && spec.neighborhood.trim()) {
    parts.push(spec.neighborhood.trim())
  }
  return parts
}
