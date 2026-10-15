/**
 * Buyer, seller or browsing: the ONE reading of a visit's intent tags, shared
 * by /admin/analytics/funnel-breakdown and the Website view of /admin/analytics.
 *
 * Pure: no I/O. visitor_sessions.intent_tags is written by the visitor_events
 * trigger (migration 20260522180000_visitor_tracking.sql) from each page
 * view's page_category, and page_category comes from
 * visitorPageCategoryFromPath (lib/analytics/page-type.ts):
 *   seller_intent   /sell, /lp/seller-home-value, /motivated-sellers,
 *                   /lp/expired-listing, /lp/fsbo, /lp/sell
 *   buyer_intent    /buy..., /buyers, /explore, /new-construction,
 *                   /lp/buyer-listing-alerts
 *   listing_viewer  a listing page
 *   area_researcher a city, neighborhood, community or subdivision page
 *   mortgage_curious a mortgage, affordability or rental calculator
 * Search results, the blog, the home page and contact pages add no tag.
 *
 * Moved here from the funnel-breakdown page (2026-10-14) so the two surfaces
 * cannot drift into two definitions.
 */

export type VisitIntent = 'seller' | 'buyer' | 'both' | 'browsing' | 'unknown'

export function classifyIntent(tags: readonly string[] | null | undefined): VisitIntent {
  const t = tags ?? []
  const hasSeller = t.includes('seller_intent')
  const hasBuyer = t.includes('buyer_intent')
  if (hasSeller && hasBuyer) return 'both'
  if (hasSeller) return 'seller'
  if (hasBuyer) return 'buyer'
  if (t.length > 0) return 'browsing' // listing_viewer / area_researcher / mortgage_curious
  return 'unknown'
}

/** Display order on the Website view: the two that matter first. */
export const INTENT_ORDER: readonly VisitIntent[] = ['buyer', 'seller', 'both', 'browsing', 'unknown']

export const INTENT_PLAIN_LABEL: Record<VisitIntent, string> = {
  buyer: 'Looking to buy',
  seller: 'Thinking of selling',
  both: 'Buying and selling',
  browsing: 'Just browsing',
  unknown: 'Too little to tell',
}

/** What put a visit in each group, in the words a broker would use. */
export const INTENT_PLAIN_MEANING: Record<VisitIntent, string> = {
  buyer: 'Opened a buyer page: Buy, listing alerts, or new construction.',
  seller: 'Opened a selling page: Sell, the home value page, or the expired and FSBO pages.',
  both: 'Opened a buyer page and a selling page.',
  browsing: 'Looked at listings, neighborhoods or calculators, but no buyer or selling page.',
  unknown: 'Only opened pages that say nothing either way, like the home page, search results or the blog.',
}
