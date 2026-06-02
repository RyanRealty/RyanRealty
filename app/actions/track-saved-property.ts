'use server'

import { cookies } from 'next/headers'
import { trackSavedProperty as sendFubSavedProperty } from '@/lib/followupboss'
import { fireGa4Event, readGa4ClientIdFromCookies } from '@/lib/ga4-measurement-protocol'

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

  // GA4 Measurement Protocol mirror — the client add_to_wishlist event is
  // ad-blocker-vulnerable; this server mirror makes saves a durable GA4
  // signal/audience, consistent with how lead events are server-mirrored.
  try {
    const cookieStore = await cookies()
    const clientId = readGa4ClientIdFromCookies(cookieStore) ?? undefined
    await fireGa4Event({
      eventName: 'add_to_wishlist',
      clientId,
      eventParams: {
        currency: 'USD',
        value: params.property.price ?? null,
        item_id: params.listingKey,
        item_name: params.property.mlsNumber ?? params.listingKey,
      },
    })
  } catch {
    // Silent
  }
}
