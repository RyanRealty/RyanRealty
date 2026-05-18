---
name: virtual_staging
description: >
  Produces AI-driven virtual staging images from empty or lightly furnished room photos for a
  listing. Use when Matt asks for "virtually stage this room", "add furniture to this photo",
  "make this empty room look furnished", "virtual staging for the listing", or any request
  to digitally furnish a space. Outputs a disclosure-tagged PNG with "Virtually staged"
  watermark burned in per NAR ethics requirements. Each image links back to the originating
  listing action row and is registered in the asset library.
action_types:
  - content:virtual_staging
output_type: image
target_platforms: ['email']
asset_destination: out/virtual_staging/<listing-slug>/
auto_inputs: ['brand voice rules']
required_inputs: ['topic']
optional_inputs: []
estimated_runtime_min: 5
cost_usd_estimate: "$0.50-$2.00 per image via Replicate virtual staging model"
thumbnail_uri: out/proof/2026-05-17/exemplars/virtual_staging/sample.png
example_outputs: []
---

# Virtual Staging

**Scope:** Digitally furnishes empty or sparsely furnished rooms using a Replicate-hosted virtual
staging model. Outputs one disclosure-tagged PNG per variant. Targets listing web pages, flyers,
IG carousels, and Facebook feed posts. Does NOT produce video, floor plans, or exterior shots.
Does NOT select photos from the listing autonomously without Matt confirming the source image.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/virtual_staging/<listing-slug>/`

---

## 1. Scope

### In scope
- PNG images of virtually staged interior rooms (1080 px minimum on the short edge)
- Mandatory "Virtually staged" disclosure burned into the bottom-left corner of every output
- NAR-compliant visual alteration: furniture, rugs, art only. Structural changes (removing walls,
  adding windows, changing flooring material) are out of scope.
- Registration of output in Supabase `asset_library` with `originated_from_action_id`
- Variants up to 3 per room per run

### Out of scope
- Virtual staging of exterior shots (use `listing-tour-video` or `media-sourcing` for drone work)
- Full-room redesigns that alter architecture (wall removal, window addition)
- Photo retouching or perspective correction (use Sharp / Pillow pre-processing if needed first)
- AI-generated property photos presented as real photographs (hard banned per anti-slop manifesto)
- Generating the entire listing photo set (each room image must be approved by Matt)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:virtual_staging` | `mls_id`, `room_photo_url`, `room_type` | `originated_from_action_id` links back to parent listing action |

### Payload schema

```typescript
interface VirtualStagingPayload {
  mls_id: string                  // MLS number, e.g. "220198765"
  room_photo_url: string          // source photo - must be an unfurnished or lightly furnished room
  room_type: "living_room" | "bedroom" | "dining_room" | "office" | "basement"
  style?: "modern" | "scandinavian" | "transitional" | "traditional"  // default "modern"
  num_variants?: number           // 1-3; default 1
  originated_from_action_id?: string  // uuid of parent action row (list_kit, listing_launch, etc.)
}
```

---

## 3. Brief payload schema

```typescript
interface VirtualStagingActionRow {
  id: string
  action_type: "content:virtual_staging"
  target: string                  // e.g. "mls:220198765"
  assigned_producer: "social_media_skills/virtual_staging"
  payload: VirtualStagingPayload
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

Read these before touching any deliverable:
- `CLAUDE.md` §0 - Data Accuracy. Every claim in the listing context is source-verified.
- `CLAUDE.md` §0.5 - Draft-First, Commit-Last. Render to `out/`. No commit before Matt approves.
- `design_system/ryan-realty/SKILL.md` - brand color and type register.
- `marketing_brain_skills/brand-voice/voice_guidelines.md` - banned phrases for any caption text.
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` - AI disclosure rules for virtual staging.

**Step 3 - Resolve and validate the source photo**

Pull the listing row from Supabase to confirm the MLS number is valid and the listing is Active or
Pending. Never virtually stage a Closed or Cancelled listing without Matt directing it explicitly.

```sql
SELECT "MlsId", "StandardStatus", "ListAgentEmail", "ListAgentFullName", "StreetNumber",
       "StreetName", "City", "ListPrice"
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

If `StandardStatus` is not `Active` or `Pending`, surface to Matt before proceeding.

Validate the source image:
- Download if URL; confirm file exists if local path.
- Check that the image is an interior room (not exterior, not a floor plan, not a bathroom unless
  specifically requested).
- Confirm image is at least 800 px on the short edge. If smaller, reject and report to Matt.

**Step 4 - Search for the best available Replicate model**

The virtual staging model landscape changes frequently. Before calling Replicate:

1. Check `marketing_brain_skills/research/tool-inventory.md` §5.5 for any Ryan Realty-verified model.
2. If no verified model is listed, search `https://replicate.com/explore?query=virtual-staging`
   for the highest-rated model that accepts an image input and returns a furnished-room PNG.
3. Document the chosen model slug, version, and the date in `citations.json` so future runs can
   verify the model still exists.

