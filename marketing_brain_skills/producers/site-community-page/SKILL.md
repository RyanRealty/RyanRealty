---
name: site-community-page
description: >
  Scaffolds or updates the canonical per-resort-community landing page at
  /lp/<community>/ on ryan-realty.com. This is the Tier 2 page in the four-tier
  search-authority stack (city -> community -> subdivision -> listing) and is
  the right producer for master-planned resort communities like Tetherow,
  Pronghorn / Juniper Preserve, Broken Top, Sunriver, Caldera Springs,
  Crosswater, Brasada Ranch, Black Butte Ranch, Eagle Crest, Aspen Lakes,
  Vandevert Ranch, NW Crossing-as-master-planned, Tree Farm, and River's Edge.
  Use this skill when Matt says "build me the Pronghorn page", "create the
  Sunriver community landing page", "we need a Broken Top resort LP", "set up
  the Caldera Springs page", or any time a resort or master-planned community
  needs its own search-authority landing page. Use this skill (NOT
  site-neighborhood-page) any time the community has its own HOA, master plan,
  golf course or ranked amenity, multiple sub-neighborhoods, or a recognizable
  resort brand. The skill outputs a Next.js dynamic route at
  app/lp/[community]/page.tsx with ISR revalidation so every market stat,
  active listing, and recent close auto-refreshes on a 6-hour cycle. Static
  brand content (architect, HOA table, builder roster, signature hole)
  is hardcoded in the route module. Opens a GitHub PR for Matt to merge.
action_types:
  - site:community_page_create
  - site:community_page_update
output_type: web-page
target_platforms: []
asset_destination: app/lp/[community]/page.tsx
auto_inputs: ['market_stats_cache', 'listings', 'boundaries', 'data/resort-communities.json']
required_inputs: ['community_slug']
optional_inputs: ['sections_to_update (for updates)', 'hero_image_override']
estimated_runtime_min: 35
cost_usd_estimate: $0-$2
thumbnail_uri: public/lp/tetherow/img/tetherow-aerial-course.jpg
example_outputs:
  - label: Tetherow exemplar (static HTML, ported by this skill to Next.js)
    surface: website
    path: public/lp/tetherow/index.html
---

# site-community-page

**Scope.** Creates or updates a per-resort-community SEO + AEO landing page at
`/lp/<community>/`. Each page is a Next.js dynamic route with Incremental Static
Regeneration (ISR) so market data stays fresh without manual edits or full
rebuilds. The page is the resort's authoritative search-result page: Google,
Bing, ChatGPT, Perplexity, and Claude should cite this page when a user asks
"what is Tetherow?" or "homes for sale in Pronghorn." Every figure on the page
traces to a live Supabase query verified at request time.

This producer ports the just-shipped static Tetherow LP at
`public/lp/tetherow/index.html` (the visual + content template, 2,495 lines)
into a dynamic Next.js route. The Tetherow port is the first exemplar; the
remaining 13 resort communities run through this same skill.

Does NOT handle: in-city neighborhood pages (that is `site-neighborhood-page`),
subdivision pages inside a master plan like Heath inside Tetherow (that is
`site-subdivision-page`), per-listing detail pages (that is `site-listing-page`),
or city-level pages like /lp/bend/ (that is `site-city-page`). Does NOT edit
the global homepage, header, footer, or `/sell` and `/buy` (those are
`site-edit`).

**Status:** Canonical
**Locked:** 2026-05-18
**Exemplar output:** GitHub PR at `site-community/<action_id_prefix>` branch.
The first executed exemplar is the Tetherow port to
`app/lp/tetherow/page.tsx`.

---

## 1. Scope

### In scope

