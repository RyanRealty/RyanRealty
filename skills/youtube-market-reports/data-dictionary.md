# Data Dictionary — Listings Table

## Overview
- 589K+ rows in `listings` table (Supabase project `dwvlophlbvvygjfxcrhm`)
- 131 table-level columns (~65 promoted from JSONB + ~17 trigger-computed derived + engagement/history columns)
- 821 distinct keys in `details` JSONB column (raw RESO/Spark API data)
- Typical SFR listing: ~221 populated JSONB keys + ~120 masked (IDX-restricted, value = `"********"`)
- Pipeline: Spark API -> details JSONB (821 keys verbatim) -> listing-mapper.ts sparkToListingRow() -> ~65 typed table columns -> compute_listing_derived_fields() trigger -> 17 computed metrics

## Column Naming Convention
- RETS mixed-case columns MUST be double-quoted in SQL: `"ListPrice"`, `"ClosePrice"`, `"StandardStatus"`, `"BedroomsTotal"`, `"BathroomsTotal"`, `"TotalLivingAreaSqFt"`, `"OnMarketDate"`, `"OriginalListPrice"`, `"SubdivisionName"`, `"PostalCode"`, `"CloseDate"`, `"StreetNumber"`, `"StreetName"`, `"Latitude"`, `"Longitude"`, `"PhotoURL"`, `"PropertyType"`, `"ListNumber"`, `"CumulativeDaysOnMarket"`, etc.
- Lowercase columns need no quoting: `details`, `year_built`, `property_sub_type`, `new_construction_yn`, `concessions_amount`, `buyer_financing`, `tax_annual_amount`, `school_district`, `walk_score`, `pending_timestamp`, `price_per_sqft`, `sale_to_list_ratio`, `sale_to_final_list_ratio`, `estimated_monthly_piti`, etc.
- When in doubt, query `information_schema.columns` first. Never guess column names.

## Promoted Table Columns (Video-Relevant)

### Identification and Location
ListingKey, ListingId, StreetNumber (quoted), StreetName (quoted), City, PostalCode (quoted), CountyOrParish, Latitude (quoted), Longitude (quoted), SubdivisionName (quoted — 871 distinct in Bend, 99.5% coverage)

### Pricing
ListPrice (quoted), OriginalListPrice (quoted), ClosePrice (quoted), concessions_amount (lowercase), AssociationFee, AssociationFeeFrequency (100% NULL — assumed monthly)

### Property Characteristics
BedroomsTotal (quoted), BathroomsTotal (quoted), BathsFull, BathsHalf, TotalLivingAreaSqFt (quoted), year_built (lowercase), PropertyType (quoted — 'A' for residential), property_sub_type (lowercase — 'Single Family Residence' for SFR), new_construction_yn, Levels, StoriesTotal, RoomsTotal, ArchitecturalStyle, ConstructionMaterials, FoundationDetails, Roof

### Status and Dates
StandardStatus (quoted — Active/Pending/Closed/Expired/Canceled/Withdrawn/Coming Soon/Active Under Contract), ListingContractDate, OnMarketDate (quoted), OriginalOnMarketTimestamp, BackOnMarketTimestamp, pending_timestamp (lowercase), PurchaseContractDate, CloseDate (quoted — stored midnight UTC), OffMarketDate, StatusChangeTimestamp, ModificationTimestamp

### Agents
ListAgentName, ListAgentMlsId, ListAgentEmail, ListOfficeName, BuyerAgentName, BuyerAgentMlsId, BuyerOfficeName

