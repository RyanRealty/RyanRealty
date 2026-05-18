---
name: school_district_overlay
description: Produces a static or short-motion overlay image/video showing the Bend-La Pine Schools boundary and assigned schools for a listing address, targeting IG Feed, FB Feed, and listing landing pages.
action_types:
  - content:school_overlay
output_type: video
target_platforms: ['ig_reel', 'fb_reel', 'ig_feed']
asset_destination: data/asset-library/manifest.json and Supabase asset-library bucket per asset-library-map.md §2
auto_inputs: [listing address and coordinates from Supabase listings, school boundaries from Supabase boundaries table]
required_inputs: [mls_id]
optional_inputs: [show_ratings (default: false), animate (default: true), variant (default: all)]
estimated_runtime_min: 8
cost_usd_estimate: $0.002-0.005 (Geocoding API) + $0.00 (Static Maps, Supabase)
thumbnail_uri: out/proof/2026-05-17/exemplars/school_overlay/sample.jpg
example_outputs: []
    label: Listing school boundary overlay (9:16 animated)
    surface: ig_reel
  - uri: out/proof/2026-05-17/exemplars/school_overlay/listing_schools_4x5.jpg
    label: Listing school card (4:5 static)
    surface: ig_feed
  - uri: out/proof/2026-05-17/exemplars/school_overlay/listing_schools_1x1.jpg
    label: Listing school card (1:1 static)
    surface: ig_feed
---

# School District Overlay Producer

**Scope:** This producer creates school district boundary overlays for a listing address, showing the elementary, middle, and high school assigned to that address within the Bend-La Pine Schools district. Output is a 1080x1920 animated MP4 (9:16) and a 1080x1350 static image (4:5) showing a Google Static Maps tile with the school attendance boundary polygon drawn as a navy overlay, the school name, and the grade range. It handles `content:school_overlay` only. It does NOT compute walkability or travel time (walkability_overlay handles that). It does NOT produce route animations (map_route_video handles that). It does NOT guarantee real-time school assignment accuracy for boundary disputes. Fair-housing note: per platform-bible.md §24, school information is factual public data and is permitted in listing content, but school quality comparisons and subjective school "rankings" are not included in any copy this producer generates.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/proof/2026-05-17/exemplars/school_overlay/`

---

## 1. What it makes

Per render, this producer outputs:
- A 15-20 second 1080x1920 animated MP4 (9:16): map fade-in, boundary polygon draw, school name cards animate in one by one, VO narrates school assignment.
- A 1080x1350 static JPG (4:5): map with boundary drawn, school cards in text overlay, no animation. Used for IG Feed and FB Feed.
- A 1080x1080 static JPG (1:1): same as 4:5 but cropped for square placement.

On-screen information displayed:
- Elementary school name and grade range (K-5 or K-6 depending on BLS zone).
- Middle school name and grade range.
- High school name and grade range.
- Attendance boundary polygon overlaid on the map in navy at 40% opacity with a cream stroke.
- "Bend-La Pine Schools" attribution line.

School names come from the Supabase `boundaries` table, populated from City of Bend GIS / Oregon Department of Education boundary data (per GIS authority rule in MEMORY.md). The producer does NOT scrape, estimate, or recall school assignments from training data.

---

## 2. Input contract (auto / required / optional)

### Auto-resolved

| field | source | method |
|---|---|---|
| `origin_lat`, `origin_lng` | Supabase `listings."Latitude"`, `"Longitude"` | SELECT by `mls_id` |
| `origin_address` | Supabase `listings."StreetNumber"`, `"StreetName"`, `"City"` | Concatenated |
| `school_boundary_polygon` | Supabase `boundaries` table, `boundary_type='school_attendance'` | Point-in-polygon query using PostGIS |
| `assigned_schools` | Supabase `boundaries` + linked school lookup table | JOIN on boundary_id |

### Required

```typescript
interface SchoolOverlayPayload {
  mls_id: string; // MLS listing number; used to resolve address and coordinates
}
```

### Optional

```typescript
interface SchoolOverlayOptions {
  show_ratings?: boolean;  // default: false. Ratings not included (fair-housing caution)
  animate?: boolean;       // default: true. Animated MP4; false = static image only
  variant?: "all" | "9x16" | "4x5" | "1x1"; // default: "all"
}
```

---

## 3. Tool stack (cite tool-inventory.md)

Per `marketing_brain_skills/research/tool-inventory.md`:

| tool | purpose | env var / path | status |
|---|---|---|---|
| Supabase MCP (`execute_sql`) | Resolve listing coords, query `boundaries` table for school zone polygon | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Active |
| Google Geocoding API | Confirm address-to-lat-lng (secondary verification) | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Active (enabled 2026-05-17 per maps-api-enablement-log.md) |
| Google Static Maps API | Render map tile with boundary polygon overlay | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Active |
| Pillow (Python) | Composite school name cards onto static image variants | `python3 -c "import PIL"` | Active via project venv |
| Remotion (`npx remotion render`) | Animated 9:16 MP4 with polygon draw and card reveals | `cd listing_video_v4` | Active |
| ElevenLabs API | Victoria VO for animated variant | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Active |
| ffmpeg | Mux audio + video | static-ffmpeg symlink | Active |
| `lib/asset-library.mjs` | Register render in asset library | local lib | Active |

Boundary data authority: per MEMORY.md GIS rule, school attendance zone polygons must come from City of Bend GIS, Deschutes County DIAL, Oregon GEO, or Census TIGER. Never approximate or LLM-generate. Each boundary row in `public.boundaries` must carry `boundary_source`, `source_url`, `fetched_at`, and `verified_by` per the GIS authority rule.

---

## 4. Platform stack (cite platform-bible.md)

Per `marketing_brain_skills/research/platform-bible.md`:

| platform | section | key constraints |
|---|---|---|
| Instagram Reels | §2 | 9:16, 15-20s, hook by 0.4s, no logo, captions required |
| Facebook Reels | §6 | 9:16, same rules as IG Reels |
| Instagram Feed (4:5) | §1 | 1080x1350, static image, logo in footer allowed |
| Instagram Feed (1:1) | §1 | 1080x1080, static |
| Listing page embed | n/a | PNG or JPG embed in property landing page sidebar |

Fair-housing compliance (platform-bible.md §24): school information is factual public data permitted in listing content. Avoid language implying school quality superiority or that a school assignment is a selling feature that would steer a protected class. Copy says "assigned school" not "top-rated school" or "best schools."

---

## 5. The recipe (end-to-end testable, numbered steps with exact tool calls)

**Step 1. Read and validate the action row**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

**Step 2. Load mandatory references**

Read before touching any deliverable:
- `CLAUDE.md` §0 (Data Accuracy) and §0.5 (Draft-First, Commit-Last)
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/bend-market-bible.md` §3 (Bend-La Pine Schools context)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`

**Step 3. Resolve listing coordinates**

```sql
SELECT
  "Latitude",
  "Longitude",
  "StreetNumber",
  "StreetName",
  "City",
  "ListPrice"
