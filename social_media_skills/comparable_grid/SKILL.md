---
name: comparable_grid
description: >
  Produces a branded comparable-sales grid image (3x2 or 3x3 layout) showing recent closed
  sales used as comps for a listing or CMA. Each cell shows a property photo, address,
  close price, square footage, price-per-sqft, and close date. Use when Matt asks for
  "comparable grid", "comp grid", "show me the comps as a visual", "comp photos for the CMA",
  "build the comp grid for this listing", or when the CMA producer delegates this action.
  All data pulls live from Supabase listings table per §0 Data Accuracy rules.
action_types:
  - content:comparable_grid
output_type: image
target_platforms: ['email']
asset_destination: out/comparable_grid/<listing-slug>/
auto_inputs: ['brand voice rules']
required_inputs: ['topic']
optional_inputs: []
estimated_runtime_min: 5
cost_usd_estimate: "$0.00 - local rendering only, no paid API calls"
thumbnail_uri: out/proof/2026-05-17/exemplars/comparable_grid/sample.png
example_outputs: []
---

# Comparable Grid

**Scope:** Produces a branded 3x2 or 3x3 image grid of comparable closed sales. Each cell contains
a property photo, street address, close price, square footage, price per sqft, and close date.
Pulls all figures live from Supabase `listings` per CLAUDE.md §0 (Data Accuracy) - no inherited
numbers from the action row payload. Designed to appear as a carousel slide inside the `cma`
producer's HTML output or as a standalone IG slide. Does NOT produce the full CMA document;
the `cma` producer (`marketing_brain_skills/producers/cma/`) handles that. Does NOT select
comps from anything other than Supabase `listings` (no manual comp lists from memory, no
Zillow-sourced prices).

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/comparable_grid/<listing-slug>/`

---

## 1. Scope

### In scope
- PNG grid image at 1080x1080 (square IG) or 1200x900 (landscape carousel/email)
- Each cell: property photo + address + close price + sqft + price/sqft + close date
- Subject property highlighted (navy border pill) in the top-left cell or separated above the grid
- All data pulled live from Supabase `listings` (PropertyType='A' for SFR, CloseDate filter)
- Comp selection criteria: same city or neighborhood, same property type, within geo radius,
  within close date window, within 20% of subject price range

### Out of scope
- Full CMA HTML document (delegated to `marketing_brain_skills/producers/cma/SKILL.md`)
- Comps from Zillow, Realtor.com, or any non-Supabase/non-Spark source
- Active listings as comps (closed sales only, per CMA methodology)
- More than 9 comps in a single grid
- Lot size or HOA fee data unless explicitly requested and available in the listing row

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:comparable_grid` | `subject_mls_id` | Comp selection is automatic unless `comp_mls_ids` is provided |

### Payload schema

```typescript
interface ComparableGridPayload {
  subject_mls_id: string          // MLS number of the subject property
  comp_mls_ids?: string[]         // up to 9 MLS numbers; if omitted, auto-selected from Supabase
  grid_layout?: "3x2" | "3x3"    // default "3x2"
  geo_radius_miles?: number       // default 1.0
  close_date_window_days?: number // default 180
  originated_from_action_id?: string  // uuid of the parent cma action row
}
```

---

## 3. Brief payload schema

```typescript
interface ComparableGridActionRow {
  id: string
  action_type: "content:comparable_grid"
  target: string                  // e.g. "mls:220198765"
  assigned_producer: "social_media_skills/comparable_grid"
  payload: ComparableGridPayload
  data_evidence: {
    audit_source?: string
    opportunity_area?: string
    signal_evidence?: string
  }
  generation_reason: string
  status: "pending"
}
```

---

## 4. The recipe

**Step 1 - Read the action row**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

**Step 2 - Load mandatory references**

- `CLAUDE.md` §0 - Data Accuracy. Every close price, square footage, and date in the grid traces
  to a live Supabase query run in this session. No inherited figures from the payload.
- `CLAUDE.md` §0.5 - Draft-First, Commit-Last.
- `design_system/ryan-realty/SKILL.md` - navy/cream palette, Geist for data cells, Amboqia
  for subject property hero label if used.

**Step 3 - Pull the subject property**

```sql
SELECT "MlsId", "StreetNumber", "StreetName", "City", "ListPrice", "ClosePrice",
       "CloseDate", "TotalLivingAreaSqFt", "BedroomsTotal", "BathroomsTotal",
       price_per_sqft, "Latitude", "Longitude", "SubdivisionName", "PhotoURL",
       "PropertyType", "ListAgentEmail", "ListAgentFullName"
FROM listings
WHERE "MlsId" = '<subject_mls_id>'
LIMIT 1;
```

If the row returns 0 results, stop and surface to Matt with the exact query.

**Step 4 - Select or validate comps**

