/**
 * Supabase `.select()` column lists for listing cards and sliders.
 * Keep in sync with `ListingTile` / `HomeTileCard`.
 * Do not add `details` JSONB here; use `has_virtual_tour` and dedicated video queries for media.
 *
 * Note: Latitude/Longitude are included in the base because `ListingTileRow` and
 * `HomeTileRow` types in `app/actions/listings.ts` declare them as required.
 * Omitting them silently returned undefined to map components.
 */
export const HOME_TILE_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, StandardStatus, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, OnMarketDate, OpenHouses, CloseDate, has_virtual_tour, year_built, price_per_sqft, lot_size_acres, garage_spaces, pool_yn, estimated_monthly_piti, price_drop_count, DaysOnMarket, Latitude, Longitude'

/** Community pages: base tile + HOA columns (no `details` JSONB). */
export const COMMUNITY_LISTING_TILE_SELECT = `${HOME_TILE_SELECT}, AssociationYN, AssociationFee, AssociationFeeFrequency`

/** City / geo pages: base tile + extra lot size column. */
export const CITY_LISTING_TILE_SELECT = `${HOME_TILE_SELECT}, lot_size_sqft`
