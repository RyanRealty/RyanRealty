---
name: map_static_card
description: >
  Produces a branded static map image for a listing or neighborhood using the Google Maps
  Static API. Use when Matt asks for "map card for this listing", "show me where this
  property is on a map", "neighborhood map for the carousel", "location slide for this
  listing", "map image for the email", or any request for a static map graphic. Outputs a
  1080x1080 square (carousel/feed) and a 1200x628 landscape (email/web OG) variant, both
  branded with the Ryan Realty wordmark and a property pin. Uses Static Maps API (already
  enabled) plus Geocoding API (enabled 2026-05-17 per maps-api-enablement-log.md).
action_types:
  - content:map_static_card
output_type: image
target_platforms: ['email']
asset_destination: out/map_static_card/<listing-slug>/
auto_inputs: ['brand voice rules']
required_inputs: ['topic']
optional_inputs: []
estimated_runtime_min: 3
cost_usd_estimate: "$0.01-$0.05 per render (Static Maps $0.002/req + Geocoding $0.005/req)"
thumbnail_uri: out/proof/2026-05-17/exemplars/map_static_card/sample.png
example_outputs: []
---

# Map Static Card

**Scope:** Produces branded static map PNG images for use as the location slide in listing
carousels, email headers, and the listing landing page. Uses Google Maps Static API for the
map tile and optionally Geocoding API to resolve an address to lat/lng. Composites the Ryan
Realty wordmark and a custom navy pin marker over the map. Outputs a 1080x1080 square and a
1200x628 landscape variant. Does NOT produce interactive maps (that is the Next.js
`@react-google-maps/api` component in the web app). Does NOT produce video flyovers
(that is `video_production_skills/google_maps_flyover/SKILL.md`).

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/map_static_card/<listing-slug>/`

---

## 1. Scope

### In scope
- 1080x1080 PNG (IG/FB carousel, feed)
- 1200x628 PNG (email OG image, web listing page header, FB link share)
- Map tile from Google Maps Static API (roadmap, satellite, or terrain)
- Custom navy pin marker at the subject property or neighborhood centroid
- Ryan Realty wordmark overlay in the bottom-right corner
- Optional nearby POI labels (restaurant, park, school icons) via Places API New
- Address label tile at the bottom of the map: `<StreetNumber> <StreetName> · <City>`

### Out of scope
- Interactive maps (use `@react-google-maps/api` in the web app)
- Video flyovers or cinematic aerials (see `google_maps_flyover/SKILL.md`)
- Maps with MLS boundary polygons (see `site-neighborhood-page/SKILL.md` and `lib/map-polygon.ts`)
- Maps that include pricing data overlaid on the tile

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:map_static_card` | `mls_id` or `neighborhood_slug` | Geocoding resolves address to lat/lng if not in listing row |

### Payload schema

```typescript
interface MapStaticCardPayload {
  mls_id?: string                 // MLS number - required unless neighborhood_slug is provided
  neighborhood_slug?: string      // e.g. "nw-crossing" - for neighborhood-level maps
  zoom_level?: number             // 10-18, default 14 (listing) or 13 (neighborhood)
  map_style?: "default" | "satellite" | "terrain"  // default "default"
  show_nearby_pois?: boolean      // default false
  output_sizes?: ("square" | "landscape")[]  // default ["square", "landscape"]
}
```

---

## 3. Brief payload schema

```typescript
interface MapStaticCardActionRow {
  id: string
  action_type: "content:map_static_card"
  target: string                  // e.g. "mls:220198765" or "neighborhood:nw-crossing"
  assigned_producer: "social_media_skills/map_static_card"
  payload: MapStaticCardPayload
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

- `CLAUDE.md` §0 - Data Accuracy. The address displayed on the map card must match the Supabase
  listing row exactly. Never display an address derived from LLM recall.
- `CLAUDE.md` §0.5 - Draft-First, Commit-Last.
- `design_system/ryan-realty/SKILL.md` - navy `#102742`, cream `#faf8f4`, Geist for address label.
- `marketing_brain_skills/research/maps-api-enablement-log.md` - Static Maps and Geocoding are
  confirmed enabled per this log. Routes API is enabled. Places (New) propagated 2026-05-17.

