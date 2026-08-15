# Public place / listing / market page discrepancies

Investigation of how ryan-realty.com mints public city, community, listing, and market pages, and why the verified public bugs share a small number of structural causes.

**Scope:** investigate and document. One one-line CTA key fix shipped with this report. No rewrite.

**Sources:** repo code as of this branch. Per `docs/DATABASE_FOR_AI_AGENTS.md` §2a and `data/resort-communities.json`. Live MLS row counts were not re-queried.

---

## How a raw MLS subdivision becomes a public page

There is no single place graph. Five overlapping registries feed public URLs:

| Layer | Where | What it is | Who edits it |
|---|---|---|---|
| Resort registry | `data/resort-communities.json` | 19 curated parents, ~100 MLS `SubdivisionName` aliases, `mls_cities`, HOA, centers | Code change |
| Tiny alias map | `lib/subdivision-aliases.ts` `SUBDIVISION_ALIASES` | 12 display-name → match-name lists (Pronghorn Resort, Eagle Crest Resort, …) | Code change |
| DB alias join | `public.neighborhood_subdivisions` | Parent slug → child `subdivision_label`. Seeded from the JSON; 1,686 rows | Migration / SQL |
| Resort flags | `public.subdivision_flags` | `entity_key = 'city:slug'`, `is_resort` | Admin toggle at `/admin/geo/resort-communities` |
| Auto communities | `public.communities` | ~1,848 rows auto-populated from MLS `SubdivisionName`. Flat. No parent. | MLS sync. Admin can only re-parent a `geo_places` row |

**Mint path for `/communities/{slug}`:**

1. `parseCommunitySlug()` in `lib/community-slug.ts` splits the URL.
   - Bare registry slug (`tetherow`) → `{ city: 'Bend', subdivision: 'Tetherow' }` via `RESORT_SLUG_TO_CITY`.
   - Compound slug (`bend-oww`) → first matching city prefix, then `slugToTitle()` on the rest (`oww` → `Oww`).
2. `getCommunityBySlug()` in `app/actions/communities.ts` looks up `communities.name` ILIKE that title-cased string. Display name is `comm?.name ?? subdivision`. If there is no `communities` row, the **MLS code is the H1**.
3. Junk-slug guard only 404s when there is **no** inventory signal, **no** community row, **no** snapshot, and **not** a resort. Any MLS plat with one active listing becomes a public page.
4. Resort alias redirect: if the parsed subdivision matches a registry label or alias, the page 302s to `/communities/{bare-slug}`. The match is exact lowercased string. `Eagle Crest Resort` is **not** in the Eagle Crest alias list, so `/communities/redmond-eagle-crest-resort` does not consolidate.

**Mint path for `/homes-for-sale/{city}/{subdivision}`:**

`app/search/[...slug]/resolve-slug.ts` → `getSubdivisionNameFromSlug()` or `decodeURIComponent`. Canonical is `homesForSalePath(city, subdivisionDisplayName)` — a **different URL family** from `/communities/{slug}`, with its own `alternates.canonical`.

**Mint path for listing PDPs:**

`listingDetailPath()` in `lib/slug.ts` builds

`/homes-for-sale/{city}/[{neighborhood}/]{community}/{street}-{mlsNumber}`

from the listing's MLS `City` + `SubdivisionName` (slugified raw). `listingKeyFromSlug()` then extracts the terminal 6+ digit token. Lookup ignores the city/community path segments.

---

## The 24-item cap

Not a silent PostgREST default. An explicit product constant:

```139:143:app/communities/[slug]/page.tsx
/** The most rows the in-boundary queries return. Named so the trace can say it. */
const BOUNDARY_ROW_CAP = 200

/** How many homes the Field lists. Every one with coordinates still pins. */
const FIELD_LIST_CAP = 24
```

`communityFieldItems(fieldTiles, FIELD_LIST_CAP)` in `app/communities/[slug]/_v3/community-opening.ts` sorts by price and `.slice(0, cap)`. The map is fed `fieldMapPins(fieldItems)`, so **map and list are both the 24-item slice**. The Field `count` is the full alias-aware / pulse / snapshot number (`live.count`). The footnote still says:

> Map and list are the same set.

That sentence is true of map vs list and false of count vs either. Tetherow 36/24, Eagle Crest 98/24, NWC 31/24 are this constant, not a data bug.

