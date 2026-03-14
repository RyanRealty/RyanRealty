# SPARK API Fields Audit

Principle: If a field exists in SPARK, find a way to use it.

---

## Source

- **Spark API:** https://sparkplatform.com/docs/api_services/listings
- **App types:** `lib/spark.ts` — `SparkStandardFields`, `SparkPhoto`, `SparkFloorPlan`, `SparkVideo`, `SparkVirtualTour`, `SparkDocument`
- **Sync:** `app/actions/sync-spark.ts` maps Spark → Supabase. Full `StandardFields` stored in `listings.details` (jsonb).

---

## Fields in SparkStandardFields (typed in app)

| Field | Supabase column / details | Where surfaced | Notes |
|-------|---------------------------|----------------|-------|
| ListingKey | ListingKey | Everywhere (key) | |
| ListingId | (in details) | Listing detail, Schema | MLS# |
| ListPrice | ListPrice | Cards, detail, Schema | |
| StreetNumber | StreetNumber | Detail, address line | |
| StreetName | StreetName | Detail, address | |
| StreetDirPrefix | details | Detail (full address) | |
| StreetSuffix | details | Detail (full address) | |
| StreetDirSuffix | details | Detail (full address) | |
| City | City | Everywhere | |
| StateOrProvince | State | Everywhere | |
| PostalCode | PostalCode | Detail | |
| Latitude | Latitude | Map, detail map | |
| Longitude | Longitude | Map, detail map | |
| SubdivisionName | SubdivisionName | Detail, similar listings, search | Community |
| BedsTotal | BedroomsTotal | Cards, detail, Schema | |
| BathsTotal | BathroomsTotal | Cards, detail, Schema | |
| BuildingAreaTotal | TotalLivingAreaSqFt | Detail, Schema | Sq ft |
| StandardStatus | StandardStatus | Cards, detail, filters | Active/Pending/Closed |
| ListStatus | details | ListingDetails | |
| ModificationTimestamp | ModificationTimestamp | Sort, "New" badge | |
| OnMarketDate | details | Adjacent listing, history | |
| ListDate | details | Detail | |
| CloseDate | details | Detail (if closed) | |
| PublicRemarks | details | ListingDetails description | |
| PrivateRemarks | details | ListingDetails (if shown) | |
| ListAgentFirstName | details | ListingDetails agent block | |
| ListAgentLastName | details | ListingDetails agent block | |
| ListAgentEmail | details | ListingDetails agent block | |
| ListAgentPreferredPhone | details | ListingDetails agent block | |
| ListOfficeName | details | ListingDetails agent block | |
| ListOfficePhone | details | ListingDetails agent block | |
| YearBuilt | details | Detail key facts, ListingDetails | |
| LotSizeAcres | details | Detail key facts, ListingDetails | |
| PropertyType | PropertyType | Filters, ListingDetails | |
| PropertySubType | details | ListingDetails | |
| Photos | details | ListingGallery | |
| FloorPlans | details | ListingFloorPlans | |
| Videos | details | ListingVideos | |
| VirtualTours | details | ListingVideos | |
| OpenHouses | details | ListingDetails open houses | |
| Documents | details | ListingDocuments | |

---

## Additional Spark fields (often in StandardFields; not all typed)

Check Spark API docs and actual API responses for:

- **Lot size** (sq ft, dimensions) — LotSizeSquareFeet, LotSizeArea, etc.
- **HOA** — AssociationFee, AssociationFeeFrequency, AssociationYN
- **Schools** — ElementarySchool, MiddleSchool, HighSchool, SchoolDistrict
- **Garage** — GarageSpaces, GarageYN, CarportSpaces
- **HVAC** — Heating, Cooling, HeatingFuel
- **Utilities** — Sewer, WaterSource, Utilities
- **View** — View, ViewYN
- **Waterfront** — WaterfrontFeatures, WaterfrontYN
- **Golf** — GolfYN, GolfCourseFront, etc.
- **Taxes** — TaxAnnualAmount, TaxYear
- **Zoning** — Zoning
- **Days on market** — Often computed from ListDate/CloseDate or a dedicated field
- **Price history** — From listing history API, not StandardFields

**Action:** When syncing or displaying listing detail, prefer reading from `details` (full StandardFields). Add any missing fields to `ListingDetails` or new collapsible sections; hide empty fields.

---

## Where we surface data today

- **Listing card:** ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, PhotoURL, ModificationTimestamp, StandardStatus
- **Listing detail page:** Gallery (Photos), key facts bar (Beds, Baths, SqFt, Acres, YearBuilt), ListingDetails (description, agent, open houses, property details grid), floor plans, videos, documents, history
- **Schema/SEO:** ListingId, address, price, beds, baths, area, photo

---

## Gaps to close (per master instruction set)

1. **Every SPARK field** — Audit actual Spark response for extra fields; add to ListingDetails or dedicated sections (HOA, schools, garage, HVAC, utilities, view, waterfront, taxes, zoning). Collapse empty.
2. **Price history** — Already have listing_history; ensure it’s visible and in Schema if applicable.
3. **Days on market** — Compute from ListDate/OnMarketDate; show on detail.

---

*Update this doc when new fields are added to sync or UI.*