### Trigger-Computed Derived Fields (19 total)
- price_per_sqft: ListPrice / TotalLivingAreaSqFt
- close_price_per_sqft: ClosePrice / TotalLivingAreaSqFt
- sale_to_list_ratio: ClosePrice / OriginalListPrice (decimal, e.g., 0.9659)
- sale_to_final_list_ratio: ClosePrice / ListPrice (decimal — USE THIS for "% of asking")
- total_price_change_pct: Already stored as percentage (-5.60 = 5.6% drop)
- total_price_change_amount: Dollar amount of total price change
- property_age: current_year - year_built (goes stale — trigger-only update)
- hoa_annual_cost: AssociationFee * frequency multiplier
- estimated_monthly_piti: Hardcoded 6.5% rate, 20% down, 30yr fixed. 1% tax if missing, 0.35% insurance + HOA
- days_to_pending: OnMarketDate to pending_timestamp. **This is the canonical DOM metric for closed/pending listings — matches Beacon Appraisal methodology. Use this in preference to legacy DaysOnMarket or CloseDate-OnMarketDate math.**
- days_pending_to_close: pending_timestamp to CloseDate
- was_relisted: Boolean
- price_drop_count, price_increase_count, largest_price_drop_pct, back_on_market_count
- dom_percentile, price_percentile, listing_quality_score
- view_count, save_count, inquiry_count, share_count, like_count (from engagement triggers)

## Status Distribution
| Status | Count |
|--------|-------|
| Closed | 375,266 |
| Expired | 128,252 |
| Canceled | 75,292 |
| Active | 7,061 |
| Pending | 1,817 |
| Withdrawn | 478 |
| Active Under Contract | 101 |
| Coming Soon | 65 |

## JSONB `details` Field Categories (821 keys)

### Video-Relevant JSONB-Only Fields
Access via `details->>'FieldName'` or `details->'FieldName'` for JSON objects.

**Price/Concession Story:**
PreviousListPrice, ConcessionsComments, AssociationAmenities, AssociationFeeIncludes, ListingTerms, CurrentFinancing (assumable mortgage angles)

**Interior Features (high value for listing crossover):**
InteriorFeatures, Flooring, FireplaceFeatures, KitchenAppliances, OtherEquipment, LaundryFeatures, WindowFeatures, DoorFeatures, SecurityFeatures, EnergySavingFeatures, Inclusions, Exclusions, AccessibilityFeatures

**Exterior/Lot:**
ExteriorFeatures, PatioAndPorchFeatures, OtherStructures, PoolFeatures, WaterfrontFeatures, ParkingFeatures, RVParkingDimensions, Vegetation, YardAndGroundsFeatures

**Green Energy (differentiator content):**
GreenEnergyEfficient, GreenEnergyGeneration, GreenBuildingCertification, GreenCertificationRating, GreenCertifyingBody, GreenYearCertified

**Distance Fields:**
DistanceToElectric, DistanceToGas, DistanceToSewer, DistanceToWater, DistanceToStreet, DistanceToFreeway, DistanceToShopping, DistanceToSchools

**Schools/Community:**
CommunityFeatures, PetsAllowed, Furnished (promoted: ElementarySchool, MiddleOrJuniorSchool, HighSchool, SchoolDistrict)

**Tax/Legal:**
Zoning, ZoningDescription, TaxLegalDescription, Disclosures, SpecialListingConditions (REO/short sale/probate)

**Object-type fields:** Use multi-value enumeration: `{"Craftsman": true, "Northwest": true}`. Flatten to comma-separated when needed.