FROM listings
WHERE "ListingId" = '<mls_id>'
  AND "Latitude" IS NOT NULL
LIMIT 1;
```

If 0 rows: surface error to Matt. If null coordinates: attempt Geocoding API with address string.

**Step 4. Query school boundary via PostGIS point-in-polygon**

```sql
SELECT
  b.id,
  b.name,
  b.boundary_type,
  b.grade_range,
  b.boundary_source,
  b.source_url,
  b.fetched_at,
  ST_AsGeoJSON(b.geometry) AS geojson
FROM boundaries b
WHERE b.boundary_type IN ('elementary_attendance', 'middle_attendance', 'high_attendance')
  AND ST_Contains(b.geometry, ST_SetSRID(ST_MakePoint(<lng>, <lat>), 4326))
ORDER BY b.boundary_type;
```

Expected: 3 rows (one per school level). If fewer than 3 rows, the listing may be in an area outside Bend-La Pine Schools jurisdiction (Sisters SD, Redmond SD, etc.) or boundary data is missing. Surface this to Matt with the specific count returned.

Write boundary_source and fetched_at to `citations.json` for the GIS authority record.

**Step 5. Fetch Static Maps tile with boundary polygon**

Convert GeoJSON boundary polygon coordinates to the Static Maps `path` parameter format (list of lat,lng pairs). The path must be closed (last point = first point). Use navy fill at 40% opacity (`0x1027266`) and cream stroke (`0xfaf8f4FF`):

```
https://maps.googleapis.com/maps/api/staticmap
  ?size=1080x1920
  &maptype=roadmap
  &path=fillcolor:0x10274266|color:0xfaf8f4FF|weight:3|enc:<encodedBoundaryPolygon>
  &markers=color:0x102742|label:H|<lat>,<lng>
  &key=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

