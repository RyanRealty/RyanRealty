# exposure — long-form notes (2026-09-22, HEAD 83a459c, read-only)

Scratch files referenced below live in this directory: `sitemap-*.xml`, `urls-*.txt`, `live-*.html`, `live2-*.html`, `live3-*.html`, `bp-*.html`, `subs/*.html`, `txt-*.txt`, `db-exposure.mjs` (+ output in `../../tasks/b59t8cvue.output`).
All production fetches used a Chrome 128 UA through the sandbox proxy; the proxy reset the tunnel on the first attempt several times (curl 35), every retry succeeded. `git status --short` = 0 lines at finish.

## 1. The place tree in code (route config)

| Route | generateStaticParams | dynamicParams | revalidate | index policy |
|---|---|---|---|---|
| `app/cities/[slug]` | PRIMARY_CITIES (7: Bend, Redmond, La Pine, Sisters, Sunriver, Prineville, Madras) | true | 900 | index (pageMetadata default) |
| `app/cities/[slug]/[neighborhoodSlug]` | neighborhoods table | true | 900 | index; only 13 rows exist (all Bend GIS districts) |
| `app/communities/[slug]` | resort registry (19) | true | 900 | index |
| `app/subdivisions/[slug]` | `[]` | true | 900, maxDuration 60 | `noindex: indexableEntry == null` — indexable iff polygon in `boundaries` AND ≥ `SUBDIVISION_INDEX_MIN_LIFETIME_SALES` = 10 closed in `subdivision_plat_closed_mv` (lib/data/subdivisions/subdivision-index.ts:48) |
| `app/zip/[zip]` | CANONICAL_ZIPS (10) | **false** | 900 | index for the 10; everything else is a 404 |
| `app/cities/[slug]/types/[type]` | 7 cities × 10 PLACE_TYPE_PAGE_SLUGS | true | 900 | index (no noindex branch) |
| `app/communities/[slug]/types/[type]` | 19 communities × 10 | true | 900 | index |
| `app/oregon/[city]` | indexable top set | true, force-dynamic | — | index iff ≥5 active and within top `OUT_OF_AREA_INDEXABLE_TOP_N` = **100** (lib/out-of-area-cities.ts:52, "WIDENED 25 -> 100") |
| `/homes-for-sale/**` | no directory; `next.config.ts:468-469` rewrites `/homes-for-sale/:path*` → `/search/:path*` | search-static.ts: SITE_CITY_SLUGS (10) | 300 | index except sort-only presets, `shouldNoIndexSearchVariant` (page>1 or any filter query key), verified-zero matrix combos |
| `app/listing/[listingKey]` | — | — | 300 | index unless out-of-area; canonical = address URL (`/homes-for-sale/bend/river-west/west-hills/1671-saginaw-220222277`) |

`lib/site/page-metadata.ts:243` — `robots: { index: !input.noindex, follow: !input.nofollow }`: a page is indexable unless it opts out.

## 2. The live sitemap (fetched 2026-09-22)

`/sitemap.xml` → `<sitemapindex>` over `/sitemaps/{core,geo,listings,matrix,content}.xml` (app/sitemaps/index.xml/route.ts via the beforeFiles rewrite). Fetch results:

```
core     200 0.32s  22,997 B   205 URLs
geo      reset, then 200 0.64s  601,535 B  4,827 URLs
listings 200 11.9s  499,615 B  3,283 URLs
matrix   200 49.3s  113,517 B  885 URLs   (cold; warm-sitemaps cron runs hourly at :26)
content  200 0.26s  12,020 B   92 URLs
total 9,292 URLs, 9,262 unique (30 duplicates: /cities/{c}, /homes-for-sale/{c}, /open-houses/{c} for the 10 SITE_CITY_SLUGS are pushed by both the static seed at app/sitemap.ts:251-257 and the dynamic city loop at :343-349)
```