`getCommunityListings()` in `app/actions/communities.ts` is documented “limit 24” and is only used on the oversized-boundary fallback path, with `BOUNDARY_ROW_CAP` (200) from the page.

---

## Root cause per verified symptom

### 1. Community pages claim N homes but render 24

**Cause:** `FIELD_LIST_CAP = 24` plus a footnote that claims one set. Count and Field are intentionally different populations after the 2026-08-12 repair (see the page header comment: “ONE INVENTORY PER FIGURE SET” is violated by the cap).

**Files:** `app/communities/[slug]/page.tsx` (`FIELD_LIST_CAP`, `fieldItems`, footnote); `app/communities/[slug]/_v3/community-opening.ts` `communityFieldItems()`.

**Not a one-line data bug.** Fix belongs in the metric kit: one published set, or honest “showing 24 of N” copy and a “see all” door that actually lists those N (today `/homes-for-sale/{city}/{literal-subdivision}` undercounts resorts).

### 2. MLS subdivision codes become public H1s and URLs

**Cause:** slug → title-case is the display name. There is almost no override map.

`parseCommunitySlug()` → `slugToTitle("oww")` = `"Oww"`.  
`getCommunityBySlug()` → `name: comm?.name ?? subdivision`.  
`getSubdivisionDisplayName()` in `lib/slug.ts` only remaps `"Out of area; see remarks"`.  
`displaySubdivision()` drops `N/A` / `None` / `Unknown` / `***`.  
`ALIAS_DISPLAY` in `app/communities/[slug]/_v3/place-knowledge.ts` has **one** entry: `Triple` → `Triple Knot`.

So `Oww`, `Crr3_C`, `PLA`, `DrrhLp`, `ForPS`, `Aspen Creek Mob Pk` ship as H1s and URL slugs whenever they appear as MLS `SubdivisionName`.

**Oww is not Widgi Creek in this repo.** `data/resort-communities.json` lists `Oww` / `OWW2` under **Three Rivers** (Matt directive 2026-05-15: Oww is Oregon Water Wonderland, not Crosswater, not Widgi). Widgi aliases are `Widgi Creek`, `PointsWest`, `Elkai Woods`, `Milepost 1`. `/communities/bend-oww` should redirect to `/communities/three-rivers` if the alias match fires; if it does not, the page publishes H1 **Oww**. The live “Widgi published as Oww” report is either a stale index, a `communities` row named Oww, or a listing URL that used `SubdivisionName=Oww` next to a Widgi address.

**Slurs / sensitive names:** `squaw-creek-canyon` appears only as a **legacy explore redirect** in `data/legacy-redirects.json` → `/cities/sisters`. There is no display-name override. A new MLS plat with that string would title-case into a public H1. Overridable today only by shipping code (`ALIAS_DISPLAY` / `getSubdivisionDisplayName`) or inserting a `communities.name` row — there is no admin field for this.

### 3. Dual indexed URLs with separate canonicals

Three URL families, three self-canonicals, incomplete consolidation:

| URL | Route | Canonical |
|---|---|---|
| `/communities/tetherow` | `app/communities/[slug]/page.tsx` | `/communities/tetherow` via `communityMetadataInput().path` |
| `/communities/bend-tetherow` | same | body redirects to bare slug; `generateMetadata` still self-canonicals the requested slug before the redirect |
| `/homes-for-sale/bend/tetherow` | `app/search/[...slug]/page.tsx` | `/homes-for-sale/bend/tetherow` via `buildCanonicalPath()` |

Eagle Crest:

- `/communities/eagle-crest` — bare registry slug. Canonical.
- `/communities/redmond-eagle-crest` — compound. Should 302 to bare if label match hits (`Eagle Crest`).
- `/communities/redmond-eagle-crest-resort` — subdivision `"Eagle Crest Resort"`. **Not** in `subdivision_aliases`. `lib/subdivision-aliases.ts` knows `Eagle Crest Resort`, the community page redirect does **not** use that map. Separate page, separate canonical.
- `/homes-for-sale/redmond/eagle-crest` — search family, third canonical.

Sitemap emits `/communities/{registry-slug}` **and** `/homes-for-sale/{city}/{sub}` for every subdivision that clears the lifetime floor (`app/sitemap.ts`). Google is asked to index both.

### 4. “Subdivisions in X” and inventory leak

**Cause:** the place graph was built by **spatial proximity**, not HOA / legal membership.

`data/resort-communities.json` verification: Spark `/listings/nearby` + closest-parent + ≥80% of that plat’s listings inside a 2–6 km radius. That is why these aliases exist **on purpose** in the registry:

- Tetherow: `Braeburn`, `Roald West` (both `pct_inside: 100`)
- Awbrey Glen: `Shevlin Bluffs`, `Shevlin Estates`, `Shevlin Court`
- NorthWest Crossing: `Shevlin Ridge` (a different Shevlin*)
- Eagle Crest: `Cline Falls Mob Park`, `Cline Falls Oasis`

`buildPlaceKnowledge()` prints every `subdivision_aliases` entry as a “Subdivisions in X” door. Alias-aware inventory (`lib/kb/resort-active-counts.ts` `resortTilesForSlug`) counts every alias as the parent’s homes.

The leak is a **wrong parent edge**, not a query bug. Admin cannot edit aliases. Fixing it is a registry edit + `neighborhood_subdivisions` migration.

### 5. Search count vs market widget (Bend ~1,300 vs ~490 SF)

**Cause:** unlabeled, different populations. Documented on the city page itself:

```213:216:app/cities/[slug]/page.tsx
      // propertyType 'A' (§0) - the MLS residential BUCKET (single family, townhome,
      // condo), Active by City field, NOT the population market_pulse_live counts
      // (SFR sub-type, Active and Coming Soon, inside the boundary polygon). Verified
      // 2026-08-12: Terrebonne 6 against 71 tiles, Bend 489 against 987.
```

| Surface | Population | Typical Bend |
|---|---|---|
| `market_pulse_live` / city Instrument | `property_type='A'` **and** single-family subtype, Active + Coming Soon, **TIGER city polygon** | ~490 |
| City Field tiles | PropertyType `A` bucket (SFR + townhome + condo), Active, City field | ~987 |
| `/homes-for-sale` split map | Default **no** `propertyType`. Status Active. City defaults to Bend. Viewport / City field, all types (land, manufactured, commercial if present) | can read ~1,300 |
| `geo_snapshot_mv.active_sfr_count` | SFR snapshot | another number |

Copy rarely names the population. Search says “N homes in this map view”. The market widget says “homes for sale” next to the pulse SFR count.

### 6. Dual listingKey on one PDP (Schedule / Ask)

**Cause:** the pretty URL extracts the **MLS number**. The page then passes the **URL param** into the sidebar CTA and the **Spark `ListingKey`** into trackers / quiet links.