### JSONB Categories Summary
| # | Category | ~Fields | Video Relevance |
|---|----------|---------|-----------------|
| 1 | Property ID & Location | 100 | High — geography, coordinates, subdivision |
| 2 | Pricing & Financial | 90 | Critical — concessions, HOA, tax, financing |
| 3 | Property Characteristics | 80 | High — beds/baths/sqft/year/style |
| 4 | Interior Features | 20 | Medium — appliances, flooring, upgrades |
| 5 | Exterior & Lot | 40 | Medium — lot size, pool, views, parking |
| 6 | Systems & Utilities | 50 | Medium — green energy, heating/cooling |
| 7 | Land & Agriculture | 14 | Low — horses, irrigation |
| 8 | Commercial & Multi-Family | 40 | None for SFR video |
| 9 | Listing Status & Dates | 60 | Critical — lifecycle timestamps |
| 10 | Listing Agent & Office | 80 | Internal analytics only (MLS rules) |
| 11 | Buyer Agent & Office | 60 | Internal analytics only |
| 12 | Media & Documents | 15 | High — photos array, virtual tours |
| 13 | Showing & Access | 15 | None (mostly masked) |
| 14 | Schools & Community | 10 | High — school assignments, community features |
| 15 | Tax & Legal | 20 | Low — zoning, disclosures |
| 16 | Compliance & IDX | 15 | None |
| 17 | System & Metadata | 20 | Low — timestamps, remarks |

## Supporting Tables

### listing_history (4.3M rows)
Every MLS field change. Key columns: listing_key, field_name, old_value, new_value, changed_at, price_change (decimal fraction).

### price_history (345K rows)
Price change events: listing_key, old_price, new_price, change_pct, changed_at.

### status_history (3.4K rows)
Status transitions: listing_key, old_status, new_status, changed_at.

### market_pulse_live (10 rows)
Live dashboard for 9 cities + Central Oregon region. Pre-computed: median_sale_price, active_count, pending_count, closed_last_30/60/90_days, months_of_supply (**WRONG — DO NOT USE**), absorption_rate_pct, sell_through_rate_90d, expired_rate_90d, price_reduction_share, median_days_to_pending.

**WARNING (see `query-rules.md` C3 + UF3):** `market_pulse_live.months_of_supply` mixes ALL `PropertyType='A'` sub-types (SFR, condo, manufactured, land artifacts) and uses an undocumented 90d/3 formula. Measured Bend gap on 2026-04-30 = stored `5.80` vs SFR-only manual `4.20` — 38% off, flips the verdict pill from "balanced" to "seller's market" on camera. **Never read this column into a video.** Always recompute MoS with `query-rules.md` Template 11. The same mixed-subtypes skew likely affects `absorption_rate_pct`, `sell_through_rate_90d`, and `median_days_to_pending` on this view — for video use, recompute those metrics manually with the SFR filter (see `storyboard-template.md` Scene 5 spec).

### market_stats_cache (1.4K rows)
Pre-computed stats by geography/period. Missing market_health_label and yoy_median_price_delta_pct (mostly NULL).

### beacon_comparable_listings_v (view)
Main analytics view on top of listings. Adds computed DOM/market columns. Uses `EXTRACT(epoch FROM interval) / 86400.0` for DOM (disagrees with trigger by +/-1 day). Excludes lots over 5 acres (lot_size_sqft < 217,800). Uses hardcoded zip-to-city mappings for 16 zips. **Note: computes legacy DOM via CloseDate–OnMarketDate math. For video stats, use `days_to_pending` column on `listings` directly — Beacon Appraisal methodology, 100% populated.**

## How to Query JSONB Fields

```sql
-- String field
SELECT details->>'GreenEnergyEfficient' FROM listings WHERE "ListingKey" = 'abc123';

-- Object field (multi-value enum)
SELECT details->'ArchitecturalStyle' FROM listings WHERE "ListingKey" = 'abc123';
-- Returns: {"Craftsman": true, "Northwest": true}

-- Filter on JSONB value
SELECT COUNT(*) FROM listings
WHERE details->>'GreenEnergyGeneration' IS NOT NULL
  AND "City" = 'Bend' AND "PropertyType" = 'A';

-- Aggregate JSONB field
SELECT details->>'Zoning' AS zoning, COUNT(*)
FROM listings
WHERE "City" = 'Bend' AND "StandardStatus" = 'Active'
GROUP BY details->>'Zoning'
ORDER BY COUNT(*) DESC;
```

## Schema Discovery Query
When in doubt, query the schema first:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'listings'
ORDER BY ordinal_position;
```
