'use server'

import { cookies } from 'next/headers'
import { fireGa4Event, readGa4ClientIdFromCookies } from '@/lib/ga4-measurement-protocol'

/**
 * Fire-and-forget: record a saved listing. Call after a successful save.
 * Zero UI, zero blocking.
 *
 * The CRM "Saved Property" mirror this action used to fire was a dead no-op
 * after the CRM decommission (2026-06-24) and has been deleted — the save
 * itself is already durably recorded (saved listings table + visitor_events);
 * only the GA4 server mirror remains here.
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