- `listingKeyFromSlug()` → terminal `\d{6,}` (MLS#).
- `getListingDetail()` tries `ListNumber` then `ListingKey` (`lib/data/listings/getListingDetail.ts` `fetchOneOrThrow`).
- `ListingBrokerCTA` was called with `listingKey={listingKey}` (the URL token).
- `listingQuietLinks()` / `ListingTracker` use `listing.listingKey` (Spark key).
- `/contact?listingKey=` resolves tiles via `getListingTiles({ listingKeys })`, which filters `listing_tile_mv.listing_key` only — an MLS# miss means “listing 220216452” with no home.

**One-line fix in this PR:** `listingKey={listing.listingKey}` on `ListingBrokerCTA`.

### 7. URL/record collision (`/homes-for-sale/bend/oww/56072-marsh-hawk-220216452` → Grants Pass)

**Cause:** the path is decorative. Lookup is the terminal number only.

```12:27:app/listing/by-address/[...slug]/page.tsx
async function resolveListingKeyFromPathSegments(slug: string[]): Promise<string | null> {
  // ...
  const keyFromSegment = listingKeyFromSlug(candidateKey ?? '')
  // Fast path FIRST: MLS# / ListingKey from the URL tail.
  if (keyFromSegment) return keyFromSegment
```

`citySlug` and `areaSlugs` (`bend`, `oww`) are unused on the fast path. Then `fetchByColumn` does `.eq(column, value).order('ModificationTimestamp').limit(1)` with **no city filter**. Oregon Data Share is statewide. If `ListNumber` `220216452` is a Grants Pass row (or a Spark `ListingKey` collides with that MLS#), that row wins. `generateMetadata` on the by-address route **self-canonicals the requested (wrong) URL**.

URL minting uses raw MLS `City` + `SubdivisionName`. A Bend-tagged or Oww-tagged row can mint a Bend/OWW URL for a house that is not in Bend.

### 8. Sold search: H1 still “Homes for Sale”

**Cause:** H1 ignores status.

`app/search/page.tsx` `h1Text` is always `[subdivision, city, 'Homes for Sale']`.  
`buildSearchTitle()` / `search-metadata.ts` title is always `Homes for Sale in {place}` unless a **preset** is present. Sold is a `status` / `statusFilter` / `includeClosed` query param, not a preset.

The map chrome is honest: `MapSearchView` prints `{N} homes in this map view` plus the filter summary (`· Bend · Sold`). Headline and chrome disagree.

### 9. `/motivated-sellers` 301s to `/price-drops`

**Cause:** intentional IA lock, not a bug.

`app/motivated-sellers/page.tsx` calls `permanentRedirect('/price-drops')` with `canonical: '/price-drops'` and `robots: { index: false }`. Comment: “P5 IA lock: deal signals keep one URL.” Nav still has a “Sell on a deadline” item pointing at `/motivated-sellers` (`lib/site-nav.ts`), so users hit a 308.

### 10. Internal table names in public copy

**Cause:** source traces were written for §0 auditability and then rendered as visitor-facing `source=` / footnotes.

Public (not comments):

- `app/cities/page.tsx` — “Featured rows prefer the 15-minute `market_pulse_live` row, then `geo_snapshot_mv`.”
- `app/months-of-supply/page.tsx` — `market_pulse_live` in Instrument source.
- `app/housing-market/reports/page.tsx` and `ReportsIslands.tsx` — `market_pulse_live` / `market_stats_cache`.
- `app/housing-market/[...slug]/_v3/geo-figures.ts` / `community-view.tsx` — `market_stats_cache`.
- `app/lp/tetherow/page.tsx`, `app/lp/bend/page.tsx` — `<code>market_stats_cache</code>` in page body.

`closed_cte` is SQL in cache RPCs / docs; if it appeared on a page it was a leaked methodology string from a stats row, not a dedicated UI label.

### 11. Sitemap index flaky; geo/listings time out; 7,656 listing URLs / 143 cities

**Cause:** the index is cheap; the children still build the whole universe.

- `/sitemap.xml` rewrites to `app/sitemaps/index.xml/route.ts` — no DB, five `<sitemap>` locs. Can look “flaky” if a child 504s.
- Each child (`app/sitemaps/[cls]/route.ts`) calls `buildAllUrls()` (`app/sitemap.ts`). `maxDuration = 300`. Comments record 600s / 1800s prerender kills and 504s from per-city RPCs (since replaced by `listing_tile_mv`, still a full active scan).
- Listing URLs: **every active row in `listing_tile_mv`**, statewide ODS, not Central Oregon. That is the ~7.6k figure and why ~half are outside the service area.
- City count: `geo_snapshot_mv` has ~362 cities; sitemap also emits CO cities + `getOutOfAreaCitySitemapEntries()` (top 25 out-of-area with ≥5 actives) + ZIP pages from a **raw `listings` PostalCode scan** (another timeout source).
- Cache: v1 2.4MB entry exceeded `unstable_cache` 2MB cap, so every child rebuilt every time. v2 is per-class; cold still one full fan-out per class per hour.

### 12. Fractional TIC listing treated as a whole home

**Cause:** PDP modules are unconditional.

`app/listing/[listingKey]/page.tsx` always renders `<MortgageCalculator>` and `<RentalAnalysis>`. `ListingDetail` has `propertySubType` (`lib/data/types/listing.ts`) and the search registry knows `Tenancy in Common` (`lib/search/field-registry.ts`). Price-drops DAL has a ~$50k sanity floor for fractional shares (`lib/data/listings/getPriceDrops.ts`). The listing page does not.

A $25k Sunriver TIC is a whole-home mortgage + rental product.

### 13. Admin CRM: what editors can fix vs what needs code

Admin is `/admin`, Google SSO `@ryan-realty.com` (`app/admin/login/page.tsx`).

| Need | Admin today | Requires code / migration |
|---|---|---|
| Flag a plat as resort | `/admin/geo/resort-communities` toggle → `subdivision_flags` | — |
| Seed the default resort list | same page, `SeedResortButton` | — |
| Assign community → neighborhood parent | `/admin/geo` `AssignCommunity` → `geo_places.parent_id` | Does **not** change public `/communities` slugs or aliases |
| Create neighborhood rows | `/admin/geo` `NeighborhoodForm` | — |
| Upload area-guide media | `/admin/geo/area-guide-upload` | — |
| Place banners | `/admin/banners` | — |
| Brand logo / hero | `/admin/site-pages` | — |
| Community **display name** | only if a `communities.name` row exists and something edits it — **no public-name editor** | `getSubdivisionDisplayName` / `ALIAS_DISPLAY` / `communities.name` |
| Alias list (Braeburn ∈ Tetherow) | **no** | `data/resort-communities.json` + `neighborhood_subdivisions` migration |
| Canonical URL / noindex a community | **no** | route metadata / sitemap / robots |
| Stop MLS codes becoming pages | **no** | allowlist + `dynamicParams` policy |
| Hide slur slugs | **no** | display-name map + noindex |
| Listing key / URL collisions | **no** | lookup must use city + MLS#; mint must use canonical place |

`public.communities` is auto-filled from MLS. `public.geo_places` is optional and “not actively used” for public LP routing (`docs/DATABASE_FOR_AI_AGENTS.md` §2a). Public community pages read the JSON registry + `getCommunityBySlug`, not the admin geo tree.

---

## Recommended fix order (one system, not 40 patches)

Do not fix Tetherow’s 24, then Eagle Crest’s alias, then one slur. Ship three contracts.

### A. Canonical place graph (source of truth)

One typed node per public place: `{ kind: city \| neighborhood \| community \| plat, slug, displayName, legalName, mlsAliases[], parentId, cityId, index: index\|noindex, canonicalPath }`.

- Ingest MLS `SubdivisionName` as a **plat**, never as a community H1.
- Display name is required before index. Default: noindex + no sitemap until a human (or a curated registry row) sets `displayName`.
- Parent edges are HOA / Matt-approved / county plat, **not** “≥80% of listings inside 4 km.”
- Re-parent Braeburn, Roald West, Shevlin*, Cline Falls Mob Park as plats (or nearby, not members) in the same change that stops counting their inventory as the resort.
- Admin: edit display name, aliases, parent, canonical, noindex. JSON remains the seed; DB is runtime.

### B. Metric kit (one population per figure)

A `MetricSpec`: `{ population, geography, status, asOf, label }`. Every Instrument, Field count, search chrome, FAQ, and Dataset variable takes a spec.

Populations that already exist and must be named:

1. SFR subtype, pulse, TIGER polygon  
2. PropertyType A bucket, City field  
3. All types, map viewport  
4. Alias-union of a community  
5. Literal `SubdivisionName`

Rules: the number, the noun, and the door must be the same set. If the Field caps at 24, the caption is “24 of N” and the door lists N with the same filter. Sold search H1 uses the status noun. Table names never leave the spec’s `sourceId`.

### C. URL policy (one public id per thing)

- **Place:** one canonical path. `/communities/{registry-slug}` for curated communities. `/homes-for-sale/{city}/{plat}` for plats. Everything else 301s to the canonical. Sitemap emits only canonicals.
- **Listing:** public id is `ListNumber` + **city**. Resolve with `City` (or lat/lng) + `ListNumber`. Reject a Bend/OWW URL that loads a Grants Pass row (301 to the minted canonical, or 404). Stop minting from raw MLS codes; mint from the place graph’s `displaySlug`.
- **ListingKey:** Spark key is internal. Every CTA, contact form, and tracker uses `listing.listingKey` after resolve (the one-line fix in this PR). Never put the URL token on a form.
- **Sitemap:** Central Oregon allowlist for listing + city URLs. Build children from precomputed tables, not `buildAllUrls()` on the request. Keep the cheap index.

### Suggested sequence

1. Place graph schema + admin editor (display name, aliases, parent, noindex). Backfill from `resort-communities.json`.  
2. URL policy: 301 compound community slugs and `/homes-for-sale/{city}/{resort}` → `/communities/{slug}`. Add `Eagle Crest Resort` to the redirect map (the missing alias).  
3. Listing resolve: city + MLS#; self-canonical only after the loaded row matches the path.  
4. Metric kit on community + city + search (kills the 24-vs-N lie, Bend 1300 vs 490, sold H1, table-name traces).  
5. PDP product class: TIC / fractional / timeshare skip mortgage + rental.  
6. Sitemap allowlist + precompute (stops timeouts and out-of-area listing URLs).  
7. Motivated-sellers: either keep the 308 and retarget nav, or restore a distinct page — it is an IA choice, not a defect.

---

## What this PR changes in code

One line: `ListingBrokerCTA` now receives `listing.listingKey` (Spark key) instead of the URL token, so Schedule / Ask / contact resolve the same row the page rendered.