If `comp_mls_ids` was provided in the payload, validate each against Supabase:

```sql
SELECT "MlsId", "ClosePrice", "CloseDate", "TotalLivingAreaSqFt", price_per_sqft,
       "StreetNumber", "StreetName", "City", "PhotoURL", "StandardStatus", "PropertyType"
FROM listings
WHERE "MlsId" = ANY(ARRAY['<mls_1>', '<mls_2>', ...])
  AND "StandardStatus" = 'Closed';
```

If any comp is not found as Closed, exclude it and log the exclusion in `citations.json`.

If `comp_mls_ids` was NOT provided, auto-select using this query. Adjust thresholds based on
local Bend market data from `marketing_brain_skills/research/bend-market-bible.md`:

```sql
SELECT "MlsId", "ClosePrice", "CloseDate", "TotalLivingAreaSqFt", price_per_sqft,
       "StreetNumber", "StreetName", "City", "PhotoURL",
       earth_distance(
         ll_to_earth("Latitude", "Longitude"),
         ll_to_earth(<subject_lat>, <subject_lng>)
       ) / 1609.34 AS dist_miles
FROM listings
WHERE "StandardStatus" = 'Closed'
  AND "PropertyType" = 'A'
  AND "CloseDate" >= now() - INTERVAL '<close_date_window_days> days'
  AND "ClosePrice" BETWEEN <subject_price> * 0.80 AND <subject_price> * 1.20
  AND earth_distance(ll_to_earth("Latitude", "Longitude"), ll_to_earth(<lat>, <lng>)) / 1609.34 <= <geo_radius_miles>
ORDER BY "CloseDate" DESC
LIMIT <grid_cells>;
```

If fewer than 4 comps are found within the defaults, widen `geo_radius_miles` to 2.0 and
`close_date_window_days` to 365. If still fewer than 4, surface to Matt.

**Step 5 - Fetch comp photos**

For each comp, resolve the best available photo:
1. Check `"PhotoURL"` in the listings row.
2. If null, query `listing_photos` table for `MlsId = '<comp_mls_id>'` ordered by `PhotoOrder` ASC.
3. If still null, use the Spark API `SparkPhoto` list.
4. If no photo is available, use a placeholder navy-on-cream silhouette from
   `design_system/ryan-realty/assets/brand/scene-tower.png` with a text label.

Download all photos to `out/comparable_grid/<slug>/photos/` before rendering.

**Step 6 - Render the grid**

Use Sharp (Node) for all compositing. The canonical layout:

Grid cell dimensions:
- 3x2 at 1080x720: each cell 360x360 px with 4 px gap between cells
- 3x3 at 1080x1080: each cell 360x360 px with 4 px gap

Per cell:
1. Crop property photo to 360x220 (2:1 header zone) - center-weighted crop.
2. Below photo: cream `#faf8f4` data zone, 360x140 px.
3. Data zone layout (Geist 500, tabular-nums, navy `#102742`):
   - Line 1: Street address, 14 px
   - Line 2: Close price in `$X,XXX,XXX` format, 18 px semibold
   - Line 3: `<sqft> sqft · $<ppsf>/sqft`, 12 px, muted (70% navy)
   - Line 4: `Closed <Mon DD, YYYY>`, 11 px, muted
4. Subject property cell (top-left): 3 px navy border pill around the whole cell,
   "Subject" label badge: cream text, navy pill, Geist 500, 11 px, positioned top-left of photo.

Grid header (above all cells, if grid is 3x2):
- `Comparable sales · <City> · <date window>` - Geist 400, 13 px, charcoal, left-aligned.

Grid footer:
- Ryan Realty wordmark: `design_system/ryan-realty/assets/brand/logo-blue.png`, right-aligned,
  height 18 px. No phone, no URL, no agent name - brand presence only.

**Step 7 - QA gate**

- Confirm every close price, sqft, and date in the grid matches the Supabase rows exactly.
- Run spot-check: pick 2 random cells, re-query Supabase for those MLS numbers, confirm values match.
- Run banned-word grep on any text in the grid.
- Confirm no Active listings appear as comps (all must be StandardStatus='Closed').
- Confirm the subject property cell has the "Subject" badge.
- Confirm the grid is 1080 px wide and either 720 or 1080 px tall based on grid_layout.

**Step 8 - Write citations.json**

One entry per comp MLS number and the subject:

```json
[
  {
    "figure": "$<close_price> close price",
    "source": "Supabase listings",
    "filter": "MlsId='<mls_id>', StandardStatus='Closed'",
    "column": "ClosePrice",
    "value": <close_price_integer>,
    "fetched_at": "<ISO>"
  }
]
```

Include an entry for each comp's price, sqft, and close date.

