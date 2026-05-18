---
name: floor_plan_render
description: >
  Cleans, brands, and renders a 2D floor plan image from a raw MLS floor plan scan or a
  Matterport scan for a specific listing. Use when Matt asks for "render the floor plan",
  "clean up this floor plan", "brand the floor plan", "make a floor plan for the listing",
  "floor plan PDF", or "add the floor plan to the carousel". Outputs a branded PNG and PDF
  at print and web resolution with Ryan Realty navy-on-cream styling. Both formats are
  ready for flyer insertion, carousel attachment, and the listing web page.
action_types:
  - content:floor_plan_render
output_type: image
target_platforms: ['email']
asset_destination: out/floor_plan_render/<listing-slug>/
auto_inputs: ['brand voice rules']
required_inputs: ['topic']
optional_inputs: []
estimated_runtime_min: 5
cost_usd_estimate: "$0.00-$0.20 per render (local Sharp/Pillow processing)"
thumbnail_uri: out/proof/2026-05-17/exemplars/floor_plan_render/sample.png
example_outputs: []
---

# Floor Plan Render

**Scope:** Takes a raw floor plan image from MLS or a Matterport scan and produces a clean,
branded 2D floor plan in both PNG and PDF format. Applies Ryan Realty navy-on-cream color
treatment, adds the brokerage wordmark at a tasteful scale, and outputs at both print (300 DPI
minimum) and web (1080 px minimum) resolution. This producer does NOT generate 3D floor plans,
walkthroughs, or animated tours. It does NOT produce floor plans from scratch when no source
material exists.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/floor_plan_render/<listing-slug>/`

---

## 1. Scope

### In scope
- Branded 2D floor plan PNG (web: 1080 px minimum on long edge; print: 300 DPI, 8.5x11 in)
- Branded PDF (single page, embedded fonts, print-ready)
- Color treatment: white or light-grey source map converted to navy `#102742` lines on cream
  `#faf8f4` background
- Ryan Realty wordmark placement: bottom-right corner, 12% of image width, no drop shadow
- Room label legibility pass: Geist 400, 12 px minimum at web resolution
- Optional dimension labels where source provides them

