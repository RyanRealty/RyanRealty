---
name: map_route_video
description: Renders an animated polyline route video (commute to key Bend destinations) from a listing address, targeting IG Reels, FB Reels, TikTok, and YouTube Shorts at 1080x1920 portrait.
action_types:
  - content:map_route
output_type: video
target_platforms: ['ig_reel', 'fb_reel', 'tt', 'yt_short']
asset_destination: data/asset-library/manifest.json and Supabase asset-library bucket per asset-library-map.md §2
auto_inputs: [listing address from Supabase listings, destination set from bend-market-bible.md §destinations]
required_inputs: [mls_id or address_string, destination_slug]
optional_inputs: [travel_mode (default: driving), variant_count (default: 3)]
estimated_runtime_min: 10
cost_usd_estimate: $0.005-0.02 (Routes API per request) + $0.00 (Static Maps)
thumbnail_uri: out/proof/2026-05-17/exemplars/map_route/sample.jpg
example_outputs: []
    label: Listing to Mt. Bachelor (driving, 9:16)
    surface: ig_reel
  - uri: out/proof/2026-05-17/exemplars/map_route/bend_to_st_charles.mp4
    label: Listing to St. Charles Medical Center (driving, 9:16)
    surface: fb_reel
  - uri: out/proof/2026-05-17/exemplars/map_route/bend_downtown_square.mp4
    label: Listing to Downtown Bend (walking, 1:1)
    surface: ig_feed
---

# Map Route Video Producer

**Scope:** This producer builds short animated polyline route videos showing commute or proximity from a listing (or neighborhood centroid) to one key Bend destination per video. Output is a 15-30 second portrait 1080x1920 MP4 with Remotion, featuring a smooth polyline draw animation over a Google Static Maps base, ElevenLabs Victoria VO giving travel time and context, and burned-in captions. It handles the `content:map_route` action type only. It does NOT geocode boundary polygons (school_district_overlay handles that), does NOT compute walkability isochrones (walkability_overlay handles that), and does NOT produce multi-stop itinerary videos.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/proof/2026-05-17/exemplars/map_route/`

---

## 1. What it makes

A single animated route video per render. The video shows:
- A Google Static Maps tile centered on the midpoint between origin and destination, with map style set to the brand palette (navy roads, cream background via custom style parameter).
- A polyline that draws progressively from origin pin to destination pin over the first 60% of the video, using Remotion's interpolate to drive stroke-dashoffset.
- An on-screen stat block appearing at 50% of the video: travel time (minutes), travel distance (miles), and destination name.
- Victoria VO narrating context: not the raw numbers, but the meaning. Example: "Mount Bachelor is 22 miles from your doorstep, but the ski-town feeling starts the moment you leave Bend." Numbers appear on-screen; VO carries narrative.
- Burned-in captions synced to ElevenLabs word timestamps (forced alignment).

Variants rendered per build (default):
- 1080x1920 (9:16) primary, for IG Reels, FB Reels, TikTok, YouTube Shorts.
- 1080x1080 (1:1) secondary, for IG Feed and Facebook Feed.

Both variants use the same VO and data; only the map crop and text layout differ.

Destination set (from `marketing_brain_skills/research/bend-market-bible.md` §destinations):
- `mt_bachelor` (Mt. Bachelor ski resort)
- `st_charles` (St. Charles Medical Center)
- `downtown_bend` (Downtown Bend / Wall St corridor)
- `old_mill` (Old Mill District)
- `bend_airport` (Bend Municipal Airport BDN)
- `athletic_club_bend` (Athletic Club of Bend)
- `les_schwab_amphitheater` (Les Schwab Amphitheater)
- `high_desert_museum` (High Desert Museum)
- `pilot_butte` (Pilot Butte State Scenic Viewpoint)
- `costco_bend` (Costco Bend - practical commute anchor)

---

## 2. Input contract (auto / required / optional)

### Auto-resolved (producer fetches without asking Matt)

| field | source | method |
|---|---|---|
| `origin_lat`, `origin_lng` | Supabase `listings` table, columns `"Latitude"`, `"Longitude"` | SELECT by `"MlsStatus"` or `mls_id` |
| `origin_address` | Supabase `listings`, `"StreetNumber"` + `"StreetName"` | Concatenated |
| `destination_coords` | bend-market-bible.md §destinations hardcoded table | Lookup by `destination_slug` |
| `destination_label` | bend-market-bible.md §destinations | Lookup by `destination_slug` |

### Required (from action row payload)

```typescript
interface MapRoutePayload {
  mls_id: string;           // MLS number, e.g. "220189422"; used to resolve listing row
  destination_slug: string; // One of the canonical destination keys above
}
```

### Optional (defaults apply if absent)

```typescript
interface MapRouteOptions {
  travel_mode?: "driving" | "walking" | "bicycling"; // default: "driving"
  variant_count?: 1 | 2;                             // default: 2 (9:16 + 1:1)
  vo_script_override?: string;                       // if provided, skips auto-script gen
  map_zoom?: number;                                 // default: auto-fit to route bounds
}
```

---

## 3. Tool stack (cite tool-inventory.md)

All tools documented in `marketing_brain_skills/research/tool-inventory.md`.

| tool | purpose | env var / path | status |
|---|---|---|---|
| Supabase MCP (`mcp__5adfee1a-82b2-4661-a931-e7bf6763a9c9__execute_sql`) | Resolve listing coordinates from `listings` table | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Active |
| Google Routes API | Compute route polyline, distance, duration | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Active (enabled 2026-05-17 per maps-api-enablement-log.md; replaces retired Directions API) |
| Google Static Maps API | Render map tile as PNG base layer | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Active |
| Remotion (`npx remotion render`) | Animate polyline draw + VO sync | `cd listing_video_v4` | Active |
| ElevenLabs API (`/v1/text-to-speech`, `/v1/forced-alignment`) | Victoria VO synthesis + word timestamps | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID=qSeXEcewz7tA0Q0qk9fH` | Active |
| ffmpeg (static-ffmpeg) | Mux audio + video, encode h264/aac | PATH via static-ffmpeg symlink | Active |
| `lib/asset-library.mjs` | Register finished render in asset library | local lib | Active |