**Step 3 - Resolve the map center**

For a listing (`mls_id` provided):

```sql
SELECT "MlsId", "StreetNumber", "StreetName", "City", "Latitude", "Longitude",
       "ListPrice", "StandardStatus", "ListAgentEmail", "ListAgentFullName"
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

If `Latitude` and `Longitude` are non-null, use them directly. No Geocoding API call needed.

If they are null, call Geocoding API:

```
GET https://maps.googleapis.com/maps/api/geocode/json
  ?address=<StreetNumber>+<StreetName>,+<City>,+OR
  &key=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

Verify the result status is `OK`. Extract `geometry.location.lat` and `geometry.location.lng`.
If the API returns `ZERO_RESULTS` or an error, surface to Matt with the address and error.

For a neighborhood (`neighborhood_slug` provided):

```sql
SELECT slug, display_name, centroid_lat, centroid_lng, city
FROM neighborhood_subdivisions
WHERE slug = '<neighborhood_slug>'
LIMIT 1;
```

If the neighborhood centroid is not in Supabase, use a known Bend neighborhood coordinates
lookup from `marketing_brain_skills/research/bend-market-bible.md` as a fallback. Document
the fallback in `citations.json`.

**Step 4 - Fetch the map tile**

Construct the Static Maps API URL. The key is `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

Square (1080x1080):
```
https://maps.googleapis.com/maps/api/staticmap
  ?center=<lat>,<lng>
  &zoom=<zoom_level>
  &size=1080x1080
  &scale=2
  &maptype=<roadmap|satellite|terrain>
  &markers=color:0x102742|size:mid|<lat>,<lng>
  &style=feature:all|element:labels.text.fill|color:0x102742
  &style=feature:road|element:geometry|color:0xe8e2d4
  &style=feature:water|element:geometry|color:0xb3cde0
  &style=feature:poi|visibility:off
  &key=<API_KEY>
```

Landscape (1200x628): same parameters, change `size=1200x628`.

Download both responses as PNG to `out/map_static_card/<slug>/raw-square.png` and
`out/map_static_card/<slug>/raw-landscape.png`.

Notes:
- `scale=2` returns a 2x image; at 1080 px it will return a 2160x2160 image. Resize down to
  1080 with Sharp after download.
- Map style params are light navy-on-cream treatment: roads are sand, water is muted blue, POIs
  hidden by default.
- If Static Maps returns an error or a blank image (verify by checking file size > 5 KB),
  stop and surface to Matt.

**Step 5 - Composite brand overlays**

Use Sharp (Node) to composite over the raw map tile.

Address label bar (bottom of map):
- Rectangle: `rgba(16, 39, 66, 0.80)` (80% navy), full width, 56 px tall, anchored to bottom edge.
- Text: `<StreetNumber> <StreetName> · <City>`, Geist 500, 18 px, cream `#faf8f4`, left-aligned
  with 20 px left padding.

Ryan Realty wordmark:
- `design_system/ryan-realty/assets/brand/logo-blue.png`
- Place in the bottom-right corner ABOVE the address bar (not inside it).
- Height 24 px, 16 px inset from right and bottom of the address bar's top edge.
- Use the transparent PNG so it floats cleanly over the map.

Property pin:
- The Google Static Maps `markers` param already places a navy pin. No additional composite needed
  unless the default marker color needs fine-tuning. If the marker is invisible against a dark
  satellite tile, add a cream `#faf8f4` halo circle (20 px radius, 40% opacity) under the pin.

**Step 6 - Nearby POIs (optional, show_nearby_pois=true)**

If enabled, call Places API New for up to 5 nearby amenities:

