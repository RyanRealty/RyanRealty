---
name: site-subdivision-page
description: >
  Scaffolds or updates the per-subdivision landing page at
  /lp/<community>/<subdivision>/ on ryan-realty.com. This is the Tier 3 page
  in the four-tier search-authority stack (city → community → subdivision →
  listing). The right producer for sub-neighborhoods inside a master-planned
  resort or community: Heath inside Tetherow, Tartan Druim inside Tetherow,
  Triple Knot inside Tetherow, Estancia inside Pronghorn, Crosswater inside
  Sunriver, etc. Use this skill when Matt says "build the Heath page",
  "create the Tartan Druim landing page", "build the subdivision pages
  inside Tetherow", or any time a named sub-plat inside a registered
  resort community needs its own search-authority landing page. Use this
  skill (NOT site-community-page or site-neighborhood-page) any time the
  subject is a sub-plat with its own architectural guidelines, dues
  schedule, builder roster, and recorded-plat boundary inside a parent
  community. The skill outputs a Next.js dynamic route nested under the
  parent community at app/lp/[community]/[subdivision]/page.tsx with ISR
  revalidation. The parent community page's sub-neighborhood carousel
  link to these pages once they exist. Opens a GitHub PR.
action_types:
  - site:subdivision_page_create
  - site:subdivision_page_update
output_type: web-page
target_platforms: []
asset_destination: app/lp/[community]/[subdivision]/page.tsx
auto_inputs: ['market_stats_cache', 'listings', 'boundaries', 'data/resort-communities.json']
required_inputs: ['community_slug', 'subdivision_slug']
optional_inputs: ['hero_image_override', 'sections_to_update']
estimated_runtime_min: 30
cost_usd_estimate: $0-$1
thumbnail_uri: null
example_outputs:
  - label: Heath inside Tetherow (first exemplar)
    surface: website
    path: app/lp/tetherow/heath/page.tsx
---

# site-subdivision-page

