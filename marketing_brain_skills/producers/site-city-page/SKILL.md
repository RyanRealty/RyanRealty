---
name: site-city-page
description: >
  Scaffolds or updates the city-level landing page at /lp/<city>/ on
  ryan-realty.com. This is the Tier 1 (top) page in the four-tier search-
  authority stack (city → community → subdivision → listing). The right
  producer for Bend, Sisters, Redmond, La Pine, Sunriver-as-a-place,
  Tumalo, Terrebonne, and Madras as wide-funnel city LPs. Use this skill
  when Matt says "build the Bend page", "create the /lp/bend/ landing
  page", "make the city pages for Central Oregon", or any time a Central
  Oregon city or town needs its own search-authority landing page above
  the resort-community tier. Use this skill (NOT site-community-page or
  site-neighborhood-page) any time the subject is a whole municipality
  with a city government, taxing authority, school district mention, and
  a city-wide MLS dataset, not a master-planned resort community. The
  skill outputs a Next.js dynamic route at app/lp/[city]/page.tsx with
  ISR 6h. The page is the broadest of the four tiers --EMDASH-- it lists every
  resort community + neighborhood inside the city as a tile grid, shows
  city-wide market stats, calls out major neighborhoods, and serves as
  the top-of-funnel SEO surface for "homes for sale in Bend" type
  queries. Opens a GitHub PR.
action_types:
  - site:city_page_create
  - site:city_page_update
output_type: web-page
target_platforms: []
asset_destination: app/lp/[city]/page.tsx
auto_inputs: ['getCityDetachedMarket', 'getMetric', 'listings', 'boundaries', 'data/resort-communities.json']
required_inputs: ['city_slug']
optional_inputs: ['hero_image_override', 'sections_to_update']
estimated_runtime_min: 40
cost_usd_estimate: $0-$2
thumbnail_uri: null
example_outputs:
  - label: /lp/bend/ (first exemplar)
    surface: website
    path: app/lp/bend/page.tsx
---

# STOP - UNUSED / DO NOT DISPATCH

Inbox, weekly-cycle, and producer-runtime do not assign this producer. Do not dispatch it. Do not invent a cron or writer. Shipped TypeScript product (if any) is the live path.


# site-city-page

**Scope.** Creates or updates the city-level SEO + AEO landing page at
`/lp/<city>/`. This is the broadest tier in the search-authority stack:
the page that ranks for queries like "homes for sale in Bend Oregon",
"Bend OR real estate", "Sisters Oregon homes", "Central Oregon
relocation". It is the top of the funnel and the parent of every
community + neighborhood + listing page in the city.

The page is rich (similar scope to a community page, ~2,000-2,800 lines)
because it must cover the full city: market dynamics, every named
neighborhood + resort community, schools, demographics, employer base,
the relocation pitch, the climate honest disclosure, and the active
inventory across the entire city. ISR every 6 hours keeps stats current.

The first executed exemplar is `/lp/bend/`. Sisters, Redmond, La Pine,
and Tumalo follow.

Does NOT replace per-resort community pages (use `site-community-page`).
Does NOT replace per-neighborhood pages (use `site-neighborhood-page`).
The city page links to those, doesn't substitute for them.

**Status:** Deprecated
**Locked:** 2026-05-18
**Exemplar output:** GitHub PR at `site-city/<city-slug>-<prefix>` branch.

---

## 1. Scope

### In scope

- `site:city_page_create`: net-new route at `app/lp/<slug>/page.tsx`
- `site:city_page_update`: targeted section refresh on an existing route
- Route registration in `app/sitemap.ts` with `priority: 0.9` (top of the stack), `changeFrequency: 'daily'`
- JSON-LD `City` (or `Place`) + `RealEstateAgent` schemas with full geo + areaServed coordinates
- ISR config: `export const revalidate = 21600` (6 hours)
- Live city MOS/DOM from getCityDetachedMarket / getMetric, active inventory, recent closings, peer-city comparison
- Map: city-wide Google Static Map at zoom 11-12 with named landmarks pinned
- Tile grid of every named resort community + neighborhood inside the city, each linking to its own LP (or "coming soon" if not built yet)
- Top-of-the-funnel KPIs: city-wide median, sold count, DOM, active inventory
- City vs Central Oregon peer comparison (Bend vs Redmond vs Sisters)
- The "relocating to Bend" content block: cost-of-living, schools, climate, employers, taxes
- A "neighborhoods at a glance" matrix with price tier per neighborhood
- Buyer track + Seller CMA forms (same as community pages, CRM-tagged with `city:bend`)
- Brand voice validation
- TypeScript compile verification