```
POST https://places.googleapis.com/v1/places:searchNearby
Headers: X-Goog-Api-Key: <key>, X-Goog-FieldMask: places.displayName,places.location,places.types
Body: { "locationRestriction": { "circle": { "center": {"latitude": <lat>, "longitude": <lng>}, "radius": 800 } }, "includedTypes": ["restaurant", "park", "school", "coffee_shop"] }
```

Render up to 3 POI name labels at their coordinates on the map. Labels: Geist 400, 12 px,
charcoal `#1A1A1A`, white halo for legibility.

**Step 7 - QA gate**

- Confirm the address bar text matches the Supabase listing row exactly (street number, street name, city).
- Confirm the map center is on or within 200 m of the listed address (spot-check with lat/lng).
- Confirm both square and landscape variants have the address bar and wordmark.
- Confirm the map tile is not blank (file size > 50 KB for a real tile).
- Confirm no banned words in the address bar or any label text.
- Confirm the wordmark is `logo-blue.png` (navy), not the white variant.

**Step 8 - Write citations.json**

```json
[
  {
    "figure": "Map center lat/lng",
    "source": "Supabase listings OR Google Geocoding API",
    "filter": "MlsId='<mls_id>'",
    "column": "Latitude, Longitude",
    "value": "<lat>, <lng>",
    "fetched_at": "<ISO>"
  },
  {
    "figure": "Street address displayed",
    "source": "Supabase listings",
    "filter": "MlsId='<mls_id>'",
    "column": "StreetNumber, StreetName, City",
    "value": "<StreetNumber> <StreetName>, <City>",
    "fetched_at": "<ISO>"
  },
  {
    "figure": "Google Static Maps tile",
    "source": "Google Maps Static API",
    "filter": "center=<lat>,<lng>&zoom=<n>&size=1080x1080",
    "column": "HTTP 200 PNG",
    "value": "confirmed",
    "fetched_at": "<ISO>"
  }
]
```

**Step 9 - Update the action row**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{"draft_path": "out/map_static_card/<slug>/", "sizes": ["square", "landscape"]}'::jsonb
WHERE id = '<action_id>';
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Google Maps Static API | Map tile generation | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Google Geocoding API | Address to lat/lng (if Latitude/Longitude null in listing row) | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Google Places API New | Nearby POI labels (optional) | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Supabase (service role) | Listing address + lat/lng + neighborhood centroid | `SUPABASE_SERVICE_ROLE_KEY` |
| Sharp (Node) | PNG composite: address bar, wordmark overlay | `scripts/composite-social-assets.mjs` |
| `design_system/ryan-realty/assets/brand/logo-blue.png` | Wordmark | local file |

**API cost context** (from `maps-api-enablement-log.md` and `tool-inventory.md` §6):

| API | Cost | Free tier |
|---|---|---|
| Static Maps | $2 / 1,000 requests | 100,000 / month |
| Geocoding | $5 / 1,000 requests | 40,000 / month |
| Places Nearby Search | $32 / 1,000 requests | small credit |

A single render costs approximately $0.002 (Static Maps) + $0.005 (Geocoding, if needed) =
under $0.01 per listing. At 20 listings per month, this is well under $1/month.

---

## 6. Output format

**Draft lands at:** `out/map_static_card/<listing-slug>/`

```
out/map_static_card/<listing-slug>/
├── map-square.png              (1080x1080, IG carousel / feed)
├── map-landscape.png           (1200x628, email OG / web)
├── raw-square.png              (raw map tile before compositing - preserve for debugging)
├── raw-landscape.png           (raw map tile before compositing)
├── citations.json
└── contact-sheet.html
```

**Surface format:**