Save to `out/school_overlay/<slug>/map_base_9x16.png`. For 4:5 variant, request `size=1080x1350`.

**Step 6. Write school name card data**

Build a JSON data structure for the three school cards:

```json
{
  "elementary": {"name": "<name>", "grades": "K-5", "boundary_id": "<id>"},
  "middle": {"name": "<name>", "grades": "6-8", "boundary_id": "<id>"},
  "high": {"name": "<name>", "grades": "9-12", "boundary_id": "<id>"}
}
```

Save to `out/school_overlay/<slug>/schools.json`.

**Step 7. Write VO script (animated variant only)**

Template (narrative, not rating commentary):

- Line 1 (hook): "This [address] is in the [high school name] attendance zone."
- Line 2 (elementary): "Elementary students are assigned to [name]."
- Line 3 (middle): "Middle school feeds into [name]."
- Line 4 (CTA): "Want the full picture on this home? Ask us anything."

Brand voice check: no banned words, sentence case for hook, no exclamation marks, no school quality claims.

**Step 8. Synthesize VO (animated variant)**

```json
{
  "model_id": "eleven_turbo_v2_5",
  "voice_settings": {
    "stability": 0.40,
    "similarity_boost": 0.80,
    "style": 0.50,
    "use_speaker_boost": true
  }
}
```

Save MP3 and forced-alignment JSON per `video_production_skills/elevenlabs_voice/SKILL.md`.

**Step 9. Render animated 9:16 MP4**

```bash
cd /Users/matthewryan/RyanRealty/listing_video_v4
npx remotion render src/index.ts SchoolDistrictOverlay \
  out/school_overlay/<slug>/school_overlay_9x16.mp4 \
  --codec h264 \
  --concurrency 1 \
  --crf 22 \
  --image-format=jpeg \
  --jpeg-quality=92 \
  --props '{"mapBase":"out/school_overlay/<slug>/map_base_9x16.png","voMp3":"out/school_overlay/<slug>/vo.mp3","schools":"out/school_overlay/<slug>/schools.json","alignment":"out/school_overlay/<slug>/vo_alignment.json"}'
```

**Step 10. Composite static variants with Pillow**

For 4:5 and 1:1 variants, use Pillow to overlay the three school name cards (navy pill, Geist 500, cream text) on the Static Maps tile. Save as JPG at quality 92.

**Step 11. Run QA gate, register in asset library, update action row**

Per §8. Write `citations.json` and `scorecard.json`. Register in asset library per §6. Update action row to 'ready'. Surface draft to Matt per §6 output format.

---

## 6. Asset library wiring (cite asset-library-map.md)

Per `marketing_brain_skills/research/asset-library-map.md`:

- **Draft location:** `out/school_overlay/<mls_id>/` (gitignored).
- **After approval:** Supabase Storage bucket `asset-library` at path `school-overlay/<date>/<mls_id>/`.
- **Manifest entry:** `lib/asset-library.mjs register()` with `mls_id`, `school_names`, `boundary_ids`, `created_at`.
- Local offline cache: `data/asset-library/manifest.json`.

---

## 7. Publishing flow

1. Matt approves draft.
2. Content engine publishes 9:16 MP4 to IG Reel and FB Reel.
3. Static 4:5 JPG queued for IG Feed post with caption (caption written per platform-bible.md §1).
4. Static JPG also registered for listing page sidebar (delivers to `site-property-landing` producer as an asset reference).
5. Scheduling: same optimal window as map_route_video (IG Reels: Tue-Fri 7-9am PT or 6-8pm PT).

---

## 8. QA gate (format-specific checks)

| check | pass condition | tool |
|---|---|---|
| Duration (animated) | 15-20s | ffprobe |
| Codec (animated) | h264 video, aac audio | ffprobe |
| Black frames | 0 sequences | ffmpeg blackdetect |
| File size | Under 100 MB | stat |
| School data present | 3 school names in on-screen cards (elementary, middle, high) | grep rendered frame text or props validation |
| Boundary polygon visible | Navy overlay present on map tile | visual QA via frame extraction at 5s |
| Banned words | 0 hits in VO + on-screen text | grep against voice_guidelines.md §11.0 list |
| Fair-housing compliance | No school quality/ranking language | grep for "top", "best", "rated", "ranking" |
| citations.json | Present with boundary_source, source_url, fetched_at for all 3 school zones | file valid |
| GIS authority rule | boundary_source is NOT null and NOT "llm" or "estimated" | SQL check on boundaries rows returned |