**Scope.** Creates or updates a per-subdivision SEO + AEO landing page at
`/lp/<community>/<subdivision>/`. This is the third tier in the search-
authority stack and lives nested inside a parent community route. The
page is shorter and tighter than a community page (typically 800-1,200
lines vs the community's 2,500) because most of the brand context is
inherited from the parent. The subdivision page focuses on: what makes
THIS sub-plat different from the others in the parent community, its
specific dues bracket, its architectural guidelines, the builders who
have completed homes there, its active inventory, and its recent close
history.

Every subdivision page server-renders live data from Supabase at request
time with 6-hour ISR. Static content (architect guidelines, character
description, lot-size norms, builder roster filtered to this sub) is
hardcoded from `data/resort-communities.json` rows under
`sub_neighborhoods[]`.

The first executed exemplar is the Heath subdivision page inside
Tetherow at `app/lp/tetherow/heath/page.tsx`. The parent
community's sub-neighborhood carousel updates to point to the real page
once it exists (today the cards link to `#cma` or "coming soon"
placeholders).

Does NOT create the parent community page (that is `site-community-page`).
Does NOT create per-listing detail pages (that is `site-listing-page`).
Does NOT handle non-resort neighborhoods like NW Crossing or Old Bend
(that is `site-neighborhood-page`).

**Status:** Canonical
**Locked:** 2026-05-18
**Exemplar output:** GitHub PR at `site-subdivision/<community-slug>-<sub-slug>-<prefix>` branch.

---

## 1. Scope

### In scope

- `site:subdivision_page_create`: net-new route at `app/lp/<community>/<subdivision>/page.tsx`
- `site:subdivision_page_update`: targeted section refresh on an existing route
- Route registration in `app/sitemap.ts` with `priority: 0.7`, `changeFrequency: 'daily'`
- JSON-LD `Place` + `RealEstateAgent` schemas, with `containedInPlace` referencing the parent community page
- ISR configuration: `export const revalidate = 21600` at the route level
- Live Supabase fetches for: active inventory filtered to this sub-plat, recent closings filtered to this sub-plat, KPIs computed against this sub-plat only when sample size >= 3 (else falls back to "sub-plat data thin; see parent community for current dynamics")
- Static content from `data/resort-communities.json` -> the matching `sub_neighborhoods[]` entry: name, type (Single-family golf homes / Townhomes / Gated custom / etc.), HOA annual dues, character description, image hint, optional architect, optional lot-size range
- Parent-community context block: a "Back to <Community>" breadcrumb at top + a compact "About <Community>" sidebar
- Map asset: subdivision-specific Google Static Map zoomed tighter than the parent community (zoom 14-15 typically)
- Per-listing "Schedule a showing" CTAs on each active inventory card (delegates to the parent community page's buyer track section via deep link)
- Buyer track: lightweight version that links up to the parent's full buyer-track section (the subdivision page does not duplicate the three-card buyer track; instead it has a single "Schedule a showing in <Sub>" CTA + "See all Tetherow homes" back-link)
- Seller CMA form: full version, FUB-tagged with `seller-intent,resort:<community>,subdivision:<sub>,lp:<source>` so leads can be routed precisely
- Brand voice validation on all generated copy
- TypeScript compile verification before PR

### Out of scope

- Creating or editing the parent community page (use `site-community-page`)
- Per-listing pages inside the subdivision (use `site-listing-page`)
- Editing the master sub-neighborhood list in `resort-communities.json` (manual edit; or a future `site-resort-config` producer)
- The sub-plat boundary polygon registration in `boundaries` table (manual import from Deschutes County GIS; this skill READS the polygon, never writes one)
- Cross-subdivision rollups (those live in the parent community page's comparison row)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `site:subdivision_page_create` | `community_slug`, `subdivision_slug`, `hero_headline`, `meta_description` | Parent community page must exist first. Sub-plat must be in resort-communities.json under that community's sub_neighborhoods[]. |
| `site:subdivision_page_update` | `community_slug`, `subdivision_slug`, `sections_to_update[]`, `reason` | Route must exist at app/lp/<c>/<s>/page.tsx. |

### Payload schema

```typescript
interface SiteSubdivisionPagePayload {
  community_slug: string;            // 'tetherow' | 'pronghorn' | etc. — must match a row in resort-communities.json
  subdivision_slug: string;          // 'heath' | 'tartan-druim' | etc. — must match a sub_neighborhoods[].slug under the parent community
  hero_headline: string;             // Playfair Display H1. Sentence case. May include dynamic-month-year span.
                                     // e.g. 'Heath at Tetherow: <data-dyn-month-year>'
  meta_description: string;          // 150-160 chars. Must include sub name + parent community + 'Bend, OR' + a verified figure.
  hero_image_override?: string;      // Optional override; otherwise uses sub_neighborhoods[].image_hint or pulls a current MLS photo from this sub.
  sections_to_update?: Array<
    | 'active_inventory'
    | 'recent_closings'
    | 'kpi_grid'
    | 'character'
    | 'architecture'
    | 'builders'
    | 'meta'
    | 'jsonld'
  >;
  reason?: string;
}
```

---

## 3. Full action row schema

```typescript
interface SiteSubdivisionPageActionRow {
  id: string;
  action_type: 'site:subdivision_page_create' | 'site:subdivision_page_update';
  target: string;                    // e.g. 'subdivision:tetherow:heath'
  assigned_producer: 'marketing_brain_skills/producers/site-subdivision-page';
  payload: SiteSubdivisionPagePayload;
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
- `data/resort-communities.json`
- The parent community's `app/lp/<community>/page.tsx` (must exist; if it doesn't, kill with "Parent community page not yet built. Run site-community-page first.")
- `public/lp/tetherow/index.html` for visual reference of the parent surface (since the subdivision page inherits its visual language)

**Step 3.** Resolve the sub-plat config:

From `resort-communities.json`, find the row matching `payload.community_slug`,
then within that row find `sub_neighborhoods[]` matching `payload.subdivision_slug`.

If either is missing:
- Community missing → kill: "Community '<c>' not in resort-communities.json. Add it first."
- Sub-plat missing → kill: "Subdivision '<s>' not in resort-communities.json under <c>. Add the sub_neighborhoods entry first."

**Step 4.** Verify the parent community route exists:
```bash
test -f app/lp/<community>/page.tsx
```

If missing, kill: "Parent community page not yet built. Run site-community-page first."

**Step 5.** Pull the sub-plat boundary polygon:

```sql
SELECT
  ST_X(ST_Centroid(polygon))::numeric(10,6) AS centroid_lng,
  ST_Y(ST_Centroid(polygon))::numeric(10,6) AS centroid_lat,
  ROUND((ST_Area(polygon::geography) / 4046.86)::numeric, 1) AS acres,
  source, source_url
FROM boundaries
WHERE geo_slug = '<sub_geo_slug>' OR geo_label ILIKE '%<sub_name>%'
  AND geo_type = 'subdivision'
ORDER BY ST_Area(polygon) ASC
LIMIT 1;
```

(The geo_slug naming convention for sub-plats is typically the parent
community slug followed by the sub slug, but Deschutes GIS row names
sometimes differ. The skill matches by both.)

If no polygon: render the page without a map; note in PR that the map
is omitted pending GIS boundary registration. This is acceptable for
launch since the parent community page already shows the location.

**Step 6.** Pull live market data filtered to this sub-plat:

a. **Sub-plat-specific market stats (if sample size allows):**
```sql
WITH sub_listings AS (
  SELECT *
  FROM listings
  WHERE "SubdivisionName" = '<sub_mls_alias>' OR "SubdivisionName" = ANY('<aliases>'::text[])
)
SELECT
  COUNT(*) FILTER (WHERE "StandardStatus" IN ('Closed', 'Sold') AND "CloseDate" >= NOW() - INTERVAL '365 days') AS sold_12mo,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") FILTER (WHERE "StandardStatus" IN ('Closed', 'Sold') AND "CloseDate" >= NOW() - INTERVAL '365 days') AS median_close_12mo,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "CumulativeDaysOnMarket") FILTER (WHERE "StandardStatus" IN ('Closed', 'Sold') AND "CloseDate" >= NOW() - INTERVAL '365 days') AS median_dom_12mo,
  COUNT(*) FILTER (WHERE "StandardStatus" = 'Active') AS active_count
FROM sub_listings
WHERE "PropertyType" = 'A';
```

If `sold_12mo < 3`, omit the KPI block from the page and use the parent
community's stats with a footnote: "Heath data thin (X sales in 12 months);
representative numbers below are Tetherow-wide."

b. **Sub-plat active inventory:**
```sql
SELECT
  "ListingId", "ListPrice", "StreetNumber", "StreetName",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
  "CumulativeDaysOnMarket", "StandardStatus", "PhotoURL"
FROM listings
WHERE "SubdivisionName" = ANY('<aliases>'::text[])
  AND "StandardStatus" IN ('Active', 'ActiveUnderContract', 'Pending')
  AND "PropertyType" = 'A'
ORDER BY "ListPrice" DESC
LIMIT 8;
```

c. **Sub-plat recent closings (last 12 months):**
```sql
SELECT
  "CloseDate", "ClosePrice", "ListPrice", "OriginalListPrice",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
  ROUND(("ClosePrice" / NULLIF("TotalLivingAreaSqFt", 0))::numeric, 0) AS price_per_sqft,
  ROUND((("ClosePrice" / NULLIF("ListPrice", 0)) * 100)::numeric, 1) AS sale_to_list_pct
FROM listings
WHERE "SubdivisionName" = ANY('<aliases>'::text[])
  AND "StandardStatus" IN ('Closed', 'Sold')
  AND "CloseDate" >= NOW() - INTERVAL '365 days'
ORDER BY "CloseDate" DESC
LIMIT 12;
```

**Step 7.** Generate map asset (if polygon exists):

```bash
MAP_URL="https://maps.googleapis.com/maps/api/staticmap?\
center=<lat>,<lng>&zoom=15&size=720x520&scale=2&maptype=roadmap\
&style=feature:poi|element:labels|visibility:off\
&style=feature:landscape|element:geometry|color:0xf2ebdd\
&style=feature:water|element:geometry|color:0xb8d4dc\
&markers=color:0x102742%7Csize:mid%7Clabel:T%7C<lat>,<lng>\
&key=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
curl -s -o public/lp/<c>/<s>/img/<s>-map.png "$MAP_URL"
```

Zoom 15 is right for most sub-plats (50-100 acre range). Adjust to 14 for
larger sub-plats (200+ acres) or 16 for tighter ones (< 30 acres).

**Step 8.** Voice-validate generated copy.

**Step 9.** Scaffold the route file at `app/lp/<c>/<s>/page.tsx`.

ISR config: `export const revalidate = 21600`.

Page structure (lighter than the parent community page):

1. **Topbar** with the white horizontal logo (inherited from layout)
2. **Sticky scroll CTA** (inherited component)
3. **Hero** with sub-plat aerial bg image, eyebrow "Inside <Community>", H1, four-stat bar (or three-stat if KPIs are thin)
4. **Breadcrumb** strip: Home › Bend › Tetherow › Heath (linked)
5. **About this sub-neighborhood** — single paragraph from `sub_neighborhoods[].description`, expanded with architectural guidelines + lot size norms if available
6. **Map + drive times** — sub-plat-specific Google Static Map + drive times inherited from parent community
7. **HOA + dues** — single card pulling from `sub_neighborhoods[].hoa_annual_estimate` + the parent's master assessment for context
8. **Live market** — KPI grid filtered to this sub-plat (or the "data thin" callout pointing to parent stats)
9. **Architecture + builders** — character section + the filtered builder roster (which builders have completed homes specifically in this sub-plat, sourced from `sub_neighborhoods[].builders` or computed from `listings.ListingAgentFullName` + `ConstructionMaterials` heuristics if not configured)
10. **Active inventory** grid (8 cards) with per-listing "Schedule a showing" buttons
11. **Recent closings** strip (8-12 rows)
12. **Parent community sidebar** — compact "About Tetherow" card with the parent community's master HOA, course recognition, and a "See all Tetherow communities" link back to `/lp/<community>/`
13. **CMA seller form** — full form, FUB tags include subdivision precision
14. **Buyer cross-link** — single CTA "See the full Tetherow buyer track" linking to `/lp/<community>/#buyer`
15. **Methodology** footer
16. **JSON-LD** Place (containedInPlace = parent community) + RealEstateAgent

Design system: identical to parent community page (Web register, shadcn/ui only).

**Step 10.** Update sitemap with `priority: 0.7`, `changeFrequency: 'daily'`.

**Step 11.** TypeScript compile check.

**Step 12.** Update the parent community's sub-neighborhood carousel:
**This step is critical.** The parent community page lists this sub-plat
in its carousel. Once this subdivision page is created, the parent's link
should switch from a `#cma` placeholder to the real route. Triggered by
a follow-up `site:community_page_update` action with
`sections_to_update: ['sub_neighborhoods']`. This producer surfaces that
action to Matt in the PR description so he can dispatch it (or the brain
can pick it up automatically).

**Step 13.** Branch, commit, push, open PR.

Branch: `site-subdivision/<c>-<s>-<prefix>`.

**Step 14.** Write citations.json + update action row to `ready`.

**Step 15.** Surface to Matt.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | sub-plat market queries + boundary lookup | standard |
| Read | resort-communities.json, parent community page, brand voice | repo paths |
| Write / Edit | sub-plat route file, sitemap, map asset | working tree |
| Bash: curl | Google Static Maps | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Bash: tsc | TypeScript compile check | repo |
| Bash: git, gh | branch + PR | active gh session |

---

## 6. Output format

**Draft lands at:** GitHub PR.

```
app/lp/<community>/<subdivision>/page.tsx
app/sitemap.ts (entry added for the new route)
public/lp/<community>/<subdivision>/img/<subdivision>-map.png (if polygon exists)
public/lp/<community>/<subdivision>/img/<subdivision>-hero.jpg (if hero override)
out/site-subdivision/<community>-<subdivision>/citations.json
```

**Surface format (chat reply to Matt):**

```
Subdivision page ready: /lp/<community>/<subdivision>/

  PR
    URL: <pr_url>
    Branch: site-subdivision/<c>-<s>-<prefix>

  PAGE
    Route: /lp/<community>/<subdivision>/
    Subdivision: <name>
    Parent: <community_name>
    Type: <sub_type>
    HOA: <annual>
    Active inventory: <n> homes
    Recent closings (12mo): <n>
    Sub-plat KPIs: <"computed" | "data thin, using parent community">

  VERIFICATION TRACE
    Live queries:
      • listings active where SubdivisionName ANY <aliases> -> <n>
      • listings closed 12mo -> <n>
      • boundaries geo_slug='<sub_geo_slug>' centroid -> (<lat>, <lng>)

  FOLLOW-UP REQUIRED
    Parent community sub-neighborhood card currently links to '#cma'.
    Dispatch site:community_page_update with sections_to_update=['sub_neighborhoods']
    to update the link to /lp/<community>/<subdivision>/.

  VALIDATION
    Voice: PASS
    TypeScript: PASS
    Design tokens: PASS
    JSON-LD: Place (containedInPlace = <community>) + RealEstateAgent

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

Same as `site-community-page`: pending -> in_production -> ready -> approved -> executed -> measured.

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Parent community page missing | `app/lp/<c>/page.tsx` not found | Kill; "Run site-community-page first" |
| Sub-plat not in resort-communities.json | No matching sub_neighborhoods[] entry | Kill; "Add entry to resort-communities.json first" |
| Route already exists (create) | File found on disk | Kill; suggest update action |
| Route missing (update) | File not found | Kill; suggest create action |
| No GIS polygon for sub-plat | boundaries query returns 0 rows | Render without map; note in PR |
| Data thin (sub-plat sample < 3 sales) | KPI block omitted | Surface to Matt with "Sample size too small; representative stats use parent community" |
| Voice / TypeScript fail | banned word or type error | Kill after 2 auto-fix iterations |
| Sub-plat builders unknown | resort-communities.json has no sub_neighborhoods[].builders array | Render with the full parent community builder roster; note "Not all builders work in this sub-plat" |

---

## 10. Related skills and references

**Required reading before executing:**

- `CLAUDE.md` §0, §0.5
- `CLAUDE.md` "Design System Rules: MANDATORY"
- `CLAUDE.md` "Design System v2: Heritage + Web Registers"
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `data/resort-communities.json`
- The parent community's `app/lp/<community>/page.tsx`
- `public/lp/tetherow/index.html` (visual exemplar at the parent tier)

**Sibling producers:**

- `marketing_brain_skills/producers/site-community-page/SKILL.md` — Tier 2 (parent of this skill's output)
- `marketing_brain_skills/producers/site-listing-page/SKILL.md` — Tier 4 (one tier deeper; per-property)
- `marketing_brain_skills/producers/site-city-page/SKILL.md` — Tier 1 (one tier higher; city-level)
- `marketing_brain_skills/producers/site-neighborhood-page/SKILL.md` — sibling for non-resort neighborhoods

**Registry entry:**

- `marketing_brain_skills/producers/REGISTRY.md` — Section D, row `site-subdivision-page`.

---

## 11. Tool gap suggestions

1. **Auto-trigger parent-community sub-neighborhood carousel update.** Today this skill surfaces a follow-up site:community_page_update action to Matt. A small audit job after every site-subdivision merge could dispatch it automatically.

2. **Sub-plat builder attribution from MLS records.** Today builder roster lives in resort-communities.json. Computing it from `listings.ListingAgentFullName` + `ConstructionMaterials` + `ContractStatusChangeDate` heuristics would surface the actual recent builders, not just the historical curated list.

3. **Sub-plat photo curation.** The hero image is hand-placed today. A small assist that picks the highest-resolution photo from the most recent close-of-record for a sub-plat would unblock 50+ subdivision builds.

4. **Architectural-guideline OCR.** Many sub-plats have CC&R PDFs with the architectural review committee guidelines. An OCR + structured extraction would let the page show a "What you can build here" section sourced directly from the recorded plat docs.

5. **Sub-plat-to-sub-plat comparison.** Today the parent community has a comparison row across peer resorts. A similar comparison across sub-plats within one resort (Heath vs Tartan Druim vs Triple Knot) would give buyers a clean apples-to-apples view inside one community.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `data/resort-communities.json`
- `marketing_brain_skills/producers/site-community-page/SKILL.md` (parent tier)