Routes API note: Google retired Directions API and Distance Matrix API for new projects. This producer calls `POST https://routes.googleapis.com/directions/v2:computeRoutes` exclusively. See `marketing_brain_skills/research/maps-api-enablement-log.md` for the enablement record.

---

## 4. Platform stack (cite platform-bible.md)

Per `marketing_brain_skills/research/platform-bible.md`:

| platform | section | key constraints for this producer |
|---|---|---|
| Instagram Reels | §2 | 9:16, max 90s (target 15-30s), no logo in frame, hook by 0.4s, captions required |
| Facebook Reels | §6 | 9:16, max 90s, same hook and caption rules as IG Reels |
| TikTok | §10 | 9:16, hook by 0.4s, captions required, no logo, geo hashtags recommended |
| YouTube Shorts | §12 | 9:16, max 60s, no watermark, include geo keywords in title/description |
| Instagram Feed (1:1) | §1 | 1080x1080, static or short video, logo allowed on feed variant |

Logo in frame: per the logo-is-a-closer doctrine (platform-bible.md §26), no logo in the 9:16 viral variants. The 1:1 feed variant may carry the footer logo bar in the bottom 200px.

---

## 5. The recipe (end-to-end testable, numbered steps with exact tool calls)

**Step 1. Read and validate the action row**

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Update immediately:

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

**Step 2. Load mandatory references**

