# Advanced Search

The site supports an **advanced listing search** that filters on every queryable dimension: flat Supabase columns and fields inside the `details` jsonb (full Spark StandardFields).

## Where it lives

- **URL:** `/listings` (all listings with advanced filters) and `/search/[city]` or `/search/[city]/[subdivision]` (same filters scoped by location).
- **UI:** "Advanced search" panel with **Quick filters** (price, beds, baths, sq ft, property type, sort, include closed) and **More filters** (expandable): max beds/baths/sq ft, year built, lot acres, zip, property subtype, status, keywords, new listings, garage, open house, pool, view, waterfront.

## Data source

- **Search runs against Supabase** (synced from Spark). No live Spark API calls for search.
- **Flat columns** (indexed): City, SubdivisionName, PostalCode, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, StandardStatus, PropertyType, ModificationTimestamp.
- **details (jsonb):** Full Spark StandardFields, including YearBuilt, LotSizeAcres, PropertySubType, GarageSpaces, GarageYN, PoolYN, PoolFeatures, ViewYN, View, WaterfrontYN, WaterfrontFeatures, OpenHouses, PublicRemarks, and any other MLS fields Spark sends.

## Backend

- **RPC:** `search_listings_advanced` in Supabase (see `supabase/migrations/20250315100000_advanced_search_rpc.sql`). Run `npx supabase db push` to create it.
- **Server:** `getListingsWithAdvanced()` in `app/actions/listings.ts`. Uses the RPC when any advanced-only filter is set; otherwise uses the fast flat-column `getListings()` + `getActiveListingsCount()`.

## Filters supported

| Filter | Source | Notes |
|--------|--------|------|
| City, subdivision, zip | Flat / details | City and SubdivisionName from URL or filter; PostalCode = zip |
| Min/max price | ListPrice | |
| Min/max beds, baths | BedroomsTotal, BathroomsTotal | |
| Min/max sq ft | TotalLivingAreaSqFt | |
| Year built min/max | details->YearBuilt | |
| Lot acres min/max | details->LotSizeAcres | |
| Property type / subtype | PropertyType, details->PropertySubType | |
| Status | StandardStatus | active, active_and_pending, pending, closed, all |
| Keywords | details->PublicRemarks | ILIKE search in description |
| Has open house | details->OpenHouses | Non-empty array |
| Garage min spaces | details->GarageSpaces or GarageYN | |
| Has pool | details->PoolYN or PoolFeatures | |
| Has view | details->ViewYN or View | |
| Has waterfront | details->WaterfrontYN or WaterfrontFeatures | |
| New listings (last N days) | ModificationTimestamp | |
| Sort | — | newest, oldest, price_asc, price_desc, price_per_sqft_asc, price_per_sqft_desc, year_newest, year_oldest |

## Adding more criteria

1. Add the parameter to `search_listings_advanced` in the migration (or a new migration).
2. Add the filter to the RPC `WHERE` clause (flat column or `details->>'FieldName'`).
3. Add to `AdvancedListingsFilters` in `app/actions/listings.ts` and to `getListingsAdvanced()` RPC call.
4. Add the control and URL param in `components/AdvancedSearchFilters.tsx`.