- `site:community_page_create`: net-new dynamic route at `app/lp/<slug>/page.tsx`
- `site:community_page_update`: targeted section refresh on an existing route
- Route registration in `app/sitemap.ts` with `priority: 0.8`, `changeFrequency: 'daily'`
- JSON-LD `Place` + `RealEstateAgent` schemas server-rendered into `<script type="application/ld+json">`
- ISR configuration: `export const revalidate = 21600` (6 hours) at the route level, with shorter `cache: 'no-store'` directives on the truly live data fetches (active inventory, pending count)
- Live Supabase fetches in the server component for every figure: market_stats_cache rolling-365d row, active listings, recent closings
- Static content authored as TypeScript constants in the route module: architect bio, HOA table, builder roster, signature hole spec, course rankings, recognition, lifestyle / amenities, membership tiers, build timeline
- Static config sourced from `data/resort-communities.json` (slug, sub-neighborhoods, hero asset path, drive-time anchors, etc.)
- Map asset generation: Google Static Maps URL computed from `boundaries.polygon` centroid at the right zoom for the community size, written to `public/lp/<slug>/img/<slug>-location-map.png` at build time
- Sub-neighborhood horizontal-scroll carousel with snap-points, prev/next arrows, scroll-progress bar, "1 OF N" position hint, keyboard navigation, edge fade indicator
- Per-listing "Schedule a showing" button on every active inventory card, anchoring to the buyer track section with property pre-fill
- Buyer track section with three forms: Schedule a Showing, Custom Alerts (delegates to `listing-alerts` producer for delivery), Buyer's Guide (delegates to `buyers-guide` producer for the actual asset)
- Seller CMA form (existing `/api/cma` endpoint, FUB-tagged)
- Sticky scroll CTA bar that appears after hero scroll-past
- Exit-intent modal (mouseleave at top OR mobile tab-hidden after 60% scroll, fires once per session)
- Dynamic dates: `data-dyn-month-year` spans server-rendered with the current month/year at request time, no client-side flash
- Analytics: GA4 `G-ST40W4WM6T`, Meta Pixel `1546878946032105`, FUB pixel (when ID is provisioned by the analytics-unification work)
- Topbar with horizontal white Ryan Realty logo (`/brand/logo-header-white.png`)
- Brand voice validation on all generated copy before file write
- TypeScript compile verification before PR opens

### Out of scope

- Authoring the resort-community static facts. Those live in
  `data/resort-communities.json` and are edited by hand or by a separate
  research producer. This skill READS that JSON; it does not WRITE it.
- Building the listing-alerts backend or sending email digests. The Custom
  Alerts form submits to the `listing-alerts` producer's queue. This skill
  only renders the form.
- Building the Tetherow / Pronghorn / etc. buyer's guide PDF. That is the
  `buyers-guide` producer. This skill only renders the form that requests it.
- Sub-neighborhood inner pages (use `site-subdivision-page`).
- Per-listing inner pages (use `site-listing-page`).
- City-level pages above the community tier (use `site-city-page`).
- Mass content rewrites or off-brand experiments.

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `site:community_page_create` | `community_slug`, `community_name`, `hero_headline`, `meta_description` | Route must not already exist. Slug must match a row in `data/resort-communities.json`. |
| `site:community_page_update` | `community_slug`, `sections_to_update[]`, `reason` | Route must exist at `app/lp/<slug>/page.tsx`. |

### Payload schema

```typescript
interface SiteCommunityPagePayload {
  community_slug: string;            // 'tetherow' | 'pronghorn' | 'broken-top' | 'sunriver' | 'caldera-springs' | etc.
                                     // Must match a row in data/resort-communities.json AND a boundaries.geo_slug.
  community_name: string;            // Display name, e.g. 'Tetherow', 'Pronghorn / Juniper Preserve'.
  hero_headline: string;             // Playfair Display H1. Sentence case. No clichés. Includes a dynamic-date span.
                                     // e.g. 'The Tetherow market, [data-dyn-month-year].'
  meta_description: string;          // 150-160 chars. Must include community name + 'Bend, OR' + a verified figure.
  hero_image_override?: string;      // Optional asset path if not the default in resort-communities.json.
  sections_to_update?: Array<        // For update action only.
    | 'kpi_grid'
    | 'active_inventory'
    | 'notable_transactions'
    | 'comparison_row'
    | 'hoa_table'
    | 'membership'
    | 'lifestyle'
    | 'builders'
    | 'sub_neighborhoods'
    | 'happenings'
    | 'pipeline'
    | 'methodology'
    | 'meta'
    | 'jsonld'
  >;
  reason?: string;                   // For updates only: why this section needs refresh.
}
```

---

## 3. Full action row schema

```typescript
interface SiteCommunityPageActionRow {
  id: string;
  action_type: 'site:community_page_create' | 'site:community_page_update';
  target: string;                    // e.g. 'community:tetherow'
  assigned_producer: 'marketing_brain_skills/producers/site-community-page';
  payload: SiteCommunityPagePayload;
  data_evidence: {
    audit_source?: string;           // e.g. 'audit-website'
    opportunity_area?: string;       // e.g. 'GSC: 1,240 monthly impressions for "pronghorn bend or homes"'
    signal_evidence?: string;
  };
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

**Step 1 — Read the action row and claim it.**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>' AND status = 'pending';
```

If the UPDATE affected zero rows, halt silently (another producer beat us to it).

**Step 2 — Load mandatory references.**

In order:

1. `CLAUDE.md` §0 — Data Accuracy mandate (every figure traces to live Supabase)
2. `CLAUDE.md` §0.5 — Draft-First, Commit-Last (open PR, never push to main directly)
3. `CLAUDE.md` "Design System Rules: MANDATORY" — shadcn/ui only
4. `CLAUDE.md` "Design System v2: Heritage + Web Registers" — Web register
5. `design_system/ryan-realty/SKILL.md` — color tokens, type families, shadow ladder, radii
6. `design_system/ryan-realty/colors_and_type.css` — CSS variable definitions
7. `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice enforcement (the hard fail list)
8. `marketing_brain_skills/research/asset-library-map.md` — hero asset paths
9. `data/resort-communities.json` — find the row for `payload.community_slug`
10. `public/lp/tetherow/index.html` — visual + content reference (2,495 lines, the gold-standard exemplar)
11. `app/sitemap.ts` — sitemap structure to extend
12. `app/lp/tetherow/page.tsx` IF IT EXISTS (the Tetherow port is the architectural exemplar after this skill executes once)

**Step 3 — Route check.**

For `create`: confirm `app/lp/<slug>/page.tsx` does NOT exist. If it does,
`status='killed'` with response:

```
Route already exists at app/lp/<slug>/page.tsx.
Use site:community_page_update to refresh sections.
```

For `update`: confirm the file DOES exist. If missing, `status='killed'` and
suggest `site:community_page_create`.

**Step 4 — Resolve community config.**

Read the matching row in `data/resort-communities.json`. Required fields:

```typescript
interface ResortCommunityConfig {
  slug: string;                      // matches payload.community_slug
  name: string;                      // display name
  geo_slug: string;                  // matches a row in `boundaries` table for the centroid
  acres: number;                     // master plan size
  founded: number;                   // year of master plan inception
  architect?: string;                // 'David McLay Kidd', 'Tom Doak', etc., or null if no signature golf course
  sub_neighborhoods: Array<{
    slug: string;                    // 'heath' | 'tartan-druim' | etc.
    name: string;                    // 'Heath' | 'Tartan Druim'
    type: string;                    // 'Single-family golf homes' | 'Townhomes' | 'Gated custom'
    hoa_annual_estimate: number;     // a single number, even if a range exists
    description: string;             // 1-sentence character note
    image_hint?: string;             // photo lookup hint, e.g. an MLS thumbnail or asset library entry
  }>;
  amenities: Array<{
    category: string;                // 'Dining', 'Wellness', 'Fitness', 'Racquet', 'Winter', 'Trails'
    name: string;
    description: string;
    access: string;                  // 'Open to public' | 'Members + Lodge guests' | etc.
  }>;
  membership_tiers: Array<{
    label: string;                   // 'Golf', 'Sport', 'Social'
    eyebrow: string;                 // 'Full club', 'Limited access', 'Social'
    description: string;
    waitlist_status: string;         // 'Typically waitlisted' | 'Generally open'
  }>;
  builders: Array<{
    name: string;
    role: string;                    // 'Bend custom luxury'
    description: string;
    website?: string;
  }>;
  signature_hole?: {
    number: number;
    par: number;
    yardage: number;
    elevation_drop_ft?: number;
    description: string;
  };
  course_specs?: {
    par: number;
    yardage: number;
    rating: number;
    slope: number;
  };
  course_rankings?: Array<{
    rank: string;                    // '#57', '#1', etc.
    publication: string;
    description: string;
  }>;
  drive_times: Array<{
    minutes: number;
    destination: string;             // 'Old Mill District'
    note: string;
  }>;
  hero_image: string;                // '/lp/<slug>/img/<slug>-aerial-course.jpg'
  brand_lockup_hex_primary: string;  // '#102742' for Ryan Realty navy
  build_timeline: Array<{
    year: number;
    label: string;
  }>;
  happenings: Array<{
    date: string;                    // '2025 · CONDE NAST 8TH CONSECUTIVE YEAR'
    headline: string;
    body: string;
    sources: Array<{label: string; url: string}>;
  }>;
}
```

If the slug is not in `resort-communities.json`, surface to Matt with:

```
Community '<slug>' not registered in data/resort-communities.json.
Add the row first, then re-run this action.
```

Don't fabricate community facts.

**Step 5 — Pull live market data.**

Always re-pull. Never use values cached in the action row payload. Per
CLAUDE.md §0, every figure on the page traces to a live query in this session.

Six queries, in this order:

a. **Rolling-365d market stats:**
```sql
SELECT
  sold_count, median_sale_price, median_dom, avg_sale_to_list_ratio,
  median_ppsf, end_of_period_inventory, methodology_version,
  period_start, period_end, computed_at
FROM market_stats_cache
WHERE geo_slug = '<community_geo_slug>'
  AND period_type = 'rolling_365d'
ORDER BY period_end DESC
LIMIT 1;
```

b. **Active inventory (live count + grid):**
```sql
SELECT
  "ListingId", "ListPrice", "StreetNumber", "StreetName",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
  "CumulativeDaysOnMarket", "StandardStatus", "PhotoURL",
  "SubdivisionName"
