---
name: walkability_overlay
description: Produces an animated isochrone overlay video and static card showing 5, 10, and 15-minute walking and driving zones from a listing address, targeting IG Reels, FB Reels, and listing landing pages.
action_types:
  - content:walkability_overlay
output_type: video
target_platforms: ['ig_reel', 'fb_reel', 'ig_feed']
asset_destination: data/asset-library/manifest.json and Supabase asset-library bucket per asset-library-map.md §2
auto_inputs: [listing coordinates from Supabase listings]
required_inputs: [mls_id]
optional_inputs: [modes (default: [walking, driving]), time_buckets (default: [5, 10, 15]), animate (default: true)]
estimated_runtime_min: 10
cost_usd_estimate: $0.01-0.05 (Mapbox Isochrone API or Routes API matrix) + $0.00 (Supabase)
thumbnail_uri: out/proof/2026-05-17/exemplars/walkability_overlay/sample.jpg
example_outputs: []
    label: Walkability isochrone animated (9:16)
    surface: ig_reel
  - uri: out/proof/2026-05-17/exemplars/walkability_overlay/walkability_4x5.jpg
    label: Walkability static card (4:5)
    surface: ig_feed
  - uri: out/proof/2026-05-17/exemplars/walkability_overlay/walkability_1x1.jpg
    label: Walkability static card (1:1)
    surface: ig_feed
---

# Walkability Overlay Producer

**Scope:** This producer creates isochrone zone overlays for a listing address, showing how far a person can walk (or drive) in 5, 10, and 15 minutes. The output is a portrait 1080x1920 animated MP4 and a 1080x1350 static image. Each isochrone ring is drawn on a Google Static Maps (or Mapbox) tile with navy fill at graduated opacity, with on-screen callouts for what is reachable at each time threshold. ElevenLabs Victoria VO narrates lifestyle context. It handles `content:walkability_overlay` only. It does NOT compute school assignments (school_district_overlay handles that). It does NOT produce point-to-point route animations (map_route_video handles that). Note: this producer does not claim a "Walk Score" trademark value; it presents isochrone geometry and reachable place categories from Places API data, clearly attributed as travel-time estimates.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/proof/2026-05-17/exemplars/walkability_overlay/`

---

## 1. What it makes

Per render, this producer outputs:
- A 20-30 second 1080x1920 animated MP4 (9:16): map base, isochrone rings animate in sequentially (5-min ring first, then 10-min, then 15-min), place category callouts fade in, VO narrates.
- A 1080x1350 static JPG (4:5): all three rings visible simultaneously, place callouts in text overlay.
- A 1080x1080 static JPG (1:1): cropped square version of the 4:5.

Isochrone data:
- Three concentric rings per mode (walking or driving).
- Walking: 5, 10, 15 minute polygons.
- Driving: 5, 10, 15 minute polygons.
- Colors: 5-min inner ring (navy `#102742` at 50% opacity), 10-min middle ring (navy at 35% opacity), 15-min outer ring (navy at 20% opacity).

Place category callouts (pulled from Places API New for the listing location):
- Categories within the 5-min walk zone: coffee shops, grocery, parks.
- Categories within the 10-min walk zone: restaurants, fitness, pharmacy.
- Callouts show category icon + count, not individual business names (avoids accuracy drift as businesses open/close).

The animated variant uses a sequential reveal: the 5-min ring expands from a point with an ease-out animation (Remotion interpolate), holds for 2s, then 10-min ring expands similarly, then 15-min, then place callouts fade in. VO runs throughout.

---

## 2. Input contract (auto / required / optional)

### Auto-resolved

| field | source | method |
|---|---|---|
| `origin_lat`, `origin_lng` | Supabase `listings."Latitude"`, `"Longitude"` | SELECT by mls_id |
| `origin_address` | Supabase `listings` | Concatenated street |
| `place_counts` | Google Places API New (`nearbySearch`) | Search per category within bounding radius |

### Required

```typescript
interface WalkabilityPayload {
  mls_id: string; // MLS number to resolve origin coordinates
}
```

### Optional

```typescript
interface WalkabilityOptions {
  modes?: ("walking" | "driving")[];    // default: ["walking", "driving"]
  time_buckets?: number[];              // default: [5, 10, 15] (minutes)
  animate?: boolean;                    // default: true
  variant?: "all" | "9x16" | "4x5" | "1x1"; // default: "all"
}
```

---

## 3. Tool stack (cite tool-inventory.md)