geo.xml by family (awk over `urls-geo.txt`):
```
2643 /subdivisions/{slug}
1815 /homes-for-sale/{city}/{sub}     (browse pairs from subdivision_city_inventory_mv, >=3 lifetime listings)
 117 /central-oregon/*
 115 /zip/{zip}
  61 /oregon/{city}
  56 /schools/*   19 /parks/*   1 /neighborhoods
```
core.xml: 42 `/cities/*` (10 seed + 19 dynamic + 13 neighborhood pages), 38 `/housing-market/*`, 29 `/open-houses/*`, 29 `/homes-for-sale/{city}`, 20 `/communities/*`, 11 `/price-drops/*`, statics.
matrix.xml: 885 `/homes-for-sale/{city}/{preset}` and `/homes-for-sale/bend/{district}/{preset}` (312 four-segment Bend combos).
listings.xml: 3,283 address URLs, statuses `PUBLIC_ACTIVE_STATUSES` = Active + Active Under Contract, filtered by `isServiceAreaCity` (lib/data/sitemap/getListingSitemapRows.ts:194). By city: bend 1,189 · redmond 454 · prineville 390 · la-pine 333 · sisters 188 · sunriver 169 · madras 167 · powell-butte 134 · terrebonne 118 · culver 57 · black-butte-ranch 37 · metolius 18 · camp-sherman 18 · tumalo 3 · brothers 3 · paulina 2 · post/mitchell/ashwood 1. **SITE-33's "56% out-of-market" is fixed: 0 out-of-market listing URLs today.** lastmod is real (`modified_at`): 1,659 in 2026-09, 666 in 2026-08, …

**`/types/` URLs in any sitemap: 0** (`grep -c '/types/' urls-all.txt`).

lastmod on geo.xml: 4,740 of 4,827 entries say `2026-09-22` (every place leg uses `lastModified: now`); 74 say 2026-07-03 (school/park registries).

## 3. Live probes (status | title | robots | canonical | H1)

```
/zip/97501                       404 "Page not found" noindex                       (in geo.xml)
/zip/97219                       404                                                (in geo.xml)
/zip/97702                       200 "97702 homes for sale · Bend SE, Oregon" index
/luxury-homes-bend               308 → /homes-for-sale/bend?minPrice=1500000        (in core.xml; 3 anchors on /; minPrice is a shouldNoIndexSearchVariant key → the target is noindex)
/homes-for-sale/bend/awbrey-butte 301 → /cities/bend/awbrey-butte                   (in geo.xml)
/cities/bend                     200 "Bend homes for sale | Ryan Realty, Central Oregon" index  H1 "Bend homes for sale"  3,773,792 B
/homes-for-sale/bend             200 "Bend homes for sale | Ryan Realty, Central Oregon" index  H1 "Bend homes for sale"    725,825 B
/cities/bend/types/single-family 200 "757 single-family homes for sale in Bend, Oregon" index H1 "Single-family in Bend" 1,683,696 B
/homes-for-sale/bend/single-family 200 "Single-Family Homes in Bend" index H1 "Single-Family Homes in Bend"   (in matrix.xml)
/cities/bend/types/condos        200 "57 condos for sale in Bend, Oregon" index
/homes-for-sale/bend/condos      200 "Condos for Sale in Bend" index H1 "Condos in Bend"                        (in matrix.xml)
/communities/tetherow/types/single-family 200 "15 single-family homes for sale in Tetherow, Oregon" index   (no sitemap, 0 inbound anchors from /communities/tetherow)
/subdivisions/ridge-at-eagle-crest-57 200 index  (the plat with the county suffix is the indexable one)
/subdivisions/ridge-at-eagle-crest    200 noindex,follow  1,068,290 B
/subdivisions/tetherow            308
/subdivisions/blakley-heights     500 (twice; 1,234 lifetime closed; in geo.xml, would be index)
/oregon/portland                  200 "17 Portland homes for sale, outside our market" index
/oregon/medford                   200 "728 Medford homes for sale, outside our market" index
/homes-for-sale/bend/deschutes-river-woods 200 index H1 "Deschutes River Woods homes for sale" body: "No homes match this search right now"
/subdivisions/deschutes-river-woods        200 index H1 "Deschutes River Woods homes for sale" 20 listing links
/open-houses/metolius             200 noindex,follow (good)
/homes-for-sale/metolius/luxury   200 index "Luxury Homes in Metolius" — 1 home
/cities/metolius                  200 index "Metolius homes for sale"
/listing/220222277                200 index canonical → address URL
/neighborhoods                    200 "Bend neighborhoods: Awbrey Butte, Larkspur, Old Bend"
/subdivisions                     200 "Central Oregon subdivisions"  — 59 /subdivisions/* anchors
/site-index                       200 — 102 /homes-for-sale/{city}/{sub} anchors, 0 /subdivisions/* anchors
/                                 200 "Homes for Sale in Central Oregon | Ryan Realty, Bend" H1 "Homes for sale in Central Oregon" 303 anchors
```

