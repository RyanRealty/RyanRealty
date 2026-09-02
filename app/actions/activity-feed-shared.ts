export type ActivityFeedItem = {
  id: string
  listing_key: string
  ListNumber?: string | null
  mls_source?: string | null
  /**
   * `activity_events.event_type` is free text, and the sole writer
   * (`lib/sync/deltaSync.ts`) interpolates one of its values as
   * `status_${StandardStatus}` — so the set is open-ended and the old
   * six-literal union was a lie the compiler enforced. Live values at
   * 2026-08-18 also include price_increase, status_active, status_canceled,
   * and status_withdrawn. `(string & {})` keeps literal autocomplete while
   * admitting the tail. Never render this raw: resolve it through
   * `activityEventLabel()` in `lib/activity/event-label.ts`.
   */
  event_type:
    | 'new_listing'
    | 'price_drop'
    | 'price_increase'
    | 'status_pending'
    | 'status_closed'
    | 'status_active'
    | 'status_expired'
    | 'status_canceled'
    | 'status_withdrawn'
    | 'back_on_market'
    | (string & {})
  event_at: string
  payload?: Record<string, unknown>
  ListPrice?: number | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  StreetNumber?: string | null
  StreetName?: string | null
  StreetSuffix?: string | null
  City?: string | null
  State?: string | null
  PostalCode?: string | null
  SubdivisionName?: string | null
  NeighborhoodName?: string | null
  NeighborhoodSlug?: string | null
  PhotoURL?: string | null
  StandardStatus?: string | null
  OnMarketDate?: string | null
  CloseDate?: string | null
}
