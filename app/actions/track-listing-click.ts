'use server'

/**
 * Listing tile click tracking.
 *
 * The FUB "Viewed Property" mirror this action used to fire was a dead no-op
 * after the FUB decommission (2026-06-24) and has been deleted. First-party
 * tracking already covers tile clicks: the VisitorTracker snippet posts
 * listing_view / cta_click events to /api/visitors/track (visitor_events),
 * which is what the dashboards read. The action is kept as a stub so existing
 * client callers (components/ListingTile.tsx) keep working; it can be removed
 * together with its call sites in a follow-up.
 */
export async function trackListingTileClick(_params: {
  listingKey: string
  listingUrl: string
  sourcePage: string
  userEmail?: string | null
  fubPersonId?: number | null
  property: {
    street?: string
    city?: string
    state?: string
    mlsNumber?: string
    price?: number
    bedrooms?: number
    bathrooms?: number
  }
}) {
  // Intentionally empty — see module doc.
}