The `REPLICATE_API_TOKEN` env var is confirmed active (see `tool-inventory.md` §4).

**Step 5 - Call Replicate**

Construct the prediction payload. Typical schema for virtual staging models:

```json
{
  "input": {
    "image": "<base64 or URL of source room photo>",
    "room_type": "<room_type from payload>",
    "style": "<style from payload or 'modern'>",
    "num_outputs": "<num_variants or 1>"
  }
}
```

POST to `https://api.replicate.com/v1/predictions` with `Authorization: Token $REPLICATE_API_TOKEN`.

Poll the prediction until `status = "succeeded"`. If it times out after 5 minutes, retry once.
If the second attempt fails, set action row to `killed` and surface the error to Matt.

**Step 6 - Burn in the disclosure watermark**

Every output image MUST carry "Virtually staged" text. This is a NAR ethics requirement and a
Ryan Realty compliance rule. Silence or omission is a ship-blocker.

Use Sharp (Node) or Pillow (Python) to composite the disclosure:
- Text: `Virtually staged`
- Font: Geist 500, 22 px, white
- Position: bottom-left, 16 px inset from each edge
- Background pill: `rgba(16, 39, 66, 0.70)` (70% navy), 8 px corner radius, 8 px horizontal
  padding, 4 px vertical padding

Save the composited image to `out/virtual_staging/<listing-slug>/<room_type>-v<n>.png`.

**Step 7 - Run the QA gate**

Before surfacing to Matt:
- Confirm the "Virtually staged" disclosure is visible in the saved PNG.
- Confirm the image dimensions are at least 1080 px on the short edge.
- Run a banned-word grep on any caption or alt text generated for the image.
- Check that the image does not contain the original room AND the staged version side-by-side
  (before/after composites are a separate deliverable; this producer outputs staged-only).
- Confirm no explicit structural changes were made (no added windows, no removed walls visible).

If any check fails, do not surface the draft. Fix and regenerate up to 2 times before surfacing
the failure to Matt.

**Step 8 - Write citations.json**

```json
[
  {
    "figure": "MLS listing status and agent",
    "source": "Supabase listings",
    "filter": "MlsId='<mls_id>'",
    "column": "StandardStatus, ListAgentEmail",
    "value": "<Active|Pending> - <agent email>",
    "fetched_at": "<ISO timestamp>"
  },
  {
    "figure": "Replicate model used",
    "source": "Replicate API",
    "filter": "model slug = <slug>",
    "column": "output[0] URL",
    "value": "<output URL>",
    "fetched_at": "<ISO timestamp>"
  }
]
```

**Step 9 - Register in asset library**

```bash
node lib/asset-library.mjs register \
  --type photo \
  --source replicate_virtual_staging \
  --path "out/virtual_staging/<listing-slug>/<room_type>-v<n>.png" \
  --mls-id <mls_id> \
  --action-id <originated_from_action_id or this action id>
```

**Step 10 - Update the action row and surface to Matt**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{"draft_path": "out/virtual_staging/<slug>/", "variants": <n>}'::jsonb
WHERE id = '<action_id>';
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Replicate API | Virtual staging model inference | `REPLICATE_API_TOKEN` |
| Supabase (service role) | Listing validation + asset library insert | `SUPABASE_SERVICE_ROLE_KEY` |
| Sharp (Node) or Pillow (Python) | Disclosure watermark composite | `scripts/composite-social-assets.mjs` |
| `lib/asset-library.mjs` | Register output in asset library | manifest at `data/asset-library/manifest.json` |

---

## 6. Output format

**Draft lands at:** `out/virtual_staging/<listing-slug>/`

```
out/virtual_staging/<listing-slug>/
├── <room_type>-v1.png          (disclosure watermark burned in)
├── <room_type>-v2.png          (if num_variants >= 2)
├── <room_type>-v3.png          (if num_variants = 3)
├── citations.json
└── contact-sheet.html
```

**Contact sheet** embeds all variant PNGs inline, shows the verification trace, lists the
Replicate model slug + version, and carries the disclosure confirmation per NAR requirements.
Follow the standard contact-sheet spec from `marketing_brain_skills/producers/TEMPLATE.md` §6.

**Surface format:**

```
Draft ready: virtual_staging - <mls_id> <room_type>

Contact sheet:
  → file:///Users/matthewryan/RyanRealty/out/virtual_staging/<slug>/contact-sheet.html

  DELIVERABLES
    <room_type>-v1.png - 1080×1350, "Virtually staged" watermark confirmed
    [<room_type>-v2.png, v3.png if applicable]

  DISCLOSURE
    "Virtually staged" text is burned into every image per NAR ethics requirements.
    These images may not be presented as original listing photographs.

  VERIFICATION TRACE
    - Listing <mls_id> - Supabase listings, StandardStatus=Active, fetched <ISO>
    - Replicate model - <slug>@<version>, cost ~$<n>.XX, prediction ID <id>

  citations.json: out/virtual_staging/<slug>/citations.json

Reply with one of:
  • approve <slug>          - commits + pushes to asset library, adds to carousel or flyer queue
  • revise <slug>: <note>   - feedback I will act on
  • kill <slug>             - drops this deliverable
```

