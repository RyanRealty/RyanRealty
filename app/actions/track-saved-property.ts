'use server'

import { trackSavedProperty as sendFubSavedProperty } from '@/lib/followupboss'

/**
 * Fire-and-forget: record saved listing in Follow Up Boss. Call after a successful save.
 * Zero UI, zero blocking.
 */
export async function trackSavedPropertyAction(params: {
  userEmail: string
  listingKey: string
  listingUrl: string
  sourcePage?: string
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
    await sendFubSavedProperty(params)
  } catch {
    // Silent
  }
}