```
Draft ready: map_static_card - <mls_id or neighborhood_slug> <address or name>

Contact sheet:
  → file:///Users/matthewryan/RyanRealty/out/map_static_card/<slug>/contact-sheet.html

  DELIVERABLES
    map-square.png    - 1080x1080, address bar + wordmark
    map-landscape.png - 1200x628, address bar + wordmark

  VERIFICATION TRACE
    - Address "<StreetNumber> <StreetName>, <City>" - Supabase listings, MlsId='<mls_id>', fetched <ISO>
    - Map center <lat>,<lng> - <Supabase listing OR Geocoding API>, fetched <ISO>
    - Google Static Maps tile - HTTP 200, size <KB>, fetched <ISO>

  citations.json: out/map_static_card/<slug>/citations.json

Reply with one of:
  • approve <slug>          - ready to attach to carousel, email, or listing page
  • revise <slug>: <note>   - e.g. "zoom out one level", "use satellite view"
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
| Static Maps returns error | HTTP 4xx or error JSON | Log the URL (without key). Check API enablement in Cloud Console. Surface to Matt. |
| Geocoding returns ZERO_RESULTS | Address not found | Try with just `<City>, OR`. If still empty, ask Matt for the correct address. |
| Listing not in Supabase | 0 rows from query | Surface to Matt with the MLS ID. |
| Map tile is blank (tiny file) | PNG file size < 5 KB | Likely API quota hit or wrong center. Log and surface. |
| GOOGLE_MAPS_API_KEY missing | 400 from Static Maps | Report: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not in .env.local." |
| Neighborhood centroid not in Supabase | 0 rows from neighborhood_subdivisions | Fall back to bend-market-bible.md neighborhood coordinates. Document fallback in citations.json. |

---

## 10. Related skills and references

**Required reading before executing:**

1. `CLAUDE.md` §0 - Data Accuracy (address and coordinates verified against Supabase)
2. `CLAUDE.md` §0.5 - Draft-First, Commit-Last (non-negotiable)
3. `design_system/ryan-realty/SKILL.md` - brand visual system
4. `marketing_brain_skills/brand-voice/voice_guidelines.md` - voice enforcement for any text
5. `marketing_brain_skills/research/tool-inventory.md` - Google Maps API surface (§6), API keys (§4)
6. `marketing_brain_skills/research/platform-bible.md` - platform specs for map card usage
7. `marketing_brain_skills/research/asset-library-map.md` - registering output after approval
8. `marketing_brain_skills/research/bend-market-bible.md` - Bend neighborhood centroids and context
9. `automation_skills/content_engine/SKILL.md` - content routing
10. `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer
11. `video_production_skills/ANTI_SLOP_MANIFESTO.md` - authenticity gate; address must match listing
12. `video_production_skills/VIRAL_GUARDRAILS.md` - location slides: specific place name increases engagement

**API enablement source:**
- `marketing_brain_skills/research/maps-api-enablement-log.md` - Static Maps enabled (pre-existing),
  Geocoding enabled 2026-05-17, Places (New) enabled 2026-05-17. Keys in `.env.local` confirmed active.

**Related producers:**
- `social_media_skills/comparable_grid/SKILL.md` - map showing comp locations pairs with the grid view
- `social_media_skills/instagram-carousel/SKILL.md` - map card is typically slide 6-8 in a listing carousel
- `social_media_skills/flyer-design/SKILL.md` - map image used as a secondary asset on print flyers
- `video_production_skills/google_maps_flyover/SKILL.md` - for video flyover (separate skill)

**Registry entry:** `marketing_brain_skills/producers/REGISTRY.md` - Section B, row `map_static_card`

## 12. Tool gap suggestions

What would make this 10x better:

1. **Places API (New)** (quota upgrade needed): replace Places Legacy results with the richer New API which returns hours, atmosphere tags, and editorial summaries for better POI label copy.
2. **Heatmap overlay**: for market-data map cards, overlay a price heatmap from market_stats_cache on the satellite basemap to show where values are highest in the neighborhood.
3. **Seasonal satellite imagery toggle**: specify a summer vs. winter satellite image date via the Maps Static API so listings near mountains or rivers always show peak-season greenery.

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