### Out of scope
- 3D floor plan rendering or walkthroughs (see `video_production_skills/listing-tour-video/SKILL.md`)
- Matterport 3D tour embedding (see `marketing_brain_skills/producers/site-matterport-embed/SKILL.md`)
- Generating a floor plan from scratch without any source material
- Measuring rooms from photos (no photogrammetry in this producer)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:floor_plan_render` | `mls_id` | Source auto-resolved from Supabase listings + Spark API |

### Payload schema

```typescript
interface FloorPlanRenderPayload {
  mls_id: string                     // MLS number
  source_type?: "mls_scan" | "matterport" | "upload"  // default: auto-detect
  matterport_model_id?: string       // required if source_type="matterport"
  include_dimensions?: boolean       // default true
  output_formats?: ("png" | "pdf")[] // default ["png", "pdf"]
}
```

---

## 3. Brief payload schema

```typescript
interface FloorPlanRenderActionRow {
  id: string
  action_type: "content:floor_plan_render"
  target: string                     // e.g. "mls:220198765"
  assigned_producer: "social_media_skills/floor_plan_render"
  payload: FloorPlanRenderPayload
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

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Immediately update:

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

**Step 2 - Load mandatory references**

- `CLAUDE.md` §0 - Data Accuracy. Every figure on the floor plan (sq ft, room count) must match
  the verified listing row from Supabase.
- `CLAUDE.md` §0.5 - Draft-First, Commit-Last.
- `design_system/ryan-realty/SKILL.md` - navy `#102742`, cream `#faf8f4`, Geist for labels,
  Amboqia only if a headline is needed.

**Step 3 - Resolve the source floor plan**

Check Supabase for a floor plan URL first:

```sql
SELECT "MlsId", "StandardStatus", "ListPrice", "TotalLivingAreaSqFt",
       "BedroomsTotal", "BathroomsTotal", "ListAgentEmail", "ListAgentFullName",
       "StreetNumber", "StreetName", "City"
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

Then query Spark API via `lib/spark.ts` for `SparkFloorPlan` attachments:

```typescript
const listing = await fetchListingById(mls_id);
const floorPlans = listing.FloorPlans ?? listing.VirtualTours?.filter(t => t.Type === "FloorPlan");
```

If neither yields a floor plan and `source_type` is not `"matterport"` or `"upload"`, stop.
Report to Matt: "No floor plan source found for MLS `<mls_id>`. Please upload a scan or
provide a Matterport model ID."

**Step 4 - Source from Matterport (if source_type="matterport")**

The Matterport API returns scan data including a 2D floor plan export. Per
`marketing_brain_skills/research/tool-inventory.md`, Matterport API access is not yet provisioned
with a stored key. If a Matterport model ID is provided:

1. Check `.env.local` for `MATTERPORT_SDK_KEY` or `MATTERPORT_TOKEN`.
2. If absent, surface to Matt: "Matterport API key not provisioned. Please add
   `MATTERPORT_TOKEN` to `.env.local` or provide the floor plan as a direct image upload."
3. If present, call `GET https://api.matterport.com/api/mp/models/<model_id>/download/floor_plan`
   and save the resulting image to a temp path.

**Step 5 - Apply the brand treatment**

Use Sharp (Node) or Pillow (Python) for all image processing. The goal is a clean, legible
floor plan that reads as a Ryan Realty document.

Processing steps:
1. Convert to grayscale (isolate the line art from any color coding in the source).
2. Threshold to near-black lines on white background (Otsu or manual threshold at ~180).
3. Re-colorize: replace near-black lines with navy `#102742`, set background to cream `#faf8f4`.
4. Resize to web output (long edge 1080 px for PNG web; 2550x3300 at 300 DPI for print PDF).
5. Composite the Ryan Realty wordmark at `design_system/ryan-realty/assets/brand/logo-blue.png`
   - bottom-right corner, 12% of image width, 16 px inset, no drop shadow.
6. If `include_dimensions=true` and the source image contains legible dimension text, preserve
   it. Do not attempt OCR-to-re-render of dimensions; preserve the original text layer.
7. Add a one-line footer below the plan (if space allows, else below the PDF page margin):
   `<address> · <city> · ryan-realty.com · 541.213.6706`
   Font: Geist 400, 11 px, charcoal `#1A1A1A`.

**Step 6 - Export PNG and PDF**

PNG web:
```
out/floor_plan_render/<listing-slug>/floor-plan-web.png
```
Width: 1080 px or longer edge 1080 px. Quality 92.

PNG print-ready:
```
out/floor_plan_render/<listing-slug>/floor-plan-print.png
```
300 DPI, 8.5x11 in canvas (2550x3300 px), floor plan centered with 0.25 in bleed margins.

PDF:
```
out/floor_plan_render/<listing-slug>/floor-plan.pdf
```
Use `@react-pdf/renderer` (already in `package.json`) or a Puppeteer HTML-to-PDF render.
Embed Geist font. Single page, A4 or Letter per output_formats preference.

**Step 7 - QA gate**

Before surfacing:
- Confirm navy lines are visible and not washed out (spot-check a corner pixel).
- Confirm wordmark is in the bottom-right corner and legible at 50% zoom.
- Confirm PDF opens and is text-selectable (not a flattened image-only PDF).
- Run banned-word grep on any footer or label text.
- Confirm room dimensions, if present, match the `TotalLivingAreaSqFt` in Supabase within 5%
  (rounding variance from measurement method is expected; >5% warrants a flag to Matt).

**Step 8 - Write citations.json**

```json
[
  {
    "figure": "TotalLivingAreaSqFt",
    "source": "Supabase listings",
    "filter": "MlsId='<mls_id>'",
    "column": "TotalLivingAreaSqFt",
    "value": "<value>",
    "fetched_at": "<ISO>"
  },
  {
    "figure": "Floor plan source",
    "source": "Spark API / Matterport / upload",
    "filter": "MlsId='<mls_id>'",
    "column": "FloorPlans[0].Uri",
    "value": "<source URL>",
    "fetched_at": "<ISO>"
  }
]
```

**Step 9 - Update the action row**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{"draft_path": "out/floor_plan_render/<slug>/", "formats": ["png", "pdf"]}'::jsonb
WHERE id = '<action_id>';
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase (service role) | Listing data + sq ft verification | `SUPABASE_SERVICE_ROLE_KEY` |
| Spark API (`lib/spark.ts`) | Floor plan attachment resolution | `SPARK_API_KEY`, `SPARK_API_BASE_URL` |
| Sharp (Node) | Image re-colorization, composite, resize | `scripts/composite-social-assets.mjs` |
| `@react-pdf/renderer` | PDF generation with embedded Geist font | `package.json` dependency |
| Matterport API | Floor plan export from 3D scan (optional) | `MATTERPORT_TOKEN` (provision if needed) |
| `design_system/ryan-realty/assets/brand/logo-blue.png` | Wordmark composite | local file, no API |

---

## 6. Output format

**Draft lands at:** `out/floor_plan_render/<listing-slug>/`

```
out/floor_plan_render/<listing-slug>/
├── floor-plan-web.png          (1080px long edge, navy on cream, wordmark)
├── floor-plan-print.png        (300 DPI, 8.5x11 canvas)
├── floor-plan.pdf              (print-ready PDF, embedded fonts)
├── citations.json
└── contact-sheet.html
```

**Surface format:**

```
Draft ready: floor_plan_render - <mls_id> <address>

Contact sheet:
  → file:///Users/matthewryan/RyanRealty/out/floor_plan_render/<slug>/contact-sheet.html

  DELIVERABLES
    floor-plan-web.png  - 1080px web, navy on cream
    floor-plan-print.png - 300 DPI print
    floor-plan.pdf      - print-ready PDF

  VERIFICATION TRACE
    - TotalLivingAreaSqFt <value> - Supabase listings, MlsId='<mls_id>', fetched <ISO>
    - Source: <Spark URL or Matterport or upload path>

  citations.json: out/floor_plan_render/<slug>/citations.json

Reply with one of:
  • approve <slug>          - ready to attach to flyer, carousel, or listing page
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
| No floor plan source | Spark returns no FloorPlan attachments, no upload | Surface to Matt with the listing address and a request for a scan. Set status='killed'. |
| Matterport token missing | 401 from Matterport API | Report to Matt: "MATTERPORT_TOKEN not in .env.local." |
| Sharp unavailable | `sharp` not installed | Run `npm install sharp` in the repo root. If still failing, use Pillow fallback. |
| Sq ft discrepancy > 5% | Dimension text on plan vs Supabase | Flag to Matt with both values. Do not ship without resolution. |
| PDF font not embedded | Text renders as boxes in PDF viewer | Confirm Geist font file is loaded via `@react-pdf/renderer` FontFamily registration. |

---

## 10. Related skills and references

**Required reading before executing:**

1. `CLAUDE.md` §0 - Data Accuracy (non-negotiable)
2. `CLAUDE.md` §0.5 - Draft-First, Commit-Last (non-negotiable)
3. `design_system/ryan-realty/SKILL.md` - brand visual system
4. `marketing_brain_skills/brand-voice/voice_guidelines.md` - voice enforcement
5. `marketing_brain_skills/research/tool-inventory.md` - Spark API (§2.7), Sharp (§3.4), packages (§3.1)
6. `marketing_brain_skills/research/platform-bible.md` - platform requirements for floor plan usage
7. `marketing_brain_skills/research/asset-library-map.md` - asset registration after approval
8. `marketing_brain_skills/research/bend-market-bible.md` - listing context
9. `automation_skills/content_engine/SKILL.md` - content routing
10. `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer
11. `video_production_skills/ANTI_SLOP_MANIFESTO.md` - authenticity gate for any generated image
12. `video_production_skills/VIRAL_GUARDRAILS.md` - cover-image scroll-stop discipline

**Related producers:**
- `social_media_skills/flyer-design/SKILL.md` - floor plan PNG is a secondary asset on listing flyers
- `social_media_skills/instagram-carousel/SKILL.md` - floor plan slide is slide 8-10 in most listing carousels
- `marketing_brain_skills/producers/site-matterport-embed/SKILL.md` - for the 3D tour embed (different skill)

**Registry entry:** `marketing_brain_skills/producers/REGISTRY.md` - Section B, row `floor_plan_render`

## 12. Tool gap suggestions

What would make this 10x better:

1. **MatterPort floor plan API**: if a Matterport tour exists, pull the auto-generated floor plan directly instead of requiring a manual PDF upload.
2. **Room-label auto-fill**: use the MLS BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt fields to verify labeled room counts match the listing data before the image ships.
3. **Furniture placement overlay**: offer an optional AI-staged furniture layer on top of the 2D floor plan so buyers can visualize room scale.

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