FROM listings
WHERE "StandardStatus" IN ('Active', 'ActiveUnderContract', 'Pending')
  AND "PropertyType" = 'A'
  AND "SubdivisionName" = ANY('<resort_communities.json mls_aliases>'::text[])
ORDER BY "ListPrice" DESC
LIMIT 12;
```

c. **Notable transactions (last 90 days):**
```sql
SELECT
  "CloseDate", "ClosePrice", "ListPrice", "OriginalListPrice",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
  "SubdivisionName",
  ROUND(("ClosePrice" / NULLIF("TotalLivingAreaSqFt", 0))::numeric, 0) AS price_per_sqft,
  ROUND((("ClosePrice" / NULLIF("ListPrice", 0)) * 100)::numeric, 1) AS sale_to_list_pct
FROM listings
WHERE "StandardStatus" IN ('Closed', 'Sold')
  AND "PropertyType" = 'A'
  AND "SubdivisionName" = ANY('<aliases>'::text[])
  AND "CloseDate" >= NOW() - INTERVAL '90 days'
ORDER BY "CloseDate" DESC
LIMIT 8;
```

d. **Comparison row vs peer communities (configurable per resort):**
```sql
SELECT
  geo_slug, geo_label,
  sold_count, median_sale_price, median_dom,
  avg_sale_to_list_ratio, median_ppsf, end_of_period_inventory
FROM market_stats_cache
WHERE geo_slug = ANY('<peer_slugs>'::text[])
  AND period_type = 'rolling_365d'
ORDER BY median_sale_price DESC NULLS LAST;
```

Peer slugs are listed in `data/resort-communities.json` under each community's
`comparison_peers` array (typically 3-4 peer resorts at similar price tier).

e. **Boundary centroid for the map:**
```sql
SELECT
  ST_X(ST_Centroid(polygon))::numeric(10,6) AS centroid_lng,
  ST_Y(ST_Centroid(polygon))::numeric(10,6) AS centroid_lat,
  ROUND((ST_Area(polygon::geography) / 4046.86)::numeric, 1) AS acres,
  source, source_url
