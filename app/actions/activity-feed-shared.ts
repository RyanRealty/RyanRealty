/** Default cities for the activity feed slider (home and reusable section). User can add more via dropdown. */
export const ACTIVITY_FEED_DEFAULT_CITIES = [
  'Bend',
  'Redmond',
  'La Pine',
  'Sunriver',
  'Sisters',
  'Tumalo',
  'Terrebonne',
  'Madras',
  'Prineville',
  'Crooked River Ranch',
] as const

export type ActivityFeedItem = {
  id: string
  listing_key: string
  ListNumber?: string | null
  mls_source?: string | null
  event_type:
    | 'new_listing'
    | 'price_drop'
    | 'status_pending'
    | 'status_closed'
    | 'status_expired'
    | 'back_on_market'
  event_at: string
  payload?: Record<string, unknown>
  ListPrice?: number | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  StreetNumber?: string | null
  StreetName?: string | null
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