Viral scorecard minimum: 80. Write `scorecard.json`.

---

## 9. Failure modes + recovery

| failure | symptoms | recovery |
|---|---|---|
| Listing coordinates null | Supabase returns NULL lat/lng | Geocode with Geocoding API. If still null, surface to Matt. |
| Fewer than 3 boundary rows | PostGIS query returns 0-2 rows | Check if listing is outside Bend-La Pine SD (may be Sisters or Redmond SD). Surface to Matt with exact count and city. |
| Boundary GeoJSON too large for Static Maps path | 4xx or URL too long | Simplify polygon with Douglas-Peucker (tolerance 0.0001 degrees) and retry. |
| School data not in boundaries table | 0 rows, any boundary_type | Surface to Matt: "School boundary data missing for this location. GIS import may be needed." Do NOT fall back to LLM-recalled school names. |
| Fair-housing flag | grep hits "best" or "top-rated" in auto-generated copy | Auto-replace with "assigned school." Re-validate. |
| ElevenLabs 429 | Rate limit | Retry after 30s. If still failing, render video-only, note in contact sheet that VO will be added after quota resets. |
| Pillow import error | ModuleNotFoundError | `pip3 install Pillow` in project venv. Re-run. |

---

## 10. Mandatory references

1. `CLAUDE.md` §0 (Data Accuracy) - school boundary data traces to live Supabase query; GIS authority rule from MEMORY.md enforced.
2. `CLAUDE.md` §0.5 (Draft-First, Commit-Last) - render to `out/`, surface, wait for approval.
3. `design_system/ryan-realty/SKILL.md` - brand palette for map tile styling and card design.
4. `marketing_brain_skills/brand-voice/voice_guidelines.md` - VO script voice enforcement; fair-housing caution on school copy.
5. `marketing_brain_skills/research/tool-inventory.md` - Geocoding API status (Active per maps-api-enablement-log.md), Supabase MCP.
6. `marketing_brain_skills/research/platform-bible.md` - §24 fair-housing compliance for school content; §1 IG Feed spec; §2 IG Reels spec.
7. `marketing_brain_skills/research/asset-library-map.md` - storage destinations, manifest registration.
8. `marketing_brain_skills/research/bend-market-bible.md` - §3 Bend-La Pine Schools context (district size, enrollment, school count).
9. `automation_skills/content_engine/SKILL.md` - routing; this producer is dispatched through content_engine.
10. `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer; fair-housing, logo, caption rules.
11. `video_production_skills/ANTI_SLOP_MANIFESTO.md` - ElevenLabs Victoria only; no generic real estate clichés.
12. `video_production_skills/VIRAL_GUARDRAILS.md` - scorecard minimum 80; scorecard.json per render.

Additional references:
- `video_production_skills/elevenlabs_voice/SKILL.md` - Victoria settings.
- `marketing_brain_skills/producers/REGISTRY.md` - Section B row `school_district_overlay`, action_type `content:school_overlay`.
- MEMORY.md GIS authority rule - boundaries must trace to City of Bend GIS, Deschutes County DIAL, Oregon GEO, or Census TIGER.

---

## 11. Tool gap suggestions

| gap | current workaround | suggested improvement |
|---|---|---|
| School boundary GeoJSON not yet imported to `boundaries` table | Producer will surface "missing boundary data" error | Phase 4 data import: download Bend-La Pine Schools attendance zone KML from Oregon DOE, import to `public.boundaries` with `boundary_type='elementary_attendance'` etc., `boundary_source='Oregon DOE'` |
| School ratings excluded for fair-housing compliance | Ratings omitted entirely | Consider a broker-facing (internal) variant that includes GreatSchools summary rating for CMA context, not for public-facing content |
| Sisters SD and Redmond SD boundaries | Not in scope | Add `sisters_school_overlay` and `redmond_school_overlay` action_types when boundary data is imported for those districts |
| Pillow dependency not in package.json | Assumed available in venv | Add `Pillow>=10.0` to `requirements.txt` and document the setup step in producer README |

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