Before any build work, read:
- `CLAUDE.md` §0 (Data Accuracy) and §0.5 (Draft-First, Commit-Last)
- `design_system/ryan-realty/SKILL.md` (brand register, v2 palette, type families)
- `marketing_brain_skills/brand-voice/voice_guidelines.md` (voice enforcement, banned words)
- `video_production_skills/elevenlabs_voice/SKILL.md` (Victoria settings, IPA phonemes)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` (banned content gate)
- `video_production_skills/VIRAL_GUARDRAILS.md` (scorecard thresholds)

**Step 3. Resolve listing coordinates from Supabase**

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

Verify: row returns non-null lat/lng. If null, surface to Matt: "Listing <mls_id> has no coordinates in Supabase. Provide a street address to geocode or verify MLS ID." Do not proceed with a null origin.

**Step 4. Call Routes API for polyline + travel stats**

```bash
curl -X POST \
  "https://routes.googleapis.com/directions/v2:computeRoutes" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: $NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" \
  -H "X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline" \
  -d '{
    "origin": {"location": {"latLng": {"latitude": <lat>, "longitude": <lng>}}},
    "destination": {"location": {"latLng": {"latitude": <dest_lat>, "longitude": <dest_lng>}}},
    "travelMode": "DRIVE",
    "routingPreference": "TRAFFIC_AWARE_OPTIMAL"
  }'
```

Parse: `routes[0].duration` (e.g. "1020s" = 17 minutes), `routes[0].distanceMeters`, `routes[0].polyline.encodedPolyline`. Convert distance to miles: `Math.round(distanceMeters / 1609.34 * 10) / 10`.

Write to `citations.json`:

```json
{
  "figure": "17 minutes",
  "source": "Google Routes API",
  "filter": "origin:<mls_id> destination:<destination_slug> travelMode:DRIVE",
  "value": 1020,
  "unit": "seconds",
  "fetched_at": "<iso>"
}
```

**Step 5. Fetch Static Maps tile**

Decode the encoded polyline to a lat/lng array. Compute bounding box. Request:

```
https://maps.googleapis.com/maps/api/staticmap
  ?size=1080x1920
  &maptype=roadmap
  &style=element:geometry|color:0x102742
  &style=element:labels.text.fill|color:0xfaf8f4
  &path=enc:<encodedPolyline>
  &markers=color:0x102742|<origin_lat>,<origin_lng>
  &markers=color:0xfaf8f4|<dest_lat>,<dest_lng>
  &key=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

Save to `out/map_route/<slug>/map_base.png`. Verify HTTP 200 and non-zero file size.

**Step 6. Write VO script (narrative-only, not number recitation)**

VO must carry context and meaning, not repeat the on-screen stats. Template:

- Line 1 (hook, 0-2s): "[Destination] is one of the reasons people move to Bend."
- Line 2 (context, 2-8s): "[Narrative about the destination and what makes it worth the commute]."
- Line 3 (CTA, final 3s): "Ask us what else is minutes away from [street name]."

Apply brand voice rules from `marketing_brain_skills/brand-voice/voice_guidelines.md`: no em-dashes, no banned words (nestled, stunning, breathtaking, etc.), sentence case, you/your subject.

Spell out numbers for ElevenLabs ingestion: "17 minutes" stays as text; do not convert to "seventeen" in the script (ElevenLabs handles cardinal numbers correctly in `eleven_turbo_v2_5`).

**Step 7. Synthesize VO with Victoria**

Settings per `video_production_skills/elevenlabs_voice/SKILL.md`:

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

Chain segments with `previous_text`. Save MP3 to `out/map_route/<slug>/vo.mp3`.

Call `/v1/forced-alignment` to get word-level timestamps. Save to `out/map_route/<slug>/vo_alignment.json`.

**Step 8. Render with Remotion**

```bash
cd /Users/matthewryan/RyanRealty/listing_video_v4
npx remotion render src/index.ts MapRouteVideo \
  out/map_route/<slug>/map_route_9x16.mp4 \
  --codec h264 \
  --concurrency 1 \
  --crf 22 \
  --image-format=jpeg \
  --jpeg-quality=92 \
  --props '{"mapBase":"out/map_route/<slug>/map_base.png","voMp3":"out/map_route/<slug>/vo.mp3","alignment":"out/map_route/<slug>/vo_alignment.json","travelTime":"<N> min","distanceMiles":"<X> mi","destination":"<label>"}'
```

**Step 9. Run QA gate**