Per `marketing_brain_skills/research/tool-inventory.md`:

| tool | purpose | env var / path | status |
|---|---|---|---|
| Supabase MCP | Resolve listing coords | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Active |
| Google Routes API (matrix endpoint) | Compute isochrone approximation via travel-time matrix | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Active (enabled 2026-05-17; replaces deprecated Distance Matrix API) |
| Mapbox Isochrone API | Alternative isochrone polygons (preferred when Mapbox token present) | `MAPBOX_ACCESS_TOKEN` | Configured (check .env.local) |
| Google Places API New | Count of place categories within walking zones | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Active (enabled 2026-05-17 per maps-api-enablement-log.md) |
| Google Static Maps API | Map tile base layer | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Active |
| Remotion | Animated isochrone ring expansion MP4 | `cd listing_video_v4` | Active |
| ElevenLabs API | Victoria VO synthesis + forced alignment | `ELEVENLABS_API_KEY` | Active |
| ffmpeg | Audio-video mux | static-ffmpeg symlink | Active |
| `lib/asset-library.mjs` | Asset library registration | local lib | Active |

Isochrone strategy:
- Primary: Mapbox Isochrone API (`GET /isochrone/v1/mapbox/walking/<lng>,<lat>?contours_minutes=5,10,15&polygons=true`). Returns proper GeoJSON polygons. Cost: $0.40/1000 requests on pay-as-you-go.
- Fallback: Routes API compute-routes matrix (approximate isochrone via convex hull of reachable points). Use if `MAPBOX_ACCESS_TOKEN` is unset in `.env.local`.
- Never fall back to LLM-estimated travel radii or simple circular buffers presented as isochrones.

---

## 4. Platform stack (cite platform-bible.md)

Per `marketing_brain_skills/research/platform-bible.md`:

| platform | section | key constraints |
|---|---|---|
| Instagram Reels | §2 | 9:16, 20-30s, hook by 0.4s, no logo, captions required |
| Facebook Reels | §6 | 9:16, same rules |
| Instagram Feed (4:5) | §1 | 1080x1350, static, logo in footer allowed |
| Instagram Feed (1:1) | §1 | 1080x1080, static |
| Listing page | n/a | PNG or JPG embed in property landing page |

Logo rule (platform-bible.md §26 logo-is-a-closer doctrine): no Ryan Realty logo in the 9:16 viral variants. Footer logo bar permitted in static 4:5 and 1:1 variants.

---

## 5. The recipe (end-to-end testable, numbered steps with exact tool calls)

**Step 1. Read and validate the action row**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

**Step 2. Load mandatory references**

- `CLAUDE.md` §0 and §0.5
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `video_production_skills/elevenlabs_voice/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`

**Step 3. Resolve listing coordinates**

```sql
SELECT "Latitude", "Longitude", "StreetNumber", "StreetName", "City", "ListPrice"
FROM listings
WHERE "ListingId" = '<mls_id>'
  AND "Latitude" IS NOT NULL
LIMIT 1;
```

Null coordinates: attempt Geocoding API fallback. If still null, surface to Matt and kill action row.

**Step 4. Compute isochrones (Mapbox primary, Routes API fallback)**

Mapbox primary:

```bash
# Walking isochrones
curl "https://api.mapbox.com/isochrone/v1/mapbox/walking/<lng>,<lat>?contours_minutes=5,10,15&polygons=true&access_token=$MAPBOX_ACCESS_TOKEN"

# Driving isochrones
curl "https://api.mapbox.com/isochrone/v1/mapbox/driving/<lng>,<lat>?contours_minutes=5,10,15&polygons=true&access_token=$MAPBOX_ACCESS_TOKEN"
```

Parse GeoJSON feature collection. Three polygon features per mode (5-min, 10-min, 15-min). Save to `out/walkability_overlay/<slug>/isochrones_walking.json` and `isochrones_driving.json`.

Write to `citations.json`:
```json
{
  "figure": "5-minute walk zone",
  "source": "Mapbox Isochrone API",
  "filter": "mode:walking contours_minutes:5 origin:<lat>,<lng>",
  "value": "<GeoJSON polygon hash>",
  "fetched_at": "<iso>"
}
```

**Step 5. Query place categories within walking zone**

For each reachable category (coffee, grocery, parks, restaurants, fitness, pharmacy), call Places API New `nearbySearch` within a bounding radius derived from the 10-min walk polygon:

```bash
curl -X POST \
  "https://places.googleapis.com/v1/places:searchNearby" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: $NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" \
  -H "X-Goog-FieldMask: places.id,places.types" \
  -d '{
    "includedTypes": ["cafe"],
    "locationRestriction": {
      "circle": {
        "center": {"latitude": <lat>, "longitude": <lng>},
        "radius": <10_min_walk_radius_meters>
      }
    },
    "maxResultCount": 20
  }'
```

Count results per category. Store counts in `out/walkability_overlay/<slug>/place_counts.json`. Add each category count to `citations.json`.

**Step 6. Build Static Maps tile**

Convert isochrone GeoJSON polygons to Static Maps `path` parameters. Use three separate path parameters for the three rings with graduated opacity:

```
https://maps.googleapis.com/maps/api/staticmap
  ?size=1080x1920
  &maptype=roadmap
  &path=fillcolor:0x10274233|color:0x10274266|weight:1|enc:<15minPolyline>
  &path=fillcolor:0x10274259|color:0x102742AA|weight:1|enc:<10minPolyline>
  &path=fillcolor:0x10274280|color:0x102742CC|weight:2|enc:<5minPolyline>
  &markers=color:0x102742|<lat>,<lng>
  &key=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

Save to `out/walkability_overlay/<slug>/map_base_9x16.png`.

**Step 7. Write VO script**

Template:
- Line 1 (hook): "Everything you need is within walking distance of [street name]."
- Line 2 (5-min): "[N] coffee shops and groceries are under a 5-minute walk."
- Line 3 (10-min): "Within 10 minutes on foot, you have [N] restaurants and [N] fitness options."
- Line 4 (CTA): "Ask us what it is like to live here day to day."

Brand voice check: no banned words, no em-dashes, sentence case, you/your subject.

**Step 8. Synthesize VO with Victoria**

Per `video_production_skills/elevenlabs_voice/SKILL.md`: `eleven_turbo_v2_5`, stability 0.40, similarity_boost 0.80, style 0.50, use_speaker_boost true. Save MP3 and forced-alignment JSON.

**Step 9. Render animated 9:16 MP4**

```bash
cd /Users/matthewryan/RyanRealty/listing_video_v4
npx remotion render src/index.ts WalkabilityOverlay \
  out/walkability_overlay/<slug>/walkability_9x16.mp4 \
  --codec h264 \
  --concurrency 1 \
  --crf 22 \
  --image-format=jpeg \
  --jpeg-quality=92 \
  --props '{"mapBase":"out/walkability_overlay/<slug>/map_base_9x16.png","voMp3":"out/walkability_overlay/<slug>/vo.mp3","isochronesWalking":"out/walkability_overlay/<slug>/isochrones_walking.json","placeCounts":"out/walkability_overlay/<slug>/place_counts.json","alignment":"out/walkability_overlay/<slug>/vo_alignment.json"}'