---

## 7. Approval gate

**This producer uses:** `matt-review-draft`

Matt must see the staged images and the disclosure confirmation before any image is posted,
attached to a flyer, embedded in a carousel, or linked from a listing page. No exceptions.

---

## 8. Status flow

```
pending
  |  producer reads row, confirms listing status
  v
in_production   executed_at = now()
  |  Replicate inference + watermark composite + QA
  v
ready           executor_response populated with draft_path and variant count
  |  Matt says "approve <slug>" or "ship it"
  v
approved        approved_by='matt', approved_at=now()
  |  asset library registration complete, image attached to carousel/flyer as directed
  v
executed        git not needed; asset library registration is the publish step
  |  48h post-use check
  v
measured        performance_loop writes engagement metrics for carousel or flyer

killed          Matt cancels OR QA fails after 2 auto-iterations
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Replicate model not found | 404 or "model not found" from API | Search Replicate for a current virtual-staging model. Document the new slug in citations.json. Surface to Matt if none found. |
| Source image too small | Short edge < 800 px | Report to Matt with image dimensions. Request a higher-resolution source. Set status='killed'. |
| Listing not Active/Pending | Status is Closed or Cancelled | Surface to Matt before proceeding. Do not virtually stage a sold listing without explicit direction. |
| Disclosure watermark missing | QA check fails | Re-run the composite step. If Sharp/Pillow is unavailable, report and stop. Never ship without disclosure. |
| Replicate times out | Prediction status stays "processing" > 5 min | Retry once. After second failure, set status='killed' and surface error with prediction ID. |
| REPLICATE_API_TOKEN missing | 401 from Replicate | Report to Matt: var name, where to find it, what to set. |

---

## 10. Related skills and references

**Required reading before executing:**

1. `CLAUDE.md` §0 - Data Accuracy (non-negotiable)
2. `CLAUDE.md` §0.5 - Draft-First, Commit-Last (non-negotiable)
3. `design_system/ryan-realty/SKILL.md` - brand visual system
4. `marketing_brain_skills/brand-voice/voice_guidelines.md` - voice enforcement
5. `marketing_brain_skills/research/tool-inventory.md` - Replicate model registry (§5.5), API keys (§4)
6. `marketing_brain_skills/research/platform-bible.md` - NAR compliance rules for virtual staging disclosure
7. `marketing_brain_skills/research/asset-library-map.md` - how to register produced images
8. `marketing_brain_skills/research/bend-market-bible.md` - listing context for staging style decisions
9. `automation_skills/content_engine/SKILL.md` - content routing; this producer is invoked from here
10. `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer
11. `video_production_skills/ANTI_SLOP_MANIFESTO.md` - AI disclosure requirements for virtually staged images
12. `video_production_skills/VIRAL_GUARDRAILS.md` - cover image scroll-stop discipline

**Related producers:**

- `social_media_skills/instagram-carousel/SKILL.md` - virtually staged images often feed into carousel slides
- `social_media_skills/flyer-design/SKILL.md` - staged images can appear as secondary photos on flyers
- `marketing_brain_skills/producers/cma/SKILL.md` - staged images occasionally included in CMA supplementals

**Registry entry:** `marketing_brain_skills/producers/REGISTRY.md` - Section B, row `virtual_staging`

---

## 11. Compliance and legal

Virtual staging is legal and common in real estate marketing when properly disclosed. The
following rules are non-negotiable at Ryan Realty:

1. Every virtually staged image carries "Virtually staged" text in the image itself. Relying on
   caption-only disclosure is insufficient. The watermark is burned into the file.
2. Virtually staged images may not be listed as "original" photos in the MLS photo set. They may
   accompany original photos with a disclosure caption.
3. Structural alterations (removing walls, adding windows, changing ceiling height) are prohibited.
   Only furniture, rugs, art, and soft furnishings may be added or modified.
4. If a buyer's agent requests clarification, the listing agent must be able to produce the original
   unfurnished photo. Always preserve the source image at `out/virtual_staging/<slug>/source-*.jpg`.

Legal citation: NAR Code of Ethics Standard of Practice 12-10 (misrepresentation of property).
For Oregon-specific rules, consult `marketing_brain_skills/research/platform-bible.md`
real-estate-compliance section before any unusual staging request.

## 12. Tool gap suggestions

What would make this 10x better:

1. **Replicate virtual-staging model upgrade**: as new models ship (e.g. CambridgeMock, REimagineHome v3), route to the highest-rated model by resolution and style-accuracy benchmark.
2. **Before/after A/B test**: publish the staged version to IG Stories as a "swipe to see staged" interactive, with the raw photo as the first frame.
3. **Staging style database**: track which staging styles (modern, farmhouse, transitional) correlate with the highest engagement by listing price tier, then auto-select the best style.

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
