# URL Architecture and Migration Plan

## Target (future)

- **Place hierarchy:** `/real-estate/{country}/{state}/{city}/[{neighborhood}/]{community}/`
- **Listing:** `/real-estate/{country}/{state}/{city}/[{neighborhood}/]{community}/listing/{slug}`
- **Examples:**
  - `/real-estate/us/oregon/bend/` — city
  - `/real-estate/us/oregon/bend/tetherow/` — community (subdivision)
  - `/real-estate/us/oregon/bend/west-side/tetherow/` — community in a neighborhood
  - `/real-estate/us/oregon/bend/tetherow/listing/123-main-st` — listing

- **Data model:** `geo_places` (country → state → city → neighborhood → community). Listings reference geography via City + SubdivisionName today; later via `geo_places.id` or stable slugs.

## Current

- **Search:** `/search/[city]/[subdivision]` (e.g. `/search/bend`, `/search/bend/tetherow`)
- **Listing:** `/listing/[key]` or `/listing/[key]-[address-slug]` (e.g. `/listing/2504654` or `/listing/2504654-56355-twin-rivers-bend-or-97707`)

### Listing URL resolution

The listing page resolves the `[key]` (or key + slug) to a row in `listings` via `getListingByKey`:

1. **First segment:** If the path looks like `2504654-56355-twin-rivers-bend-or-97707`, we try the first segment `2504654` as ListNumber/ListingKey.
2. **All numeric segments:** We then try every other numeric segment (`56355`, `97707`, etc.) so URLs work whether the primary key is ListNumber (e.g. MLS ListingId) or ListingKey (e.g. Spark id).
3. **Key-only:** If the URL is just `2504654`, we look up by that.
4. **Hyphen stripping:** For non-numeric keys (e.g. `BR-12345-address`), we try shortening from the end until we match.
5. **Column names:** We try both PascalCase (`ListNumber`, `ListingKey`) and snake_case (`list_number`, `listing_key`) so the same code works across different Supabase schemas.

Tiles build the link as `[linkKey]-[addressSlug]` where `linkKey` is `ListNumber ?? ListingKey` and `addressSlug` is street-city-state-zip from `listingAddressSlug()` for SEO.

## Redirect strategy (when migrating)

1. **301 permanent redirects** from old to new:
   - `/search/{city}` → `/real-estate/us/oregon/{city}/`
   - `/search/{city}/{subdivision}` → `/real-estate/us/oregon/{city}/{subdivision}/` (or `/{neighborhood}/{subdivision}/` when neighborhood is assigned)
   - `/listing/{key}` → `/real-estate/us/oregon/{city}/{community}/listing/{slug}` (resolve city/community from listing, slug from address or ListNumber)
2. **Canonical URLs** on new pages point to the new structure.
3. **Sitemap** and internal links updated to new paths in the same release.
4. **Phase:** Optional intermediate phase with both routes (same content, canonical to new) before removing old routes.

## Implementation order

1. Backfill `geo_places` with country (US), state (Oregon), cities and communities from listings (no neighborhoods yet).
2. Add route handlers for `/real-estate/[...slug]` that resolve slug to city/neighborhood/community and render same content as search page (or redirect to search during transition).
3. Add neighborhood layer in admin; assign communities to neighborhoods.
4. Switch canonical to new URLs; add 301 from old.
5. Replace `/search/` and `/listing/` with `/real-estate/...` in codebase and remove legacy routes.

No Oregon hardcoding in the data model: adding a new state/market = new rows in `geo_places`, not code changes.
