# Advanced Search with Map — Spec

Reference: Zillow-style search with map. Our layout: **list on left**, **map on right**, **filters in a compact top bar**.

---

## Layout

- **Top:** Single horizontal filter bar (location, status, price, beds/baths, home type, “More”, Save search). Dense and scannable; no hero above it on this view.
- **Left column:** Scrollable list of **existing ListingTiles**. Header: “Bend OR Real Estate & Homes For Sale” (or current geography), “X of Y homes”, Sort dropdown. Cards use the same ListingTile component as elsewhere (share, like, save, badges).
- **Right column:** Full-height map. Same dataset as the list; filters apply to both. Map shows **clusters** when many pins are close; **single pins** show **price** (e.g. “1.35M”); **heart** on pin when that listing is liked/saved by the user.
- **Responsive:** Desktop = list left, map right. Tablet/mobile = stack (list then map) or single column with list/map toggle.

---

## Map behavior

1. **Clustering**  
   When multiple listings are close, show one **cluster marker** with the **count** (e.g. “13”). Click or zoom in to expand. Use `@googlemaps/markerclusterer` (or equivalent) with our brand colors.

2. **Single marker**  
   One listing in view: show a **pin** with **price** on it (e.g. “1.35M”, “$850k”). Short, readable format.

3. **Liked/saved**  
   If the user has liked or saved that listing, show a **heart** on or next to the pin so they can see favorites at a glance.

4. **Interaction**  
   Click pin → InfoWindow or highlight corresponding card in the list (optional). List and map stay in sync (same filters, same data).

---

## Filter bar (top)

- **Location** – Typeahead or link to city/community search (e.g. “Bend OR”). Can link to existing `/search/bend` or open a location picker.
- **For Sale** – Status: Active, Pending, Sold, All (or “Homes for You” as sort). Single dropdown.
- **Price** – Min/max or presets (Under $300K, $300K–$500K, …).
- **Beds & Baths** – Combined dropdown or two compact dropdowns (e.g. “Any”, “1+”, “2+”, …).
- **Home Type** – Property type (House, Condo, etc.) from existing `PROPERTY_TYPES`.
- **More** – Expandable section for: sq ft, lot, year built, zip, keywords, open house, pool, view, waterfront, etc. Same params as current AdvancedSearchFilters.
- **Save search** – Button (existing SaveSearchButton) when logged in.
- **Sort** – “Homes for You”, “Newest”, “Price”, etc. In or next to the list header.

All filters drive the same URL params used by `getListingsWithAdvanced` so list and map share one source of truth.

---

## Data and URLs

- **Listings page with map:** `/listings?view=map` (and optionally `?view=split`). Same query params as current listings page (minPrice, maxPrice, beds, baths, etc.).
- **City/subdivision search:** `/homes-for-sale/[city]` and `/homes-for-sale/[city]/[subdivision]` (and filter-only `/homes-for-sale`) now get the same split layout (list left, map right) and same filter bar when `view=map` is in the URL (e.g. `/homes-for-sale/bend?view=map`).
- List and map both use the same fetched listings (and saved/liked keys for the current user). No separate map-only fetch unless we add “search this area” (bounds) later.

---

## Implementation checklist

- [x] Split layout component: left = list (ListingTiles + count + sort), right = map; filter bar above. Shared by `/listings?view=map` and search pages with `?view=map`.
- [x] Compact filter bar component reusing current filter params and Apply behavior (SearchFilterBar).
- [x] Map: add `@googlemaps/markerclusterer`; cluster when multiple pins; single pin = price label (SearchMapClustered).
- [x] Map: pass `savedListingKeys` / `likedListingKeys`; render heart on pin for saved/liked.
- [x] List scroll and map viewport stay in sync (same results); clicking map pin scrolls to card in list.
- [x] Mobile: list first, then map, or toggle; filter bar collapses to “Filters” drawer if needed.