### Browse-pair sample (12 URLs, every 151st `/homes-for-sale/{city}/{sub}` in geo.xml)
9 of 12 render **"No homes match this search right now"** with `index, follow` and 0 listing links: 27th-street-crossing, clal, golfside-park, newport-heights, cascade-view-allotmt, north-canyon-estate, haner-park, canyonv, happy-trails. 3 had inventory (rivers-edge-village 9, thunder-ridge 4, desert-sand-arabian 4). Slugs like `clal`, `canyonv`, `cascade-view-allotmt` are MLS abbreviations rendered as page names.

### Subdivision detail sample (8 plats across the closed-count distribution)
```
plat                    status size     main words  anchors listing_links plat_links  notes
deschutes-river-woods   200   806 KB    3,579       228     20            8           3,018 closed
tetherow-phase-1        200   910 KB    4,171       237     24            7           983 closed
blakley-heights         500   6.8 KB    0           0       0             0           1,234 closed — server error
cimmaron-hills          200   409 KB    923         179     2             0
airpark-estates         200   538 KB    2,051       192     0             8
bartel-addition         200   477 KB    1,787       184     0             0           10 closed, last 2020-11-30
carriage-addition-no-i  200   494 KB    1,872       192     0             8           10 closed, last 2020-01-06
919-bond-condominiums   200   448 KB    2,459       214     1             11          10 closed
```
"main words" counts everything inside `<main>` including ledgers and source lines. Substantive prose lines (>25 chars, tags stripped): bartel 26, carriage 27, DRW 34. bartel ∩ carriage identical lines = 4 of 22 unique; the rest are the same templates with the plat name and one number swapped. Sample of bartel-addition (a plat with zero active listings and no sale since 2020, `index, follow`, in the sitemap):
> "Bartel Addition is one of Redmond's subdivisions. The drawing above is the ground under Bartel Addition: its streets and water, from US Census TIGER data." … "Bartel Addition has had fewer sales we can attribute to it on its own than a fair buyer's or seller's verdict needs, so we are not printing one." … "2 homes closed in Bartel Addition in 2020" … "10 sales have closed inside the Bartel Addition boundary across every year the MLS holds."

## 4. Database facts (via scratch `db-exposure.mjs`, service-role supabase-js, aggregated in JS)

