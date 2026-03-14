# Spark → Supabase: column count and data loss

## Supabase `listings` table: **18 columns**

| # | Column | Purpose |
|---|--------|--------|
| 1 | ListNumber | Primary key (Spark `ListingId`) |
| 2 | ListingKey | Spark listing key |
| 3 | ListPrice | Price (for filters/display) |
| 4 | StreetNumber | |
| 5 | StreetName | |
| 6 | City | Browse/filter |
| 7 | State | |
| 8 | PostalCode | |
| 9 | Latitude | Map |
| 10 | Longitude | Map |
| 11 | SubdivisionName | Browse/filter, similar listings |
| 12 | BedroomsTotal | Filters |
| 13 | BathroomsTotal | Filters |
| 14 | TotalLivingAreaSqFt | Filters |
| 15 | StandardStatus | |
| 16 | PhotoURL | First photo URL (cards/map) |
| 17 | ModificationTimestamp | Prev/next, ordering |
| 18 | **details** | **Full Spark payload (see below)** |

---

## Spark `StandardFields`: **40+ typed fields** (and more possible)

Spark can send many more fields than we have flat columns. Typed in our app:

- **Ids:** ListingKey, ListingId  
- **Address:** StreetNumber, StreetName, StreetDirPrefix, StreetSuffix, StreetDirSuffix, City, StateOrProvince, PostalCode  
- **Geo:** Latitude, Longitude  
- **Location:** SubdivisionName  
- **Size:** BedsTotal, BathsTotal, BuildingAreaTotal, LotSizeAcres, YearBuilt  
- **Status/dates:** StandardStatus, ListStatus, ListDate, CloseDate, ModificationTimestamp  
- **Price:** ListPrice  
- **Text:** PublicRemarks, PrivateRemarks  
- **Agent/office:** ListAgentFirstName, ListAgentLastName, ListAgentEmail, ListAgentPreferredPhone, ListOfficeName, ListOfficePhone  
- **Type:** PropertyType, PropertySubType  
- **Media:** Photos[], FloorPlans[], Videos[], VirtualTours[]  
- **Other:** OpenHouses[]  
- Plus `[key: string]: unknown` — MLS can send extra fields we don’t list in TypeScript.

So Spark has **many more** than 18 distinct fields.

---

## Is there data loss? **No.**

We do **not** only store the 18 flat columns. We store:

1. **18 flat columns** – subset used for querying, filters, map, and cards.
2. **`details` (jsonb)** – the **entire** `StandardFields` object from Spark for that listing.

Sync does:

```ts
details: f as Record<string, unknown>  // f = result.StandardFields
```

So every field Spark returns in `StandardFields` (all 40+ and any extra from the MLS) is saved in `details`. Nothing from Spark is dropped.

- **Flat columns** = fast queries and display (price, city, beds, map, etc.).
- **`details`** = full payload for the listing page and for future use (remarks, agent, photos array, floor plans, videos, virtual tours, open houses, and any other field Spark sends).

---

## Spark API calls we use

| Call | When | What we get |
|------|------|-------------|
| **GET /listings** (paginated, `_expand=...`) | Sync | List of listings with StandardFields + Photos, FloorPlans, Videos, VirtualTours, OpenHouses, **Documents**. All stored in `details`. |
| **GET /listings/:key** (single, expanded) | Listing fallback when not in Supabase | Full listing; same expansions as above. |
| **GET /listings/:key/history** | **Admin “Sync history”** (batch backfill) | Price/status history. Stored in `listing_history` for CMAs and market analytics. |

So: **listing history** is stored in Supabase in the `listing_history` table. Run “Sync history” on the admin sync page to backfill from Spark. Listing pages and reports read from Supabase (no API calls for history). Use for list date, price changes, last sale, etc.

---

## Summary

| | Count |
|---|:---:|
| Supabase columns | 18 |
| Spark StandardFields (typed) | 40+ |
| Spark fields stored in Supabase | **All** (in `details` + selected ones in flat columns) |
| Data loss from Spark → Supabase | **None** |
| Listing history | Stored in `listing_history`; backfill via admin “Sync history” |
