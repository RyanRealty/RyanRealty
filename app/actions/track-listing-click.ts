'use server'

import { trackListingTileClick as sendFubTileClick } from '@/lib/followupboss'

/**
 * Fire-and-forget: record listing tile click in Follow Up Boss (listing address, MLS ID,
 * timestamp, source page, and contact if available). Zero UI, zero blocking.
 */
export async function trackListingTileClick(params: {
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
  try {
    await sendFubTileClick(params)
  } catch {
    // Silent; do not block navigation or surface errors
  }
}