```
boundaries rows = 3,541: subdivision 3,427 · school 42 · neighborhood 28 · park 17 · city 11 · zip 10 · school_district 6
  city polygons: bend culver la-pine madras powell-butte prineville redmond sisters sunriver terrebonne tumalo
  zip polygons: exactly the 10 CANONICAL_ZIPS (97701 97702 97703 97707 97739 97741 97754 97756 97759 97760)
  neighborhood polygons: 14 Bend districts (bend-*) + bend-undesignated + 13 resort/community slugs (tetherow, broken-top, …)
subdivision_plat_closed_mv rows = 3,283
  closed_count buckets: 1-9 → 641 · 10-24 → 679 · 25-99 → 1,466 · 100-499 → 465 · 500+ → 32
  plats >= 10 (the index bar) = 2,642; all 2,642 have a boundaries polygon  → matches the 2,643 /subdivisions URLs in geo.xml
  of those: 454 (17%) have no closed sale since 2024-09-22; 84 have <50% of their sales inside the polygon (name-join dominated)
  top_city_lower of indexable plats: bend 1,523 · redmond 570 · prineville 138 · sisters 133 · la pine 129 · sunriver 71 · black butte ranch 40 · terrebonne 23 · powell butte 10 · klamath falls 2 · ashland 1 · talent 1 · grants pass 1
  largest: eagle-crest 3,973 (in_polygon 524, by_name 3,968) · waywest-properties 3,245 · deschutes-river-woods 3,018 (by_name 0) · whispering-pines 1,053 (in_polygon 50, by_name 1,005)
subdivision_city_inventory_mv rows = 6,888; Central Oregon pairs 2,218; >=3 lifetime = 1,919; of those with >=1 active = 782 (41%)
  by city (>=3): bend 887 · redmond 348 · prineville 182 · la pine 120 · sisters 94 · madras 71 · sunriver 57 · terrebonne 55 · …
place_membership: subdivision 250,877 (is_primary 195,591; confidence='verified' 0) · neighborhood 136,314 · city 594,365 · zip 578,567; newest computed_at 2026-08-23 (cron compute-neighborhood-metrics runs 40 */6 * * * — whether it writes membership is UNVERIFIED)
listing_boundary_xref_mv: subdivision rows with standard_status=Active 3,113; neighborhood 1,260
geo_snapshot_mv rows 6,943: community 6,548 · city 366 · neighborhood 29; city rows with active_all_count>=5 = 74 (→ 61 out-of-area after removing service-area cities)
neighborhoods table = 13 rows, all city_slug=bend, desc_len 1,271–1,549, boundary + hero on every row (City of Bend GIS Neighborhood Districts)
subdivision_descriptions = 0 rows (checked two shapes: ORDER BY created_at LIMIT 12 and bare LIMIT 3)
```
Earlier in the session three targeted row reads went through the MCP SQL tool before the orchestrator's rule change; no further MCP calls were made after it.

## 5. Internal linking (anchors by destination class from raw HTML)

```
page                              total  →/subdivisions/*  →/cities/*/nbhd  →/cities/*/types/*  →/homes-for-sale/*/*  →listing addr
/                                 303    0                 0                0                   0                     75
/cities/bend                      995    0                 13               10                  51                    692
/cities/bend/types/single-family  307    0                 0                4                   12                    123
/homes-for-sale/bend              206    0                 0                0                   14                    82
/subdivisions (index)             226    59                0                0                   8 (city)              0
/neighborhoods (index)            183    0                 13               0                   0                     0
/site-index                       313    0                 0                0                   102                   0
/communities/tetherow             —      0                 —                0 (community types)  —                     —
```
Header (`lib/site-nav.ts`): Buy → `/homes-for-sale?view=map` (10 anchors on / point at `?view=` URLs); Areas → 8 cities, 7 communities, `/neighborhoods`, `/subdivisions`, `/schools`; no property types, no individual neighborhoods. `lib/site/chrome-mega.ts` columns: Cities, Communities, Browse.
SITE-128 commit **fc68066dc (2026-09-18, Cursor)** "Kill the city Subdivisions dump above neighborhood bars" removed the "Subdivisions in {city}" (60 deepest-history plats) section from `/cities/[slug]`; its comment says "A–Z `/subdivisions` is the directory", but `app/subdivisions/page.tsx` lists `registryChildPlats()` (59 anchors live), not the 2,642 indexable plats. Remaining inbound to plat pages: listing pages (`platHref`, app/listing/[listingKey]/page.tsx:865) and ≤24 "sister" links per plat page (PLAT_SISTER_CAP). Net: most of the 2,643 sitemapped plat pages have no path from the home page.

## 6. The title/H1 collision (search vs place)