FROM boundaries
WHERE geo_slug = '<community_geo_slug>'
ORDER BY ST_Area(polygon) ASC
LIMIT 1;
```

Use the smallest authoritative polygon if multiple match (for Tetherow this is
"Tetherow Phase 1" at 599.7 acres, not the 5,717-acre name-match convex hull).
The City-of-Bend GIS or Deschutes County GIS sub-plat is preferred over the
Spark MLS alias-derived polygon.

f. **Reconciliation gate.** If any figure pulled here differs from
`resort-communities.json` by more than 5%, halt and surface to Matt with the
delta. Don't auto-update the JSON.

**Step 6 — Generate map asset.**

```bash
MAP_URL="https://maps.googleapis.com/maps/api/staticmap?\
center=<lat>,<lng>&zoom=13&size=720x520&scale=2&maptype=roadmap\
&style=feature:poi|element:labels|visibility:off\
&style=feature:landscape|element:geometry|color:0xf2ebdd\
&style=feature:water|element:geometry|color:0xb8d4dc\
&style=feature:road|element:geometry|color:0xfaf8f4\
&markers=color:0x102742%7Csize:mid%7Clabel:T%7C<lat>,<lng>\
&key=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
curl -s -o public/lp/<slug>/img/<slug>-location-map.png "$MAP_URL"
```

Zoom heuristic by community size:
- < 200 acres: zoom 14
- 200 to 1,000 acres: zoom 13
- > 1,000 acres: zoom 12

If the master plan straddles a wide range (e.g. Sunriver at 3,300 acres),
pull the bounding box from `boundaries` and compute the right zoom from the
size of the box, not the centroid.

**Step 7 — Voice-validate all generated copy.**

Before writing the route file, run `payload.hero_headline`,
`payload.meta_description`, and every paragraph that this skill generates
(not the content read verbatim from `resort-communities.json`, which is
assumed pre-validated) through the voice guardrail:

Banned words: stunning, nestled, boasts, charming, pristine, gorgeous,
breathtaking, must-see, dream home, meticulously maintained, tucked away,
hidden gem, truly, spacious, cozy, luxurious, updated throughout, turnkey,
immaculate, captivating, exquisite, delve, leverage, tapestry, navigate,
robust, seamless, comprehensive, elevate, unlock, holistic, dynamic, vibrant,
bustling, eclectic, curated, bespoke, foster, premier, approximately,
polygon (jargon — homeowners do not care), don't miss, act now, won't last.

Banned punctuation in body copy: em-dash, en-dash (except numeric ranges
where it's swapped to "to"), semicolon, exclamation mark, dramatic colon.

If a violation persists after 2 auto-fix iterations, kill the action with the
specific banned token and rule cited.

**Step 8 — Scaffold the route file.**

For `create`, write `app/lp/<slug>/page.tsx`. Page structure mirrors the
Tetherow exemplar (`public/lp/tetherow/index.html`) but as TSX with server
components.

ISR config at the top:

```typescript
export const revalidate = 21600  // 6 hours
```

Critical sections of the page:

1. **<head> metadata** via Next.js Metadata API: title, meta description,
   canonical, og:image (hero), JSON-LD Place + RealEstateAgent.
2. **Analytics layer** in `app/layout.tsx` (already present): GA4 `G-ST40W4WM6T`,
   Meta Pixel `1546878946032105`, FUB pixel (when ID lands).
3. **Topbar** with the white horizontal logo (`/brand/logo-header-white.png`,
   400x80) + license text + "What's my home worth?" pill.
4. **Sticky scroll CTA** that reveals on scroll-past-hero.
5. **Hero** with course aerial bg image, eyebrow, dynamic-month-year H1,
   subhead, four-stat bar.
6. **About Community overview** (rich SEO + AEO content + sticky facts panel
   + anchor TOC).
7. **Architect / signature angle** (from `architect` + `course_rankings` in
   config).
8. **Location** with the Google Static Map + drive-time anchors.
9. **Live market pulse** KPI grid (8 cards, all from `market_stats_cache`).
10. **HOA table** by sub-neighborhood (from `sub_neighborhoods` in config) +
    HOA meta cards + board roster (board roster lives in a separate JSON if
    available, otherwise omitted with a "Not publicly disclosed" note).
11. **Mid-page CTA** linking to #cma.
12. **The course** + rankings + build timeline + signature hole (from config).
13. **Lifestyle / Amenities** grid (from `amenities` in config).
14. **Membership tiers** (from `membership_tiers` in config) with the
    "Confirmed at office" placeholders for figures the resort doesn't
    publish publicly.
15. **What's happening** (from `happenings` in config, most recent first).
16. **Active inventory** grid (live from `listings` query, 12 cards max).
    Each card gets a `<button>` "Schedule a showing" with
    `data-property` set from the live query result.
17. **Buyer track** section (three cards: showing, alerts, guide).
    "Schedule a showing" form's property dropdown is populated server-side
    from the same active inventory query so it matches the cards above.
18. **Notable transactions strip** (live from `listings` query, 6-8 rows).
19. **Sub-neighborhoods** horizontal-scroll carousel (from
    `sub_neighborhoods` in config). Each card href links to
    `/lp/<community>/<sub_slug>/` (subdivision pages produced by
    `site-subdivision-page` — those are likely placeholders at create time).
20. **Builder roster** (from `builders` in config).
21. **Pipeline** (from a `pipeline` array in config if present, else omitted).
22. **Comparison row** (live from the comparison query).
23. **Our work / If you list** broker block + headshot.
24. **CMA seller form** (existing /api/cma endpoint, FUB tags from config).
25. **Methodology** footer with one bullet per data source.
26. **Footer** with brand block + reach + resort + community pages list +
    legal.
27. **JSON-LD** Place + RealEstateAgent server-rendered.
28. **Exit-intent modal** (component import).
29. **Inline scripts** for the scroller, multi-step CMA form, exit-intent,
    sticky CTA, listing-showing click handlers, dynamic-date injection
    fallback (server-render handles primary).

Design system rules (Web register):

- `bg-background` for page background (cream `#faf8f4`)
- `bg-primary text-primary-foreground` for CTAs (navy `#102742`)
- All containers use `<Card>` from `@/components/ui/card` — no raw divs
- `font-display` class (Playfair Display) for hero H1, section H2s — sentence case body, Title Case only the hero
- Geist for everything else
- Radii: `rounded-xl` (14px) for cards, `rounded-lg` (10px) for buttons
- No gold. No off-brand hex. No custom CSS classes outside shadcn/ui token system.
- Shadows: `shadow-sm` resting, `shadow-md` hover.

Hero asset: from `resort-communities.json` row's `hero_image` field, mirrored
under `public/lp/<slug>/img/`.

For `update`: read the existing route file, identify which sections live in
`payload.sections_to_update`, replace only those sections, preserve all others
verbatim. Re-run live queries only for the sections being updated.

**Step 9 — Update sitemap.**

For creates only:

```typescript
{
  url: `${siteUrl}/lp/<slug>/`,
  lastModified: new Date(),
  changeFrequency: 'daily',
  priority: 0.8,
}
```

**Step 10 — TypeScript compile check.**

```bash
cd /Users/matthewryan/RyanRealty && npx tsc --noEmit 2>&1
```

Zero errors required. If errors, fix within 2 iterations. If unfixable, kill
with the tsc output in the response.

**Step 11 — Branch, commit, push, open PR.**

