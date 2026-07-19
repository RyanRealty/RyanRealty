/**
 * Canonical column projection for the listing-tile materialized views.
 *
 * Both `listing_tile_mv` (getListingTiles) and `listing_search_mv`
 * (searchListingsAll) expose the SAME 34-column tile surface. Selecting these
 * explicitly instead of `select('*')` avoids hauling the columns `mvRowToTile`
 * discards — on `listing_tile_mv` that is `city_lower`, `subdivision_lower`,
 * `refreshed_at`, and the GIN-indexed `search_vector` tsvector (~2 MB per 500
 * rows). Verified against docs/DATABASE_SCHEMA_SNAPSHOT.md: every column below
 * exists in both MVs, and neither has a `virtual_tour_url` column (the phantom
 * field in ListingTileMvRow resolves to undefined under select('*') either way).
 *
 * Keep in sync with `mvRowToTile` in both getListingTiles.ts and
 * searchListingsAll.ts. Do NOT add `details` JSONB or the tsvector here.
 */
export const TILE_MV_SELECT_COLUMNS = [
  'listing_key', 'list_number', 'standard_status', 'list_price', 'close_price',
  'close_date', 'beds', 'baths', 'sqft', 'street_number', 'street_name',
  'street_suffix', 'city', 'postal_code', 'subdivision_name', 'lat', 'lng',
  'photo_url', 'property_type', 'property_sub_type', 'on_market_date',
  'modified_at', 'price_per_sqft', 'lot_size_acres', 'year_built',
  'garage_spaces', 'pool_yn', 'has_virtual_tour', 'dom', 'price_drop_count',
  'address_slug', 'boundary_city', 'boundary_neighborhood', 'boundary_subdivision',
].join(',')

/**
 * @deprecated Legacy PascalCase `listings`-table projection from the pre-MV era.
 * The only remaining consumer is the brokerage slider in app/actions/listings.ts
 * (BROKERAGE_TILE_SELECT), which is being migrated into the lib/data DAL. Do not
 * add new consumers — use a lib/data tile reader instead.
 */
export const HOME_TILE_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, StandardStatus, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, OnMarketDate, OpenHouses, CloseDate, has_virtual_tour, year_built, price_per_sqft, lot_size_acres, garage_spaces, pool_yn, estimated_monthly_piti, price_drop_count, DaysOnMarket, Latitude, Longitude'