### Out of scope

- Per-community pages (use `site-community-page`)
- Per-neighborhood pages (use `site-neighborhood-page`)
- Per-listing pages (use `site-listing-page`)
- City government info pages (we link to the city's official site)
- Tourist/visitor info content (out of scope --EMDASH-- this is a real-estate LP)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `site:city_page_create` | `city_slug`, `city_name`, `hero_headline`, `meta_description` | Route must not exist. Slug must match `boundaries.geo_slug` of type `city`. |
| `site:city_page_update` | `city_slug`, `sections_to_update[]`, `reason` | Route must exist. |

### Payload schema

```typescript
interface SiteCityPagePayload {
  city_slug: string;                 // 'bend' | 'sisters' | 'redmond' | 'la-pine' | 'tumalo' | 'terrebonne' | 'madras'
  city_name: string;                 // 'Bend' | 'Sisters' | etc.
  hero_headline: string;             // Playfair Display H1. May include dynamic-month-year.
                                     // e.g. 'Bend, Oregon real estate, <data-dyn-month-year>'
  meta_description: string;          // 150-160 chars. Must include city + state + a verified figure.
  hero_image_override?: string;
  sections_to_update?: Array<
    | 'kpi_grid'
    | 'active_inventory'
    | 'communities_tile_grid'
    | 'neighborhoods_matrix'
    | 'comparison_row'
    | 'demographics'
    | 'schools'
    | 'employers'
    | 'climate'
    | 'meta'
    | 'jsonld'
  >;
  reason?: string;
}
```

---

## 3. Full action row schema

```typescript
interface SiteCityPageActionRow {
  id: string;
  action_type: 'site:city_page_create' | 'site:city_page_update';
  target: string;                    // e.g. 'city:bend'
  assigned_producer: 'marketing_brain_skills/producers/site-city-page';
  payload: SiteCityPagePayload;
  data_evidence: {
    audit_source?: string;
    opportunity_area?: string;
  };
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

**Step 1.** Read action row, set `status='in_production'`.

**Step 2.** Load mandatory references:
- `CLAUDE.md` §0, §0.5, design system, brand voice
- `design_system/ryan-realty/SKILL.md`
- `data/resort-communities.json` --EMDASH-- read every community where `city == payload.city_slug`

**Step 3.** Verify the city has a boundary polygon:

```sql
SELECT
  ST_X(ST_Centroid(polygon))::numeric(10,6) AS centroid_lng,
  ST_Y(ST_Centroid(polygon))::numeric(10,6) AS centroid_lat,
  ROUND((ST_Area(polygon::geography) / 4046.86)::numeric, 1) AS acres,
  source, source_url
FROM boundaries
WHERE geo_slug = '<city_slug>' AND geo_type = 'city'
LIMIT 1;
```

If no row, kill: "City '<slug>' has no registered boundary polygon. Add it from City GIS first."

**Step 4.** Pull all communities inside this city:

```sql
-- Reads from data/resort-communities.json (file read, not SQL):
-- All rows where city == payload.city_slug.
-- E.g. for Bend: Tetherow, Broken Top, NW Crossing, Old Bend, Awbrey Butte, Tree Farm,
-- River's Edge, Caldera Springs (south Bend area), etc.
```

For each community, look up its `boundaries.geo_slug` to verify the route at
`/lp/<community>/` exists (or note "coming soon" in the tile).

**Step 5.** Pull live city-wide market data:

a. **City MOS, active count, verdict, days to contract:**

City MOS, active count, and market verdict: `getCityDetachedMarket('<city_slug>')` from
`lib/data/market-truth/getSellBendMarket.ts` (D1 detached, MLS City, exact Active). Same
three figures as `/sell`.

City days on market: `getMetric({ stat: 'median_days_to_contract', geoType: 'city',
geoSlug: '<city_slug>', segment: 'detached' })` from `lib/data/market-truth/getMetric.ts`
(D2). Label it days to contract.

Do not query `listings` for city MOS or city DOM. Do not treat `PropertyType='A'` as
single family. Do not read `CumulativeDaysOnMarket` or `"DaysOnMarket"` as a city median.
Do not compute on the fly from listings. A miss (`null` or `isPublishable === false`)
withholds the KPI. Never fall back to pulse 488 / 3.54.

Other city cells (median close, median list, YoY) also go through `getMetric` with
`segment: 'detached'`.

b. **City-wide active inventory (for the active grid + tile, not the KPI count):**
The published city active count is `getCityDetachedMarket('<city_slug>').activeCount`.
Use that number in the KPI bar. The listing grid below is inventory cards, not the
MOS numerator. Filter cards to detached (`property_sub_type='Single Family Residence'`
and `"PropertyType"='A'`), never `PropertyType='A'` alone as "SFR".

c. **Featured active inventory (cap 12 for the tile section):**
```sql
SELECT
  "ListingId", "ListPrice", "StreetNumber", "StreetName",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
  "PhotoURL", "SubdivisionName"
FROM listings
WHERE "City" = '<city_name>' AND "StandardStatus" = 'Active'
  AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
ORDER BY "ListPrice" DESC
LIMIT 12;
```

This grid is listing cards. The published city active count and MOS still come from
`getCityDetachedMarket`, never from `COUNT(*)` on this query.

d. **Peer-city comparison:**
For each peer slug (`bend`, `redmond`, `sisters`, `la-pine`, `tumalo`, `terrebonne`,
`madras` except the current city), call `getCityDetachedMarket('<peer>')` for MOS,
active count, and verdict. Call `getMetric` `median_days_to_contract` for days to
contract. Omit a peer whose cell misses. Never fill a miss from pulse or listings.

**Step 6.** Generate map asset. City-wide zoom (10-12 depending on city size):

```bash
MAP_URL="https://maps.googleapis.com/maps/api/staticmap?\
center=<lat>,<lng>&zoom=12&size=720x520&scale=2&maptype=roadmap\
&style=feature:poi|element:labels|visibility:off\
&style=feature:landscape|element:geometry|color:0xf2ebdd\
&style=feature:water|element:geometry|color:0xb8d4dc\
&markers=color:0x102742%7Csize:mid%7Clabel:B%7C<lat>,<lng>\
[+ markers for each major resort community + neighborhood centroid]\
&key=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
curl -s -o public/lp/<slug>/img/<slug>-map.png "$MAP_URL"
```

For Bend, add markers for major communities (Tetherow, Broken Top, NW
Crossing) so the city map shows where they are inside the city.

**Step 7.** Voice-validate all generated copy.

**Step 8.** Scaffold the route at `app/lp/<slug>/page.tsx`.

Page structure (rich, similar to community page):

1. **Topbar** (inherited from layout)
2. **Sticky scroll CTA** ("Browse Bend homes" or "What's my Bend home worth?")
4. **About <City>** --EMDASH-- rich SEO + AEO overview. 5-7 paragraphs covering: what makes the city distinct, geography, climate (honest disclosure on wildfire smoke + winter), economy, population, schools, the relocation pitch. Right column: sticky "City at a glance" panel.
5. **The market right now** --EMDASH-- full KPI grid: active, pending, median, DOM, S/L, $/sqft, YoY momentum, price-tier distribution
6. **Resort communities inside <City>** --EMDASH-- tile grid linking to every `/lp/<community>/` page. Photo, name, price tier, sold count badge per community.
7. **Neighborhoods at a glance** --EMDASH-- matrix showing every named neighborhood (NW Crossing, Old Bend, etc.) with median + price-tier badge. Each links to `/lp/neighborhoods/<slug>/` if built.
8. **Map** --EMDASH-- full-city map with all major communities pinned + neighborhood centroids
9. **The relocation block** --EMDASH-- "Thinking about moving to <City>?" --EMDASH-- cost of living, schools (Bend-La Pine assignment + GreatSchools), employer base (St Charles, Deschutes Brewery, Mt Bachelor, BendBroadband), climate honest disclosure, taxes (no sales tax in OR), wildfire risk window
10. **City vs peer cities comparison** --EMDASH-- table of Bend vs Redmond vs Sisters vs La Pine
11. **Active inventory** featured grid (12 cards) with showing CTAs
12. **Schools** section with the Bend-La Pine district overview + per-area assignment table
14. **Pipeline** --EMDASH-- major construction projects, zoning changes, master-plan amendments
15. **Buyer track** (three cards: showing, alerts, guide) --EMDASH-- same pattern as community pages
16. **CMA seller form** (CRM tagged `city:bend`)
17. **Methodology** footer
18. **Footer** with the resort + community pages list (linking to all 14+)
19. **JSON-LD** City + RealEstateAgent

Design system: Web register, shadcn/ui only. Hero is the canonical 4K aerial.

**Step 9.** TypeScript compile, sitemap update (priority 0.9), branch + commit + PR.

**Step 10.** Write citations.json. Surface to Matt.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | market queries; boundaries; listings | standard |
| Read | bend-market-bible, resort-communities.json, brand voice | repo |
| Write / Edit | route file, sitemap, map asset | working tree |
| Bash: curl | Google Static Maps | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Bash: tsc | TypeScript compile | repo |
| Bash: git, gh | branch + PR | gh session |

---

## 6. Output format

**Draft lands at:** GitHub PR.

```
app/lp/<slug>/page.tsx
app/sitemap.ts
public/lp/<slug>/img/<slug>-map.png
public/lp/<slug>/img/<slug>-hero.jpg (if override)
out/site-city/<slug>/citations.json
```

**Surface format (chat reply to Matt):**

```
City page ready: /lp/<slug>/

  PR
    URL: <pr_url>
    Branch: site-city/<slug>-<prefix>

  PAGE
    Route: /lp/<slug>/
    City: <city_name>, Oregon
    H1: <hero_headline> (with dynamic month-year)
    KPI sourced from getCityDetachedMarket / getMetric (D1 detached, D2 days_to_contract)
    Active inventory: <n> homes city-wide
    Communities tiled: <n>
    Neighborhoods matrixed: <n>
    Peer comparison: <peer list>

  VERIFICATION TRACE
    Live queries:
      • getCityDetachedMarket('<slug>') -> active / MOS / verdict
      • getMetric median_days_to_contract city/<slug>/detached -> days to contract
      • listings city-wide detached active cards -> <n>
      • Per-community counts -> <list>
      • Peer cities -> <n>
      • boundaries geo_slug='<slug>' centroid -> (<lat>, <lng>)

  VALIDATION
    Voice: PASS
    TypeScript: PASS
    Design tokens: PASS
    JSON-LD: City + RealEstateAgent

Matt merges the PR in GitHub to ship.
```

Then stop. Wait for merge.

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-PR` | Matt merges the GitHub PR | Matt only |

---

## 8. Status flow

Same as community-page: pending → in_production → ready → approved → executed → measured.

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| City missing in boundaries | No polygon | Kill; surface to Matt |
| City missing in bend-market-bible | No reference content | For Bend: kill (must exist). For other cities: render with minimal copy and surface a "research-needed" note to Matt |
| Communities tile grid empty | No `/lp/<community>/` routes exist for this city | Render tile grid with all "coming soon" placeholders; note in PR |
| Active inventory thin | < 5 active homes | Render with "Limited city-wide inventory right now" callout |
| Voice / TS fail | as elsewhere | Kill after 2 iterations |
| Peer comparison city cell missing | `getCityDetachedMarket` or `getMetric` miss for a peer | Omit that peer. Never fill from pulse 488 / 3.54 or listings CDOM. |

---

## 10. Related skills and references

**Required reading:**

- `CLAUDE.md` §0, §0.5
- `CLAUDE.md` "Design System Rules: MANDATORY" + "Design System v2"
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/VOICE.md`
- `data/resort-communities.json` (all rows for the target city)
- `public/lp/tetherow/index.html` (visual exemplar)
- `app/sitemap.ts`

**Sibling producers:**

- `site-community-page` (Tier 2 --EMDASH-- child of this skill's output)
- `site-neighborhood-page` (Tier 2 sibling for non-resort neighborhoods)
- `site-subdivision-page` (Tier 3)
- `site-listing-page` (Tier 4)

**Producers this delegates to:**

- `listing-alerts` for the Custom Alerts form
- `buyers-guide` for the Buyer's Guide form
- `cma` for the seller CMA flow

**Registry entry:**

- `marketing_brain_skills/producers/REGISTRY.md` --EMDASH-- Section D, row `site-city-page`.

---

## 11. Tool gap suggestions


2. **Embedded video tour of the city.** The hero could autoplay a 30-second drone reel of the city. Generated via the `neighborhood_tour` producer at the city scope.

3. **Live employer-base scrape.** Today the employer base list is hand-curated. A LinkedIn or BLS API scrape would auto-update the major employers list quarterly.

4. **Comparable-city auto-detection.** Today peer cities are hand-listed. Computing peers from population + median + amenity profile would surface the right comparison set (Bend vs Park City vs Asheville for the national HNW migration story).

5. **Wildfire-risk overlay.** A small server-rendered map overlay showing the recent fire season's smoke days for the city would add a real disclosure element to the relocation block, sourced from National Weather Service AQI data.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/VOICE.md`
- `data/resort-communities.json`
- `marketing_brain_skills/producers/site-community-page/SKILL.md` (Tier 2 child producer)