Branch: `site-community/<slug>-<first-8-of-action-id>`

```bash
git checkout -b site-community/<slug>-<prefix>
git add app/lp/<slug>/page.tsx app/sitemap.ts public/lp/<slug>/
git commit -m "site-community-page(<slug>): <create|update> resort community LP

Action row: <id>
Community: <community_name>
Route: /lp/<slug>/
Rationale: <generation_reason>

ISR: revalidate every 6 hours.
Live data sources: market_stats_cache, listings (active + recent
closings), boundaries (centroid for map), peer communities for
comparison row.
Static config sourced from data/resort-communities.json.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin site-community/<slug>-<prefix>
gh pr create --title "site-community-page(<slug>): <create|update> /lp/<slug>/" \
  --body "<PR body — see Output format section>"
```

**Step 12 — Write citations.json.**

```json
{
  "produced_at": "<iso>",
  "community_slug": "<slug>",
  "route": "/lp/<slug>/",
  "data_sources": [
    {
      "section": "kpi_grid",
      "source": "market_stats_cache",
      "filter": "geo_slug='<slug>' AND period_type='rolling_365d'",
      "fetched_at": "<iso>",
      "methodology_version": "<from cache row>"
    },
    {
      "section": "active_inventory",
      "source": "listings",
      "filter": "StandardStatus IN ('Active','Pending','ActiveUnderContract') AND SubdivisionName = ANY(<aliases>)",
      "fetched_at": "<iso>",
      "row_count": "<n>"
    },
    {
      "section": "notable_transactions",
      "source": "listings",
      "filter": "CloseDate >= NOW() - INTERVAL '90 days'",
      "fetched_at": "<iso>",
      "row_count": "<n>"
    },
    {
      "section": "comparison_row",
      "source": "market_stats_cache",
      "filter": "geo_slug = ANY(<peers>) AND period_type='rolling_365d'",
      "fetched_at": "<iso>"
    },
    {
      "section": "map",
      "source": "boundaries",
      "filter": "geo_slug='<slug>' ORDER BY ST_Area ASC LIMIT 1",
      "centroid_lat": "<lat>",
      "centroid_lng": "<lng>",
      "polygon_source": "<source>",
      "polygon_source_url": "<url>"
    },
    {
      "section": "static_content",
      "source": "data/resort-communities.json",
      "row": "<slug>",
      "last_modified": "<mtime>"
    }
  ]
}
```

Store at `out/site-community/<slug>/citations.json`.

**Step 13 — Update action row to `ready`.**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{
      "branch_name": "site-community/<slug>-<prefix>",
      "pr_url": "<pr_url>",
      "files_changed": [
        "app/lp/<slug>/page.tsx",
        "app/sitemap.ts",
        "public/lp/<slug>/img/<slug>-location-map.png"
      ],
      "page_route": "/lp/<slug>/",
      "isr_revalidate_seconds": 21600,
      "voice_validated": true,
      "tsc_clean": true,
      "jsonld_schemas": ["Place", "RealEstateAgent"],
      "citations_path": "out/site-community/<slug>/citations.json"
    }'::jsonb