```

**Step 10. Composite static variants with Pillow**

Place all three rings on the 4:5 and 1:1 map tiles. Overlay legend (five-min / ten-min / fifteen-min with navy pill labels). Add place count callouts in cream Geist 500 text.

**Step 11. Run QA gate, register in asset library, surface draft**

Per §8. Write `citations.json` and `scorecard.json`. Register in asset library. Update action row to 'ready'. Surface per §6.

---

## 6. Asset library wiring (cite asset-library-map.md)

Per `marketing_brain_skills/research/asset-library-map.md`:

- **Draft location:** `out/walkability_overlay/<mls_id>/` (gitignored).
- **After approval:** Supabase Storage `asset-library` at `walkability-overlay/<date>/<mls_id>/`.
- **Manifest entry:** `lib/asset-library.mjs register()` with `mls_id`, `isochrone_mode`, `place_counts`, `created_at`.

---

## 7. Publishing flow

1. Matt approves.
2. Content engine publishes 9:16 to IG Reel and FB Reel.
3. Static 4:5 queued for IG Feed post.
4. Asset reference passed to `site-property-landing` producer for listing page sidebar.
5. Scheduling: same optimal window as map_route_video.

---

## 8. QA gate (format-specific checks)

| check | pass condition | tool |
|---|---|---|
| Duration (animated) | 20-30s | ffprobe |
| Codec | h264 video, aac audio | ffprobe |
| Black frames | 0 sequences | ffmpeg blackdetect |
| File size | Under 100 MB | stat |
| Isochrone rings visible | All 3 rings present on map (frame extraction at 10s, 20s) | visual QA |
| Place counts | At least 2 category counts show non-zero values | place_counts.json validation |
| VO says "Walk Score" trademark | 0 hits | grep VO script for "Walk Score" (trademark; use "walking distance" instead) |
| Banned words | 0 hits | grep against voice_guidelines.md §11.0 |
| citations.json | Isochrone source and place count source entries present | file valid |
| Isochrone source | Not "llm" or "estimated" | citations.json source field check |

Viral scorecard minimum: 80. Write `scorecard.json`.

---

## 9. Failure modes + recovery

| failure | symptoms | recovery |
|---|---|---|
| Mapbox token missing | 401 Unauthorized on Isochrone API | Fall back to Routes API matrix approximation. Flag in scorecard as "isochrone-approx" variant. |
| Routes API matrix fallback also fails | 4xx | Surface to Matt: both isochrone sources unavailable. Kill action row. |
| Places API returns 0 results for all categories | Empty place_counts.json | Widen search radius by 50%. If still 0, omit place callouts from render and flag in contact sheet: "No places data returned; listing may be in a low-density area." |
| Map tile polygon too large | Static Maps URL exceeds 8192 chars | Simplify isochrone polygon with Douglas-Peucker (tolerance 0.0001 degrees). |
| "Walk Score" in VO | Trademark violation | Auto-replace with "walking distance" or "walkable zone." |
| Remotion OOM | Process killed | `--concurrency 1` is default; try reducing map tile to 640x1280. |
| QA fails after 2 iterations | Specific failure | Surface to Matt with failure reason and extracted frame. Kill action row. |

---

## 10. Mandatory references

1. `CLAUDE.md` §0 (Data Accuracy) - isochrone data traces to live Mapbox or Routes API call; place counts trace to live Places API call; no estimated values.
2. `CLAUDE.md` §0.5 (Draft-First, Commit-Last) - render to `out/`; wait for explicit approval.
3. `design_system/ryan-realty/SKILL.md` - navy graduated opacity rings, cream callout pills, Geist body type.
4. `marketing_brain_skills/brand-voice/voice_guidelines.md` - VO script enforcement; "Walk Score" trademark avoidance.
5. `marketing_brain_skills/research/tool-inventory.md` - Mapbox token status, Routes API status (Active per maps-api-enablement-log.md), Places API New (Active).
6. `marketing_brain_skills/research/platform-bible.md` - §2 IG Reels spec; §1 IG Feed spec; §26 logo-is-a-closer doctrine.
7. `marketing_brain_skills/research/asset-library-map.md` - storage destinations, manifest registration.
8. `marketing_brain_skills/research/bend-market-bible.md` - local context for VO narrative (neighborhood density, walkable areas of Bend vs. outlying subdivisions).
9. `automation_skills/content_engine/SKILL.md` - routing bus; all content:* actions execute through here.
10. `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer.
11. `video_production_skills/ANTI_SLOP_MANIFESTO.md` - banned content gate; ElevenLabs Victoria only.
12. `video_production_skills/VIRAL_GUARDRAILS.md` - scorecard minimum 80; scorecard.json per render.

Additional references:
- `video_production_skills/elevenlabs_voice/SKILL.md` - Victoria settings.
- `marketing_brain_skills/producers/REGISTRY.md` - Section B row `walkability_overlay`, action_type `content:walkability_overlay`.

---

## 11. Tool gap suggestions

| gap | current workaround | suggested improvement |
|---|---|---|
| Mapbox Isochrone vs. Routes API approximation | Fallback to convex-hull approximation | Confirm `MAPBOX_ACCESS_TOKEN` is set in `.env.local`; Mapbox isochrones are proper polygon shapes vs. approximations |
| Place category icons | Text-only callout pills | Add SVG icons per category (coffee cup, shopping cart, park tree) in `design_system/ryan-realty/assets/icons/` for richer visual callouts |
| "Walk Score" brand alternative | Worded as "walking distance" | Consider integrating WalkScore API (walkscore.com) with explicit attribution if Matt wants the official score displayed |
| Driving vs. walking visual differentiation | Same ring style, different mode toggle | Add a mode-switch UI beat in the animated variant (first 10s walking, then 10s driving) to show both modes in one video |
| Mapbox billing | Pay-as-you-go | At scale (>1000 listings/mo), evaluate Mapbox Monthly Active Users plan vs. per-request pricing |

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
