/**
 * Activity feed types (homepage live updates).
 * Sourced from `activity_events` table + Supabase Realtime subscription.
 */

import type { Currency, IsoTimestamp } from './shared'

export type ActivityEventType =
  | 'new_listing'
  | 'price_drop'
  | 'status_pending'
  | 'status_closed'
  | 'open_house_added'

export type ActivityEvent = {
  id: string
  eventType: ActivityEventType
  listingKey: string | null
  city: string | null
  subdivision: string | null
  streetAddress: string | null
  listPrice: Currency | null
  previousPrice: Currency | null
  priceDelta: Currency | null
  occurredAt: IsoTimestamp
}