Live: `/cities/bend` and `/homes-for-sale/bend` both carry title `Bend homes for sale | Ryan Realty, Central Oregon` and H1 `Bend homes for sale`, both `index, follow`, both in the sitemap (twice each).
Commit **ffcc52e80 (2026-09-17, Cursor Agent, "Node: none (Matt P0 voice — place H1 every-home kill)")** "use {place} homes for sale on place and search h1s" touched 27 files: city, neighborhood, zip, subdivision, oregon, listing AND search pages now share `placeHomesForSaleHeading()`, and `scripts/check-seo-shell.mjs` was rewritten so lines 102-107 now REQUIRE city H1 and metadata title to be "{city} homes for sale" and lines 129-130 require neighborhood H1 to carry "homes for sale".
The IA lock says the opposite: `docs/plans/PUBLIC_PRODUCT/PAGE_OUTLINE.md:53` "`/cities/bend` leftover HUD 'Bend homes for sale' — Change H1. Search owns that phrase."; `:64-66` "`/cities/bend` … must become `Bend real estate`. Search slug owns homes-for-sale."; `:226-228` "**Do not H1.** `{City} homes for sale` (search owns it). Title / H1: `Bend real estate`". `docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md:9` "Search owns `{City} homes for sale`. City guide owns `{City} real estate`."
Same shape on subdivisions: 651 slugs exist as both `/homes-for-sale/{city}/{slug}` and `/subdivisions/{slug}` (comm of the two slug sets from geo.xml), both indexable, same H1 pattern; the browse twin of DRW says "No homes match" while the plat twin lists 20 homes.
Type pages vs presets: `/cities/bend/types/condos` ("57 condos for sale in Bend, Oregon") and `/homes-for-sale/bend/condos` ("Condos for Sale in Bend") are both indexable; only the preset is sitemapped, only the type page is linked from the city page.

## 7. Menus / IA vs spec
`docs/MASTER_SPEC.md §4.3` specifies a "Homes for sale" mega-menu with Cities / Featured Neighborhoods / Property Types / Quick links and a "Neighborhoods" mega-menu with Bend (8) + Other areas. Live header has cities and communities only. `docs/plans/PUBLIC_PRODUCT/SITE_PAGES.md:68-69,83` lists `/zip/[zip]` and `/subdivisions/[slug]` as landing pages and `/oregon/[city]` as "Refer-out".

## 8. Robots
`app/robots.ts`: `*` allow `/`, `/api/og`, `/llms.txt`; disallow `/admin/ /dashboard/ /account/ /api/ /auth/ /mockup-preview/ /dev/`; explicit allow for OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-*, Applebot, YouBot, meta-externalagent, Amazonbot, Googlebot, Bingbot, GPTBot, ClaudeBot. Nothing in robots blocks the place tree.

## 9. Conclusion — is the exposure model right?

What deserves to exist and be indexed:
- City (10) · Bend neighborhood (13) · resort community (19) · ZIP (10): yes, and these are the pages with real prose, polygons, photos. They are also the only ones the header reaches.
- Subdivision: ONE URL per entity. Today there are two families (plat by GIS slug, browse by MLS name) with 651 overlaps and ~1,100 indexable empty browse pages. The plat page has the depth (polygon, sold history, streets); the browse page has the MLS-name match. Consolidate: plat page canonical where a polygon exists, browse URL 301/canonical to it, browse-only names (no polygon) indexable only with ≥1 active.
- Plat bar: 10 lifetime closes is not a content bar. 454 indexable plats have had no sale in two years and read as filler. Add recency (a closed sale in 36 months or ≥1 active) and let the rest be `noindex, follow`, kept as reachable data not as index entries.
- Property types: real query intent ("Bend condos for sale") but two URLs, neither in the sitemap+nav together. Pick one per (place, type), sitemap it, put it in the mega-menu.
- ZIP: sitemap must be the 10 canonical ZIPs; 105 entries are 404s.
- Out-of-area `/oregon/*`: 61 indexable "outside our market" pages, cap silently widened 25→100. Matt decides; the IA doc says refer-out.
- Internal links: the depth Matt describes is not crawlable from the home page — 0 links to plats, types, or Bend districts on `/`; plats lost their city-page links on 2026-09-18. A real A–Z directory per city (paginated HTML), place → children, and the mega-menu are what make 3,000 pages part of one site instead of a sitemap dump.
- Prose: `subdivision_descriptions` is empty; every plat and browse page is template + numbers. Depth to Google and AI engines means a few hundred pages with real sentences, not 4,500 with the same twenty.
- Honesty gates worth keeping: verified-zero matrix noindex (W3.1/W3.2), Coming Soon excluded, listing sitemap service-area filter (SITE-33 fixed), out-of-area listing noindex.