See §8 for the full gate. Minimum checks before surfacing:
- `ffprobe` confirms duration 15-30s.
- `ffprobe` confirms codec h264, audio aac.
- `ffmpeg -blackdetect` strict (pix_th=0.05) returns zero sequences.
- Banned-word grep across VO script and any on-screen text.
- `citations.json` present with all route figures.
- File size under 100 MB.

**Step 10. Register in asset library**

```javascript
import { register } from '../../lib/asset-library.mjs';
await register({
  type: 'video',
  slug: 'map_route_<mls_id>_<destination_slug>',
  path: 'out/map_route/<slug>/map_route_9x16.mp4',
  tags: ['map_route', '<destination_slug>', '<city>'],
  mls_id: '<mls_id>',
  created_at: new Date().toISOString()
});
```

**Step 11. Update action row to ready and surface draft**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{"draft_path":"out/map_route/<slug>/map_route_9x16.mp4","scorecard":{"score":82,"format_min":80}}'::jsonb
WHERE id = '<action_id>';
```

Then surface per §6 output format. Do not commit. Wait for Matt's approval.

---

## 6. Asset library wiring (cite asset-library-map.md)

Per `marketing_brain_skills/research/asset-library-map.md`:

- **Draft location:** `out/map_route/<mls_id>_<destination_slug>/` (gitignored, scratch).
- **After approval:** copy to Supabase Storage bucket `asset-library` at path `map-route/<date>/<mls_id>/<destination_slug>/map_route_9x16.mp4` (Convention 1 from asset-library-map.md §2).
- **Manifest entry:** written to `data/asset-library/manifest.json` via `lib/asset-library.mjs register()`.
- **Metadata stored:** `mls_id`, `destination_slug`, `travel_time_sec`, `distance_miles`, `travel_mode`, `created_at`, `approved_at`, Supabase public URL.

---

## 7. Publishing flow (platforms in order, scheduling, OAuth status)

Per `marketing_brain_skills/research/platform-bible.md` §25 and `video_production_skills/publisher/SKILL.md`:

1. Matt approves draft (explicit "ship it" or "approved").
2. Producer calls `automation_skills/content_engine/SKILL.md` publish step.
3. Content engine calls `/api/social/publish` with `platform=instagram_reel` first (primary surface).
4. On IG success, republish to `facebook_reel` (same asset).
5. TikTok and YouTube Shorts queued via `post_scheduler` (OAuth status: TikTok OAuth table empty as of 2026-05-16; flag if TikTok is a required target for this action row).
6. Scheduling: post within the platform's optimal window per platform-bible.md (IG Reels: Tue-Fri 7-9am PT or 6-8pm PT).

---

## 8. QA gate (format-specific checks)

| check | pass condition | tool |
|---|---|---|
| Duration | 15-30s | `ffprobe -show_entries format=duration` |
| Codec | h264 video, aac audio | `ffprobe -show_streams` |
| Black frames | 0 sequences (pix_th=0.05) | `ffmpeg -vf blackdetect=d=0.05:pix_th=0.05` |
| File size | Under 100 MB | `stat -f %z` |
| Aspect ratio | 1080x1920 for 9:16; 1080x1080 for 1:1 | `ffprobe -show_streams -select_streams v` |
| Hook timing | Motion at frame 12 (0.4s); text at frame 30 (1.0s) | frame extraction at 0.4s, 1.0s |
| Banned words | 0 hits | grep across VO script + any on-screen text strings |
| citations.json | Present, 1+ entries with source, filter, fetched_at | file exists, JSON valid |
| Contact sheet | HTML file present with video embedded | file exists |
| Logo in 9:16 variants | No Ryan Realty logo/text/phone in frame | frame scrub at 5s intervals |

Viral scorecard minimum: 80 (default floor). Write `scorecard.json` to the draft folder.

---

## 9. Failure modes + recovery

| failure | symptoms | recovery |
|---|---|---|
| Listing not found in Supabase | 0 rows returned for `mls_id` | Surface to Matt: "MLS ID <id> returned 0 rows. Verify the listing is in the Supabase `listings` table." Set status='killed'. |
| Null coordinates | `Latitude` or `Longitude` is NULL | Attempt geocoding via Geocoding API with address string. If that also fails, surface to Matt. |
| Routes API 4xx | REQUEST_DENIED or zero routes | Verify API key and that Routes API is enabled (maps-api-enablement-log.md). Surface error response to Matt. |
| Static Maps returns non-200 | Map tile missing | Log the full URL (redact key) and HTTP status. Try reducing `size` to 640x1280 as fallback. |
| ElevenLabs forced-alignment unavailable | 404 or 422 on alignment endpoint | Fall back to approximate word timing using character-count proportioning. Flag in scorecard. |
| Remotion OOM | Process killed, no output | Retry with `--concurrency 1` (already default). If OOM persists, reduce map tile resolution. |
| Banned word in VO | Grep hit | Auto-fix: replace with approved phrasing per voice_guidelines.md. Re-validate. If 2 auto-fix cycles fail, surface specific hit to Matt. |
| QA gate fails after 2 iterations | Still failing | Surface to Matt with specific failure reason, last frame extracted, error log. Set status='killed'. |

---

## 10. Mandatory references

All 12 mandatory references per CLAUDE.md §Marketing Brain Architecture:

1. `CLAUDE.md` §0 (Data Accuracy) - every route figure traces to a live Routes API call in this session.
2. `CLAUDE.md` §0.5 (Draft-First, Commit-Last) - render to `out/`, surface draft, wait for explicit approval before any commit.
3. `design_system/ryan-realty/SKILL.md` - brand visual system (navy `#102742`, cream `#faf8f4`, Geist body, Amboqia display).
4. `marketing_brain_skills/brand-voice/voice_guidelines.md` - voice enforcement; VO script scanned for banned words before synthesis.
5. `marketing_brain_skills/research/tool-inventory.md` - tool statuses; Routes API confirmed active (§6 Google Maps surface, see maps-api-enablement-log.md).
6. `marketing_brain_skills/research/platform-bible.md` - 9:16 format spec, hook timing, no-logo rule for viral variants.
7. `marketing_brain_skills/research/asset-library-map.md` - storage destination, manifest registration, object path conventions.
8. `marketing_brain_skills/research/bend-market-bible.md` - canonical destination set and local context for VO script generation.
9. `automation_skills/content_engine/SKILL.md` - all content:* actions execute through here; producer is dispatched by this engine.
10. `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer; logo, caption, aspect, and hook decisions.
11. `video_production_skills/ANTI_SLOP_MANIFESTO.md` - banned content gate; ElevenLabs Victoria only, no generic real estate language.
12. `video_production_skills/VIRAL_GUARDRAILS.md` - scorecard gate; minimum 80 to ship; scorecard.json written per render.

Additional capability references:
- `video_production_skills/elevenlabs_voice/SKILL.md` - Victoria voice ID, stability 0.40, similarity 0.80, style 0.50.
- `video_production_skills/quality_gate/SKILL.md` - QA pass procedure.
- `marketing_brain_skills/producers/REGISTRY.md` - Section B row `map_route_video`, action_type `content:map_route`.

---

## 11. Tool gap suggestions

| gap | current workaround | suggested improvement |
|---|---|---|
| Encoded polyline decode in Remotion | Requires custom JS decoder or external decode step | Add `@mapbox/polyline` to `listing_video_v4/package.json` for clean decode at render time |
| Street View Static for origin thumbnail | API enabled but not wired | Wire Street View Static thumbnail as a 2s intro beat before the map animation (adds location context at no extra cost) |
| Aerial View API for destination | API enabled (maps-api-enablement-log.md) | For premium listings, swap Static Maps destination tile for Aerial View cinematic clip |
| TikTok OAuth | Table empty as of 2026-05-16 | Complete OAuth at `/api/tiktok/authorize/`; route `content:map_route` to TikTok on first publish after connect |
| Routes API traffic-aware routing | Currently TRAFFIC_AWARE_OPTIMAL | Add time-of-day parameter so commute videos reflect realistic peak vs. off-peak times |

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