**Step 9 - Update the action row**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{"draft_path": "out/comparable_grid/<slug>/", "comp_count": <n>}'::jsonb
WHERE id = '<action_id>';
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase (service role) | Subject + comp data, photo URLs | `SUPABASE_SERVICE_ROLE_KEY` |
| Spark API (`lib/spark.ts`) | Photo fallback for comps missing PhotoURL | `SPARK_API_KEY`, `SPARK_API_BASE_URL` |
| Sharp (Node) | Grid compositing, photo crop, text overlay | `scripts/composite-social-assets.mjs` |
| `design_system/ryan-realty/assets/brand/logo-blue.png` | Footer wordmark | local file |

---

## 6. Output format

**Draft lands at:** `out/comparable_grid/<listing-slug>/`

```
out/comparable_grid/<listing-slug>/
├── comparable-grid.png         (1080x720 for 3x2 or 1080x1080 for 3x3)
├── photos/                     (downloaded comp photos, local cache)
├── citations.json
└── contact-sheet.html
```

**Surface format:**

```
Draft ready: comparable_grid - <subject_mls_id> <address>

Contact sheet:
  → file:///Users/matthewryan/RyanRealty/out/comparable_grid/<slug>/contact-sheet.html

  DELIVERABLE
    comparable-grid.png - <grid_layout>, <n> comps

  VERIFICATION TRACE (per comp, one line each)
    - $<price> close price - Supabase listings, MlsId='<id>', CloseDate <date>, fetched <ISO>
    [repeat for each comp]

  citations.json: out/comparable_grid/<slug>/citations.json

Reply with one of:
  • approve <slug>          - attaches to CMA or carousel queue
  • revise <slug>: <note>   - feedback I will act on
  • kill <slug>             - drop this deliverable
```

---

## 7. Approval gate

**This producer uses:** `matt-review-draft`

---

## 8. Status flow

```
pending  ->  in_production  ->  ready  ->  approved  ->  executed  ->  measured
                                                 killed (Matt cancels or QA fails 2x)
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Fewer than 4 comps found | Supabase returns <4 rows | Widen radius to 2 miles, then 365-day window. If still <4, surface to Matt with the query and result count. |
| Comp photo missing | PhotoURL null, listing_photos empty, Spark returns no photos | Use scene-tower.png placeholder. Flag the cell in the contact sheet as "No photo available." |
| Close price mismatch in spot-check | Grid value != re-queried Supabase value | Do not surface draft. Regenerate from fresh query. If mismatch persists, surface as a data issue. |
| earth_distance function unavailable | Postgres extension not installed | Fall back to bounding-box filter using Latitude/Longitude ranges (0.0145 degrees per mile). Note the fallback in citations.json. |

---

## 10. Related skills and references

**Required reading before executing:**

1. `CLAUDE.md` §0 - Data Accuracy (non-negotiable; this producer's core value is source-verified comp data)
2. `CLAUDE.md` §0.5 - Draft-First, Commit-Last (non-negotiable)
3. `design_system/ryan-realty/SKILL.md` - brand visual system
4. `marketing_brain_skills/brand-voice/voice_guidelines.md` - voice enforcement
5. `marketing_brain_skills/research/tool-inventory.md` - Supabase, Spark API, Sharp
6. `marketing_brain_skills/research/platform-bible.md` - CMA and comp disclosure requirements
7. `marketing_brain_skills/research/asset-library-map.md` - asset registration
8. `marketing_brain_skills/research/bend-market-bible.md` - Bend comp selection norms (typical search radius, price band)
9. `automation_skills/content_engine/SKILL.md` - content routing
10. `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer
11. `video_production_skills/ANTI_SLOP_MANIFESTO.md` - authenticity gate; no fabricated comp data
12. `video_production_skills/VIRAL_GUARDRAILS.md` - visual hierarchy for carousel slides

**Related producers:**
- `marketing_brain_skills/producers/cma/SKILL.md` - primary delegator; comparable_grid is often a slide within the CMA
- `social_media_skills/instagram-carousel/SKILL.md` - comp grid can be a standalone IG carousel
- `social_media_skills/map_static_card/SKILL.md` - map showing comp locations pairs with the grid

**Registry entry:** `marketing_brain_skills/producers/REGISTRY.md` - Section B, row `comparable_grid`

## 12. Tool gap suggestions

What would make this 10x better:

1. **Photo diversity check**: before assembling the grid, check that no two comp photos share the same MLS photo ID (duplicate exterior shot) using a perceptual hash.
2. **Price-per-sqft delta annotation**: auto-add a small badge to each comp showing whether it sold above or below the subject on a price/sqft basis.
3. **Swipeable interactive version**: alongside the static image, generate an HTML carousel version for email and website embedding using the same comp data.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

---

## Validator stub sections (canonical 11-section structure)

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