WHERE id = '<id>';
```

**Step 14 — Surface draft to Matt.**

Use the format in §6.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | market_stats_cache + listings + boundaries queries; action row updates | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Read | bend-market-bible, resort-communities.json, brand voice, existing page | repo paths |
| Write / Edit | `app/lp/<slug>/page.tsx`, `app/sitemap.ts`, `public/lp/<slug>/img/*` | repo working tree |
| Bash: `curl` | Google Static Maps fetch | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Bash: `npx tsc --noEmit` | TypeScript compile check | `/Users/matthewryan/RyanRealty` |
| Bash: `git`, `gh` | branch, commit, push, PR open | active gh session |

---

## 6. Output format

**Draft lands at:** GitHub PR (Web register page on branch)

```
app/lp/<slug>/page.tsx                            (new or updated)
app/sitemap.ts                                    (updated for creates)
public/lp/<slug>/img/<slug>-location-map.png      (new for creates)
public/lp/<slug>/img/<slug>-aerial-hero.jpg       (if not yet in repo)
out/site-community/<slug>/citations.json          (always)
```

**PR body template:**

```markdown
## site-community-page(<slug>): <create|update>

**Action row:** `<id>`
**Community:** <community_name>
**Route:** `/lp/<slug>/`
**Branch:** `site-community/<slug>-<prefix>`

### Files

- `app/lp/<slug>/page.tsx` — <new | updated sections: X, Y, Z>
- `app/sitemap.ts` — <added entry | unchanged>
- `public/lp/<slug>/img/<slug>-location-map.png` — <new | refreshed>

### Live data sources (ISR revalidate = 6h)

| Section | Source | Filter | Rows |
|---|---|---|---|
| KPI grid | market_stats_cache | geo_slug='<slug>' AND period_type='rolling_365d' | 1 |
| Active inventory | listings | StandardStatus IN ('Active','Pending') AND SubdivisionName = ANY(<aliases>) | <n> |
| Notable transactions | listings | CloseDate >= 90d AND SubdivisionName = ANY(<aliases>) | <n> |
| Comparison row | market_stats_cache | geo_slug = ANY(<peers>) | <n> |
| Map centroid | boundaries | geo_slug='<slug>' | 1 |

### Static config

`data/resort-communities.json` row `<slug>`, mtime <date>.
<N> sub-neighborhoods, <N> amenities, <N> builders, <N> happenings.

### Validation

- [x] Voice: PASS (no banned words or punctuation in generated copy)
- [x] TypeScript: PASS (zero errors)
- [x] Design tokens: PASS (shadcn/ui only, no custom CSS classes)
- [x] JSON-LD: Place + RealEstateAgent schemas included
- [x] Analytics: GA4 + Meta Pixel + FUB pixel placeholder
- [x] Data accuracy: every figure traces to a live Supabase query (citations.json)

### Approval gate

Matt merges this PR in GitHub to make the page live. Vercel deploys
automatically after merge.
```

**Surface format (chat reply to Matt):**

```
Draft ready: site-community-page: /lp/<slug>/

  PR
    URL: <pr_url>
    Branch: site-community/<slug>-<prefix>

  PAGE
    Route: /lp/<slug>/
    Community: <community_name>
    H1: <hero_headline> (with dynamic month-year)
    KPI section sourced from market_stats_cache (refreshes every 6h via ISR)
    Active inventory at render: <n> homes
    Recent closings (90d): <n>
    Sub-neighborhoods: <n>
    Comparison peers: <peer list>

  VERIFICATION TRACE
    Live queries:
      • market_stats_cache geo_slug='<slug>' period='rolling_365d' -> 1 row
      • listings Active/Pending where SubdivisionName ANY <aliases> -> <n>
      • listings Closed last 90d -> <n>
      • market_stats_cache peers (<peers>) -> <n>
      • boundaries geo_slug='<slug>' centroid -> (<lat>, <lng>)

  VALIDATION
    Voice: PASS
    TypeScript: PASS
    Design tokens: PASS (shadcn/ui only)
    JSON-LD: Place + RealEstateAgent
    citations.json: out/site-community/<slug>/citations.json

Matt merges the PR in GitHub to ship.
```

Then stop. Do not push to main. Wait for Matt to merge.

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-PR` | Matt merges the GitHub PR | Matt only, via GitHub UI |

This producer uses: **`matt-review-PR`**.

A draft is never considered approved by a passing TypeScript build, a passing
voice check, or a complete render. Those are necessary, not sufficient. Only
Matt clicking Merge on the PR transitions the action row from `ready` to
`approved`.

---

## 8. Status flow

```
pending           <- producer reads row here
  |
  v
in_production     <- set immediately on pickup; executed_at=now()
  |
  +-- Route conflict (create) -> killed
  +-- Route missing (update) -> killed
  +-- Slug not in resort-communities.json -> killed (surface to Matt)
  +-- Data reconciliation delta > 5% -> killed (surface to Matt)
  +-- Voice fail after 2 iterations -> killed
  +-- TypeScript fail after 2 iterations -> killed
  +-- Boundaries query returns 0 rows -> killed (community has no registered polygon)
  |
  v (PR open)
ready             <- executor_response populated with branch_name, pr_url, etc.
  |
  v (Matt merges PR)
approved
  |
  v (Vercel deploy completes)
executed
  |
  v (48h: audit-website captures first impressions and clicks)
measured
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Route already exists (create) | `app/lp/<slug>/page.tsx` found on disk | Kill; suggest `site:community_page_update` |
| Route missing (update) | File not found | Kill; suggest `site:community_page_create` |
| Slug not in resort-communities.json | No matching row | Kill; surface to Matt with instruction to add the row first |
| Boundaries query returns 0 rows | Community has no registered polygon | Kill; surface to Matt with the data accuracy rule (GIS authoritative only — no fabricated coordinates) |
| Data reconciliation delta > 5% | Figure in resort-communities.json differs from live cache by more than 5% | Kill; surface specific figure, cache value, JSON value, delta % |
| Insufficient closed sales for comparison row | Peer community has < 3 closings in window | Render row with peer's column showing "—" and footnote |
| Voice fail after 2 iterations | Banned word persists | Kill; surface specific violation and rule |
| TypeScript error after 2 iterations | Persistent type error | Kill; surface tsc output |
| Google Static Maps quota exceeded | curl returns 403 / 429 | Kill; surface to Matt with the key billing dashboard URL |
| ListingPhotoURL has dead/dangling URL | One or more active listing cards have missing images | Render card with a gray placeholder; note in PR; do not kill |
| Comparison peers list empty for a community | No peers configured in resort-communities.json | Omit the comparison row entirely; note in PR |
| Sub-neighborhood subdivision pages don't exist yet | Cards point to /lp/<community>/<sub>/ that 404 | Render with hover text "(coming soon)" on the card label; do not kill |

---

## 10. Related skills and references

**Required reading before executing:**

- `CLAUDE.md` §0 — Data Accuracy
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `CLAUDE.md` "Design System Rules: MANDATORY" — shadcn/ui only
- `CLAUDE.md` "Design System v2: Heritage + Web Registers"
- `design_system/ryan-realty/SKILL.md` — color tokens, type families, radii, shadows
- `design_system/ryan-realty/colors_and_type.css` — CSS variable definitions
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice enforcement
- `automation_skills/content_engine/SKILL.md` — content routing bus
- `social_media_skills/platform-best-practices/SKILL.md` — 2026 platform rule layer for the on-page CTAs
- `marketing_brain_skills/research/asset-library-map.md` — hero asset paths
- `marketing_brain_skills/research/bend-market-bible.md` — community fact references where the data is sparse in resort-communities.json
- `data/resort-communities.json` — the canonical community config
- `public/lp/tetherow/index.html` — the visual + content exemplar (gold standard)
- `app/sitemap.ts` — sitemap structure to extend
- `app/actions/lead-capture.ts` — FUB lead routing (CMA + buyer forms)
- `marketing_brain_skills/research/platform-bible.md` §24 — fair housing + real estate compliance

**Sibling producers in the same tier system:**

- `marketing_brain_skills/producers/site-neighborhood-page/SKILL.md` — Tier 2 producer for in-city neighborhoods that are NOT master-planned resorts (NW Crossing, Old Bend, etc.). Use that instead of this skill for those.
- `marketing_brain_skills/producers/site-subdivision-page/SKILL.md` — Tier 3 (lives one level deeper inside a community page; the Heath exemplar inside Tetherow). Not yet authored — pending.
- `marketing_brain_skills/producers/site-listing-page/SKILL.md` — Tier 4 (per-property). Not yet authored — pending.
- `marketing_brain_skills/producers/site-city-page/SKILL.md` — Tier 1 (/lp/bend/). Not yet authored — pending.

**Producers this skill delegates the work of:**

- `marketing_brain_skills/producers/listing-alerts/SKILL.md` — receives the Custom Alerts form submissions (saved-search backend). Not yet authored — pending.
- `marketing_brain_skills/producers/buyers-guide/SKILL.md` — receives the Buyer's Guide form submissions (PDF + content). Not yet authored — pending.
- `marketing_brain_skills/producers/cma/SKILL.md` — receives the seller CMA form submissions (existing /api/cma endpoint).

**Registry entry:**

- `marketing_brain_skills/producers/REGISTRY.md` — Section D (site-* producers), row `site-community-page`. Action types: `site:community_page_create`, `site:community_page_update`. Approval: `matt-review-PR`. Estimated runtime: 30-45 min.

---

## 11. Tool gap suggestions

What would make this skill 10x better:

1. **Auto-discover peer communities.** Today `comparison_peers` is a hand-curated list in `resort-communities.json`. A query against `market_stats_cache` clustering by median price + acres + amenity profile could surface peers automatically. This would also keep the comparison row consistent across all 14 resorts.

2. **Resort-communities.json schema validation.** Author a JSON schema and a precommit hook so a malformed config row is caught before it reaches this skill. Today a missing field in the config will surface as a TypeScript error mid-build — the schema check should run first.

3. **Hero-asset auto-source.** Today the hero image is hand-placed at `public/lp/<slug>/img/<slug>-aerial-hero.jpg`. A small assist that pulls the canonical aerial from the resort's own marketing page (with editorial attribution) and writes it into place would unblock 13 resort builds without manual Asset Library curation.

4. **Sub-neighborhood drill-down propagation.** When the `site-subdivision-page` producer creates a real page at `/lp/<community>/<sub>/`, this skill should be triggered with `sections_to_update: ['sub_neighborhoods']` to remove the "(coming soon)" hover text from the matching card. A small audit job that runs after every subdivision page merge could handle this without manual triggering.

5. **Comparison row data freshness ping.** The comparison row pulls peer data once per ISR cycle. If a peer community's data is more than 14 days stale (i.e., the brain hasn't refreshed `market_stats_cache` for that peer), surface that in the page footnote with a "Peer stats as of <date>" timestamp so the reader knows which comparison reflects current data.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `data/resort-communities.json`
- `public/lp/tetherow/index.html` (visual exemplar)
